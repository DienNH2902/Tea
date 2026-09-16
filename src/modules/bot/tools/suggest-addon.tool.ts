import { Injectable } from '@nestjs/common';
import { TeaType } from 'src/constants/tea-type.enum';
import { IBotTool, ToolExecutionResult } from './tool.interface';
import { ConversationBlackboard } from '../blackboard/conversation-blackboard.interface';
import { resolveTeaByName } from './tea-search-helper.util';
import { TeaCatalogCacheService } from './tea-catalog-cache.service';
import { teaTypeToVietnamese } from './tea-type-label.util';
import { ResponseTeaDto } from 'src/modules/tea/dto/response-tea.dto';

interface SuggestAddonInput {
  /** Tên sản phẩm chính khách đang chọn mua (CHỈ điền khi không có sẵn
   * trong tin nhắn hiện tại - hệ thống sẽ tự dò trong câu trước). */
  teaName?: string;
  /** Tổng giá trị đơn hàng hiện tại (nếu biết) - để tính có được freeship hay chưa */
  currentOrderTotal?: number;
}

/**
 * ----------------------------------------------------------------------
 * CẤU HÌNH ĐIỀU KIỆN BÁN HÀNG CỦA SHOP (business rules)
 * ----------------------------------------------------------------------
 * Đặt tạm dưới dạng hằng số cho đơn giản. Có thể chuyển thành 1 collection
 * MongoDB riêng cho Admin chỉnh sửa qua giao diện quản trị sau này.
 */
const STORE_POLICY = {
  freeShippingThreshold: 300_000,
  minQuantityPerItem: 1,
  maxQuantityPerItem: 20,
};

/** Bảng gợi ý "loại trà nào hợp mua kèm loại trà nào" */
const PAIRING_SUGGESTION: Record<TeaType, TeaType[]> = {
  [TeaType.GREEN_TEA]: [TeaType.HERBAL_TEA, TeaType.WHITE_TEA],
  [TeaType.BLACK_TEA]: [TeaType.OOLONG_TEA],
  [TeaType.OOLONG_TEA]: [TeaType.BLACK_TEA, TeaType.GREEN_TEA],
  [TeaType.HERBAL_TEA]: [TeaType.GREEN_TEA],
  [TeaType.WHITE_TEA]: [TeaType.GREEN_TEA],
};

/**
 * Tool `suggest_addon`
 * -----------------------------------------------------------------------
 * BẢN TỐI ƯU: trước đây tool này cần model tự cung cấp `teaType` bằng
 * tiếng Anh (dễ gõ sai/không biết map đúng) - giờ chỉ cần TÊN sản phẩm
 * (`teaName`, ưu tiên tự dò trong câu gốc như mọi tool khác). Loại trà để
 * tìm sản phẩm mua kèm được TỰ ĐỘNG suy ra từ chính sản phẩm đã tìm được
 * trong DB (qua cache) - model hoàn toàn không cần biết khái niệm loại trà
 * tiếng Anh là gì.
 */
@Injectable()
export class SuggestAddonTool implements IBotTool {
  readonly name = 'suggest_addon';
  readonly description =
    'Gợi ý sản phẩm mua kèm phù hợp với sản phẩm khách đang chọn, và cho ' +
    'biết điều kiện/ưu đãi bán hàng hiện tại (ví dụ ngưỡng miễn phí vận ' +
    'chuyển). Dùng khi khách hỏi "mua cái này thì cần gì thêm", "có được ' +
    'freeship không", hoặc sau khi khách đã chọn được 1 sản phẩm ưng ý.';

  readonly inputSchema = {
    type: 'object',
    properties: {
      teaName: {
        type: 'string',
        description:
          'Tên sản phẩm chính khách đang chọn mua, CHỈ điền khi tên KHÔNG ' +
          'có sẵn trong tin nhắn hiện tại (hệ thống sẽ tự dò trong câu).',
      },
      currentOrderTotal: {
        type: 'number',
        description: 'Tổng giá trị đơn hàng hiện tại của khách (nếu biết)',
      },
    },
    required: [],
  };

  readonly requiresAuth = false;

  constructor(private readonly catalogCache: TeaCatalogCacheService) {}

  async execute(
    input: SuggestAddonInput,
    blackboard: ConversationBlackboard,
  ): Promise<ToolExecutionResult> {
    const total = input?.currentOrderTotal ?? 0;
    const remainingForFreeShip = Math.max(
      STORE_POLICY.freeShippingThreshold - total,
      0,
    );

    const storePolicy = {
      freeShippingThreshold: STORE_POLICY.freeShippingThreshold,
      isEligibleForFreeShip: remainingForFreeShip === 0,
      amountNeededForFreeShip: remainingForFreeShip,
      minQuantityPerItem: STORE_POLICY.minQuantityPerItem,
      maxQuantityPerItem: STORE_POLICY.maxQuantityPerItem,
    };

    // Tìm sản phẩm chính (nếu có) để suy ra loại trà mua kèm phù hợp
    const resolution = await resolveTeaByName(
      this.catalogCache,
      blackboard.userMessage,
      input?.teaName,
    );

    if (resolution.matchType === 'none' || resolution.matches.length !== 1) {
      // Không xác định được đúng 1 sản phẩm chính -> vẫn trả về điều kiện
      // bán hàng chung, chỉ là không có gợi ý mua kèm cụ thể
      return { data: { addonProducts: [], storePolicy } };
    }

    const mainTea = resolution.matches[0];
    const pairedTypes = PAIRING_SUGGESTION[mainTea.type] ?? [];
    const allTeas = await this.catalogCache.getAllTeas();

    const addonProducts = allTeas
      .filter(
        (t: ResponseTeaDto) =>
          pairedTypes.includes(t.type) &&
          t._id?.toString() !== mainTea._id?.toString() &&
          t.isAvailable &&
          t.stock > 0,
      )
      .slice(0, 4)
      .map((t: ResponseTeaDto) => ({
        name: t.name,
        type: teaTypeToVietnamese(t.type),
        price: t.price,
      }));

    return { data: { addonProducts, storePolicy } };
  }
}
