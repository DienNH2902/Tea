import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
} from '@nestjs/common';
import { CartService } from './cart.service';
import { CreateCartDto } from './dto/create-cart.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UpdateCartDto } from './dto/update-cart.dto';

@ApiTags('cart')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Post()
  @ApiOperation({ summary: 'Thêm chè vào danh sách yêu thích' })
  create(@Req() req: any, @Body() createCartDto: CreateCartDto) {
    return this.cartService.addToCart(req.user._id, createCartDto);
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách yêu thích của tôi' })
  findAll(@Req() req: any) {
    return this.cartService.getMyCart(req.user._id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật ghi chú cho món yêu thích' })
  update(@Param('id') id: string, @Body() note: UpdateCartDto) {
    return this.cartService.updateNote(id, note);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa khỏi danh sách yêu thích' })
  remove(@Param('id') id: string) {
    return this.cartService.removeItem(id);
  }
}
