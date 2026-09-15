import { TeaType } from 'src/constants/tea-type.enum';

/**
 * ============================================================================
 *  ÁNH XẠ LOẠI TRÀ SANG TIẾNG VIỆT
 * ============================================================================
 * DB đang lưu `type` bằng tiếng Anh (`TeaType.GREEN_TEA = 'Green Tea'`...) vì
 * đây là dữ liệu gốc của hệ thống Tea/Order sẵn có (không đổi để tránh phải
 * migrate dữ liệu cũ). Nhưng BOT thì KHÔNG ĐƯỢC để lộ hay yêu cầu model phải
 * gõ những chuỗi tiếng Anh này - theo đúng yêu cầu "bỏ tên tiếng Anh của
 * chè". File này là lớp "phiên dịch" 2 chiều:
 *   - Khi trả dữ liệu cho LLM đọc: dùng `teaTypeToVietnamese()` để hiển thị
 *     loại trà bằng tiếng Việt trong kết quả Tool.
 *   - Khi cần TỰ ĐỘNG nhận diện khách đang hỏi về loại trà nào (ví dụ khách
 *     gõ "trà xanh có gì"): dùng `findTeaTypeMentionedInText()` để dò xem
 *     câu gốc có nhắc tới nhãn tiếng Việt nào hay không - HOÀN TOÀN không
 *     cần model phải tự gõ loại trà ra tham số Tool.
 * ============================================================================
 */
export const TEA_TYPE_VI_LABELS: Record<TeaType, string> = {
  [TeaType.GREEN_TEA]: 'Trà xanh',
  [TeaType.BLACK_TEA]: 'Trà đen',
  [TeaType.OOLONG_TEA]: 'Trà Ô Long',
  [TeaType.HERBAL_TEA]: 'Trà thảo mộc',
  [TeaType.WHITE_TEA]: 'Trà trắng',
};

/** Chuyển 1 giá trị TeaType (tiếng Anh) sang nhãn tiếng Việt để hiển thị cho LLM */
export function teaTypeToVietnamese(type: string): string {
  return (TEA_TYPE_VI_LABELS as Record<string, string>)[type] ?? type;
}

/**
 * Chuẩn hóa 1 chuỗi tiếng Việt: bỏ dấu, viết thường - dùng để so khớp
 * không phân biệt dấu (tách riêng ở đây để không phụ thuộc vòng vào
 * `tea-search-helper.util.ts`).
 */
function stripDiacritics(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase();
}

/**
 * Dò xem trong `rawText` (câu gốc khách gõ) có nhắc tới NHÃN TIẾNG VIỆT của
 * loại trà nào hay không (không phân biệt dấu). Dùng làm lưới an toàn cho
 * `search_tea` khi khách hỏi kiểu duyệt danh mục ("trà xanh có gì") thay vì
 * hỏi đích danh 1 sản phẩm - mà KHÔNG CẦN model phải biết/gõ tiếng Anh.
 */
export function findTeaTypeMentionedInText(
  rawText: string,
): TeaType | undefined {
  const normalizedText = stripDiacritics(rawText);

  for (const [type, label] of Object.entries(TEA_TYPE_VI_LABELS)) {
    if (normalizedText.includes(stripDiacritics(label))) {
      return type as TeaType;
    }
  }

  return undefined;
}
