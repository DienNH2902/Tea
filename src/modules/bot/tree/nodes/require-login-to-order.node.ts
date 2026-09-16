import { Injectable, Logger } from '@nestjs/common';
import { ActionNode } from '../../behavior-tree/nodes/base-node';
import { NodeStatus } from '../../behavior-tree/behavior-tree.types';
import { ConversationBlackboard } from '../../blackboard/conversation-blackboard.interface';

/**
 * RequireLoginToOrderNode
 * -----------------------------------------------------------------------
 * Chỉ được chạy tới khi `GuestWantsToOrderCondition` SUCCESS, tức là khách
 * VÃNG LAI vừa thể hiện ý định đặt hàng thật. Node này trả lời NGAY LẬP
 * TỨC bằng 1 câu văn bản CỐ ĐỊNH, KHÔNG gọi LLM/Agent, KHÔNG gọi bất kỳ
 * Tool nào - vì vậy đảm bảo TUYỆT ĐỐI khách không thể nhận nhầm 1 câu trả
 * lời trông giống "đơn hàng đã được tạo" (dù `toolsUsed` vẫn đúng là rỗng,
 * đúng với thực tế chưa có hành động thật nào xảy ra).
 */
@Injectable()
export class RequireLoginToOrderNode extends ActionNode<ConversationBlackboard> {
  readonly name = 'RequireLoginToOrder';
  private readonly logger = new Logger(RequireLoginToOrderNode.name);

  // eslint-disable-next-line @typescript-eslint/require-await
  async run(blackboard: ConversationBlackboard): Promise<NodeStatus> {
    this.logger.debug(
      `Khách vãng lai (session ${blackboard.sessionId}) thể hiện ý định đặt hàng ` +
        `-> chặn ngay ở tầng Behavior Tree, KHÔNG gọi LLM, yêu cầu đăng nhập trước.`,
    );

    blackboard.replyText =
      'Dạ để đặt hàng, anh/chị vui lòng đăng nhập (hoặc đăng ký tài khoản nếu ' +
      'chưa có) trước ạ 🙏. Sau khi đăng nhập, BOT có thể giúp anh/chị chốt đơn ' +
      'ngay trong khung chat này. Trong lúc chờ, em vẫn sẵn sàng tư vấn thêm về ' +
      'sản phẩm, giá cả hay tình trạng tồn kho ạ!';

    return NodeStatus.SUCCESS;
  }
}
