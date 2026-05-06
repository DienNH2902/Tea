import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

// Sử dụng PartialType để kế thừa các validation từ CreateOrderDto (shippingAddress, phoneNumber, note)
// nhưng biến tất cả các trường thành optional (?)
export class UpdateOrderDto {
  @ApiProperty({
    example: '123 Đường ABC, Quận 1, TP. Hồ Chí Minh',
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Địa chỉ giao hàng không được để trống' })
  shippingAddress?: string;

  @ApiProperty({
    example: '0901234567',
    required: false,
  })
  @IsOptional()
  @IsNotEmpty({ message: 'Số điện thoại không được để trống' })
  phoneNumber?: string;

  @ApiProperty({
    example: 'Giao sau 5h chiều',
    required: false,
  })
  @IsOptional()
  @IsString()
  note?: string;
}
