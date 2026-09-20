import * as bcrypt from 'bcrypt';

export class HashUtil {
  // Số vòng lặp (cost factor) để băm mật khẩu.
  // Giá trị càng cao thì băm càng chậm và an toàn hơn, nhưng tốn tài nguyên CPU hơn. 10 là mức cân bằng chuẩn.
  private static readonly SALT_ROUNDS = 10;

  /**
   * Hash mật khẩu kết hợp với Salt để bảo mật.
   *
   * @param password Mật khẩu dạng plain text (người dùng nhập vào).
   * @returns Chuỗi mật khẩu đã được mã hóa (Hash + Salt).
   *
   * GIẢI THÍCH VỀ SALT:
   * - Salt là một chuỗi dữ liệu ngẫu nhiên được sinh ra tự động và "trộn" (salt) vào mật khẩu trước khi đưa qua thuật toán băm (bcrypt).
   * - Tác dụng: Ngay cả khi 2 người dùng đặt cùng một mật khẩu (ví dụ: "123456"), chuỗi hash lưu trong database của họ sẽ hoàn toàn khác nhau nhờ lớp salt ngẫu nhiên này.
   * - Điều này giúp vô hiệu hóa hoàn toàn các cuộc tấn công bằng bảng dò sẵn (Rainbow Table Attack).
   */
  static async hash(password: string): Promise<string> {
    return bcrypt.hash(password, this.SALT_ROUNDS);
  }

  /**
   * So sánh mật khẩu người dùng nhập vào với mật khẩu đã mã hóa trong database.
   *
   * @param plainPassword Mật khẩu người dùng nhập khi đăng nhập.
   * @param hashedPassword Mật khẩu đã mã hóa được lưu trong database.
   * @returns true nếu trùng khớp, ngược lại trả về false.
   *
   * CƠ CHẾ HOẠT ĐỘNG:
   * - Hàm `bcrypt.compare` sẽ tự động trích xuất chuỗi Salt được lưu ẩn bên trong `hashedPassword`.
   * - Sau đó, nó áp dụng salt đó lên `plainPassword` và băm lại, rồi so sánh kết quả với `hashedPassword`.
   */
  static async compare(
    plainPassword: string,
    hashedPassword: string,
  ): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
  }
}
