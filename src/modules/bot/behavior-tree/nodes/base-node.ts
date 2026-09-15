import { IBehaviorNode, NodeStatus } from '../behavior-tree.types';

/**
 * ActionNode - node "LÁ" đại diện cho một HÀNH ĐỘNG thực sự
 * (ví dụ: gọi LLM Agent, lưu lịch sử hội thoại, trả lời fallback...).
 *
 * Class con chỉ cần cài đặt hàm `run()` để thực hiện hành động, rồi tự quyết
 * định trả về SUCCESS hay FAILURE tùy kết quả.
 */
export abstract class ActionNode<
  TBlackboard = any,
> implements IBehaviorNode<TBlackboard> {
  abstract readonly name: string;
  abstract run(blackboard: TBlackboard): Promise<NodeStatus>;
}

/**
 * ConditionNode - node "LÁ" chỉ dùng để KIỂM TRA 1 điều kiện, KHÔNG được
 * phép gây tác dụng phụ (không sửa blackboard, không gọi service ghi dữ liệu).
 *
 * Class con chỉ cần cài đặt hàm `check()` trả về true/false, phần chuyển đổi
 * sang NodeStatus (SUCCESS/FAILURE) đã được lớp cha lo sẵn.
 */
export abstract class ConditionNode<
  TBlackboard = any,
> implements IBehaviorNode<TBlackboard> {
  abstract readonly name: string;

  /** Trả về true nếu điều kiện thỏa mãn, false nếu không */
  abstract check(blackboard: TBlackboard): boolean | Promise<boolean>;

  async run(blackboard: TBlackboard): Promise<NodeStatus> {
    const isSatisfied = await this.check(blackboard);
    return isSatisfied ? NodeStatus.SUCCESS : NodeStatus.FAILURE;
  }
}
