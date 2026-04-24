import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsBoolean,
  Min,
  IsEnum,
  IsOptional,
} from 'class-validator';
import { TeaType } from 'src/constants/tea-type.enum';

export class CreateTeaDto {
  @ApiProperty({ example: 'Trà Sen Tây Hồ', required: true })
  @IsString()
  @IsNotEmpty({ message: 'Tên loại trà không được để trống' })
  name: string;

  @ApiProperty({
    description: 'Chọn một trong các loại trà có sẵn',
    enum: TeaType, // Đây là chìa khóa để hiện Dropdown
    enumName: 'TeaType', // Giúp định nghĩa Schema rõ ràng
    example: TeaType.GREEN_TEA,
    required: true,
  })
  @IsEnum(TeaType, { message: 'Loại trà không hợp lệ' })
  @IsNotEmpty({ message: 'Loại trà không được để trống' })
  type: TeaType;

  @ApiProperty({ example: 150000, required: true })
  @IsNumber({}, { message: 'Giá tiền phải là số' })
  @Min(0, { message: 'Giá tiền không được nhỏ hơn 0' })
  price: number;

  @ApiProperty({
    example: 'Trà sen thơm mát, đậm vị truyền thống',
    required: false,
  })
  @IsString()
  @IsOptional()
  description: string;

  @ApiProperty({ example: 'Bảo Lộc, Lâm Đồng', required: false })
  @IsString()
  @IsOptional()
  origin: string;

  @ApiProperty({ example: 100, required: false, default: 0 })
  @IsNumber({}, { message: 'Số lượng tồn kho phải là số' })
  @Min(0, { message: 'Số lượng tồn kho không được nhỏ hơn 0' })
  @IsOptional()
  stock: number;

  @ApiProperty({ example: true, required: false, default: true })
  @IsBoolean({ message: 'isAvailable phải là true/false' })
  @IsOptional()
  isAvailable: boolean;
}
