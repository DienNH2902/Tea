/**
 * ============================================================================
 *  ORDER INTENT UTIL - NHẬN DIỆN "Ý ĐỊNH ĐẶT HÀNG" MỘT CÁCH TẤT ĐỊNH
 * ============================================================================
 * BỐI CẢNH: trước đây, việc "khách vãng lai không được đặt hàng" HOÀN TOÀN
 * dựa vào 2 lớp phòng thủ:
 *   1. `ToolRegistryService.getToolsFor()` không đưa tool `create_order`
 *      cho khách vãng lai (nên LLM không có cách nào GỌI TOOL THẬT).
 *   2. Câu dặn dò trong System Prompt: "nếu khách muốn đặt hàng, hãy nhắc
 *      khách đăng nhập".
 *
 * VẤN ĐỀ: (2) chỉ là 1 "lời khuyên" cho LLM, KHÔNG PHẢI ràng buộc cứng. Với
 * model nhỏ/chạy local, khi không có tool `create_order` để gọi nhưng vẫn
 * "cảm thấy" khách đã cung cấp đủ thông tin (sản phẩm + số lượng), model có
 * thể tự BỊA ra hẳn 1 đoạn xác nhận "đơn hàng của bạn đã được tạo, số
 * lượng X, mã đơn #..." dù KHÔNG hề gọi tool nào (`toolsUsed` rỗng) - đây
 * chính là lỗi đã phát hiện: khách vãng lai vẫn "thấy" như đã đặt hàng
 * thành công, dù thực tế KHÔNG CÓ đơn hàng nào được tạo trong DB.
 *
 * GIẢI PHÁP: đưa quyết định "khách vãng lai muốn đặt hàng thì phải chặn"
 * XUỐNG TẦNG BEHAVIOR TREE (tất định, không phụ thuộc vào việc LLM có
 * "nghe lời" hay không), gồm 2 lớp:
 *   A. `hasOrderPlacementIntent()` - dò NGAY TRONG CÂU GỐC của khách xem có
 *      thể hiện ý định CHỐT ĐƠN/ĐẶT MUA hay không. Nếu có VÀ khách chưa
 *      đăng nhập -> Behavior Tree CHẶN NGAY, trả lời yêu cầu đăng nhập,
 *      KHÔNG cần gọi LLM (xem `guest-wants-to-order.condition.ts` +
 *      `require-login-to-order.node.ts`). Đây là lớp chặn CHÍNH.
 *   B. `looksLikeFakeOrderConfirmation()` - lưới an toàn TẦNG 2: sau khi
 *      Guest Agent đã chạy xong (phòng trường hợp ý định đặt hàng không rõ
 *      ràng ngay trong câu, ví dụ khách chỉ trả lời "ok" sau khi được BOT
 *      hỏi lại), kiểm tra xem câu trả lời cuối cùng có "mùi" 1 xác nhận đơn
 *      hàng GIẢ hay không (trong khi `toolCallLog` không hề có
 *      `create_order`) - nếu có, GHI ĐÈ lại câu trả lời (xem
 *      `guest-fake-order-reply-guard.node.ts`).
 *
 * LƯU Ý QUAN TRỌNG (đã xảy ra thực tế): lỗi hallucination KHÔNG CHỈ xảy ra
 * với khách vãng lai (không có tool). Khách ĐÃ ĐĂNG NHẬP có đầy đủ quyền
 * gọi `create_order`, nhưng model 8B đôi khi vẫn:
 *   - Tự soạn 1 câu "đơn hàng đã tạo thành công" mà HOÀN TOÀN KHÔNG gọi
 *     tool `create_order` ở lượt đó, HOẶC
 *   - CÓ gọi tool, nhưng tool trả về `success: false` (hết hàng/thiếu
 *     thông tin/lỗi hệ thống) mà model đọc sai/bỏ qua kết quả và vẫn báo
 *     "thành công" cho khách.
 * Cả 2 trường hợp trên đều dẫn tới hiện tượng: BOT báo "đặt hàng thành
 * công" nhưng trong DB KHÔNG CÓ đơn hàng nào được tạo. Vì vậy 2 hàm
 * `hasAttemptedCreateOrderCall()` và `hasSuccessfulCreateOrderCall()` phía
 * dưới được dùng ở CẢ 2 nhánh (khách vãng lai lẫn đã đăng nhập) để đối
 * chiếu câu trả lời của model với SỰ THẬT DUY NHẤT đáng tin cậy: kết quả
 * tool `create_order` (`resultSummary` trong `toolCallLog`) - xem thêm
 * `authenticated-order-confirmation-guard.node.ts`.
 * ============================================================================
 */

/** Chuẩn hóa: bỏ dấu tiếng Việt, viết thường - để so khớp không phân biệt dấu. */
function stripDiacritics(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase();
}

// Các cụm từ thể hiện ý định CHỐT ĐƠN/ĐẶT MUA/THANH TOÁN NGAY - khác với
// việc chỉ hỏi thông tin ("còn hàng không", "giá bao nhiêu", "có nên mua
// không") - những câu hỏi thông tin đơn thuần KHÔNG nằm trong danh sách
// này, để tránh chặn nhầm khách chỉ đang tìm hiểu sản phẩm.
const ORDER_INTENT_PHRASES: readonly string[] = [
  'dat hang',
  'dat mua',
  'dat luon',
  'dat gium',
  'dat giup',
  'chot don',
  'chot mua',
  'mua ngay',
  'mua luon',
  'mua gium',
  'mua giup',
  'order ngay',
  'order giup',
  'order gium',
  'xac nhan mua',
  'xac nhan dat',
  'thanh toan don',
  'giao hang cho toi',
  'giao ve dia chi',
  'giao den dia chi',
  'ship cho toi',
  'toi muon dat',
  'em muon dat',
  'cho toi dat',
  'cho em dat',
  'toi can dat',
  'minh muon dat',
];

/**
 * Trả về true nếu câu gốc của khách thể hiện RÕ RÀNG ý định chốt đơn/đặt
 * hàng ngay lập tức (không chỉ hỏi giá/tồn kho/tư vấn chung chung).
 */
export function hasOrderPlacementIntent(rawUserMessage: string): boolean {
  if (!rawUserMessage) return false;
  const normalized = stripDiacritics(rawUserMessage);
  return ORDER_INTENT_PHRASES.some((phrase) => normalized.includes(phrase));
}

// Các cụm từ THƯỜNG xuất hiện khi model "bịa" ra 1 xác nhận đơn hàng GIẢ
// (dù không hề gọi tool `create_order` thật) - dùng làm lưới an toàn tầng 2.
const FAKE_ORDER_CONFIRMATION_PHRASES: readonly string[] = [
  'don hang cua ban da duoc',
  'don hang cua anh da duoc',
  'don hang cua chi da duoc',
  'da dat hang thanh cong',
  'dat hang thanh cong',
  'tao don thanh cong',
  'tao don hang thanh cong',
  'ma don hang',
  'xac nhan don hang',
  'cam on ban da dat hang',
  'cam on anh da dat hang',
  'cam on chi da dat hang',
  'don hang #',
  'order da duoc tao',
  'order created',
  'don hang da duoc ghi nhan',
  'don hang se duoc giao',
];

/**
 * Trả về true nếu văn bản trả lời của BOT có dấu hiệu "bịa" ra 1 xác nhận
 * đơn hàng (chỉ nên gọi hàm này SAU KHI đã xác nhận `toolCallLog` không có
 * `create_order` - hàm này chỉ xét mặt câu chữ, không tự kiểm tra tool).
 */
export function looksLikeFakeOrderConfirmation(replyText: string): boolean {
  if (!replyText) return false;
  const normalized = stripDiacritics(replyText);
  return FAKE_ORDER_CONFIRMATION_PHRASES.some((phrase) =>
    normalized.includes(phrase),
  );
}

/**
 * Dạng rút gọn của `ToolCallLogEntry` - chỉ cần 2 field để kiểm tra, tránh
 * import ngược `ConversationBlackboard` vào file util này (giữ util này
 * không phụ thuộc kiểu dữ liệu ở tầng cao hơn).
 */
interface MinimalToolCallLogEntry {
  toolName: string;
  resultSummary: string;
}

/**
 * Trả về true nếu tool `create_order` đã THỰC SỰ được gọi ở lượt này (bất
 * kể kết quả thành công hay thất bại) - dùng để phân biệt 2 tình huống
 * khác nhau khi phát hiện model "bịa" xác nhận đơn hàng:
 *   - Model bịa ra HOÀN TOÀN, chưa hề gọi tool nào -> chưa có gì xảy ra cả.
 *   - Model CÓ gọi tool nhưng tool trả về THẤT BẠI (hết hàng, thiếu thông
 *     tin, lỗi hệ thống...) mà model lại đọc sai/bỏ qua kết quả đó rồi vẫn
 *     báo "thành công" - đây là lỗi nghiêm trọng hơn (khách tưởng đã đặt
 *     hàng nhưng đơn không hề tồn tại trong DB).
 */
export function hasAttemptedCreateOrderCall(
  toolCallLog: MinimalToolCallLogEntry[],
): boolean {
  return toolCallLog.some((entry) => entry.toolName === 'create_order');
}

/**
 * Trả về true CHỈ KHI tool `create_order` đã được gọi ở lượt này VÀ kết
 * quả trả về thực sự là `success: true` (tức là đơn hàng đã được ghi
 * xuống DB thật trong `ordersService.create()`, xem
 * `create-order.tool.ts`). Đây là nguồn "sự thật" DUY NHẤT được tin tưởng
 * khi quyết định BOT có được phép nói "đơn hàng đã được tạo" hay không -
 * TUYỆT ĐỐI không dựa vào câu chữ mà model tự soạn.
 */
export function hasSuccessfulCreateOrderCall(
  toolCallLog: MinimalToolCallLogEntry[],
): boolean {
  return toolCallLog.some(
    (entry) =>
      entry.toolName === 'create_order' &&
      /"success"\s*:\s*true/.test(entry.resultSummary),
  );
}
