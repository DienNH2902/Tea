import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Transform } from 'class-transformer';
import { Tea } from '../schemas/tea.schema';
import { TeaType } from '../../../constants/tea-type.enum';

export class ResponseTeaDto {
  @ApiProperty({ example: '65f1234567890abcdef12345' })
  @Expose()
  @Transform(({ obj }) => obj._id?.toString())
  _id: string;

  @Expose()
  @ApiProperty({ example: 'Trà Sen Tây Hồ' })
  name: string;

  @Expose()
  @ApiProperty({ example: TeaType.GREEN_TEA, enum: TeaType })
  type: TeaType;

  @Expose()
  @ApiProperty({ example: 150000 })
  price: number;

  @Expose()
  @ApiProperty({ example: 'Trà sen thơm mát, đậm vị truyền thống' })
  description: string;

  @Expose()
  @ApiProperty({ example: 'Bảo Lộc, Lâm Đồng' })
  origin: string;

  @Expose()
  @ApiProperty({ example: 100 })
  stock: number;

  @Expose()
  @ApiProperty({ example: true })
  isAvailable: boolean;

  @Exclude()
  __v: number;

  constructor(partial: Partial<Tea>) {
    Object.assign(this, partial);
  }
}
