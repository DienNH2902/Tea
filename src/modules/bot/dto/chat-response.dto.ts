import { ApiProperty } from '@nestjs/swagger';

export class ChatResponseDto {
  @ApiProperty({ example: 'a1b2c3d4-...-uuid' })
  sessionId: string;

  @ApiProperty({
    example: 'Dạ trà sen hiện còn 25 gói ạ, giá 150.000đ/gói. Anh/chị muốn đặt mấy gói ạ?',
  })
  reply: string;

  @ApiProperty({
    example: ['check_stock'],
    description: 'Danh sách tên các Tool BOT đã gọi để tạo ra câu trả lời trên (phục vụ debug/theo dõi)',
  })
  toolsUsed: string[];
}
