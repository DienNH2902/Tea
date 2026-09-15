import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ChatRequestDto {
  @ApiProperty({
    example: 'Cho tôi hỏi trà sen còn hàng không ạ?',
    description: 'Nội dung tin nhắn của khách gửi cho BOT',
  })
  @IsString()
  @IsNotEmpty({ message: 'Nội dung tin nhắn không được để trống' })
  message: string;

  @ApiProperty({
    example: 'a1b2c3d4-...-uuid',
    description:
      'Mã phiên chat (để BOT nhớ ngữ cảnh các lượt chat trước). Nếu là tin nhắn đầu tiên, có thể bỏ trống, hệ thống sẽ tự tạo mới và trả về trong response.',
    required: false,
  })
  @IsString()
  @IsOptional()
  sessionId?: string;
}
