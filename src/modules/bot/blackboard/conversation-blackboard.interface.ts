/**
 * ============================================================================
 *  BLACKBOARD - "BẢNG TIN" DÙNG CHUNG CHO 1 LƯỢT HỘI THOẠI
 * ============================================================================
 * Trong mô hình Behavior Tree, Blackboard là nơi các node đọc/ghi dữ liệu
 * dùng chung với nhau (thay vì phải truyền tham số qua lại lằng nhằng).
 * Mỗi lần khách gửi 1 tin nhắn lên BOT, hệ thống sẽ tạo MỚI 1 Blackboard,
 * cho cây hành vi chạy trên đó, rồi đọc kết quả (replyText) trả về cho khách.
 * ============================================================================
 */

/**
 * Định dạng 1 lệnh gọi Tool mà LLM yêu cầu thực hiện, mô phỏng theo chuẩn
 * "tool_calls" của OpenAI Chat Completions API (chuẩn này cũng chính là
 * chuẩn Ollama dùng, vì Ollama expose API tương thích OpenAI).
 */
export interface ToolCallRequest {
  id: string;
  /** Tên hàm (tool) mà LLM muốn gọi */
  name: string;
  /** Tham số đầu vào, LLM trả về dạng CHUỖI JSON (cần JSON.parse trước khi dùng) */
  argumentsJson: string;
}

/**
 * 1 lượt tin nhắn trong lịch sử hội thoại, theo đúng cấu trúc "messages"
 * của chuẩn OpenAI Chat Completions (system message được thêm riêng ở mỗi
 * lần gọi, KHÔNG lưu trong lịch sử để tránh lặp lại không cần thiết).
 */
export type AgentMessage =
  | { role: 'user'; content: string }
  | {
      role: 'assistant';
      content: string | null;
      toolCalls?: ToolCallRequest[];
    }
  | { role: 'tool'; toolCallId: string; content: string };

/** 1 dòng nhật ký ghi lại việc BOT đã gọi Tool nào, với input/kết quả gì */
export interface ToolCallLogEntry {
  toolName: string;
  input: Record<string, unknown>;
  resultSummary: string;
  calledAt: Date;
}

/**
 * Blackboard chính - dữ liệu dùng chung xuyên suốt quá trình xử lý 1 tin
 * nhắn của khách, từ lúc vào cây hành vi cho tới lúc trả lời xong.
 */
export interface ConversationBlackboard {
  // --- Thông tin phiên chat (để nhớ ngữ cảnh cho các lượt chat sau) ---
  sessionId: string;

  // --- Tin nhắn khách vừa gửi lên ---
  userMessage: string;

  // --- Thông tin định danh khách hàng (phục vụ phân quyền Tool) ---
  isAuthenticated: boolean;
  userId?: string;
  userName?: string;

  // --- Lịch sử hội thoại (định dạng gửi thẳng cho LLM) ---
  history: AgentMessage[];

  // --- Kết quả cuối cùng: nội dung BOT sẽ trả lời khách ---
  replyText?: string;

  // --- Nhật ký các Tool đã được gọi trong lượt này (phục vụ debug) ---
  toolCallLog: ToolCallLogEntry[];

  // --- Cờ đánh dấu có lỗi hệ thống xảy ra hay không (dùng cho node an toàn) ---
  hadSystemError?: boolean;
}
