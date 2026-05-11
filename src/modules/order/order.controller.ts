import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
  Request,
  Delete,
  Req,
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
import { UpdateOrderDto } from './dto/update-order.dto';

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
  @UseGuards(JwtAuthGuard)
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
  @ApiOperation({ summary: 'Update order by ID' })
  @UseGuards(JwtAuthGuard)
  @ApiBody({ type: UpdateOrderDto })
  updateOrder(
    @Param('id') id: string,
    @Body() updateOrderDto: UpdateOrderDto,
  ): Promise<UpdateOrderDto> {
    return this.orderService.updateOrder(id, updateOrderDto);
  }

  @Patch('status/:id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'update order status' })
  update(
    @Param('id') id: string,
    @Body() updateOrderStatusDto: UpdateOrderStatusDto,
    @Req() req: any,
  ): Promise<ResponseOrderDto> {
    return this.orderService.updateStatus(id, updateOrderStatusDto, req.user);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'delete order' })
  remove(@Param('id') id: string) {
    return this.orderService.removeOrder(id);
  }

  @Post('webhook')
  @ApiOperation({ summary: 'PayOS Webhook' })
  async handlePayosWebhook(@Body() body: any) {
    // Controller chỉ gọi sang Service, không trực tiếp xử lý Mail hay DB
    return await this.orderService.handleWebhook(body);
  }
}
