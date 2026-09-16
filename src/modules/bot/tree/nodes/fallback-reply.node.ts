import { Injectable, Logger } from '@nestjs/common';
import { ActionNode } from '../../behavior-tree/nodes/base-node';
import { NodeStatus } from '../../behavior-tree/behavior-tree.types';
import { ConversationBlackboard } from '../../blackboard/conversation-blackboard.interface';

/**
 * FallbackReplyNode - "LƯỚI AN TOÀN" (safety net)
 * -----------------------------------------------------------------------
 * Chỉ được chạy tới khi `HasReplyTextCondition` FAILURE (nghĩa là vì lý do
 * gì đó - lỗi gọi API Claude, hết token, đạt giới hạn vòng lặp tool-use...
 * - mà chưa có câu trả lời hợp lệ). Node này đảm bảo KHÁCH KHÔNG BAO GIỜ
 * nhận về màn hình trắng hay lỗi 500 khó hiểu, mà luôn có 1 câu trả lời
 * lịch sự, đúng tinh thần một nhân viên thật sự khi hệ thống trục trặc.
 */
@Injectable()
export class FallbackReplyNode extends ActionNode<ConversationBlackboard> {
  readonly name = 'FallbackReply';
  private readonly logger = new Logger(FallbackReplyNode.name);

  // eslint-disable-next-line @typescript-eslint/require-await
  async run(blackboard: ConversationBlackboard): Promise<NodeStatus> {
    this.logger.warn(
      `Phải dùng câu trả lời dự phòng cho session ${blackboard.sessionId} (hadSystemError=${blackboard.hadSystemError})`,
    );

    blackboard.replyText =
      'Dạ hiện tại hệ thống tư vấn đang gặp chút trục trặc, ' +
      'anh/chị vui lòng thử lại sau ít phút hoặc liên hệ trực tiếp shop để được hỗ trợ nhanh nhất ạ!';

    return NodeStatus.SUCCESS;
  }
}
