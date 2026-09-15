import { IBehaviorNode, NodeStatus } from '../behavior-tree.types';

/**
 * SelectorNode ("Bộ chọn / Bộ dự phòng")
 * -----------------------------------------------------------------------
 * Hoạt động giống phép toán OR: thử lần lượt từng node con theo thứ tự
 * ƯU TIÊN từ trên xuống dưới.
 *   - Hễ có 1 node con SUCCESS (hoặc RUNNING) -> Selector DỪNG NGAY và trả
 *     về đúng trạng thái đó, KHÔNG thử các node con phía sau nữa.
 *   - Nếu TẤT CẢ node con đều FAILURE thì Selector mới FAILURE.
 *
 * Đây chính là công cụ để BOT "ra quyết định định tuyến" mà KHÔNG cần viết
 * if/else: ví dụ node đầu tiên là "khách đã đăng nhập?" (Condition) nối với
 * "chạy Agent đầy đủ quyền" (Action); nếu điều kiện đó không thỏa (FAILURE),
 * Selector tự động rơi xuống nhánh dự phòng "chạy Agent khách vãng lai".
 *
 * Ngoài ra Selector còn được dùng làm "lưới an toàn" (safety net): thử xem
 * đã có câu trả lời chưa, nếu chưa thì tự tạo câu trả lời dự phòng, đảm bảo
 * KHÁCH LUÔN NHẬN ĐƯỢC PHẢN HỒI dù có lỗi xảy ra ở bước nào đó phía trước.
 */
export class SelectorNode<TBlackboard = any>
  implements IBehaviorNode<TBlackboard>
{
  constructor(
    public readonly name: string,
    private readonly children: IBehaviorNode<TBlackboard>[],
  ) {}

  async run(blackboard: TBlackboard): Promise<NodeStatus> {
    for (const child of this.children) {
      const status = await child.run(blackboard);

      // Hễ có 1 nhánh chạy được (SUCCESS/RUNNING) -> chọn nhánh đó luôn
      if (status === NodeStatus.SUCCESS || status === NodeStatus.RUNNING) {
        return status;
      }
      // FAILURE -> thử tiếp node con kế tiếp (đây chính là "dự phòng")
    }

    // Không có nhánh nào chạy được
    return NodeStatus.FAILURE;
  }
}
