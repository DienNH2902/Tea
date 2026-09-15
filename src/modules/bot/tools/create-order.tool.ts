import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrdersService } from 'src/modules/order/order.service';
import { IBotTool, ToolExecutionResult } from './tool.interface';
import { ConversationBlackboard } from '../blackboard/conversation-blackboard.interface';
import { resolveTeaByName } from './tea-search-helper.util';
import { TeaCatalogCacheService } from './tea-catalog-cache.service';
import { ResponseTeaDto } from 'src/modules/tea/dto/response-tea.dto';

interface CreateOrderItemInput {
  teaName?: string;
  quantity: number;
}

interface CreateOrderInput {
  items: CreateOrderItemInput[];
  shippingAddress?: string;
  phoneNumber?: string;
  note?: string;
}

/**
 * Tool `create_order` (yêu cầu đăng nhập)
 * -----------------------------------------------------------------------
 * Khi khách đặt hàng CHỈ 1 sản phẩm, việc phân giải tên -> ID ưu tiên dùng
 * THẲNG câu gốc khách gõ (đáng tin cậy tuyệt đối). Khi đơn có NHIỀU sản
 * phẩm cùng lúc, dùng tên do model tự cung cấp cho từng item (kèm tìm mờ
 * dự phòng) để tránh nhầm lẫn sản phẩm nọ với sản phẩm kia.
 *
 * XỬ LÝ THÊM (lỗi thực tế đã xảy ra): khi khách nhắc tên sản phẩm ở LƯỢT
 * CHAT TRƯỚC (ví dụ "2 west lake"), rồi lượt này chỉ trả lời thêm SĐT/địa
 * chỉ (không nhắc lại tên sản phẩm), model 8B đôi khi "tách nhầm" 1 sản
 * phẩm thành 2 phần tử trong mảng `items` (ví dụ mỗi phần tử quantity: 1),
 * và QUÊN điền `teaName` cho phần tử thứ 2. Vì tin nhắn HIỆN TẠI không hề
 * chứa tên sản phẩm nữa, các tầng tìm theo câu gốc (TẦNG 1) không giúp
 * được gì. Đoạn "TẦNG GIẢI QUYẾT 2" bên dưới xử lý phòng hờ trường hợp
 * này: nếu 1 phần tử KHÔNG có `teaName` (và không tự tìm ra sản phẩm nào),
 * nhưng TẤT CẢ các phần tử CÒN LẠI trong cùng đơn đều đã xác định rõ ràng
 * và trỏ về CHÍNH XÁC 1 sản phẩm duy nhất, coi như phần tử đó cũng là sản
 * phẩm đó (gộp thêm số lượng) - đúng với cách hiểu tự nhiên "khách chỉ
 * mua 1 loại trà, chẳng qua model liệt kê thành nhiều dòng".
 *
 * SAU KHI tạo đơn thành công, gọi `catalogCache.invalidate()` NGAY LẬP TỨC
 * để xoá cache - đảm bảo câu hỏi tồn kho tiếp theo của khách thấy đúng số
 * liệu MỚI NHẤT (đã bị trừ kho), không phải đợi hết hạn cache (15 giây).
 */
@Injectable()
export class CreateOrderTool implements IBotTool {
  readonly name = 'create_order';
  readonly description =
    'Tạo đơn hàng THẬT cho khách, dựa trên danh sách sản phẩm và số lượng ' +
    'khách muốn mua (theo TÊN sản phẩm). Tool sẽ tự kiểm tra tồn kho và ' +
    'các thông tin còn thiếu (địa chỉ giao hàng, số điện thoại) - nếu ' +
    'thiếu, PHẢI hỏi lại khách rồi gọi lại tool này sau, TUYỆT ĐỐI không tự ' +
    'bịa địa chỉ/SĐT. Chỉ gọi tool này khi khách đã XÁC NHẬN muốn đặt hàng. ' +
    'QUAN TRỌNG: nếu khách mua NHIỀU SỐ LƯỢNG của CÙNG 1 sản phẩm, hãy dùng ' +
    'ĐÚNG 1 phần tử duy nhất trong "items" với "quantity" tương ứng - TUYỆT ' +
    'ĐỐI KHÔNG tách 1 sản phẩm thành nhiều phần tử riêng biệt. Luôn điền ' +
    '"teaName" cho MỌI phần tử, kể cả khi tên sản phẩm chỉ được khách nhắc ' +
    'ở tin nhắn TRƯỚC ĐÓ (không có trong tin nhắn hiện tại) - hãy nhớ lại từ ' +
    'lịch sử hội thoại, TUYỆT ĐỐI không để trống tên sản phẩm.';

  readonly inputSchema = {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        description:
          'Danh sách sản phẩm khách muốn mua. Mỗi sản phẩm CHỈ xuất hiện ' +
          'ĐÚNG 1 lần trong mảng này (gộp số lượng vào "quantity", không ' +
          'lặp lại nhiều phần tử cho cùng 1 sản phẩm).',
        items: {
          type: 'object',
          properties: {
            teaName: {
              type: 'string',
              description:
                'Tên sản phẩm - BẮT BUỘC điền, kể cả khi tên chỉ xuất hiện ' +
                'ở tin nhắn TRƯỚC ĐÓ trong hội thoại (nhớ lại từ lịch sử).',
            },
            quantity: { type: 'number', description: 'Số lượng muốn mua' },
          },
          required: ['teaName', 'quantity'],
        },
      },
      shippingAddress: { type: 'string', description: 'Địa chỉ giao hàng' },
      phoneNumber: { type: 'string', description: 'Số điện thoại người nhận' },
      note: {
        type: 'string',
        description: 'Ghi chú thêm cho đơn hàng (nếu có)',
      },
    },
    required: ['items'],
  };

  readonly requiresAuth = true;

  constructor(
    private readonly ordersService: OrdersService,
    private readonly catalogCache: TeaCatalogCacheService,
  ) {}

  /**
   * Chuẩn hóa `input` THÔ từ LLM về đúng hình dạng `CreateOrderInput` mong
   * muốn - KHÔNG BAO GIỜ được tin tưởng mù quáng rằng model luôn trả đúng
   * cấu trúc JSON Schema đã khai báo.
   *
   * LỖI THỰC TẾ ĐÃ XẢY RA (crash server): model 8B đôi khi gửi `items` là
   * 1 OBJECT đơn lẻ (`{"teaName":"west lake","quantity":2}`) thay vì 1
   * MẢNG chứa 1 phần tử (`[{"teaName":"west lake","quantity":2}]`) khi
   * khách chỉ đặt đúng 1 sản phẩm. Guard cũ `!input.items ||
   * input.items.length === 0` không bắt được trường hợp này (object
   * không có `.length`, nên `length === 0` là `false`, guard bị bỏ qua),
   * khiến `input.items.map(...)` NÉM LỖI TypeError và crash luôn request.
   *
   * Hàm này KHÔNG BAO GIỜ ném lỗi - luôn trả về 1 cấu trúc AN TOÀN để dùng
   * tiếp, "sửa" các lỗi hình dạng dữ liệu thường gặp (object đơn lẻ thay
   * vì mảng 1 phần tử, quantity dạng chuỗi số...). Nếu dữ liệu thực sự
   * không dùng được, trả về `items: []` để rơi vào nhánh `missing_info`
   * phía dưới như bình thường (KHÔNG crash).
   */
  private normalizeInput(rawInput: unknown): CreateOrderInput {
    if (!rawInput || typeof rawInput !== 'object') {
      return { items: [] };
    }

    const obj = rawInput as Record<string, unknown>;
    const rawItems = obj.items;

    // Model nhỏ/local đôi khi serialize mảng `items` thành STRING JSON:
    //   "items": "[{\"teaName\":\"west lake\",\"quantity\":2}]"
    // Trong trường hợp này phải parse thêm 1 lớp trước khi xử lý.
    let normalizedRawItems: unknown = rawItems;
    if (typeof rawItems === 'string') {
      try {
        normalizedRawItems = JSON.parse(rawItems);
      } catch {
        normalizedRawItems = null;
      }
    }

    let rawItemsArray: unknown[];
    if (Array.isArray(normalizedRawItems)) {
      rawItemsArray = normalizedRawItems;
    } else if (normalizedRawItems && typeof normalizedRawItems === 'object') {
      // Model gửi 1 sản phẩm dưới dạng OBJECT thay vì MẢNG 1 phần tử.
      rawItemsArray = [normalizedRawItems];
    } else {
      rawItemsArray = [];
    }

    const items: CreateOrderItemInput[] = rawItemsArray
      .filter(
        (it): it is Record<string, unknown> => !!it && typeof it === 'object',
      )
      .map((it) => {
        const teaName = typeof it.teaName === 'string' ? it.teaName : undefined;
        const rawQuantity = it.quantity;
        const quantity =
          typeof rawQuantity === 'number' && rawQuantity > 0
            ? rawQuantity
            : typeof rawQuantity === 'string' &&
                Number(rawQuantity) > 0 &&
                !Number.isNaN(Number(rawQuantity))
              ? Number(rawQuantity)
              : 1;
        return { teaName, quantity };
      });

    return {
      items,
      shippingAddress:
        typeof obj.shippingAddress === 'string'
          ? obj.shippingAddress
          : undefined,
      phoneNumber:
        typeof obj.phoneNumber === 'string' ? obj.phoneNumber : undefined,
      note: typeof obj.note === 'string' ? obj.note : undefined,
    };
  }

  /**
   * Lấy số lượng rõ ràng từ câu gốc khách gõ, chỉ dùng khi model đã tạo
   * nhiều item nhưng tất cả cùng trỏ về đúng 1 sản phẩm. Đây là lớp bảo vệ
   * chống lỗi model kiểu "2 west lake" -> [{quantity:2},{quantity:2}].
   */
  private extractQuantityFromUserMessage(
    userMessage: string,
    tea: ResponseTeaDto,
  ): number | null {
    const normalize = (value: string) =>
      value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/gi, 'd')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();

    const normalizedMessage = normalize(userMessage);
    const names = [tea.name, tea.nameEn]
      .filter((name): name is string => !!name?.trim())
      .map(normalize)
      .sort((a, b) => b.length - a.length);

    for (const name of names) {
      const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const match = normalizedMessage.match(
        new RegExp(
          `\\b(\\d+(?:[.,]\\d+)?)\\s*(?:goi|hop|tui|chai|kg|gram|g)?\\s*${escapedName}\\b`,
          'i',
        ),
      );

      if (match) {
        const quantity = Number(match[1].replace(',', '.'));
        if (Number.isFinite(quantity) && quantity > 0) {
          return quantity;
        }
      }
    }

    return null;
  }

  async execute(
    rawInput: unknown,
    blackboard: ConversationBlackboard,
  ): Promise<ToolExecutionResult> {
    if (!blackboard.userId) {
      return { data: { success: false, reason: 'not_authenticated' } };
    }

    const input = this.normalizeInput(rawInput);

    if (input.items.length === 0) {
      return {
        data: {
          success: false,
          reason: 'missing_info',
          missingFields: ['items'],
        },
      };
    }

    const missingFields: string[] = [];
    if (!input.shippingAddress) missingFields.push('shippingAddress');
    if (!input.phoneNumber) missingFields.push('phoneNumber');

    if (missingFields.length > 0) {
      return {
        data: {
          success: false,
          reason: 'missing_info',
          missingFields,
          message:
            'Cần hỏi khách bổ sung các thông tin còn thiếu trước khi đặt hàng.',
        },
      };
    }

    // Chỉ dùng câu gốc để đối chiếu khi đơn CHỈ CÓ 1 sản phẩm (an toàn,
    // tránh nhầm lẫn giữa nhiều sản phẩm trong cùng 1 câu).
    const allowRawMessageMatch = input.items.length === 1;

    // TẦNG GIẢI QUYẾT 1: thử phân giải TỪNG item độc lập như bình thường.
    const perItemResolutions = await Promise.all(
      input.items.map((item) =>
        resolveTeaByName(
          this.catalogCache,
          blackboard.userMessage,
          item.teaName,
          allowRawMessageMatch,
        ),
      ),
    );

    // TẦNG GIẢI QUYẾT 2 (lưới an toàn): với các item KHÔNG tìm ra sản phẩm
    // nào (matchType 'none') VÀ vốn KHÔNG được model cung cấp tên (teaName
    // rỗng) - thử "mượn" sản phẩm từ 1 item KHÁC trong CÙNG đơn hàng đã
    // xác định rõ ràng, NẾU (và chỉ nếu) toàn bộ các item còn lại có tên
    // đều trỏ về CHÍNH XÁC 1 sản phẩm duy nhất (an toàn: nếu đơn có ≥2 sản
    // phẩm KHÁC NHAU, tuyệt đối không đoán mò, cứ để hỏi lại khách).
    const namedResolutions = perItemResolutions.filter(
      (r, idx) => !!input.items[idx].teaName?.trim() && r.matches.length > 0,
    );
    const distinctResolvedTeaIds = new Set(
      namedResolutions.flatMap((r) => r.matches.map((t) => t._id)),
    );
    const singleFallbackCandidate =
      namedResolutions.length > 0 &&
      distinctResolvedTeaIds.size === 1 &&
      namedResolutions.every((r) => r.matches.length === 1)
        ? namedResolutions[0].matches[0]
        : null;

    const resolvedItems: { teaId: string; quantity: number }[] = [];
    const notFoundItems: string[] = [];
    const ambiguousItems: { keyword: string; matches: string[] }[] = [];

    input.items.forEach((item, idx) => {
      const resolution = perItemResolutions[idx];
      const hadNoNameFromModel = !item.teaName?.trim();

      if (
        resolution.matchType === 'none' &&
        hadNoNameFromModel &&
        singleFallbackCandidate
      ) {
        // Lưới an toàn TẦNG 2 vừa nêu trên: gộp thêm số lượng vào sản phẩm
        // duy nhất mà các item khác trong đơn đã xác định rõ ràng.
        resolvedItems.push({
          teaId: singleFallbackCandidate._id,
          quantity: item.quantity,
        });
        return;
      }

      if (resolution.matchType === 'none') {
        notFoundItems.push(
          item.teaName ?? '(không xác định được tên sản phẩm)',
        );
      } else if (resolution.matches.length === 1) {
        resolvedItems.push({
          teaId: resolution.matches[0]._id,
          quantity: item.quantity,
        });
      } else {
        ambiguousItems.push({
          keyword: item.teaName ?? blackboard.userMessage,
          matches: resolution.matches.map(
            (m: ResponseTeaDto) => `${m.name} (id: ${m._id})`,
          ),
        });
      }
    });

    // Nếu model vô tình lặp cùng một sản phẩm thành nhiều item, không để
    // lỗi format của model làm số lượng bị nhân lên. Khi câu gốc của khách
    // có một số lượng rõ ràng cho đúng sản phẩm đó, ưu tiên số lượng từ
    // câu gốc (nguồn đáng tin cậy hơn output của model).
    if (resolvedItems.length > 1) {
      const distinctTeaIds = new Set(resolvedItems.map((item) => item.teaId));

      if (distinctTeaIds.size === 1) {
        const teaId = resolvedItems[0].teaId;
        const resolvedTea = perItemResolutions
          .flatMap((resolution) => resolution.matches)
          .find((tea) => tea._id === teaId);

        const requestedQuantity = resolvedTea
          ? this.extractQuantityFromUserMessage(
              blackboard.userMessage,
              resolvedTea,
            )
          : null;

        if (requestedQuantity !== null) {
          resolvedItems.splice(0, resolvedItems.length, {
            teaId,
            quantity: requestedQuantity,
          });
        }
      }
    }

    if (notFoundItems.length > 0 || ambiguousItems.length > 0) {
      return {
        data: {
          success: false,
          reason: 'items_need_clarification',
          notFoundItems,
          ambiguousItems,
          message:
            'Một số sản phẩm không xác định được chính xác, cần hỏi lại khách trước khi tạo đơn.',
        },
      };
    }

    try {
      const order = await this.ordersService.create(
        blackboard.userId,
        {
          items: resolvedItems,
          shippingAddress: input.shippingAddress as string,
          phoneNumber: input.phoneNumber as string,
          note: input.note,
        },
        'bot',
      );

      // Tồn kho vừa bị thay đổi thật (đã trừ kho) -> xoá cache NGAY, không
      // đợi hết hạn TTL, để lượt hỏi tiếp theo của khách luôn thấy đúng.
      this.catalogCache.invalidate();

      return { data: { success: true, order } };
    } catch (error: unknown) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        return {
          data: {
            success: false,
            reason: 'stock_error',
            message: error.message,
          },
        };
      }

      return {
        data: {
          success: false,
          reason: 'system_error',
          message: 'Có lỗi hệ thống khi tạo đơn hàng.',
        },
        isSystemError: true,
      };
    }
  }
}
