// src/modules/orders/dto/response-order.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import {
  Exclude,
  Expose,
  plainToInstance,
  Transform,
  Type,
} from 'class-transformer';
import { Order } from '../schemas/order.schema';
import { ResponseOrderItemDto } from './response-order-item.dto';

export class ResponseOrderDto {
  @ApiProperty({ example: '65f1234567890abcdef12345' })
  @Expose()
  @Transform(({ obj }) => obj._id?.toString())
  _id: string;

  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  @Expose()
  @Transform(({ obj }) => obj.userId?.toString())
  userId: string;

  @Expose()
  @ApiProperty({ type: [ResponseOrderItemDto] })
  @Type(() => ResponseOrderItemDto)
  items: ResponseOrderItemDto[];

  @Expose()
  @ApiProperty({ example: 70000 })
  totalPrice: number;

  @Expose()
  @ApiProperty({ example: 'pending' })
  status: string;

  @Expose()
  @ApiProperty({ example: '123 Đường ABC, Quận 1, HCM' })
  shippingAddress: string;

  @Expose()
  @ApiProperty({ example: '0901234567' })
  phoneNumber: string;

  @Expose()
  @ApiProperty({ example: 'Ít đường nhiều đá' })
  note: string;

  @Expose()
  @ApiProperty({ example: '2026-05-04T10:00:00.000Z' })
  createdAt: Date;

  @Exclude()
  __v: number;

  constructor(partial: Partial<Order>) {
    return plainToInstance(ResponseOrderDto, partial, {
      excludeExtraneousValues: true,
    });
  }
}
