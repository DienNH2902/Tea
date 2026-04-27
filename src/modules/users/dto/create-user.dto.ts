import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  IsNotEmpty,
  MinLength,
  IsNumber,
  IsBoolean,
  Min,
  IsEnum,
} from 'class-validator';
import { GenderEnum } from 'src/constants/genderEnum.enum';

export class CreateUserDto {
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

  @ApiProperty({ example: 25, required: true })
  @IsNumber({}, { message: 'Tuổi phải là số' })
  @Min(0, { message: 'Tuổi không hợp lệ' })
  age: number;

  @ApiProperty({ example: 1, required: true })
  @IsEnum(GenderEnum, { message: 'Giới tính không hợp lệ' })
  @IsNumber({}, { message: 'Giới tính phải là 0/1' })
  @IsNotEmpty({ message: 'Giới tính không được để trống' })
  gender: GenderEnum;

  //   @ApiProperty({ example: 0, required: true })
  //   @IsNumber({}, { message: 'Role phải là số' })
  //   @IsNotEmpty({ message: 'Role không được để trống' })
  //   role: number;

  @ApiProperty({ example: 'Hồ Chí Minh', required: true })
  @IsString()
  @IsNotEmpty({ message: 'Địa chỉ không được để trống' })
  address: string;

  @ApiProperty({ example: false, required: true })
  @IsBoolean({ message: 'isRegular phải là true/false' })
  @IsNotEmpty({ message: 'Trạng thái không được để trống' })
  isRegular: boolean;
}
