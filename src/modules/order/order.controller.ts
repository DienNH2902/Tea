import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';

import { CreateOrderDto } from './dto/create-order.dto';
import { OrdersService } from './order.service';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ResponseOrderDto } from './dto/response-order.dto';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiTags,
} from 'node_modules/@nestjs/swagger/dist';
import { Roles } from '../auth/decorators/roles.decorator';
import { RoleEnum } from 'src/constants/roleEnum.enum';
import { RolesGuard } from '../auth/guards/roles.guard';

@ApiTags('order')
@ApiBearerAuth()
@Controller('order')
export class OrderController {
  constructor(private readonly orderService: OrdersService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create a new order' })
  @ApiBody({ type: CreateOrderDto })
  async create(
    @Request() req: any,
    @Body() createOrderDto: CreateOrderDto,
  ): Promise<ResponseOrderDto> {
    // Lấy userId từ payload của JWT (sau khi qua JwtStrategy)
    const userId = req.user._id as string;

    // Gọi service xử lý logic đặt hàng, tính tiền và trừ tồn kho
    return await this.orderService.create(userId, createOrderDto);
  }

  // @Get()
  // findAll() {
  //   return this.orderService.findAll();
  // }

  @Get('my-orders')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get all my orders' })
  async getMyOrders(@Request() req: any): Promise<ResponseOrderDto[]> {
    // Lấy ID của chính người dùng đang đăng nhập từ Passport
    const userId = req.user._id as string;
    return await this.orderService.getAllOrdersByUserId(userId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(RoleEnum.ADMIN, RoleEnum.MANAGER)
  @ApiOperation({ summary: 'Get order by id' })
  async findOne(@Param('id') id: string): Promise<ResponseOrderDto> {
    return await this.orderService.findOne(id);
  }

  // Route này thường dành cho Admin muốn xem đơn của 1 khách hàng bất kỳ
  @Get('user/:userId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleEnum.ADMIN)
  @ApiOperation({ summary: 'Admin get all orders by user id' })
  async findAllOrdersByUserId(@Param('userId') userId: string) {
    return await this.orderService.getAllOrdersByUserId(userId);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'update order status' })
  update(
    @Param('id') id: string,
    @Body() updateOrderStatusDto: UpdateOrderStatusDto,
  ): Promise<ResponseOrderDto> {
    return this.orderService.updateStatus(id, updateOrderStatusDto);
  }

  // @Delete(':id')
  // remove(@Param('id') id: string) {
  //   return this.orderService.remove(+id);
  // }
}
