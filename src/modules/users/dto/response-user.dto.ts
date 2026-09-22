import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Transform } from 'class-transformer';

export class ResponseUserDto {
  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  @Expose()
  @Transform(({ obj }) => obj._id?.toString())
  _id: string;

  @Expose()
  @ApiProperty({ example: 'Nguyễn Văn A' })
  name: string;

  @Expose()
  @ApiProperty({ example: 'vana@example.com' })
  email: string;

  @Expose()
  @ApiProperty({ example: 25 })
  age: number;

  @Expose()
  @ApiProperty({ example: 1 })
  gender: number;

  @Expose()
  @ApiProperty({ example: 0 })
  role: number;

  @Expose()
  @ApiProperty({ example: 'Hồ Chí Minh' })
  address: string;

  @Expose()
  @ApiProperty({ example: 500000, description: 'Số dư ví hiện tại' })
  balance: number;

  @Expose()
  @ApiProperty({ example: false })
  isRegular: boolean;

  @Exclude()
  password: string;

  @Exclude()
  __v: number;

  // LỖI THỰC TẾ ĐÃ XẢY RA VÀ ĐÃ SỬA: trước đây constructor ở đây tự gọi
  // `plainToInstance(ResponseUserDto, partial, {...})` NGAY BÊN TRONG
  // chính constructor của class này. Vấn đề: `plainToInstance` khi cần
  // tạo 1 instance MỚI của `ResponseUserDto` để gán field vào, nó tự gọi
  // `new ResponseUserDto()` (KHÔNG tham số) - việc này lại kích hoạt LẠI
  // constructor này, gọi lại `plainToInstance(...)` với `partial =
  // undefined` -> ĐỆ QUY HỎNG, kết quả cuối cùng là 1 object rỗng/undefined
  // dù không có exception nào ném ra rõ ràng (hậu quả: `AuthService.login()`
  // từng dùng `new ResponseUserDto(user)` khiến field "user" trong response
  // đăng nhập bị rỗng, phía frontend đọc `data.user.name` bị crash dù HTTP
  // status vẫn 200/201 - "backend báo thành công nhưng thiếu dữ liệu").
  //
  // KHÔNG được tự override constructor để gọi `plainToInstance` như vậy -
  // luôn gọi `plainToInstance(ResponseUserDto, ..., {excludeExtraneousValues:
  // true})` từ BÊN NGOÀI class này (trong Service, xem
  // `UsersService.toResponseDto()` hoặc `AuthService.login()`), KHÔNG BAO
  // GIỜ dùng `new ResponseUserDto(...)` trực tiếp ở bất kỳ đâu.
}
