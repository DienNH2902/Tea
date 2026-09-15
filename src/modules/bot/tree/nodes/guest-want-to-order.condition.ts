import { Injectable } from '@nestjs/common';
import { ConditionNode } from '../../behavior-tree/nodes/base-node';
import { ConversationBlackboard } from '../../blackboard/conversation-blackboard.interface';
import { hasOrderPlacementIntent } from './order-intent.util';

/**
 * GuestWantsToOrderCondition
 * -----------------------------------------------------------------------
 * Điều kiện TẤT ĐỊNH (không phụ thuộc LLM): khách đang chat là VÃNG LAI
 * (chưa đăng nhập) VÀ câu nhắn hiện tại thể hiện rõ ý định CHỐT ĐƠN/ĐẶT
 * HÀNG NGAY (xem `hasOrderPlacementIntent` trong `order-intent.util.ts`).
 *
 * Khi điều kiện này SUCCESS, `SelectorNode "RouteByAuth"` sẽ chạy tiếp
 * `RequireLoginToOrderNode` NGAY, KHÔNG chạy `RunGuestAgentNode`/gọi LLM -
 * đảm bảo khách vãng lai KHÔNG BAO GIỜ nhận được 1 câu trả lời trông giống
 * xác nhận đơn hàng (dù thật hay bịa), mà LUÔN được yêu cầu đăng nhập rõ
 * ràng trước khi BOT xử lý tiếp yêu cầu đặt hàng.
 */
@Injectable()
export class GuestWantsToOrderCondition extends ConditionNode<ConversationBlackboard> {
  readonly name = 'GuestWantsToOrder?';

  check(blackboard: ConversationBlackboard): boolean {
    // Phòng thủ: node này chỉ được Selector "RouteByAuth" thử tới sau khi
    // nhánh "đã đăng nhập" đã FAILURE, nhưng vẫn tự kiểm tra lại `isAuthenticated`
    // ở đây cho chắc chắn - tránh vô tình chặn nhầm khách đã đăng nhập nếu
    // cấu trúc cây bị sửa lại thứ tự sau này.
    if (blackboard.isAuthenticated) return false;

    return hasOrderPlacementIntent(blackboard.userMessage);
  }
}
