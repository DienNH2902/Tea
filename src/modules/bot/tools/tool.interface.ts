import { ConversationBlackboard } from '../blackboard/conversation-blackboard.interface';

/**
 * ============================================================================
 *  TOOL (CÔNG CỤ) - TRÁI TIM CỦA KIẾN TRÚC "BOT DÙNG TOOL"
 * ============================================================================
 * Đây chính là phần quan trọng nhất theo yêu cầu: thay vì BOT trả lời bằng
 * cách viết sẵn if/else ("nếu khách hỏi X thì trả lời Y"), ta định nghĩa ra
 * các TOOL (công cụ) - là các HÀM NGHIỆP VỤ THẬT (kiểm kho, tạo đơn hàng...)
 * rồi đưa "danh sách công cụ" này cho LLM (Claude). LLM sẽ tự đọc tin nhắn
 * của khách, TỰ QUYẾT ĐỊNH cần gọi Tool nào, với tham số gì, rồi tự soạn
 * câu trả lời dựa trên KẾT QUẢ THẬT mà Tool trả về.
 *
 * Ưu điểm so với if/else:
 *  - Không cần liệt kê hết mọi câu hỏi có thể xảy ra (là điều bất khả thi).
 *  - LLM hiểu ngôn ngữ tự nhiên linh hoạt hơn regex/keyword rất nhiều.
 *  - Dữ liệu (tồn kho, giá...) vẫn 100% lấy từ Database thật qua Tool, nên
 *    BOT KHÔNG "bịa" (hallucinate) thông tin - đây là điểm mấu chốt để BOT
 *    đóng đúng vai "nhân viên kiểm kho": nó không tự đoán còn hàng hay hết
 *    hàng, mà luôn phải GỌI TOOL để lấy số liệu thật rồi mới được trả lời.
 * ============================================================================
 */

/** Kết quả 1 Tool trả về sau khi thực thi xong */
export interface ToolExecutionResult {
  /**
   * Dữ liệu dạng JSON thuần (object), sẽ được gửi ngược lại cho LLM đọc để
   * LLM tự soạn câu trả lời bằng ngôn ngữ tự nhiên cho khách. KHÔNG viết
   * sẵn câu trả lời ở đây - việc "diễn đạt thành lời" luôn do LLM đảm nhận.
   * Dùng `unknown` thay vì `any` cho GIÁ TRỊ của mỗi field: nội dung cụ thể
   * do từng Tool tự quyết định (có thể là chuỗi, số, mảng, object lồng
   * nhau...), nơi ĐỌC dữ liệu này (chủ yếu là `JSON.stringify()` để gửi
   * cho LLM) không cần và không nên giả định trước kiểu dữ liệu bên trong.
   */
  data: Record<string, unknown>;

  /**
   * true nếu Tool gặp LỖI HỆ THỐNG (ví dụ mất kết nối DB) - khác với "lỗi
   * nghiệp vụ" như hết hàng (hết hàng vẫn coi là chạy Tool THÀNH CÔNG, chỉ
   * là kết quả trả về nói rằng "hết hàng" mà thôi).
   */
  isSystemError?: boolean;
}

/** Hợp đồng chung mà mọi Tool của BOT phải cài đặt */
export interface IBotTool {
  /** Tên Tool, PHẢI trùng khớp với tên mà LLM sẽ gọi (không dấu, snake_case) */
  readonly name: string;

  /**
   * Mô tả Tool bằng tiếng Việt/Anh rõ ràng - đây là phần LLM đọc để quyết
   * định "khi nào nên gọi tool này". Mô tả càng rõ, LLM chọn tool càng đúng.
   */
  readonly description: string;

  /**
   * JSON Schema mô tả các tham số đầu vào của Tool, theo đúng chuẩn mà
   * Anthropic Messages API yêu cầu (trường `input_schema` khi khai báo tool).
   * Dùng `unknown` cho giá trị mỗi field vì cấu trúc JSON Schema lồng nhau
   * nhiều tầng (properties/items/enum...) với kiểu dữ liệu khác nhau ở mỗi
   * tầng - không có lợi ích gì khi ép về 1 kiểu cụ thể ở đây.
   */
  readonly inputSchema: Record<string, unknown>;

  /**
   * true nếu Tool này chỉ dành cho khách ĐÃ ĐĂNG NHẬP (ví dụ: tạo đơn hàng
   * thật, tra cứu đơn hàng cá nhân...). ToolRegistry sẽ dựa vào cờ này để
   * ẩn/hiện Tool tương ứng với từng loại khách (đây chính là nơi Behavior
   * Tree - nhánh "đăng nhập hay chưa" - quyết định "quyền hạn", còn LLM chỉ
   * được lựa chọn trong tập Tool đã được cấp quyền mà thôi).
   */
  readonly requiresAuth: boolean;

  /**
   * Thực thi Tool thật sự, trả về kết quả để LLM đọc.
   * `input` khai báo `unknown` ở tầng hợp đồng chung vì đây là dữ liệu THÔ
   * do LLM tự sinh ra (JSON.parse từ chuỗi arguments) - từng Tool cụ thể sẽ
   * tự khai báo lại kiểu Input riêng của mình (ví dụ `CreateOrderInput`) và
   * tự kiểm tra/ép kiểu dữ liệu ở đầu hàm `execute`, KHÔNG được tin tưởng
   * mù quáng cấu trúc mà LLM gửi lên.
   */
  execute(
    input: unknown,
    blackboard: ConversationBlackboard,
  ): Promise<ToolExecutionResult>;
}
