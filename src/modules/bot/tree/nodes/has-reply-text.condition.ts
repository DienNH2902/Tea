import { Injectable } from '@nestjs/common';
import { ConditionNode } from '../../behavior-tree/nodes/base-node';
import { ConversationBlackboard } from '../../blackboard/conversation-blackboard.interface';

/**
 * HasReplyTextCondition
 * -----------------------------------------------------------------------
 * Kiểm tra xem sau khi chạy Agent, đã có nội dung `replyText` hợp lệ chưa
 * (và không bị đánh dấu lỗi hệ thống). Đây là điều kiện đầu tiên trong
 * SelectorNode "EnsureReply" (lưới an toàn) - nếu đã có câu trả lời tốt
 * thì không cần chạy tới node dự phòng `FallbackReplyNode` nữa.
 */
@Injectable()
export class HasReplyTextCondition extends ConditionNode<ConversationBlackboard> {
  readonly name = 'HasReplyText?';

  check(blackboard: ConversationBlackboard): boolean {
    return !!blackboard.replyText && !blackboard.hadSystemError;
  }
}
