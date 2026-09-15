import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { OrdersService } from 'src/modules/order/order.service';
import { IBotTool, ToolExecutionResult } from './tool.interface';
import { ConversationBlackboard } from '../blackboard/conversation-blackboard.interface';

interface CheckOrderStatusInput {
  /** Mã đơn hàng cụ thể khách muốn tra (nếu không có sẽ trả về các đơn gần nhất) */
  orderId?: string;
}

/**
 * Tool `check_order_status` (yêu cầu đăng nhập)
 * -----------------------------------------------------------------------
 * Dùng khi khách hỏi "đơn của tôi tới đâu rồi", "đơn hàng #ABC đã giao chưa".
 */
@Injectable()
export class CheckOrderStatusTool implements IBotTool {
  readonly name = 'check_order_status';
  readonly description =
    'Tra cứu trạng thái đơn hàng của khách đang chat (đã đăng nhập). Nếu ' +
    'không có orderId cụ thể, sẽ trả về danh sách các đơn hàng gần đây nhất ' +
    'của khách để BOT tóm tắt lại.';

  readonly inputSchema = {
    type: 'object',
    properties: {
      orderId: {
        type: 'string',
        description: 'Mã đơn hàng cụ thể cần tra cứu (nếu khách có nhắc tới)',
      },
    },
    required: [],
  };

  readonly requiresAuth = true;

  constructor(private readonly ordersService: OrdersService) {}

  async execute(
    input: CheckOrderStatusInput,
    blackboard: ConversationBlackboard,
  ): Promise<ToolExecutionResult> {
    if (!blackboard.userId) {
      return { data: { success: false, reason: 'not_authenticated' } };
    }

    try {
      // LƯU Ý BẢO MẬT: cố tình KHÔNG dùng thẳng `ordersService.findOne(orderId)`
      // rồi so sánh `order.userId` - vì trường `userId` trong ResponseOrderDto
      // chỉ được điền đúng khi document đã được `populate('userId')` (hiện
      // chỉ `findAllByUserId` mới populate). Nếu so sánh nhầm, có nguy cơ để
      // lộ đơn hàng của khách khác. Vì vậy ta luôn lấy DANH SÁCH đơn hàng
      // CỦA CHÍNH khách đang chat trước, rồi mới lọc theo orderId (nếu có) -
      // đảm bảo BOT chỉ có thể thấy đúng đơn hàng thuộc về khách đó.
      const myOrders = await this.ordersService.getAllOrdersByUserId(
        blackboard.userId,
      );

      if (input?.orderId) {
        const order = myOrders.find((o: any) => o._id === input.orderId);
        if (!order) {
          throw new ForbiddenException();
        }
        return { data: { found: true, order } };
      }

      // Chỉ trả về vài đơn gần nhất để tránh câu trả lời quá dài
      return { data: { found: true, recentOrders: myOrders.slice(0, 5) } };
    } catch (error) {
      if (error instanceof NotFoundException) {
        return { data: { found: false, message: 'Khách chưa có đơn hàng nào.' } };
      }
      if (error instanceof ForbiddenException) {
        return {
          data: { found: false, message: 'Không có quyền xem đơn hàng này.' },
        };
      }
      return {
        data: { found: false, message: 'Có lỗi khi tra cứu đơn hàng.' },
        isSystemError: true,
      };
    }
  }
}
