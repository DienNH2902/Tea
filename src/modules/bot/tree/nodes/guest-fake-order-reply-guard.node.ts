import { Injectable, Logger } from '@nestjs/common';
import { ActionNode } from '../../behavior-tree/nodes/base-node';
import { NodeStatus } from '../../behavior-tree/behavior-tree.types';
import { ConversationBlackboard } from '../../blackboard/conversation-blackboard.interface';
import { looksLikeFakeOrderConfirmation } from './order-intent.util';

/**
 * GuestFakeOrderReplyGuardNode - LƯỚI AN TOÀN TẦNG 2 chống hallucination
 * -----------------------------------------------------------------------
 * `GuestWantsToOrderCondition` (tầng 1) đã chặn phần lớn trường hợp khách
 * vãng lai thể hiện RÕ ràng ý định đặt hàng NGAY TRONG CÂU HIỆN TẠI. Tuy
 * nhiên có những câu không chứa từ khóa đặt hàng rõ ràng (ví dụ khách chỉ
 * trả lời "ok", "vậy chốt vậy" sau khi được BOT hỏi lại, hoặc dựa vào ngữ
 * cảnh nhiều lượt chat trước) mà model VẪN có thể tự bịa ra 1 đoạn xác
 * nhận "đơn hàng đã tạo thành công, số lượng X..." dù KHÔNG hề gọi (và
 * cũng không có quyền gọi) tool `create_order`.
 *
 * Node này chạy NGAY SAU `RunGuestAgentNode`, kiểm tra chéo `toolCallLog`
 * (nguồn dữ liệu THẬT, không qua LLM) với nội dung `replyText` model vừa
 * soạn: nếu phát hiện dấu hiệu "xác nhận đơn hàng" trong lời văn mà
 * `create_order` KHÔNG hề xuất hiện trong `toolCallLog`, GHI ĐÈ lại câu
 * trả lời để khách không bị hiểu lầm là đã đặt hàng thành công.
 */
@Injectable()
export class GuestFakeOrderReplyGuardNode extends ActionNode<ConversationBlackboard> {
  readonly name = 'GuestFakeOrderReplyGuard';
  private readonly logger = new Logger(GuestFakeOrderReplyGuardNode.name);

  // eslint-disable-next-line @typescript-eslint/require-await
  async run(blackboard: ConversationBlackboard): Promise<NodeStatus> {
    // Node này chỉ có ý nghĩa với khách VÃNG LAI - khách đã đăng nhập được
    // phép đặt hàng thật nên không cần (và không được) can thiệp vào đây.
    if (blackboard.isAuthenticated) {
      return NodeStatus.SUCCESS;
    }

    const calledCreateOrder = blackboard.toolCallLog.some(
      (entry) => entry.toolName === 'create_order',
    );

    if (calledCreateOrder) {
      // Về lý thuyết KHÔNG THỂ xảy ra: `ToolRegistryService.getToolsFor()`
      // đã ẩn tool này với khách vãng lai, và `execute()` còn chặn lần 2.
      // Nếu vẫn thấy ở đây, đây là dấu hiệu của 1 lỗi bảo mật nghiêm trọng
      // hơn nhiều so với việc model chỉ "bịa chuyện" - cần log ONLINE ngay
      // để dev kiểm tra lại 2 lớp phòng thủ nói trên.
      this.logger.error(
        `NGHIÊM TRỌNG: tool "create_order" đã được gọi cho khách VÃNG LAI ` +
          `(session ${blackboard.sessionId}) - kiểm tra lại ToolRegistryService.getToolsFor()/execute().`,
      );
      return NodeStatus.SUCCESS;
    }

    if (looksLikeFakeOrderConfirmation(blackboard.replyText ?? '')) {
      this.logger.warn(
        `Model bịa ra 1 xác nhận đơn hàng GIẢ cho khách vãng lai ` +
          `(session ${blackboard.sessionId}) dù KHÔNG hề gọi tool create_order. ` +
          `Ghi đè lại câu trả lời để tránh gây hiểu lầm nghiêm trọng cho khách.`,
      );

      blackboard.replyText =
        'Dạ xin lỗi, đơn hàng này CHƯA thực sự được tạo trong hệ thống ạ - để ' +
        'đặt hàng, anh/chị vui lòng đăng nhập (hoặc đăng ký tài khoản) trước ' +
        'nhé 🙏, sau đó BOT sẽ giúp anh/chị đặt hàng thật ngay trong khung chat này.';
    }

    return NodeStatus.SUCCESS;
  }
}
