import { Injectable } from '@nestjs/common';
import { TeaService } from 'src/modules/tea/tea.service';

/**
 * ============================================================================
 *  TEA CATALOG CACHE - BỘ NHỚ ĐỆM DANH SÁCH TRÀ (tương đương "localStorage"
 *  phía server, vì backend Node.js KHÔNG có localStorage của trình duyệt)
 * ============================================================================
 * LÝ DO CẦN CACHE:
 *  1. TỐC ĐỘ: mỗi lần BOT cần so khớp tên sản phẩm (đặc biệt là tầng "đối
 *     chiếu câu gốc khách gõ"), nó cần DUYỆT QUA TOÀN BỘ sản phẩm. Nếu mỗi
 *     lần đều truy vấn lại MongoDB (mà `findAll()` giới hạn 10 sản phẩm/lần
 *     gọi, nên phải gọi nhiều lần liên tiếp để gộp đủ), sẽ RẤT CHẬM, nhất
 *     là khi phải làm việc này NHIỀU LẦN trong 1 vòng lặp Agent (mỗi lượt
 *     Agent có thể gọi vài Tool). Cache giúp CHỈ TRUY VẤN DB 1 LẦN rồi dùng
 *     lại cho các lượt gọi Tool tiếp theo trong một khoảng thời gian ngắn.
 *  2. KHÔNG BỊA: vì mọi Tool đều lấy dữ liệu từ ĐÚNG 1 NGUỒN DUY NHẤT (cache
 *     này, được nạp trực tiếp từ MongoDB), BOT không có cách nào "tự nghĩ
 *     ra" 1 sản phẩm không tồn tại - nó chỉ có thể chọn trong danh sách THẬT
 *     đang có trong cache.
 *
 * ĐỘ MỚI CỦA DỮ LIỆU (staleness): cache có hạn dùng (TTL) rất ngắn (15
 * giây) để dữ liệu tồn kho không bị "cũ" quá lâu. Ngoài ra, sau khi
 * `create_order` tạo đơn thành công (làm thay đổi tồn kho thật), Tool đó
 * sẽ tự gọi `invalidate()` để xoá cache ngay lập tức, đảm bảo câu hỏi tiếp
 * theo của khách luôn thấy đúng số tồn kho MỚI NHẤT, không cần đợi hết TTL.
 *
 * GIỚI HẠN CẦN BIẾT: nếu Admin sửa tồn kho qua API `/tea` (PATCH) ở nơi
 * khác trong lúc cache còn hạn, BOT có thể thấy số liệu cũ tối đa 15 giây.
 * Với quy mô đồ án/demo, đây là đánh đổi hợp lý giữa tốc độ và độ mới; nếu
 * cần chính xác tuyệt đối theo thời gian thực, có thể nâng cấp sau bằng
 * cách cho `TeaService` phát sự kiện (EventEmitter) mỗi khi tồn kho đổi,
 * rồi cho cache này lắng nghe sự kiện đó để tự xoá - không cần sửa gì ở
 * các Tool đang dùng cache này.
 */
@Injectable()
export class TeaCatalogCacheService {
  private static readonly CACHE_TTL_MS = 15_000; // 15 giây

  private cachedTeas: any[] | null = null;
  private cachedAtMs = 0;

  constructor(private readonly teaService: TeaService) {}

  /**
   * Lấy TOÀN BỘ danh sách trà, ưu tiên trả từ cache nếu còn "mới" (trong
   * hạn TTL). Nếu cache hết hạn hoặc chưa từng nạp, tự động truy vấn lại
   * MongoDB (gộp nhiều trang vì `findAll` giới hạn 10 sản phẩm/trang).
   */
  async getAllTeas(): Promise<any[]> {
    const now = Date.now();
    const isCacheFresh =
      this.cachedTeas !== null &&
      now - this.cachedAtMs < TeaCatalogCacheService.CACHE_TTL_MS;

    if (isCacheFresh) {
      return this.cachedTeas as any[];
    }

    const firstPage = await this.teaService.findAll(1, 10);
    const allTeas = [...firstPage.data];

    for (let page = 2; page <= firstPage.totalPages; page++) {
      const nextPage = await this.teaService.findAll(page, 10);
      allTeas.push(...nextPage.data);
    }

    this.cachedTeas = allTeas;
    this.cachedAtMs = now;
    return allTeas;
  }

  /**
   * Xoá cache ngay lập tức, bắt buộc lần gọi `getAllTeas()` tiếp theo phải
   * truy vấn lại DB. Gọi hàm này ngay sau khi có thao tác làm thay đổi tồn
   * kho thật (ví dụ sau khi `create_order` tạo đơn thành công).
   */
  invalidate(): void {
    this.cachedTeas = null;
  }
}
