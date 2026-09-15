import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { LLM_CLIENT } from './llm-client.provider';
import { ToolRegistryService } from '../tools/tool-registry.service';
import { IBotTool } from '../tools/tool.interface';
import {
  AgentMessage,
  ConversationBlackboard,
} from '../blackboard/conversation-blackboard.interface';

/**
 * Giới hạn số vòng lặp "gọi LLM -> chạy Tool -> gọi lại LLM" tối đa cho 1
 * lượt chat. Đây là "van an toàn" (circuit breaker) để tránh trường hợp
 * LLM cứ liên tục gọi tool mà không bao giờ chịu trả lời (do model local
 * nhỏ hơn Claude nên đôi khi kém "kỷ luật" hơn), tránh treo máy vô thời hạn.
 */
const MAX_TOOL_USE_ITERATIONS = 6;

/** Số token tối đa cho mỗi câu trả lời của model */
const MAX_OUTPUT_TOKENS = 1024;

/**
 * LlmAgentService
 * -----------------------------------------------------------------------
 * Bộ não "AI Agent dùng Tool" của BOT: KHÔNG lập trình sẵn if/else để
 * quyết định BOT nói gì/làm gì, mà đưa cho LLM (chạy MIỄN PHÍ qua Ollama
 * trên máy local, xem `llm-client.provider.ts`) một "hộp công cụ" (Tool)
 * và để LLM tự:
 *   - Đọc tin nhắn + lịch sử hội thoại của khách.
 *   - TỰ QUYẾT ĐỊNH có cần gọi Tool nào không, gọi với tham số gì.
 *   - Đọc kết quả Tool trả về, quyết định có cần gọi thêm Tool khác không
 *     (ví dụ: check_stock hết hàng sẽ TỰ ĐỘNG kèm gợi ý thay thế trong cùng
     kết quả, hoặc quyết định gọi thêm suggest_addon để gợi ý mua kèm).
 *   - Cuối cùng tự soạn câu trả lời bằng ngôn ngữ tự nhiên cho khách.
 *
 * Cơ chế "Tool Use" / "Function Calling" theo chuẩn OpenAI Chat Completions
 * API (Ollama tương thích 100% chuẩn này): mỗi vòng lặp, model có thể trả
 * về 1 hoặc nhiều `tool_calls` (yêu cầu gọi tool), ta thực thi các tool đó
 * rồi gửi kết quả ngược lại (role `tool`) cho model ở vòng lặp kế tiếp, cho
 * tới khi model quyết định đã đủ thông tin để trả lời (không còn tool_calls).
 *
 * XỬ LÝ THÊM (quan trọng với model nhỏ/local): đôi khi model KHÔNG gọi tool
 * đúng cơ chế function-calling của API, mà lại "viết ra" 1 đoạn JSON trông
 * giống lệnh gọi tool NGAY TRONG CÂU TRẢ LỜI VĂN BẢN (ví dụ:
 * `{"name": "create_order", "parameters": {...}}`), khiến đoạn JSON
 * đó bị lộ thẳng ra cho khách thấy - rất xấu. `tryExtractFakeToolCall()`
 * phía dưới sẽ phát hiện các trường hợp này và tự động chuyển thành 1 lệnh
 * gọi tool THẬT, để hành vi vẫn đúng dù model "đi sai quy trình".
 */
@Injectable()
export class LlmAgentService {
  private readonly logger = new Logger(LlmAgentService.name);
  private readonly model: string;

  constructor(
    @Inject(LLM_CLIENT) private readonly llmClient: OpenAI,
    private readonly toolRegistry: ToolRegistryService,
    private readonly configService: ConfigService,
  ) {
    // Cho phép đổi model qua biến môi trường mà không cần sửa code.
    // Mặc định dùng `llama3.1` (bản 8B) qua Ollama - miễn phí, chạy local,
    // KHÔNG giới hạn số lượng request. Nhờ các lưới an toàn trong code
    // (ưu tiên dùng câu gốc khách gõ, tự sửa khi model viết tool call giả,
    // cache dữ liệu thật...), model 8B vẫn hoạt động ổn định và không bịa.
    this.model = this.configService.get<string>('LLM_MODEL') ?? 'llama3.1';
  }

  /**
   * Chạy 1 lượt Agent hoàn chỉnh: nhận tin nhắn mới của khách + lịch sử cũ,
   * cho phép LLM gọi Tool nhiều vòng nếu cần, rồi GHI KẾT QUẢ TRỰC TIẾP vào
   * blackboard (`replyText`, `history` được cập nhật, `toolCallLog`...).
   */
  async runAgent(
    systemPrompt: string,
    allowedTools: IBotTool[],
    blackboard: ConversationBlackboard,
  ): Promise<void> {
    // Lịch sử hội thoại (không gồm system message - sẽ thêm riêng mỗi lần gọi)
    const history: AgentMessage[] = [
      ...blackboard.history,
      { role: 'user', content: blackboard.userMessage },
    ];

    const toolSchemas = this.toolRegistry.toToolSchema(allowedTools);
    const allowedToolNames = allowedTools.map((t) => t.name);

    for (let iteration = 0; iteration < MAX_TOOL_USE_ITERATIONS; iteration++) {
      let response;
      try {
        response = await this.llmClient.chat.completions.create({
          model: this.model,
          max_tokens: MAX_OUTPUT_TOKENS,
          // QUAN TRỌNG: đặt temperature THẤP (gần 0) vì đây là tác vụ "trả lời
          // dựa trên dữ liệu thật" (tồn kho, giá...), không phải viết sáng
          // tạo. Nhiệt độ càng cao, model càng dễ "bịa" thay vì bám sát đúng
          // con số trong kết quả Tool vừa trả về - đây chính là nguyên nhân
          // phổ biến khiến model nhỏ/local trả lời sai dù Tool đã đúng.
          temperature: 0.1,
          messages: [
            { role: 'system', content: systemPrompt },
            ...this.toOpenAiMessages(history),
          ],
          tools: toolSchemas.length > 0 ? (toolSchemas as any) : undefined,
        });
      } catch (error: any) {
        // Lỗi gọi API (ví dụ Groq trả 429 do vượt hạn mức free-tier trong
        // phút hiện tại, hoặc lỗi mạng) - KHÔNG để lỗi này làm sập cả
        // request của khách. Đánh dấu lỗi hệ thống để Behavior Tree tự
        // chuyển sang câu trả lời dự phòng (FallbackReplyNode).
        this.logger.error(
          `Lỗi khi gọi LLM API (có thể do vượt rate limit miễn phí, hoặc lỗi mạng): ${error?.message ?? error}`,
        );
        blackboard.hadSystemError = true;
        break;
      }

      const choice = response.choices[0];
      const assistantMessage = choice.message;

      // Log lại để dev có thể kiểm tra Tool thực sự trả về gì, phục vụ
      // debug khi nghi ngờ BOT trả lời sai lệch so với dữ liệu thật.
      this.logger.debug(
        `[Vòng ${iteration}] finish_reason=${choice.finish_reason}, content="${assistantMessage.content ?? ''}"`,
      );

      // Phiên bản mới của SDK `openai` cho phép tool_call thuộc nhiều kiểu
      // khác nhau (kiểu "function" - cái ta dùng, và 1 kiểu "custom" khác
      // không có trường `.function`). Ta chỉ quan tâm loại "function", nên
      // lọc + thu hẹp kiểu (type-narrow) ngay tại đây để TypeScript hiểu rõ
      // `tc.function` chắc chắn tồn tại ở các dòng phía dưới.
      const toolCalls = (assistantMessage.tool_calls ?? []).filter(
        (
          tc,
        ): tc is OpenAI.Chat.Completions.ChatCompletionMessageFunctionToolCall =>
          tc.type === 'function',
      );

      if (toolCalls.length === 0) {
        // Model KHÔNG gọi tool đúng cơ chế function-calling. Nhưng trước khi
        // coi đây là câu trả lời cuối cùng, kiểm tra xem model có "viết
        // chui" 1 lệnh gọi tool dưới dạng JSON trong nội dung văn bản hay
        // không (lỗi thường gặp ở model nhỏ/local) - nếu có, tự động sửa
        // thành 1 lệnh gọi tool THẬT thay vì để lộ JSON ra cho khách thấy.
        const fakeToolCall = this.tryExtractFakeToolCall(
          assistantMessage.content ?? '',
          allowedToolNames,
        );

        if (fakeToolCall) {
          this.logger.warn(
            `Model viết tool call "${fakeToolCall.name}" dưới dạng văn bản thay vì gọi thật qua function-calling. Tự động sửa lại thành lệnh gọi tool thật.`,
          );

          // Tạo 1 id giả để ghép cặp assistant/tool message cho đúng cấu
          // trúc hội thoại chuẩn OpenAI (dù lệnh gọi này không đến từ
          // `tool_calls` thật của API, ta vẫn dựng lại đúng khuôn dạng để
          // lịch sử hội thoại nhất quán cho các lượt chat sau).
          const syntheticId = `auto_fix_${Date.now()}`;

          history.push({
            role: 'assistant',
            content: null,
            toolCalls: [
              {
                id: syntheticId,
                name: fakeToolCall.name,
                argumentsJson: JSON.stringify(fakeToolCall.args),
              },
            ],
          });

          const result = await this.toolRegistry.execute(
            fakeToolCall.name,
            fakeToolCall.args,
            blackboard,
          );

          history.push({
            role: 'tool',
            toolCallId: syntheticId,
            content: JSON.stringify(result.data),
          });

          // Không dùng đoạn text rác này làm câu trả lời cuối - quay lại
          // đầu vòng lặp để model soạn 1 câu trả lời SẠCH dựa trên kết quả
          // tool THẬT vừa thực thi.
          continue;
        }

        // Không phát hiện tool call giả -> đây thực sự là câu trả lời cuối
        history.push({
          role: 'assistant',
          content: assistantMessage.content ?? '',
        });
        blackboard.replyText = (assistantMessage.content ?? '').trim();
        break;
      }

      // Model yêu cầu gọi 1 hoặc nhiều Tool trong cùng 1 lượt trả lời ->
      // lưu lại chính xác yêu cầu đó vào lịch sử trước khi thực thi.
      history.push({
        role: 'assistant',
        content: assistantMessage.content ?? null,
        toolCalls: toolCalls.map((tc) => ({
          id: tc.id,
          name: tc.function.name,
          argumentsJson: tc.function.arguments,
        })),
      });

      // Thực thi TỪNG tool được yêu cầu, rồi đẩy kết quả (role `tool`) vào
      // lịch sử, đúng chuẩn giao thức function-calling.
      for (const toolCall of toolCalls) {
        let parsedInput: any = {};
        try {
          parsedInput = JSON.parse(toolCall.function.arguments || '{}');
        } catch {
          // Model đôi khi trả JSON không hợp lệ (hay gặp ở model nhỏ/local
          // hơn là model thương mại lớn) - coi như tham số rỗng, để Tool tự
          // báo "thiếu tham số" và LLM sẽ tự sửa ở vòng lặp kế tiếp.
          this.logger.warn(
            `Không parse được arguments JSON từ tool_call "${toolCall.function.name}": ${toolCall.function.arguments}`,
          );
        }

        const result = await this.toolRegistry.execute(
          toolCall.function.name,
          parsedInput,
          blackboard,
        );

        history.push({
          role: 'tool',
          toolCallId: toolCall.id,
          content: JSON.stringify(result.data),
        });
      }
    }

    // Nếu sau toàn bộ vòng lặp vẫn chưa có replyText (chạm giới hạn
    // MAX_TOOL_USE_ITERATIONS mà model vẫn đòi gọi tool), đánh dấu lỗi hệ
    // thống để node "an toàn" (FallbackReplyNode) trong Behavior Tree xử lý.
    if (!blackboard.replyText) {
      this.logger.warn(
        `Agent đạt giới hạn ${MAX_TOOL_USE_ITERATIONS} vòng lặp tool-use mà chưa có câu trả lời cuối cùng.`,
      );
      blackboard.hadSystemError = true;
    }

    // Lưu lại lịch sử hội thoại đầy đủ (đã bao gồm cả tool call/tool result)
    // để lượt chat tiếp theo của khách vẫn giữ được ngữ cảnh.
    blackboard.history = history;
  }

  /**
   * Dò tìm xem trong đoạn văn bản `text` model trả về có "viết chui" 1 lệnh
   * gọi tool dưới dạng JSON hay không (thay vì gọi đúng qua cơ chế
   * function-calling của API) - lỗi thường gặp ở model nhỏ/local khi chuỗi
   * suy luận dài hoặc model "quên" quy trình chuẩn.
   *
   * Nhận diện các dạng phổ biến: `{"name": "tool_x", "parameters": {...}}`
   * hoặc `{"name": "tool_x", "arguments": {...}}`. Chỉ chấp nhận nếu `name`
   * khớp đúng 1 tool đang được phép dùng (`allowedToolNames`) - tránh nhận
   * nhầm 1 đoạn JSON bất kỳ khác trong câu trả lời của model.
   */
  private tryExtractFakeToolCall(
    text: string,
    allowedToolNames: string[],
  ): { name: string; args: Record<string, unknown> } | null {
    if (!text) return null;

    // Model nhỏ/local đôi khi trả tool call giả với JSON gần đúng nhưng
    // không hoàn toàn hợp lệ, ví dụ:
    //   "phoneNumber": \"089...\"
    // trong khi các dấu \" bên trong chuỗi `items` lại là escape hợp lệ.
    // Vì vậy không được replace `\\"` trên toàn bộ chuỗi: làm vậy sẽ phá
    // chính chuỗi JSON lồng bên trong `items`.
    const jsonBlockMatches = text.match(/\{[\s\S]*\}/g);

    if (!jsonBlockMatches || jsonBlockMatches.length === 0) {
      return null;
    }

    // Thử từ khối cuối cùng trước, giống hành vi cũ. Nếu model có thêm text
    // sau JSON thì vẫn có thể thử các khối trước đó.
    for (let index = jsonBlockMatches.length - 1; index >= 0; index--) {
      const candidate = jsonBlockMatches[index];

      const parsed = this.parseFakeToolJson(candidate);

      if (!parsed) {
        continue;
      }

      const name = parsed.name;

      if (typeof name !== 'string' || !allowedToolNames.includes(name)) {
        continue;
      }

      let args = parsed.parameters ?? parsed.arguments ?? parsed.input ?? {};

      // Một lỗi rất hay gặp của model nhỏ: parameters tự biến thành một
      // JSON STRING thay vì OBJECT. Parse thêm một lần để đưa về đúng input
      // mà ToolRegistry mong đợi.
      if (typeof args === 'string') {
        const parsedArgs = this.parseNestedJson(args);

        if (
          parsedArgs !== null &&
          typeof parsedArgs === 'object' &&
          !Array.isArray(parsedArgs)
        ) {
          args = parsedArgs as Record<string, unknown>;
        }
      }

      if (!args || typeof args !== 'object' || Array.isArray(args)) {
        args = {};
      }

      return {
        name,
        args: args as Record<string, unknown>,
      };
    }

    return null;
  }

  /**
   * Parse JSON tool-call giả và chịu được lỗi escape mà model local thường
   * tạo ra ở các field string bên ngoài chuỗi JSON lồng nhau.
   */
  private parseFakeToolJson(text: string): Record<string, unknown> | null {
    const candidates = [text, this.repairFakeToolJson(text)];

    for (const candidate of candidates) {
      try {
        const parsed: unknown = JSON.parse(candidate);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed as Record<string, unknown>;
        }
      } catch {
        // Thử candidate tiếp theo.
      }
    }

    return null;
  }

  /**
   * Sửa đúng lỗi escape đã thấy ở output thực tế của model:
   *
   *   "phoneNumber": \"0893829963\"
   *
   * nhưng KHÔNG đụng vào các `\"` hợp lệ bên trong `items` dạng JSON string.
   * Chỉ sửa 3 field string mà create_order nhận trực tiếp.
   */
  private repairFakeToolJson(text: string): string {
    return text.replace(
      /("(?:phoneNumber|shippingAddress|note)"\s*:\s*)\\"([\s\S]*?)\\"(?=\s*[,}])/g,
      '$1"$2"',
    );
  }

  /**
   * Parse một JSON value có thể đang được model bọc thành string.
   * Không throw ra ngoài vì đây chỉ là lớp phục hồi output của LLM.
   */
  private parseNestedJson(value: string): unknown | null {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }

  /**
   * Chuyển đổi mảng `AgentMessage` (kiểu nội bộ của module bot) sang đúng
   * định dạng `messages` mà OpenAI SDK/Ollama yêu cầu khi gọi API.
   */
  private toOpenAiMessages(history: AgentMessage[]): any[] {
    return history.map((msg) => {
      if (msg.role === 'assistant') {
        return {
          role: 'assistant',
          content: msg.content,
          tool_calls: msg.toolCalls?.map((tc) => ({
            id: tc.id,
            type: 'function',
            function: { name: tc.name, arguments: tc.argumentsJson },
          })),
        };
      }
      if (msg.role === 'tool') {
        return {
          role: 'tool',
          tool_call_id: msg.toolCallId,
          content: msg.content,
        };
      }
      return { role: 'user', content: msg.content };
    });
  }
}
