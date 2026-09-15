import { IBehaviorNode, NodeStatus } from '../behavior-tree.types';

/**
 * SequenceNode ("Chuỗi tuần tự")
 * -----------------------------------------------------------------------
 * Hoạt động giống phép toán AND: chạy lần lượt từng node con theo đúng thứ
 * tự khai báo.
 *   - Nếu 1 node con trả về FAILURE hoặc RUNNING -> Sequence DỪNG NGAY LẬP
 *     TỨC và trả về đúng trạng thái đó (không chạy các node con còn lại).
 *   - Chỉ khi TẤT CẢ node con đều SUCCESS thì Sequence mới SUCCESS.
 *
 * Dùng để mô tả 1 "quy trình" gồm nhiều bước bắt buộc phải làm đúng thứ tự,
 * ví dụ: [Nạp ngữ cảnh] -> [Định tuyến & chạy Agent] -> [Đảm bảo có câu trả
 * lời] -> [Lưu lại lịch sử hội thoại].
 */
export class SequenceNode<TBlackboard = any>
  implements IBehaviorNode<TBlackboard>
{
  constructor(
    public readonly name: string,
    private readonly children: IBehaviorNode<TBlackboard>[],
  ) {}

  async run(blackboard: TBlackboard): Promise<NodeStatus> {
    for (const child of this.children) {
      const status = await child.run(blackboard);

      // Hễ có 1 bước không SUCCESS -> dừng cả chuỗi ngay, không chạy tiếp
      if (status !== NodeStatus.SUCCESS) {
        return status;
      }
    }

    // Đi hết toàn bộ node con mà không ai thất bại -> cả chuỗi thành công
    return NodeStatus.SUCCESS;
  }
}
