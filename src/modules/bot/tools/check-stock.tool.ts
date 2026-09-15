import { Injectable } from '@nestjs/common';
import { IBotTool, ToolExecutionResult } from './tool.interface';
import { ConversationBlackboard } from '../blackboard/conversation-blackboard.interface';
import { resolveTeaByName } from './tea-search-helper.util';
import { TeaCatalogCacheService } from './tea-catalog-cache.service';
import { teaTypeToVietnamese } from './tea-type-label.util';
import { ResponseTeaDto } from 'src/modules/tea/dto/response-tea.dto';

interface CheckStockInput {
  teaName?: string;
}

/** Dữ liệu tồn kho của 1 sản phẩm, đã chuẩn hóa để gửi cho LLM đọc */
interface StockView {
  name: string;
  nameEn: string;
  type: string;
  price: number;
  stock: number;
  isAvailable: boolean;
  canSell: boolean;
}

/** Sản phẩm thay thế gợi ý khi sản phẩm chính hết hàng */
interface AlternativeView {
  name: string;
  price: number;
  stock: number;
}

/**
 * Tool `check_stock`
 * -----------------------------------------------------------------------
 * TOOL QUAN TRỌNG NHẤT của BOT - đóng vai "nhân viên kiểm kho": mọi câu trả
 * lời về tồn kho ĐỀU phải qua đây, dữ liệu 100% lấy từ cache (chính là dữ
 * liệu thật trong MongoDB, xem `tea-catalog-cache.service.ts`) - BOT không
 * có cách nào tự bịa ra 1 sản phẩm hay số tồn kho không có thật.
 *
 * BẢN TỐI ƯU MỚI:
 *  1. Tìm sản phẩm CHỈ theo tên, ưu tiên dùng THẲNG câu gốc khách gõ (xem
 *     `tea-search-helper.util.ts`) - không cần model gõ lại tên.
 *  2. NẾU sản phẩm HẾT HÀNG, tool này TỰ ĐỘNG (ngay trong 1 lần gọi, không
 *     cần LLM gọi thêm tool `suggest_alternative` riêng biệt như trước)
 *     tìm luôn các sản phẩm CÙNG LOẠI đang còn hàng để gợi ý kèm theo. Việc
 *     này giúp: (a) NHANH HƠN vì tiết kiệm 1 vòng gọi LLM, (b) KHÔNG CẦN
 *     model phải biết/gõ loại trà bằng tiếng Anh - vì loại trà được lấy
 *     THẲNG từ chính sản phẩm vừa tìm ra trong DB, không qua model.
 *  3. Trường `type` trả về cho LLM luôn ở dạng TIẾNG VIỆT (qua
 *     `teaTypeToVietnamese()`), để câu trả lời của BOT tự nhiên hơn.
 */
@Injectable()
export class CheckStockTool implements IBotTool {
  readonly name = 'check_stock';
  readonly description =
    'Kiểm tra tồn kho THẬT (số lượng còn lại và trạng thái còn bán hay ' +
    'không) của 1 sản phẩm trà cụ thể, dựa theo tên sản phẩm. BẮT BUỘC ' +
    'phải gọi tool này trước khi khẳng định với khách là "còn hàng" hay ' +
    '"hết hàng" - TUYỆT ĐỐI không được tự đoán tồn kho. Nếu hết hàng, tool ' +
    'sẽ tự động kèm theo gợi ý sản phẩm thay thế cùng loại, không cần gọi ' +
    'thêm tool nào khác cho việc này.';

  readonly inputSchema = {
    type: 'object',
    properties: {
      teaName: {
        type: 'string',
        description:
          'Tên sản phẩm trà cần kiểm tra, CHỈ điền khi tên KHÔNG xuất hiện ' +
          'trong tin nhắn hiện tại của khách (ví dụ khách đang hỏi tiếp về ' +
          'sản phẩm đã nhắc ở tin nhắn trước). Nếu tên đã có sẵn trong tin ' +
          'nhắn hiện tại, có thể để trống tham số này - hệ thống sẽ tự dò.',
      },
    },
    required: [],
  };

  readonly requiresAuth = false;

  constructor(private readonly catalogCache: TeaCatalogCacheService) {}

  async execute(
    input: CheckStockInput,
    blackboard: ConversationBlackboard,
  ): Promise<ToolExecutionResult> {
    const resolution = await resolveTeaByName(
      this.catalogCache,
      blackboard.userMessage,
      input?.teaName,
    );

    if (resolution.matchType === 'none') {
      return {
        data: {
          found: false,
          message: `Không tìm thấy sản phẩm nào khớp với "${input?.teaName ?? blackboard.userMessage}".`,
        },
      };
    }

    const matches = resolution.matches;

    // Nhiều hơn 1 kết quả khớp -> để LLM hỏi lại khách, không tự đoán
    if (matches.length > 1) {
      return {
        data: {
          found: true,
          matchType: resolution.matchType,
          totalResults: matches.length,
          matches: matches.map((t) => this.toStockView(t)),
          note: 'Có nhiều sản phẩm khớp, hãy hỏi lại khách để xác định đúng sản phẩm trước khi trả lời hoặc tạo đơn hàng.',
        },
      };
    }

    // Đúng 1 sản phẩm khớp - đây là trường hợp phổ biến nhất
    const tea = matches[0];
    const canSell = tea.isAvailable && tea.stock > 0;

    const result: {
      found: boolean;
      matchType: string;
      totalResults: number;
      matches: StockView[];
      alternatives?: AlternativeView[];
      hasAlternative?: boolean;
    } = {
      found: true,
      matchType: resolution.matchType,
      totalResults: 1,
      matches: [this.toStockView(tea)],
    };

    // TỰ ĐỘNG gợi ý thay thế nếu hết hàng - KHÔNG cần LLM gọi thêm tool
    // riêng, và KHÔNG cần model biết loại trà là gì (lấy thẳng từ `tea.type`
    // vốn đã có sẵn từ chính sản phẩm vừa tìm được).
    if (!canSell) {
      const allTeas = await this.catalogCache.getAllTeas();
      const alternatives = allTeas.filter(
        (t: ResponseTeaDto) =>
          t.type === tea.type &&
          t._id?.toString() !== tea._id?.toString() &&
          t.isAvailable &&
          t.stock > 0,
      );

      result.alternatives = alternatives.map((t: ResponseTeaDto) => ({
        name: t.name,
        price: t.price,
        stock: t.stock,
      }));
      result.hasAlternative = alternatives.length > 0;
    }

    return { data: result };
  }

  /** Chuẩn hóa dữ liệu tồn kho trả về cho LLM đọc - loại trà luôn tiếng Việt */
  private toStockView(tea: ResponseTeaDto): StockView {
    return {
      name: tea.name,
      nameEn: tea.nameEn,
      type: teaTypeToVietnamese(tea.type),
      price: tea.price,
      stock: tea.stock,
      isAvailable: tea.isAvailable,
      canSell: tea.isAvailable && tea.stock > 0,
    };
  }
}
