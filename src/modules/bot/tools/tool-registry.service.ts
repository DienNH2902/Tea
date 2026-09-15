import { Injectable, Logger } from '@nestjs/common';
import { IBotTool, ToolExecutionResult } from './tool.interface';
import { ConversationBlackboard } from '../blackboard/conversation-blackboard.interface';
import { SearchTeaTool } from './search-tea.tool';
import { CheckStockTool } from './check-stock.tool';
import { SuggestAddonTool } from './suggest-addon.tool';
import { AddToCartTool } from './add-to-cart.tool';
import { CreateOrderTool } from './create-order.tool';
import { CheckOrderStatusTool } from './check-order-status.tool';

/**
 * ToolRegistryService
 * -----------------------------------------------------------------------
 * Nơi tập trung TOÀN BỘ danh sách Tool mà BOT sở hữu. Có 3 nhiệm vụ chính:
 *   1. `getToolsFor(blackboard)`: lọc ra tập Tool mà khách HIỆN TẠI được
 *      phép dùng (khách vãng lai sẽ KHÔNG thấy các tool cần đăng nhập như
 *      create_order/check_order_status - đây là nơi thực hiện "phân quyền"
 *      mà Behavior Tree đã định tuyến tới).
 *   2. `toToolSchema(tools)`: chuyển danh sách Tool sang đúng định dạng
 *      JSON mà chuẩn OpenAI/Ollama yêu cầu khi khai báo function-calling.
 *   3. `execute(toolName, input, blackboard)`: khi LLM quyết định gọi 1
 *      Tool, hàm này sẽ LÀM SẠCH tham số đầu vào trước (xem `sanitizeInput`),
 *      rồi tìm đúng Tool đó và thực thi, đồng thời ghi log lại vào
 *      blackboard.toolCallLog để phục vụ debug/theo dõi.
 *
 * Muốn thêm 1 Tool mới cho BOT? Chỉ cần:
 *   - Tạo file tool mới (implements IBotTool) trong thư mục `tools/`.
 *   - Thêm vào constructor của class này.
 *   - Thêm vào mảng `providers` trong `bot.module.ts`.
 * KHÔNG cần sửa gì ở nơi khác (LLM Agent, Behavior Tree...) - đúng tinh
 * thần "mở để mở rộng, đóng để sửa đổi" (Open/Closed Principle).
 */
@Injectable()
export class ToolRegistryService {
  private readonly logger = new Logger(ToolRegistryService.name);
  private readonly allTools: IBotTool[];

  constructor(
    searchTeaTool: SearchTeaTool,
    checkStockTool: CheckStockTool,
    suggestAddonTool: SuggestAddonTool,
    addToCartTool: AddToCartTool,
    createOrderTool: CreateOrderTool,
    checkOrderStatusTool: CheckOrderStatusTool,
  ) {
    this.allTools = [
      searchTeaTool,
      checkStockTool,
      suggestAddonTool,
      addToCartTool,
      createOrderTool,
      checkOrderStatusTool,
    ];
  }

  /** Lấy tập Tool được phép dùng, tùy theo khách đã đăng nhập hay chưa */
  getToolsFor(blackboard: ConversationBlackboard): IBotTool[] {
    return this.allTools.filter(
      (tool) => !tool.requiresAuth || blackboard.isAuthenticated,
    );
  }

  /** Chuyển 1 danh sách Tool sang định dạng khai báo "function calling" của
   * chuẩn OpenAI Chat Completions API (cũng chính là chuẩn Ollama dùng). */
  toToolSchema(tools: IBotTool[]) {
    return tools.map((tool) => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema,
      },
    }));
  }

  /**
   * "LÀM SẠCH" tham số đầu vào do LLM tạo ra, trước khi đưa vào Tool thật.
   * -----------------------------------------------------------------------
   * VẤN ĐỀ THỰC TẾ: các model nhỏ/chạy local (như llama3.1 qua Ollama) đôi
   * khi KHÔNG bỏ trống 1 tham số optional mà khách không đề cập, mà lại
   * điền vào các giá trị "giả null" dạng CHUỖI VĂN BẢN, ví dụ:
   *   { "type": "null" }        (chuỗi "null", không phải giá trị null thật)
   *   { "teaId": "" }           (chuỗi rỗng)
   *   { "note": "undefined" }   (chuỗi "undefined")
   * Nếu không xử lý, code sẽ hiểu nhầm đây là "có giá trị" (vì đó vẫn là 1
   * chuỗi khác rỗng về mặt kỹ thuật), dẫn tới Tool tìm kiếm sai (ví dụ tìm
   * loại trà tên "null" - chắc chắn không khớp gì cả) rồi báo nhầm "không
   * tìm thấy sản phẩm nào" dù dữ liệu trong kho hoàn toàn bình thường.
   *
   * Hàm này quét qua từng field trong input, loại bỏ hẳn field nào có giá
   * trị "giả null" như trên, để Tool coi như KHÔNG được cung cấp tham số
   * đó (rơi về nhánh xử lý mặc định, ví dụ search_tea không có `type` sẽ
   * trả về danh sách sản phẩm mới nhất thay vì tìm loại "null").
   *
   * LƯU Ý VỀ KIỂU DỮ LIỆU: `input` do LLM gửi lên PHẢI là 1 JSON object
   * (đúng chuẩn function-calling: mọi `inputSchema` khai báo `type:
   * 'object'`) - nếu vì lý do gì đó (model lỗi) mà không phải object, coi
   * như KHÔNG có tham số nào (trả về object rỗng), để Tool tự rơi về
   * nhánh xử lý mặc định thay vì crash.
   */
  private sanitizeInput(input: unknown): Record<string, unknown> {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      return {};
    }

    // Các chuỗi được coi là "giả null" - model hay trả về khi không có giá trị
    const NULL_LIKE_STRINGS = new Set([
      'null',
      'undefined',
      'none',
      'n/a',
      'na',
      '',
    ]);

    const cleaned: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(
      input as Record<string, unknown>,
    )) {
      // Bỏ hẳn field có giá trị null/undefined thật
      if (value === null || value === undefined) continue;

      if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (NULL_LIKE_STRINGS.has(normalized)) continue; // bỏ field "giả null"
        cleaned[key] = value; // giữ nguyên chuỗi gốc (không đổi hoa/thường)
        continue;
      }

      // Các kiểu dữ liệu khác (number, boolean, array, object con...) giữ nguyên
      cleaned[key] = value;
    }

    return cleaned;
  }

  /**
   * Thực thi 1 Tool theo tên (do LLM chỉ định), có làm sạch tham số đầu
   * vào và ghi log lại vào blackboard để phục vụ debug và hiển thị "BOT
   * đã làm gì" cho dev xem.
   */
  async execute(
    toolName: string,
    input: unknown,
    blackboard: ConversationBlackboard,
  ): Promise<ToolExecutionResult> {
    const tool = this.allTools.find((t) => t.name === toolName);

    if (!tool) {
      this.logger.warn(`LLM yêu cầu gọi tool không tồn tại: ${toolName}`);
      return {
        data: {
          error: 'unknown_tool',
          message: `Tool "${toolName}" không tồn tại.`,
        },
      };
    }

    // Chặn trường hợp LLM cố tình (hoặc bị "dẫn dụ" qua prompt injection từ
    // nội dung tin nhắn khách) gọi 1 tool yêu cầu đăng nhập trong khi phiên
    // chat hiện tại là khách vãng lai. Đây là lớp bảo vệ thứ 2, độc lập với
    // việc lọc tool ở `getToolsFor` phía trên.
    if (tool.requiresAuth && !blackboard.isAuthenticated) {
      return {
        data: {
          success: false,
          reason: 'not_authenticated',
          message: 'Chức năng này yêu cầu khách đăng nhập trước.',
        },
      };
    }

    // Làm sạch tham số TRƯỚC khi đưa vào Tool thật (xem giải thích ở
    // `sanitizeInput` phía trên) - đây chính là bước sửa lỗi model trả về
    // "null" dạng chuỗi thay vì bỏ trống tham số optional.
    const sanitizedInput = this.sanitizeInput(input);

    try {
      const result = await tool.execute(sanitizedInput, blackboard);

      // Log ra terminal để dev đối chiếu: Tool THẬT SỰ trả về gì, so với
      // việc model có "đọc đúng" dữ liệu đó khi trả lời khách hay không.
      // Nếu thấy `canSell: true` ở đây mà BOT lại trả lời "hết hàng", chắc
      // chắn lỗi nằm ở khả năng đọc-hiểu của model, KHÔNG phải ở Tool/DB.
      this.logger.debug(
        `Tool "${toolName}" input(raw)=${JSON.stringify(input)} input(sanitized)=${JSON.stringify(sanitizedInput)} -> result=${JSON.stringify(result.data)}`,
      );

      blackboard.toolCallLog.push({
        toolName,
        input: sanitizedInput,
        resultSummary: JSON.stringify(result.data).slice(0, 300),
        calledAt: new Date(),
      });

      return result;
    } catch (error) {
      this.logger.error(`Lỗi khi thực thi tool "${toolName}"`, error as Error);
      return {
        data: {
          success: false,
          message: 'Có lỗi hệ thống khi thực hiện thao tác này.',
        },
        isSystemError: true,
      };
    }
  }
}
