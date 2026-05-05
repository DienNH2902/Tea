// src/modules/orders/dto/create-order.dto.ts
import {
  IsNotEmpty,
  IsString,
  IsArray,
  ValidateNested,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateOrderItemDto } from './create-order-item.dto';
import { ApiProperty } from 'node_modules/@nestjs/swagger/dist';

export class CreateOrderDto {
  @ApiProperty({
    type: [CreateOrderItemDto],
    description: 'Danh sách các món trong đơn hàng',
    required: true,
  })
  @IsArray({ message: 'Danh sách món ăn phải là một mảng' })
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];

  @ApiProperty({
    example: '123 Đường ABC, Quận 1, TP. Hồ Chí Minh',
    description: 'Địa chỉ nhận hàng',
    required: true,
  })
  @IsString()
  @IsNotEmpty({ message: 'Địa chỉ giao hàng không được để trống' })
  shippingAddress: string;

  @ApiProperty({
    example: '0901234567',
    description: 'Số điện thoại người nhận',
    required: true,
  })
  @IsString()
  @IsNotEmpty({ message: 'Số điện thoại không được để trống' })
  phoneNumber: string;

  @ApiProperty({
    example: 'Giao giờ hành chính, ít đường nhiều đá',
    description: 'Ghi chú cho đơn hàng',
    required: false,
  })
  @IsString()
  @IsOptional()
  note?: string;
}
