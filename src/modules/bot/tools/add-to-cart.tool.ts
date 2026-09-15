import { Injectable } from '@nestjs/common';
import { CartService } from 'src/modules/cart/cart.service';
import { IBotTool, ToolExecutionResult } from './tool.interface';
import { ConversationBlackboard } from '../blackboard/conversation-blackboard.interface';

interface AddToCartInput {
  teaId: string;
  note?: string;
}

/**
 * Tool `add_to_cart` (yêu cầu đăng nhập)
 * -----------------------------------------------------------------------
 * Dùng khi khách muốn "lưu lại" 1 sản phẩm để mua sau (giỏ hàng yêu thích),
 * khác với `create_order` là CHỐT ĐƠN mua ngay.
 */
@Injectable()
export class AddToCartTool implements IBotTool {
  readonly name = 'add_to_cart';
  readonly description =
    'Thêm 1 sản phẩm trà vào giỏ hàng yêu thích của khách (để mua sau, ' +
    'chưa phải là chốt đơn hàng ngay). Chỉ dùng cho khách ĐÃ ĐĂNG NHẬP.';

  readonly inputSchema = {
    type: 'object',
    properties: {
      teaId: { type: 'string', description: 'ID sản phẩm trà cần thêm vào giỏ' },
      note: { type: 'string', description: 'Ghi chú của khách cho sản phẩm này (nếu có)' },
    },
    required: ['teaId'],
  };

  readonly requiresAuth = true;

  constructor(private readonly cartService: CartService) {}

  async execute(
    input: AddToCartInput,
    blackboard: ConversationBlackboard,
  ): Promise<ToolExecutionResult> {
    // Phòng thủ: dù ToolRegistry đã lọc theo requiresAuth, vẫn kiểm tra lại
    // cho chắc chắn trước khi thao tác dữ liệu của người dùng.
    if (!blackboard.userId) {
      return { data: { success: false, reason: 'not_authenticated' } };
    }

    try {
      const item = await this.cartService.addToCart(blackboard.userId, {
        teaId: input.teaId,
        note: input.note,
      });
      return { data: { success: true, cartItem: item } };
    } catch (error: any) {
      // Các lỗi nghiệp vụ (đã có trong giỏ, hết hàng...) không phải lỗi hệ thống
      return {
        data: {
          success: false,
          reason: 'business_error',
          message: error?.message ?? 'Không thể thêm vào giỏ hàng.',
        },
      };
    }
  }
}
