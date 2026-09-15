# 🤖 BOT Tư Vấn Bán Chè — Hướng Dẫn Cài Đặt & Sử Dụng

Module `src/modules/bot/` biến dự án bán chè thành 1 hệ thống **tự động hóa**:
thay vì khách (hoặc frontend) phải tự gọi API kiểm tra tồn kho rồi mới tạo
đơn, giờ khách chỉ cần **chat tự nhiên** với BOT — BOT đóng vai "nhân viên
kiểm kho kiêm tư vấn bán hàng", tự kiểm tra dữ liệu thật trong DB rồi mới
trả lời/hành động.

> **100% MIỄN PHÍ:** BOT dùng LLM chạy LOCAL qua **Ollama**, không gọi bất
> kỳ API tính phí nào (không Claude, không GPT trả phí). Phù hợp đồ án
> sinh viên, chạy bao nhiêu tin nhắn cũng không tốn 1 đồng nào.

## 1. Kiến trúc tổng quan

```
Khách nhắn tin
      │
      ▼
BotController (POST /bot/chat hoặc /bot/chat/me)
      │
      ▼
BotService ──► tạo Blackboard (bộ nhớ dùng chung của 1 lượt chat)
      │
      ▼
BEHAVIOR TREE (BotTreeBuilderService) — KHUNG ĐIỀU PHỐI, KHÔNG quyết định nội dung
  Sequence "ProcessOneMessage"
   ├─ LoadContext                       (nạp lịch sử chat cũ)
   ├─ Selector "RouteByAuth"
   │    ├─ [Condition: đã đăng nhập?] → RunAuthenticatedAgent (đủ Tool)
   │    └─ RunGuestAgent (fallback)     (Tool an toàn cho khách vãng lai)
   ├─ Selector "EnsureReply"            (lưới an toàn, luôn có câu trả lời)
   └─ PersistContext                    (lưu lại lịch sử chat)
      │
      ▼ (bên trong RunAuthenticatedAgent / RunGuestAgent)
LLM AGENT (LlmAgentService) — gọi Ollama (LOCAL, MIỄN PHÍ) kèm TOOL USE
      │  Model tự đọc tin nhắn, tự chọn gọi Tool nào, đọc kết quả, lặp lại
      │  tới khi đủ thông tin để tự soạn câu trả lời bằng tiếng Việt.
      ▼
TOOLS (dữ liệu THẬT từ DB, không bịa) — src/modules/bot/tools/
  • search_tea            – tìm sản phẩm
  • check_stock           – kiểm tra tồn kho thật (Tool "kiểm kho" chính)
  • suggest_alternative   – hết hàng thì gợi ý sản phẩm cùng loại còn hàng
  • suggest_addon         – gợi ý mua kèm + điều kiện bán hàng (freeship...)
  • add_to_cart           – thêm giỏ hàng (cần đăng nhập)
  • create_order          – tạo đơn hàng thật, gọi lại OrdersService có sẵn (cần đăng nhập)
  • check_order_status    – tra cứu đơn hàng của khách (cần đăng nhập)
```

**Vì sao không dùng if/else?** Nếu viết if/else, bạn phải liệt kê trước MỌI
cách khách có thể hỏi ("còn hàng không", "còn ko shop", "hết chưa vậy",...)
— là điều bất khả thi. LLM đọc hiểu ngôn ngữ tự nhiên và tự quyết định "cần
gọi Tool nào" — Behavior Tree chỉ lo phần khung xương (thứ tự xử lý, phân
quyền, đảm bảo luôn có phản hồi), còn "nội dung nói gì, làm gì" hoàn toàn
do LLM + Tool đảm nhiệm.

## 2. Vì sao gộp chung vào dự án (không tách service riêng)?

Đây là lựa chọn **tối ưu nhất** ở quy mô hiện tại: BOT gọi thẳng
`TeaService`, `OrdersService`, `CartService` đã có sẵn trong cùng tiến
trình Node.js — không tốn thêm 1 lượt gọi HTTP nào, không lo 2 nơi kiểm
kho lệch pha nhau. Toàn bộ phần "bộ não" (Behavior Tree, Tool, LLM Agent)
được viết tách biệt trong `src/modules/bot/`, không đụng vào logic nghiệp
vụ gốc — nếu sau này muốn tách BOT thành 1 service độc lập, chỉ cần bê
nguyên thư mục này sang dự án khác và thay các `import ...Service` bằng
lệnh gọi HTTP.

## 3. Cài đặt Ollama (chạy LLM MIỄN PHÍ trên máy bạn)

1. Tải & cài Ollama tại **https://ollama.com** (có bản Windows/Mac/Linux).
2. Mở terminal, tải model có hỗ trợ tool-calling (chỉ cần làm 1 lần,
   khoảng 4-5GB dung lượng ổ cứng):
   ```bash
   ollama pull llama3.1
   ```
   (Máy yếu hơn có thể thử `ollama pull qwen2.5:7b` hoặc bản lượng tử hoá
   nhỏ hơn như `llama3.1:8b-instruct-q4_0` cho nhẹ RAM hơn.)
3. Ollama tự chạy nền ở cổng `11434` ngay sau khi cài — không cần bật gì
   thêm. Kiểm tra bằng cách mở trình duyệt tới `http://localhost:11434`,
   thấy dòng chữ "Ollama is running" là thành công.
4. Cài SDK gọi API (chuẩn OpenAI-compatible, Ollama hỗ trợ sẵn):
   ```bash
   npm install openai
   ```

### Cấu hình `.env`
```env
# Không bắt buộc khai báo nếu dùng đúng mặc định (Ollama chạy local, model llama3.1)
LLM_BASE_URL=http://localhost:11434/v1
LLM_MODEL=llama3.1
# LLM_API_KEY không cần thiết với Ollama (bỏ qua dòng này cũng được)
```

### Muốn đổi sang dịch vụ khác sau này (ví dụ Groq free-tier)?
Chỉ cần đổi `LLM_BASE_URL` (ví dụ `https://api.groq.com/openai/v1`),
`LLM_MODEL` (ví dụ `llama-3.3-70b-versatile`) và `LLM_API_KEY` trong
`.env` — **không cần sửa 1 dòng code nào**, vì toàn bộ `LlmAgentService`
được viết theo chuẩn OpenAI Chat Completions API dùng chung cho cả 2.

## 4. API

### 4.1. Khách vãng lai (chưa đăng nhập)
```
POST /bot/chat
Content-Type: application/json

{
  "message": "Shop còn trà sen không ạ?",
  "sessionId": "" // để trống ở tin nhắn đầu, các tin sau nhớ dùng lại sessionId trả về
}
```

### 4.2. Khách đã đăng nhập (có thể đặt hàng thật qua BOT)
```
POST /bot/chat/me
Authorization: Bearer <JWT token>
Content-Type: application/json

{
  "message": "Cho tôi đặt 2 gói trà sen, giao về 123 Lê Lợi Q1, sđt 0901234567",
  "sessionId": "..."
}
```

### Response mẫu
```json
{
  "sessionId": "5b1e...-uuid",
  "reply": "Dạ trà sen hiện còn hàng, giá 150.000đ/gói. Em đã tạo đơn 2 gói (300.000đ) giao tới 123 Lê Lợi Q1 ạ, shop sẽ liên hệ số 0901234567 để xác nhận nhé!",
  "toolsUsed": ["check_stock", "create_order"]
}
```
`toolsUsed` chỉ để debug/theo dõi BOT đã thao tác gì, có thể ẩn đi ở frontend.

## 5. Test nhanh bằng Swagger

Chạy `npm run start:dev` (nhớ đảm bảo Ollama đang chạy nền), mở
`http://localhost:8000/tea-swagger/index.html`, tìm nhóm **bot**, thử lần
lượt các kịch bản:

1. *"Cửa hàng có những loại trà nào?"* → BOT gọi `search_tea`.
2. *"Trà sen còn hàng không?"* → BOT gọi `check_stock`.
3. Sửa tồn kho 1 sản phẩm về 0 (qua API `PATCH /tea/:id` hoặc DB), rồi hỏi
   lại sản phẩm đó → BOT tự báo hết hàng **và** chủ động gọi
   `suggest_alternative` để gợi ý sản phẩm khác.
4. *(đăng nhập trước)* "Tôi muốn mua 2 trà sen" → thiếu địa chỉ/SĐT, BOT sẽ
   hỏi lại thay vì tạo đơn ngay.
5. Cung cấp đủ địa chỉ/SĐT → BOT gọi `create_order`, đơn hàng thật được tạo
   trong DB (có thể kiểm tra qua `GET /order/my-orders`), với `channel: "bot"`.

## 6. Lưu ý về model local (khác với Claude/GPT trả phí)

- Model 8B chạy local **thông minh hơn if/else rất nhiều**, đủ dùng tốt
  cho đồ án, nhưng sẽ không "khéo" bằng các model thương mại lớn — đôi khi
  cần hỏi rõ ràng hơn 1 chút, hoặc thử lại nếu model trả JSON tham số hơi
  lỗi (code đã có xử lý fallback cho trường hợp này, xem `llm-agent.service.ts`).
- Tốc độ phản hồi phụ thuộc phần cứng máy bạn (CPU/GPU/RAM) — nếu quá chậm,
  thử model nhỏ hơn (`qwen2.5:7b`, hoặc bản q4 lượng tử hoá).
- Nếu không thấy `tool_calls` được model gọi dù đã hỏi đúng ý, kiểm tra lại
  model đã pull có nằm trong danh sách hỗ trợ tool-calling của Ollama
  không (llama3.1, llama3.2, qwen2.5, mistral-nemo, firefunction-v2...).

## 7. Mở rộng thêm

- **Thêm Tool mới**: tạo file trong `tools/`, cài `IBotTool`, thêm vào
  constructor + mảng `providers` của `ToolRegistryService`/`BotModule`.
  Không cần sửa Behavior Tree hay LLM Agent.
- **Thêm nhánh hành vi mới** (ví dụ "khách VIP" được ưu đãi riêng): thêm 1
  `Condition` + `Action` node mới, chèn vào `SelectorNode "RouteByAuth"`
  trong `tree/bot-tree-builder.service.ts`.
- **Lưu lịch sử chat bền vững hơn**: hiện dùng bộ nhớ RAM
  (`ConversationStoreService`), phù hợp demo/1 instance. Lên production
  thật, chỉ cần thay phần lưu trữ bên trong service này bằng Redis, các
  nơi khác không cần sửa gì.
- **Điều kiện bán hàng** (`suggest_addon`): hiện là hằng số trong code
  (`STORE_POLICY`), có thể chuyển thành 1 collection MongoDB cho Admin tự
  chỉnh sửa qua giao diện quản trị mà không cần deploy lại.

## 8. Lưu ý

- Đã kiểm tra biên dịch TypeScript (`tsc --noEmit`) sạch cho toàn bộ module
  `bot/` và các thay đổi trong `order` — không phát sinh lỗi kiểu dữ liệu.
- File `.zip` gửi kèm chỉ chứa thư mục `src/` (giống file gốc bạn tải lên),
  hãy giải nén đè lên dự án hiện có rồi chạy `npm install openai` và cài
  Ollama theo hướng dẫn mục 3.

---

# 🧪 HƯỚNG DẪN TEST TOÀN BỘ BOT TRÊN SWAGGER (TỪNG BƯỚC)

Phần này hướng dẫn chi tiết từ A-Z: chuẩn bị môi trường → khởi động server →
test đầy đủ các kịch bản trên Swagger UI, kể cả các bước KHÔNG làm được
trên Swagger (seed dữ liệu ban đầu) sẽ có hướng dẫn thay thế rõ ràng.

## BƯỚC 0 — Chuẩn bị môi trường (làm 1 lần)

1. **MongoDB đang chạy** và `.env` đã có `MONGODB_URI` trỏ đúng (giữ nguyên
   như dự án cũ của bạn, không đổi gì).
2. **Cài Ollama + tải model** (xem chi tiết mục 3 phía trên):
   ```bash
   ollama pull llama3.1
   ```
   Kiểm tra Ollama đang chạy: mở trình duyệt `http://localhost:11434`,
   thấy dòng "Ollama is running" là OK.
3. **Giải nén file zip** đè lên thư mục dự án hiện tại (chỉ có thư mục
   `src/` và `BOT_README.md`, không ảnh hưởng file khác).
4. **Cài thêm 1 gói duy nhất:**
   ```bash
   npm install openai
   ```
5. **Thêm vào `.env`** (không bắt buộc nếu dùng đúng mặc định):
   ```env
   LLM_BASE_URL=http://localhost:11434/v1
   LLM_MODEL=llama3.1
   ```
6. **Chạy server:**
   ```bash
   npm run start:dev
   ```
   Thấy log NestJS khởi động thành công, không có lỗi đỏ là được.
7. **Mở Swagger UI:** `http://localhost:8000/tea-swagger/index.html`
   (đổi `8000` nếu bạn cấu hình `PORT` khác trong `.env`).

## BƯỚC 1 — Tạo dữ liệu sản phẩm trà mẫu (seed data)

⚠️ Đây là bước **DUY NHẤT không làm hoàn toàn trên Swagger được**, vì tạo
sản phẩm trà (`POST /tea`) yêu cầu tài khoản có quyền **ADMIN/MANAGER**,
nhưng tài khoản đăng ký mới qua `POST /auth/register` luôn chỉ được gán
quyền **USER** (đây là thiết kế bảo mật có sẵn từ trước trong dự án của
bạn, không phải do BOT thêm vào) — nên cần "mồi" 1 tài khoản admin đầu
tiên bằng tay. Chọn 1 trong 2 cách sau:

### Cách A (khuyên dùng — nhanh nhất): Seed thẳng vào MongoDB
Mở MongoDB Compass (hoặc `mongosh`) kết nối vào đúng database trong
`MONGODB_URI`, vào collection `teas`, insert các document mẫu sau:

```json
[
  { "name": "Trà Sen Tây Hồ", "type": "Green Tea", "price": 150000, "description": "Trà sen ướp hương truyền thống", "origin": "Hà Nội", "stock": 25, "isAvailable": true },
  { "name": "Trà Xanh Thái Nguyên", "type": "Green Tea", "price": 120000, "description": "Trà xanh búp 1 tôm 2 lá", "origin": "Thái Nguyên", "stock": 0, "isAvailable": true },
  { "name": "Hồng Trà Đà Lạt", "type": "Black Tea", "price": 135000, "description": "Hồng trà đậm vị", "origin": "Đà Lạt", "stock": 40, "isAvailable": true },
  { "name": "Trà Ô Long Cao Sơn", "type": "Oolong Tea", "price": 220000, "description": "Ô long trồng núi cao", "origin": "Lâm Đồng", "stock": 15, "isAvailable": true }
]
```
Lưu ý: `type` phải đúng 1 trong 5 giá trị: `Green Tea`, `Black Tea`,
`Oolong Tea`, `Herbal Tea`, `White Tea` (xem `src/constants/tea-type.enum.ts`).

### Cách B: Tự thăng cấp 1 tài khoản thành ADMIN rồi tạo qua Swagger
1. Đăng ký tài khoản bất kỳ qua `POST /auth/register`.
2. Vào MongoDB, tìm document user vừa tạo trong collection `users`, sửa
   field `role` từ `1` (USER) thành `2` (ADMIN).
3. Đăng nhập lại (`POST /auth/login`) để lấy token MỚI (token cũ không có
   quyền admin vì đã phát hành trước khi đổi role).
4. Dùng token đó gọi `POST /tea` trên Swagger để tạo sản phẩm.

## BƯỚC 2 — Đăng ký & đăng nhập tài khoản khách hàng (để test BOT đã đăng nhập)

1. Mở nhóm **Auth** trên Swagger → `POST /auth/register` → **Try it out**:
   ```json
   {
     "name": "Nguyễn Văn A",
     "email": "khachhang@example.com",
     "password": "123456",
     "gender": 1
   }
   ```
   → **Execute**.
2. `POST /auth/login` với đúng `email`/`password` vừa đăng ký → **Execute**.
   Copy giá trị `access_token` trong response (chuỗi rất dài, dạng JWT).
3. Bấm nút **Authorize** (góc trên bên phải Swagger UI, biểu tượng ổ khóa),
   dán `access_token` vào ô (không cần gõ chữ "Bearer", Swagger tự thêm),
   bấm **Authorize** rồi **Close**.
   → Từ giờ mọi request có khóa 🔒 sẽ tự động gửi kèm token này.

## BƯỚC 3 — Test BOT với khách vãng lai (chưa đăng nhập)

Mở nhóm **bot** → `POST /bot/chat` → **Try it out**.

**3.1. Hỏi sản phẩm chung chung:**
```json
{ "message": "Cửa hàng có những loại trà nào?" }
```
→ **Execute**. Kỳ vọng: `reply` liệt kê các loại trà, `toolsUsed` chứa
`"search_tea"`. **Copy lại `sessionId`** trong response để dùng cho các
tin nhắn tiếp theo (giúp BOT nhớ ngữ cảnh).

**3.2. Hỏi tồn kho sản phẩm còn hàng:**
```json
{ "message": "Trà sen còn hàng không ạ?", "sessionId": "<dán sessionId bước 3.1>" }
```
→ Kỳ vọng: `reply` xác nhận còn hàng + giá, `toolsUsed` chứa `"check_stock"`.

**3.3. Hỏi tồn kho sản phẩm ĐÃ HẾT HÀNG** (dùng "Trà Xanh Thái Nguyên" đã
seed với `stock: 0` ở Bước 1):
```json
{ "message": "Trà xanh Thái Nguyên còn không shop?", "sessionId": "<sessionId>" }
```
→ Kỳ vọng: `reply` báo hết hàng **và chủ động gợi ý sản phẩm khác cùng
loại Green Tea còn hàng** (ví dụ Trà Sen Tây Hồ), `toolsUsed` chứa
`"check_stock"` **và** `"suggest_alternative"` — đây chính là kịch bản
trọng tâm bạn yêu cầu ban đầu ("hết hàng thì BOT trả lời như nào").

**3.4. Thử BOT chặn hành động cần đăng nhập:**
```json
{ "message": "Đặt cho tôi 2 gói trà sen luôn", "sessionId": "<sessionId>" }
```
→ Kỳ vọng: BOT **không tạo đơn** (vì đang ở endpoint khách vãng lai),
`toolsUsed` KHÔNG chứa `create_order`, `reply` nhắc khách đăng nhập/đăng
ký trước — chứng minh việc phân quyền theo Behavior Tree hoạt động đúng.

## BƯỚC 4 — Test BOT với khách đã đăng nhập (đặt hàng thật)

Dùng `POST /bot/chat/me` (đã có 🔒 Authorize từ Bước 2, không cần copy token thủ công nữa).

**4.1. Hỏi mua kèm / điều kiện bán hàng:**
```json
{ "message": "Tôi ưng trà sen rồi, mua thêm gì được freeship không?" }
```
→ Kỳ vọng: `toolsUsed` chứa `"suggest_addon"`, `reply` gợi ý sản phẩm mua
kèm + nói rõ ngưỡng freeship (300.000đ theo cấu hình mặc định).

**4.2. Đặt hàng nhưng CỐ Ý thiếu thông tin:**
```json
{ "message": "Chốt đơn 2 gói trà sen giúp tôi" }
```
→ Kỳ vọng: BOT **không tạo đơn ngay**, mà hỏi lại địa chỉ giao hàng và số
điện thoại (vì `create_order` tool phát hiện thiếu `shippingAddress`/`phoneNumber`).
**Nhớ lại `sessionId`** trả về ở bước này.

**4.3. Bổ sung đủ thông tin (dùng lại `sessionId` bước 4.2):**
```json
{
  "message": "Giao tới 123 Lê Lợi, Quận 1, TPHCM, số điện thoại 0901234567",
  "sessionId": "<sessionId bước 4.2>"
}
```
→ Kỳ vọng: `toolsUsed` chứa `"create_order"`, `reply` xác nhận đơn hàng
đã tạo thành công kèm tổng tiền.

**4.4. Xác minh đơn hàng đã thật sự được tạo trong DB:**
Mở nhóm **order** → `GET /order/my-orders` (đã có sẵn 🔒 Authorize) →
**Execute**. Kỳ vọng: thấy đơn hàng vừa tạo, với field `channel: "bot"`
(field mới thêm vào, để phân biệt đơn tạo qua BOT với đơn tạo qua web/app
thông thường).

**4.5. Tra cứu lại đơn hàng qua chính BOT:**
```json
{ "message": "Đơn hàng của tôi tới đâu rồi?" }
```
→ Kỳ vọng: `toolsUsed` chứa `"check_order_status"`, `reply` tóm tắt đúng
đơn hàng vừa đặt ở bước 4.3.

## BƯỚC 5 — Test trường hợp hết hàng NGAY LÚC ĐẶT (đặt số lượng vượt tồn kho)

1. Sửa tồn kho 1 sản phẩm về số nhỏ, ví dụ `stock: 1`, qua
   `PATCH /tea/:id` (cần token ADMIN/MANAGER từ Bước 1 Cách B; hoặc sửa
   thẳng trong MongoDB cho nhanh).
2. Ở `POST /bot/chat/me`, thử đặt số lượng NHIỀU hơn tồn kho:
   ```json
   { "message": "Cho tôi đặt 5 gói trà đó, giao 123 Lê Lợi Q1, sđt 0901234567" }
   ```
   → Kỳ vọng: `create_order` tool trả lỗi nghiệp vụ (hết hàng/không đủ số
   lượng), BOT **giải thích lại cho khách bằng lời văn tự nhiên** thay vì
   trả lỗi HTTP 400 khô khan, và không có đơn hàng nào bị tạo sai trong DB.

## Mẹo debug khi test

- Field `toolsUsed` trong mọi response chính là "nhật ký" cho biết BOT đã
  gọi tool nào — dùng nó để xác nhận đúng hành vi kỳ vọng ở mỗi bước trên.
- Nếu `reply` trả về câu xin lỗi kiểu "hệ thống đang gặp trục trặc" (message
  fallback trong `FallbackReplyNode`), mở log terminal nơi chạy
  `npm run start:dev` để xem lỗi thật (thường do Ollama chưa chạy, hoặc
  model chưa được `ollama pull`).
- Luôn nhớ **dùng lại đúng `sessionId`** giữa các tin nhắn trong cùng 1
  kịch bản — nếu bỏ trống, BOT sẽ coi như 1 cuộc trò chuyện hoàn toàn mới,
  mất hết ngữ cảnh (ví dụ Bước 4.3 mà quên `sessionId` thì BOT sẽ không
  nhớ đã hỏi xin địa chỉ/SĐT trước đó).
