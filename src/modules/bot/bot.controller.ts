import { Body, Controller, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { BotService } from './bot.service';
import { ChatRequestDto } from './dto/chat-request.dto';
import { ChatResponseDto } from './dto/chat-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * BotController
 * -----------------------------------------------------------------------
 * Cung cấp 2 endpoint chat với BOT:
 *  - POST /bot/chat     : dành cho khách VÃNG LAI (chưa đăng nhập) - ví dụ
 *    gắn vào widget chat công khai trên trang chủ website bán chè.
 *  - POST /bot/chat/me   : dành cho khách ĐÃ ĐĂNG NHẬP - BOT có thể thay
 *    khách tạo đơn hàng thật, tra cứu đơn hàng cá nhân.
 *
 * Vì module này nằm CHUNG trong cùng dự án NestJS (thay vì tách thành 1
 * service riêng phải gọi qua HTTP), BOT có thể gọi thẳng các Service nội
 * bộ (TeaService, OrderService, CartService...) mà không tốn thêm 1 lượt
 * gọi mạng nào - đây là lựa chọn TỐI ƯU NHẤT về hiệu năng cho quy mô hiện
 * tại của dự án. Nếu sau này muốn tách BOT ra chạy như 1 service độc lập
 * (ví dụ để scale riêng, hoặc dùng chung cho nhiều kênh bán hàng khác
 * nhau), chỉ cần "bê" nguyên thư mục `modules/bot` sang 1 dự án NestJS
 * khác, rồi thay các import Service nội bộ (TeaService, OrderService...)
 * bằng các lệnh gọi HTTP/gRPC sang service gốc - kiến trúc Behavior Tree +
 * Tool + LLM Agent ở đây được thiết kế độc lập, không bị ràng buộc vào
 * việc module đang nằm chung hay tách riêng.
 */
@ApiTags('bot')
@Controller('bot')
export class BotController {
  constructor(private readonly botService: BotService) {}

  @Post('chat')
  @ApiOperation({
    summary: 'Chat với BOT tư vấn bán chè (khách vãng lai - chưa đăng nhập)',
  })
  async chatAsGuest(@Body() dto: ChatRequestDto): Promise<ChatResponseDto> {
    return this.botService.chat({
      sessionId: dto.sessionId,
      message: dto.message,
      user: null,
    });
  }

  @Post('chat/me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Chat với BOT tư vấn bán chè (khách đã đăng nhập - BOT có thể đặt hàng thật giúp khách)',
  })
  async chatAsMember(
    @Request() req: any,
    @Body() dto: ChatRequestDto,
  ): Promise<ChatResponseDto> {
    return this.botService.chat({
      sessionId: dto.sessionId,
      message: dto.message,
      user: { _id: req.user._id, name: req.user.name },
    });
  }
}
