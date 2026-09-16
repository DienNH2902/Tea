import { Injectable, Logger } from '@nestjs/common';
import { ActionNode } from '../../behavior-tree/nodes/base-node';
import { NodeStatus } from '../../behavior-tree/behavior-tree.types';
import { ConversationBlackboard } from '../../blackboard/conversation-blackboard.interface';
import {
  looksLikeFakeOrderConfirmation,
  hasAttemptedCreateOrderCall,
  hasSuccessfulCreateOrderCall,
} from './order-intent.util';

/**
 * AuthenticatedOrderConfirmationGuardNode
 * -----------------------------------------------------------------------
 * BỐI CẢNH (lỗi thực tế đã xảy ra): khách ĐÃ ĐĂNG NHẬP, đặt hàng, BOT trả
 * lời "đơn hàng đã được tạo thành công" - nhưng khi kiểm tra DB thì KHÔNG
 * hề có đơn hàng nào. Nguyên nhân: model 8B chạy local đôi khi:
 *   1. Tự soạn ra câu xác nhận thành công mà KHÔNG hề gọi tool
 *      `create_order` ở lượt đó (bỏ qua luôn bước gọi tool), HOẶC
 *   2. CÓ gọi tool, nhưng tool trả về `success: false` (ví dụ do thiếu địa
 *      chỉ/SĐT, hết hàng, hoặc lỗi hệ thống) mà model đọc sai kết quả JSON
 *      rồi vẫn báo "thành công" cho khách.
 *
 * Node này chạy NGAY SAU `RunAuthenticatedAgentNode`, đối chiếu câu trả
 * lời cuối cùng với `blackboard.toolCallLog` - nguồn dữ liệu THẬT (kết quả
 * tool `create_order` trả về, KHÔNG qua diễn giải của LLM). Nếu câu trả
 * lời "nghe như" đã tạo đơn thành công nhưng thực tế tool chưa từng được
 * gọi, hoặc đã gọi nhưng thất bại, GHI ĐÈ lại câu trả lời để khách không
 * bị hiểu lầm là đã đặt hàng thành công trong khi DB không có gì.
 */
@Injectable()
export class AuthenticatedOrderConfirmationGuardNode extends ActionNode<ConversationBlackboard> {
  readonly name = 'AuthenticatedOrderConfirmationGuard';
  private readonly logger = new Logger(
    AuthenticatedOrderConfirmationGuardNode.name,
  );

  // eslint-disable-next-line @typescript-eslint/require-await
  async run(blackboard: ConversationBlackboard): Promise<NodeStatus> {
    // Node này chỉ có ý nghĩa với khách đã đăng nhập - nhánh khách vãng lai
    // đã có `GuestFakeOrderReplyGuardNode` riêng lo việc này.
    if (!blackboard.isAuthenticated) {
      return NodeStatus.SUCCESS;
    }

    if (!looksLikeFakeOrderConfirmation(blackboard.replyText ?? '')) {
      return NodeStatus.SUCCESS;
    }

    if (hasSuccessfulCreateOrderCall(blackboard.toolCallLog)) {
      // Có bằng chứng THẬT (tool trả về success: true) -> câu trả lời của
      // model là chính xác, không cần can thiệp gì thêm.
      return NodeStatus.SUCCESS;
    }

    if (hasAttemptedCreateOrderCall(blackboard.toolCallLog)) {
      // Model CÓ gọi tool, nhưng tool trả về thất bại mà model lại đọc
      // sai/bỏ qua kết quả rồi vẫn báo "thành công" - lỗi đọc-hiểu kết quả
      // tool, không phải lỗi bịa hoàn toàn từ đầu.
      this.logger.warn(
        `Model báo "đặt hàng thành công" cho khách (session ${blackboard.sessionId}, ` +
          `user ${blackboard.userId}) dù tool create_order VỪA GỌI trả về THẤT BẠI. ` +
          `Ghi đè lại câu trả lời để tránh khách hiểu lầm.`,
      );
    } else {
      // Model bịa ra HOÀN TOÀN - chưa hề gọi tool create_order ở lượt này.
      this.logger.error(
        `NGHIÊM TRỌNG: model báo "đặt hàng thành công" cho khách (session ` +
          `${blackboard.sessionId}, user ${blackboard.userId}) mà KHÔNG HỀ gọi ` +
          `tool create_order ở lượt này. Đơn hàng CHƯA tồn tại trong DB. ` +
          `Ghi đè lại câu trả lời để tránh khách hiểu lầm.`,
      );
    }

    blackboard.replyText =
      'Dạ xin lỗi, đơn hàng của anh/chị CHƯA thực sự được tạo trong hệ thống ' +
      'ạ 🙏 (có thể do thiếu thông tin hoặc lỗi tạm thời). Anh/chị vui lòng ' +
      'nhắn lại đầy đủ sản phẩm, số lượng, địa chỉ giao hàng và số điện thoại ' +
      'để em xử lý đặt hàng lại giúp anh/chị nhé!';

    return NodeStatus.SUCCESS;
  }
}
