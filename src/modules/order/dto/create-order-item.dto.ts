import { IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';
import { ApiProperty } from 'node_modules/@nestjs/swagger/dist';

export class CreateOrderItemDto {
  @ApiProperty({
    example: '69ef2878d5e67ad2231658be',
    description: 'ID của loại trà',
  })
  @IsString()
  @IsNotEmpty()
  teaId: string;

  @ApiProperty({ example: 2, description: 'Số lượng đặt mua' })
  @IsNumber()
  @Min(1)
  quantity: number;
}
