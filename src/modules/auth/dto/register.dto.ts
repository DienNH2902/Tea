import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  IsNotEmpty,
  MinLength,
  IsNumber,
  IsBoolean,
  Min,
  IsOptional,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'Nguyễn Văn A', required: true, minLength: 3 })
  @IsString()
  @IsNotEmpty({ message: 'Tên không được để trống' })
  @MinLength(3, { message: 'Tên phải có ít nhất 3 ký tự' })
  name: string;

  @ApiProperty({ example: 'vana@example.com', required: true })
  @IsEmail({}, { message: 'Email không đúng định dạng' })
  @IsNotEmpty({ message: 'Email không được để trống' })
  email: string;

  @ApiProperty({ example: 'password123', required: true, minLength: 6 })
  @IsString()
  @IsNotEmpty({ message: 'Mật khẩu không được để trống' })
  @MinLength(6, { message: 'Mật khẩu phải có ít nhất 6 ký tự' })
  password: string;

  @ApiProperty({ example: 25, required: false })
  @IsOptional() // Cho phép để trống khi đăng ký nhanh
  @IsNumber({}, { message: 'Tuổi phải là số' })
  @Min(0, { message: 'Tuổi không hợp lệ' })
  age?: number;

  @ApiProperty({ example: true, required: true })
  @IsBoolean({ message: 'Giới tính phải là true/false' })
  @IsNotEmpty({ message: 'Giới tính không được để trống' })
  gender: boolean;

  @ApiProperty({ example: 'Hồ Chí Minh', required: false })
  @IsOptional()
  @IsString()
  address?: string;

  //   @ApiProperty({ example: false, required: false }) // Đổi thành false
  //   @IsBoolean({ message: 'isRegular phải là true/false' })
  //   @IsOptional()
  //   isRegular?: boolean; // Thêm dấu chấm hỏi
}
