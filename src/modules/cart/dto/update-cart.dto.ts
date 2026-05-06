import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateCartDto {
  @ApiProperty({
    example: 'Món này uống rất hợp khi làm việc khuya',
    description: 'Ghi chú mới cho món yêu thích',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(200, { message: 'Ghi chú không được quá 200 ký tự' })
  note: string;
}
