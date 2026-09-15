import { Injectable } from '@nestjs/common';
import { IBehaviorNode } from '../behavior-tree/behavior-tree.types';
import { SequenceNode } from '../behavior-tree/composite/sequence.node';
import { SelectorNode } from '../behavior-tree/composite/selector.node';
import { ConversationBlackboard } from '../blackboard/conversation-blackboard.interface';
import { LoadContextNode } from './nodes/load-context.node';
import { HasAuthenticatedUserCondition } from './nodes/has-authenticated-user.condition';
import { RunAuthenticatedAgentNode } from './nodes/run-authenticated-agent.node';
import { AuthenticatedOrderConfirmationGuardNode } from './nodes/authenticated-order-confirmation-guard.node';
import { RequireLoginToOrderNode } from './nodes/require-login-to-order.node';
import { RunGuestAgentNode } from './nodes/run-guest-agent.node';
import { GuestFakeOrderReplyGuardNode } from './nodes/guest-fake-order-reply-guard.node';
import { HasReplyTextCondition } from './nodes/has-reply-text.condition';
import { FallbackReplyNode } from './nodes/fallback-reply.node';
import { PersistContextNode } from './nodes/persist-context.node';
import { GuestWantsToOrderCondition } from './nodes/guest-want-to-order.condition';

/**
 * ============================================================================
 *  BOT TREE BUILDER - "SƠ ĐỒ" HÀNH VI TỔNG THỂ CỦA BOT
 * ============================================================================
 * Đây là nơi lắp ráp các node đã định nghĩa ở thư mục `tree/nodes/` thành
 * 1 cây hành vi hoàn chỉnh, mô tả CHÍNH XÁC quy trình xử lý 1 tin nhắn của
 * khách, từ đầu tới cuối. Sơ đồ cây như sau:
 *
 *   ROOT = Sequence "XửLýMộtLượtChat"
 *     ├─ 1. Action  : LoadContext            (nạp lịch sử hội thoại cũ)
 *     ├─ 2. Selector: "PhânQuyềnTheoĐăngNhập"
 *     │     ├─ Sequence "AuthenticatedFlow":
 *     │     │     ├─ Condition: HasAuthenticatedUser?
 *     │     │     ├─ Action   : RunAuthenticatedAgent  (đầy đủ Tool, kể cả đặt hàng)
 *     │     │     └─ Action   : AuthenticatedOrderConfirmationGuard (chống hallucination)
 *     │     ├─ Sequence "GuestOrderIntentBlocked" (CHẶN NGAY, không gọi LLM):
 *     │     │     ├─ Condition: GuestWantsToOrder?     (khách vãng lai + có ý định chốt đơn)
 *     │     │     └─ Action   : RequireLoginToOrder    (yêu cầu đăng nhập, câu trả lời CỐ ĐỊNH)
 *     │     └─ Sequence "GuestFlow" (nhánh dự phòng cuối cùng, LUÔN SUCCESS):
 *     │           ├─ Action   : RunGuestAgent          (Tool an toàn cho khách vãng lai)
 *     │           └─ Action   : GuestFakeOrderReplyGuard (lưới an toàn tầng 2 chống hallucination)
 *     ├─ 3. Selector: "ĐảmBảoLuônCóPhảnHồi" (lưới an toàn)
 *     │     ├─ Condition: HasReplyText?
 *     │     └─ Action (dự phòng): FallbackReply
 *     └─ 4. Action  : PersistContext          (lưu lại lịch sử hội thoại)
 *
 * VÌ SAO THÊM NHÁNH "GuestOrderIntentBlocked"? Trước đây, việc "khách vãng
 * lai không đặt hàng được" chỉ dựa vào việc LLM "nghe lời" dặn dò trong
 * System Prompt - nhưng model nhỏ/local đôi khi vẫn tự BỊA ra 1 câu xác
 * nhận đơn hàng GIẢ (có số lượng, có vẻ như đã đặt) dù không hề gọi tool
 * `create_order` (`toolsUsed` vẫn rỗng). Nhánh mới này đưa quyết định
 * "chặn đặt hàng" xuống ĐÚNG TẦNG Behavior Tree - tất định, không phụ
 * thuộc hành vi của LLM: hễ phát hiện khách vãng lai có ý định chốt đơn
 * (`GuestWantsToOrderCondition`), BOT trả lời NGAY bằng 1 câu CỐ ĐỊNH yêu
 * cầu đăng nhập, KHÔNG chạy Agent/gọi LLM cho lượt này nữa. Nhánh
 * `GuestFlow` phía dưới vẫn giữ thêm `GuestFakeOrderReplyGuard` làm lưới
 * an toàn TẦNG 2, phòng trường hợp ý định đặt hàng không đủ rõ ràng để
 * `GuestWantsToOrderCondition` bắt được ngay trong câu hiện tại.
 *
 * VÌ SAO THÊM `AuthenticatedOrderConfirmationGuard`? Lỗi hallucination
 * KHÔNG CHỈ xảy ra ở khách vãng lai. Khách ĐÃ ĐĂNG NHẬP có đầy đủ quyền
 * gọi `create_order`, nhưng model 8B đôi khi vẫn báo "đặt hàng thành công"
 * dù (a) chưa hề gọi tool đó ở lượt này, hoặc (b) có gọi nhưng tool trả về
 * thất bại (hết hàng/thiếu thông tin/lỗi hệ thống) mà model đọc sai kết
 * quả. Cả 2 trường hợp đều khiến khách tưởng đã đặt hàng xong trong khi DB
 * không hề có đơn hàng nào. Node này đối chiếu câu trả lời với
 * `toolCallLog` (sự thật duy nhất) để phát hiện và sửa lại kịp thời.
 *
 * Đúng như yêu cầu ban đầu: Behavior Tree ở đây KHÔNG quyết định "nội dung"
 * BOT nói gì khi TƯ VẤN (việc đó do LLM Agent + Tool đảm nhiệm) - nhưng
 * PHẦN QUYẾT ĐỊNH "CÓ ĐƯỢC PHÉP ĐẶT HÀNG HAY KHÔNG" là 1 quyết định về
 * QUYỀN HẠN, nên hoàn toàn hợp lý khi để Behavior Tree quyết định tất định,
 * dễ đọc, dễ mở rộng thêm nhánh mới (ví dụ sau này thêm nhánh "khách VIP"
 * chỉ cần thêm 1 Sequence[Condition, Action] nữa vào Selector số 2, KHÔNG
 * cần sửa code cũ).
 * ============================================================================
 */
@Injectable()
export class BotTreeBuilderService {
  private readonly tree: IBehaviorNode<ConversationBlackboard>;

  constructor(
    loadContextNode: LoadContextNode,
    hasAuthenticatedUserCondition: HasAuthenticatedUserCondition,
    runAuthenticatedAgentNode: RunAuthenticatedAgentNode,
    authenticatedOrderConfirmationGuardNode: AuthenticatedOrderConfirmationGuardNode,
    guestWantsToOrderCondition: GuestWantsToOrderCondition,
    requireLoginToOrderNode: RequireLoginToOrderNode,
    runGuestAgentNode: RunGuestAgentNode,
    guestFakeOrderReplyGuardNode: GuestFakeOrderReplyGuardNode,
    hasReplyTextCondition: HasReplyTextCondition,
    fallbackReplyNode: FallbackReplyNode,
    persistContextNode: PersistContextNode,
  ) {
    // --- Nhánh 2: định tuyến theo quyền hạn (đăng nhập hay chưa) ---
    const routeByAuth = new SelectorNode<ConversationBlackboard>(
      'RouteByAuth',
      [
        new SequenceNode<ConversationBlackboard>('AuthenticatedFlow', [
          hasAuthenticatedUserCondition,
          runAuthenticatedAgentNode,
          authenticatedOrderConfirmationGuardNode,
        ]),
        // Khách vãng lai thể hiện Ý ĐỊNH ĐẶT HÀNG -> CHẶN NGAY, không gọi
        // LLM, tránh mọi khả năng model bịa ra 1 xác nhận đơn hàng giả.
        new SequenceNode<ConversationBlackboard>('GuestOrderIntentBlocked', [
          guestWantsToOrderCondition,
          requireLoginToOrderNode,
        ]),
        // Nhánh dự phòng CUỐI CÙNG: tư vấn/tra cứu thông thường cho khách
        // vãng lai, kèm lưới an toàn tầng 2 chống hallucination đặt hàng.
        new SequenceNode<ConversationBlackboard>('GuestFlow', [
          runGuestAgentNode,
          guestFakeOrderReplyGuardNode,
        ]),
      ],
    );

    // --- Nhánh 3: lưới an toàn, đảm bảo luôn có câu trả lời ---
    const ensureReply = new SelectorNode<ConversationBlackboard>(
      'EnsureReply',
      [hasReplyTextCondition, fallbackReplyNode],
    );

    // --- Ghép toàn bộ thành 1 Sequence gốc (quy trình 4 bước bắt buộc) ---
    this.tree = new SequenceNode<ConversationBlackboard>('ProcessOneMessage', [
      loadContextNode,
      routeByAuth,
      ensureReply,
      persistContextNode,
    ]);
  }

  /** Lấy cây hành vi đã lắp ráp sẵn, dùng để `.run(blackboard)` */
  getTree(): IBehaviorNode<ConversationBlackboard> {
    return this.tree;
  }
}
