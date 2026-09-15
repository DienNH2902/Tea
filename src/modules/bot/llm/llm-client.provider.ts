import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

export const LLM_CLIENT = 'LLM_CLIENT';

/**
 * ============================================================================
 *  LLM CLIENT - MẶC ĐỊNH DÙNG OLLAMA (CHẠY LOCAL, MIỄN PHÍ, KHÔNG GIỚI HẠN)
 * ============================================================================
 * Ưu tiên Ollama vì đây là lựa chọn PHÙ HỢP NHẤT với yêu cầu "miễn phí,
 * không giới hạn số lượng request, không lo bị tính phí dù dùng bao nhiêu":
 * chạy hoàn toàn trên máy bạn, không có khái niệm "rate limit" hay "hết
 * hạn mức" như các dịch vụ cloud (kể cả các dịch vụ free-tier), và không
 * cần Internet sau khi đã tải model về.
 *
 * Ollama expose API tương thích chuẩn OpenAI tại `http://localhost:11434/v1`,
 * nên dùng chung được gói `openai` (SDK chính thức) - chỉ cần trỏ `baseURL`
 * về máy mình, KHÔNG cần API Key thật (Ollama không kiểm tra key).
 *
 * CÀI ĐẶT (1 lần duy nhất, xem thêm BOT_README.md):
 *   1. Tải & cài Ollama tại https://ollama.com
 *   2. `ollama pull llama3.1` (model 8B, hỗ trợ tool-calling, chạy tốt
 *      trên phần cứng phổ thông)
 *   3. Ollama tự chạy nền ở cổng 11434 sau khi cài, không cần bật gì thêm.
 *   4. `npm install openai`
 *
 * MUỐN ĐỔI SANG DỊCH VỤ KHÁC (ví dụ Groq, mạnh hơn nhưng có giới hạn
 * request/phút dù vẫn miễn phí) SAU NÀY? Chỉ cần khai báo đè trong `.env`,
 * KHÔNG cần sửa code:
 *   LLM_BASE_URL=https://api.groq.com/openai/v1
 *   LLM_MODEL=llama-3.3-70b-versatile
 *   LLM_API_KEY=gsk_xxxxxxxxxxxx   (lấy miễn phí tại console.groq.com/keys)
 * ============================================================================
 */
export const LlmClientProvider: Provider = {
  provide: LLM_CLIENT,
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => {
    // Mặc định trỏ về Ollama chạy trên chính máy đang chạy server NestJS.
    const baseURL =
      configService.get<string>('LLM_BASE_URL') ?? 'http://localhost:11434/v1';

    // Ollama KHÔNG kiểm tra API Key, nhưng OpenAI SDK bắt buộc phải truyền
    // 1 chuỗi khác rỗng, nên điền tạm giá trị bất kỳ nếu chưa cấu hình.
    const apiKey = configService.get<string>('LLM_API_KEY') ?? 'ollama-local';

    return new OpenAI({ baseURL, apiKey });
  },
};
