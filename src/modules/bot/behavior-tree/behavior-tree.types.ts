/**
 * ============================================================================
 *  BEHAVIOR TREE (CÂY HÀNH VI) - KIỂU DỮ LIỆU NỀN TẢNG
 * ============================================================================
 * Behavior Tree là một mô hình rất phổ biến trong Game AI (NPC trong game),
 * Robotics... để điều khiển "hành vi" của một thực thể một cách CÓ CẤU TRÚC,
 * dễ đọc, dễ mở rộng - thay vì viết hàng loạt if/else lồng nhau (rất khó bảo trì).
 *
 * Ý tưởng cốt lõi:
 *  - Cây được ghép từ các NODE (nút).
 *  - Mỗi lần "chạy" (tick), cây sẽ duyệt từ gốc (root) xuống các nhánh con,
 *    mỗi node trả về 1 trong 3 trạng thái: SUCCESS / FAILURE / RUNNING.
 *  - Có 2 loại node "khung" (composite) hay dùng nhất:
 *      + SEQUENCE (giống phép AND): chạy lần lượt từng con, hễ có 1 con FAILURE
 *        thì cả Sequence FAILURE luôn, dừng lại không chạy tiếp.
 *      + SELECTOR (giống phép OR):  chạy lần lượt từng con, hễ có 1 con SUCCESS
 *        thì cả Selector SUCCESS luôn, dừng lại không thử node tiếp theo.
 *        -> Rất hợp để làm "định tuyến" (routing) hoặc "fallback" (dự phòng).
 *  - Ngoài ra còn CONDITION (chỉ kiểm tra điều kiện, không làm gì khác) và
 *    ACTION (thực sự làm 1 việc gì đó, ví dụ: gọi Tool, gọi LLM...).
 *
 * Trong dự án BOT bán chè này, Behavior Tree KHÔNG dùng để quyết định
 * "nội dung" BOT sẽ trả lời khách (việc đó do LLM + Tool đảm nhiệm, xem thư
 * mục `llm/` và `tools/`). Behavior Tree ở đây đóng vai trò "khung xương"
 * điều phối luồng xử lý 1 lượt hội thoại: nạp ngữ cảnh -> phân quyền
 * (khách vãng lai hay đã đăng nhập) -> chạy AI Agent phù hợp -> đảm bảo luôn
 * có câu trả lời (safety net) -> lưu lại lịch sử hội thoại.
 * ============================================================================
 */

/**
 * Trạng thái trả về sau khi 1 node được "chạy" (tick) 1 lần.
 *  - SUCCESS: node hoàn thành tốt đẹp.
 *  - FAILURE: node thất bại (không thỏa điều kiện, hoặc gặp lỗi nghiệp vụ).
 *  - RUNNING: node cần chạy tiếp ở tick sau (không dùng nhiều trong bot chat
 *    dạng request/response, nhưng vẫn khai báo đầy đủ để đúng chuẩn BT,
 *    và có thể tái sử dụng sau này cho các luồng bất đồng bộ dài hơi hơn).
 */
export enum NodeStatus {
  SUCCESS = 'SUCCESS',
  FAILURE = 'FAILURE',
  RUNNING = 'RUNNING',
}

/**
 * Hợp đồng (interface) chung mà MỌI node trong cây phải tuân theo.
 * `TBlackboard` là kiểu dữ liệu của "Blackboard" - bộ nhớ dùng chung mà mọi
 * node đều đọc/ghi được trong suốt 1 lượt xử lý (giống như 1 cái "bảng tin"
 * chung cho cả đội, ai cũng ghi/đọc được).
 */
export interface IBehaviorNode<TBlackboard = any> {
  /** Tên node, chỉ dùng để log/debug cho dễ hiểu, không ảnh hưởng logic */
  readonly name: string;

  /**
   * Hàm thực thi node. Nhận vào blackboard (đọc/ghi dữ liệu dùng chung),
   * trả về trạng thái NodeStatus sau khi chạy xong.
   */
  run(blackboard: TBlackboard): Promise<NodeStatus>;
}
