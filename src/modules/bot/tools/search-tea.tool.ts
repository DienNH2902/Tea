import { Injectable } from '@nestjs/common';
import { IBotTool, ToolExecutionResult } from './tool.interface';
import { ConversationBlackboard } from '../blackboard/conversation-blackboard.interface';
import { resolveTeaByName } from './tea-search-helper.util';
import { TeaCatalogCacheService } from './tea-catalog-cache.service';
import {
  teaTypeToVietnamese,
  findTeaTypeMentionedInText,
} from './tea-type-label.util';
import { ResponseTeaDto } from 'src/modules/tea/dto/response-tea.dto';

interface SearchTeaInput {
  name?: string;
}

/** Dữ liệu rút gọn của 1 sản phẩm trà, đủ để LLM đọc và tư vấn cho khách */
interface CompactTeaView {
  name: string;
  nameEn: string;
  type: string;
  price: number;
  stock: number;
  isAvailable: boolean;
  description: string;
}

/** Chuẩn hóa 1 sản phẩm trà sang dạng rút gọn - tách ra hàm thuần (không
 * dùng `this`) để có thể truyền thẳng vào `.map()` mà không lo mất ngữ
 * cảnh `this` hay phải `.bind()`. */
function toCompactView(tea: ResponseTeaDto): CompactTeaView {
  return {
    name: tea.name,
    nameEn: tea.nameEn,
    type: teaTypeToVietnamese(tea.type),
    price: tea.price,
    stock: tea.stock,
    isAvailable: tea.isAvailable,
    description: tea.description,
  };
}

/**
 * Tool `search_tea`
 * -----------------------------------------------------------------------
 * CHỈ CÓ ĐÚNG 1 THAM SỐ: `name`. Không còn tham số loại trà (type) tiếng
 * Anh nào để model phải điền nữa - đúng yêu cầu "bỏ tên tiếng Anh, chỉ tìm
 * theo 1 tên duy nhất". Khi khách hỏi kiểu duyệt danh mục ("trà xanh có
 * gì"), hệ thống TỰ NHẬN DIỆN nhãn tiếng Việt ngay trong câu gốc (xem
 * `findTeaTypeMentionedInText` trong `tea-type-label.util.ts`) - model
 * không cần biết chữ tiếng Anh tương ứng là gì.
 */
@Injectable()
export class SearchTeaTool implements IBotTool {
  readonly name = 'search_tea';
  readonly description =
    'Tìm kiếm sản phẩm trà trong cửa hàng theo tên (khớp gần đúng). Dùng ' +
    'khi khách hỏi chung chung về sản phẩm đang bán, ví dụ "có trà sen ' +
    'không", "cửa hàng có những loại trà nào", "trà xanh có gì". Nếu không ' +
    'truyền tham số, trả về danh sách sản phẩm mới nhất.';

  readonly inputSchema = {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description:
          'Tên (hoặc từ khoá) trà cần tìm, CHỈ điền khi tên KHÔNG có sẵn ' +
          'trong tin nhắn hiện tại của khách (hệ thống đã tự dò trong câu).',
      },
    },
    required: [],
  };

  readonly requiresAuth = false;

  constructor(private readonly catalogCache: TeaCatalogCacheService) {}

  async execute(
    input: SearchTeaInput,
    blackboard: ConversationBlackboard,
  ): Promise<ToolExecutionResult> {
    // TẦNG 1-3: tìm theo TÊN sản phẩm (ưu tiên câu gốc, xem tea-search-helper)
    const resolution = await resolveTeaByName(
      this.catalogCache,
      blackboard.userMessage,
      input?.name,
    );

    if (resolution.matchType !== 'none') {
      return {
        data: {
          found: true,
          matchType: resolution.matchType,
          totalResults: resolution.matches.length,
          teas: resolution.matches.map(toCompactView),
        },
      };
    }

    // TẦNG 4: không tìm ra tên sản phẩm cụ thể -> thử nhận diện xem khách
    // có đang hỏi theo LOẠI TRÀ (tiếng Việt) trong câu gốc hay không
    const mentionedType = findTeaTypeMentionedInText(blackboard.userMessage);
    if (mentionedType) {
      const allTeas = await this.catalogCache.getAllTeas();
      const sameType = allTeas.filter(
        (t: ResponseTeaDto) => t.type === mentionedType,
      );
      return {
        data: {
          found: sameType.length > 0,
          matchType: 'by_type',
          totalResults: sameType.length,
          teas: sameType.map(toCompactView),
        },
      };
    }

    if (input?.name) {
      return {
        data: { found: false, message: 'Không tìm thấy sản phẩm phù hợp.' },
      };
    }

    // Không có tên/loại nào được nhắc tới -> trả về TOÀN BỘ danh sách (đã
    // cache sẵn, không cần query DB lại)
    const allTeas = await this.catalogCache.getAllTeas();
    return {
      data: {
        found: true,
        totalResults: allTeas.length,
        teas: allTeas.slice(0, 10).map(toCompactView),
      },
    };
  }
}
