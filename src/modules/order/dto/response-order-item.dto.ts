// src/modules/orders/dto/response-order-item.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { Expose, Transform } from 'class-transformer';

export class ResponseOrderItemDto {
  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  @Expose()
  @Transform(({ obj }) => obj.teaId?.toString())
  teaId: string;

  @Expose()
  @ApiProperty({ example: 'Trà Sữa Trân Châu' })
  name: string;

  @Expose()
  @ApiProperty({ example: 2 })
  quantity: number;

  @Expose()
  @ApiProperty({ example: 35000 })
  price: number;
}
