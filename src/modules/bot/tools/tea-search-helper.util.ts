import { TeaCatalogCacheService } from './tea-catalog-cache.service';
import { ResponseTeaDto } from 'src/modules/tea/dto/response-tea.dto';

/**
 * ============================================================================
 *  TEA SEARCH HELPER - TÌM SẢN PHẨM CHỈ THEO 1 TRƯỜNG "TÊN" DUY NHẤT
 * ============================================================================
 * NGUYÊN TẮC: BOT chỉ có ĐÚNG 1 cách để tìm sản phẩm - theo TÊN, nhưng
 * chấp nhận CẢ tên tiếng Việt (`name`) LẪN tên tiếng Anh (`nameEn`) lấy
 * thẳng từ DB (xem `getSearchableNames()` bên dưới) - khách hàng gõ tên
 * nào trong 2 tên cũng tìm ra đúng sản phẩm. KHÔNG có tham số loại trà
 * (type) bằng tiếng Anh nào được đưa cho model điền. Việc "duyệt theo danh
 * mục" (ví dụ khách hỏi "trà xanh có gì") được tự động nhận diện từ NHÃN
 * TIẾNG VIỆT xuất hiện trong câu gốc (xem `tea-type-label.util.ts`).
 *
 * THỨ TỰ ƯU TIÊN khi tìm theo tên (dừng ngay khi có kết quả ở tầng nào):
 *   TẦNG 1 - "from_user_message": tên sản phẩm THẬT (đã bỏ dấu) xuất hiện
 *            dưới dạng chuỗi con bên trong NGUYÊN VĂN câu khách gõ. Đây là
 *            tầng CHÍNH, đáng tin cậy tuyệt đối vì không qua tay model.
 *   TẦNG 2 - "exact": câu gốc không chứa tên nào (khách hỏi tiếp không nhắc
 *            lại tên) -> thử tìm CHÍNH XÁC bằng tên model tự nhớ & cung cấp.
 *   TẦNG 3 - "fuzzy": so khớp gần đúng (Levenshtein, bỏ dấu) trên tên model
 *            cung cấp - phương án cuối cùng.
 *   TẦNG 4 - "by_type": không tìm ra tên sản phẩm cụ thể nào, nhưng câu gốc
 *            có nhắc tới 1 NHÃN LOẠI TRÀ TIẾNG VIỆT (vd "trà xanh") -> trả
 *            về danh sách các sản phẩm cùng loại đó (phục vụ duyệt danh mục).
 * ============================================================================
 */

// ----------------------------------------------------------------------
// CHUẨN HÓA CHUỖI TIẾNG VIỆT (bỏ dấu, viết thường)
// ----------------------------------------------------------------------
const VIETNAMESE_DIACRITICS_MAP: Record<string, string> = {
  à: 'a',
  á: 'a',
  ạ: 'a',
  ả: 'a',
  ã: 'a',
  â: 'a',
  ầ: 'a',
  ấ: 'a',
  ậ: 'a',
  ẩ: 'a',
  ẫ: 'a',
  ă: 'a',
  ằ: 'a',
  ắ: 'a',
  ặ: 'a',
  ẳ: 'a',
  ẵ: 'a',
  è: 'e',
  é: 'e',
  ẹ: 'e',
  ẻ: 'e',
  ẽ: 'e',
  ê: 'e',
  ề: 'e',
  ế: 'e',
  ệ: 'e',
  ể: 'e',
  ễ: 'e',
  ì: 'i',
  í: 'i',
  ị: 'i',
  ỉ: 'i',
  ĩ: 'i',
  ò: 'o',
  ó: 'o',
  ọ: 'o',
  ỏ: 'o',
  õ: 'o',
  ô: 'o',
  ồ: 'o',
  ố: 'o',
  ộ: 'o',
  ổ: 'o',
  ỗ: 'o',
  ơ: 'o',
  ờ: 'o',
  ớ: 'o',
  ợ: 'o',
  ở: 'o',
  ỡ: 'o',
  ù: 'u',
  ú: 'u',
  ụ: 'u',
  ủ: 'u',
  ũ: 'u',
  ư: 'u',
  ừ: 'u',
  ứ: 'u',
  ự: 'u',
  ử: 'u',
  ữ: 'u',
  ỳ: 'y',
  ý: 'y',
  ỵ: 'y',
  ỷ: 'y',
  ỹ: 'y',
  đ: 'd',
};

function normalizeVietnamese(input: string): string {
  return input
    .toLowerCase()
    .split('')
    .map((ch) => VIETNAMESE_DIACRITICS_MAP[ch] ?? ch)
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

// ----------------------------------------------------------------------
// TÌM MỜ (fuzzy) - phương án gần cuối, dùng khoảng cách Levenshtein
// ----------------------------------------------------------------------
function levenshteinDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const matrix: number[][] = Array.from({ length: rows }, () =>
    new Array<number>(cols).fill(0),
  );
  for (let i = 0; i < rows; i++) matrix[i][0] = i;
  for (let j = 0; j < cols; j++) matrix[0][j] = j;
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }
  return matrix[rows - 1][cols - 1];
}

/**
 * Trả về TẤT CẢ các "tên tìm kiếm" hợp lệ của 1 sản phẩm - gồm cả tên
 * tiếng Việt (`name`) LẪN tên tiếng Anh (`nameEn`). Khách hàng có thể gõ
 * bằng bất kỳ tên nào trong 2 tên này (ví dụ "Trà Sen Tây Hồ" hoặc "West
 * Lake"), nên MỌI tầng so khớp bên dưới đều phải thử cả 2 tên, KHÔNG chỉ
 * `name` như trước đây (đây chính là nguyên nhân khiến BOT báo "không xác
 * định được sản phẩm" khi khách gõ đúng tên tiếng Anh).
 */
function getSearchableNames(tea: ResponseTeaDto): string[] {
  return [tea.name, tea.nameEn].filter(
    (n): n is string => typeof n === 'string' && n.trim().length > 0,
  );
}

/** Điểm số khớp CAO NHẤT giữa `query` và bất kỳ tên nào (Việt/Anh) của sản phẩm */
function bestMatchScore(normalizedQuery: string, tea: ResponseTeaDto): number {
  let best = 0;
  for (const rawName of getSearchableNames(tea)) {
    const normalizedName = normalizeVietnamese(rawName);
    let score: number;
    if (
      normalizedName.includes(normalizedQuery) ||
      normalizedQuery.includes(normalizedName)
    ) {
      score = 0.95;
    } else {
      const maxLen = Math.max(normalizedQuery.length, normalizedName.length);
      score =
        maxLen === 0
          ? 1
          : 1 - levenshteinDistance(normalizedQuery, normalizedName) / maxLen;
    }
    if (score > best) best = score;
  }
  return best;
}

function fuzzySearch(
  query: string,
  candidates: ResponseTeaDto[],
  threshold = 0.5,
  maxResults = 3,
): ResponseTeaDto[] {
  const normalizedQuery = normalizeVietnamese(query);
  const scored = candidates.map((item) => ({
    item,
    score: bestMatchScore(normalizedQuery, item),
  }));
  return scored
    .filter((s) => s.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map((s) => s.item);
}

// ----------------------------------------------------------------------
// TÌM THEO CÂU GỐC - TẦNG CHÍNH, đáng tin cậy nhất
// ----------------------------------------------------------------------
function findNamesContainedInText(
  rawText: string,
  candidates: ResponseTeaDto[],
): ResponseTeaDto[] {
  const normalizedText = normalizeVietnamese(rawText);

  // Với MỖI sản phẩm, thử TẤT CẢ tên tìm kiếm của nó (Việt + Anh), giữ lại
  // tên DÀI NHẤT thực sự xuất hiện trong câu (ưu tiên tên dài hơn - khớp
  // đầy đủ hơn, ví dụ ưu tiên "west lake" thay vì trùng khớp 1 từ ngắn tình
  // cờ nào đó trong tên khác).
  const matched = candidates
    .map((item) => {
      const namesFound = getSearchableNames(item)
        .map((n) => normalizeVietnamese(n))
        .filter((n) => n.length > 0 && normalizedText.includes(n));
      const longestNameFound =
        namesFound.length > 0
          ? namesFound.reduce((a, b) => (b.length > a.length ? b : a))
          : null;
      return { item, longestNameFound };
    })
    .filter(
      (m): m is { item: ResponseTeaDto; longestNameFound: string } =>
        m.longestNameFound !== null,
    );

  if (matched.length === 0) return [];

  const maxLen = Math.max(...matched.map((m) => m.longestNameFound.length));
  return matched
    .filter((m) => m.longestNameFound.length === maxLen)
    .map((m) => m.item);
}

// ----------------------------------------------------------------------
// HÀM CHÍNH - GỌI TỪ CÁC TOOL
// ----------------------------------------------------------------------
export type TeaNameMatchType =
  | 'from_user_message'
  | 'exact'
  | 'fuzzy'
  | 'by_type'
  | 'none';

export interface TeaNameResolution {
  matchType: TeaNameMatchType;
  matches: ResponseTeaDto[];
}

/**
 * Tìm sản phẩm CHỈ theo tên - ưu tiên dùng THẲNG câu gốc khách gõ, chỉ dùng
 * tới tên model tự cung cấp (`nameFromModel`) khi câu gốc không chứa tên
 * nào khớp. Nếu vẫn không tìm được sản phẩm cụ thể nào, thử nhận diện xem
 * khách có đang hỏi theo LOẠI TRÀ (tiếng Việt) hay không.
 *
 * @param cache Cache danh sách trà (đọc nhanh từ bộ nhớ, không phải lúc nào
 *   cũng truy vấn DB - xem `tea-catalog-cache.service.ts`)
 * @param rawUserMessage NGUYÊN VĂN tin nhắn khách vừa gõ (không qua model)
 * @param nameFromModel Tên model tự cung cấp (dùng dự phòng, có thể sai dấu)
 * @param allowRawMessageMatch Cho phép dùng tầng 1 hay không (mặc định true;
 *   `create_order` tắt khi đơn có NHIỀU sản phẩm để tránh gán nhầm)
 */
export async function resolveTeaByName(
  cache: TeaCatalogCacheService,
  rawUserMessage: string,
  nameFromModel: string | undefined,
  allowRawMessageMatch = true,
): Promise<TeaNameResolution> {
  const allTeas = await cache.getAllTeas();

  // TẦNG 1 (ưu tiên cao nhất): dùng THẲNG câu gốc khách gõ, không qua model
  if (allowRawMessageMatch) {
    const containedMatches = findNamesContainedInText(
      rawUserMessage,
      allTeas as ResponseTeaDto[],
    );
    if (containedMatches.length > 0) {
      return { matchType: 'from_user_message', matches: containedMatches };
    }
  }

  // TẦNG 2: thử tìm CHÍNH XÁC bằng tên model tự nhớ & cung cấp
  if (nameFromModel) {
    const normalizedTarget = normalizeVietnamese(nameFromModel);
    const exactMatches = allTeas.filter((t) =>
      getSearchableNames(t).some(
        (n) => normalizeVietnamese(n) === normalizedTarget,
      ),
    );
    if (exactMatches.length > 0) {
      return { matchType: 'exact', matches: exactMatches as ResponseTeaDto[] };
    }

    // TẦNG 3: tìm mờ trên chuỗi model cung cấp
    const fuzzyMatches = fuzzySearch(nameFromModel, allTeas);
    if (fuzzyMatches.length > 0) {
      return { matchType: 'fuzzy', matches: fuzzyMatches };
    }
  }

  return { matchType: 'none', matches: [] };
}
