import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Transform } from 'class-transformer';
import { User } from '../schemas/user.schema';

export class ResponseUserDto {
  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  @Expose()
  @Transform(({ obj }) => obj._id?.toString())
  _id: string;

  @Expose()
  @ApiProperty({ example: 'Nguyễn Văn A' })
  name: string;

  @Expose()
  @ApiProperty({ example: 'vana@example.com' })
  email: string;

  @Expose()
  @ApiProperty({ example: 25 })
  age: number;

  @Expose()
  @ApiProperty({ example: true })
  gender: boolean;

  @Expose()
  @ApiProperty({ example: 0 })
  role: number;

  @Expose()
  @ApiProperty({ example: 'Hồ Chí Minh' })
  address: string;

  @Expose()
  @ApiProperty({ example: false })
  isRegular: boolean;

  @Exclude()
  password: string;

  @Exclude()
  __v: number;

  constructor(partial: Partial<User>) {
    Object.assign(this, partial);
  }
}
