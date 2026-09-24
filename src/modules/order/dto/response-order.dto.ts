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
  // LỖI THỰC TẾ ĐÃ XẢY RA (khiến khách hàng KHÔNG BAO GIỜ nhận được cập
  // nhật realtime): trước đây chỉ đọc `obj.userId?._id`, giá trị này CHỈ
  // đúng khi `userId` đã được `.populate()` từ MongoDB. Hàm
  // `updateOrderStatusById()` (dùng khi admin đổi trạng thái đơn) KHÔNG hề
  // populate - `userId` lúc đó vẫn là ObjectId THÔ (không có field `._id`
  // con bên trong) -> `obj.userId?._id` ra `undefined` -> phòng WebSocket
  // đích trở thành "user:undefined", không khớp phòng thật của khách hàng.
  // Sửa để tự nhận diện CẢ 2 trường hợp: đã populate (object có `._id`)
  // hoặc chưa populate (chính `userId` đã là ObjectId/string).
  @Transform(({ obj }) => (obj.userId?._id ?? obj.userId)?.toString())
  userId: string;

  @ApiProperty({ example: 'Nguyễn Văn A' })
  @Expose()
  @Transform(({ obj }) => obj.userId?.name)
  userName: string;

  @ApiProperty({ example: 'vana@gmail.com' })
  @Expose()
  @Transform(({ obj }) => obj.userId?.email)
  userEmail: string;

  @ApiProperty({ example: 'Hồ Chí Minh' })
  @Expose()
  @Transform(({ obj }) => obj.userId?.address)
  userAddress: string;

  @ApiProperty({ example: 'Hồ Chí Minh' })
  @Expose()
  @Transform(({ obj }) => obj.userId?.isRegular)
  isRegular: boolean;

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
