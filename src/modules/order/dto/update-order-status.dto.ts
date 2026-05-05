import { IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from 'node_modules/@nestjs/swagger/dist';
import { OrderStatus } from 'src/constants/statusEnum.enum';

export class UpdateOrderStatusDto {
  @ApiProperty({
    enum: OrderStatus,
    example: OrderStatus.PENDING,
    description: 'Trạng thái mới của đơn hàng',
  })
  @IsEnum(OrderStatus, { message: 'Trạng thái đơn hàng không hợp lệ' })
  @IsNotEmpty()
  status: OrderStatus;
}
