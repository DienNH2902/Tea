import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCartDto {
  @ApiProperty({
    example: '69ef28ec22398063db5afc8b',
    description: 'ID của loại chè yêu thích',
  })
  @IsString()
  @IsNotEmpty()
  teaId: string;

  @ApiProperty({ example: 'Uống đậm vị', required: false })
  @IsString()
  @IsOptional()
  note?: string;
}
