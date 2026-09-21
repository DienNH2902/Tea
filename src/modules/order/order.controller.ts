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
  Res,
  Query,
} from '@nestjs/common';
import type { Request as ExpressRequest, Response } from 'express';

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
import { ConfigService } from '@nestjs/config';

// Request đã gắn thêm `user` sau khi qua JwtAuthGuard/JwtStrategy
interface RequestWithUser extends ExpressRequest {
  user: { _id: string };
}

@ApiTags('order')
@ApiBearerAuth()
@Controller('order')
export class OrderController {
  constructor(
    private readonly orderService: OrdersService,
    private readonly configService: ConfigService,
  ) {}

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

  // Trang admin "Quản lý đơn hàng" - lấy TOÀN BỘ đơn của MỌI khách hàng,
  // có phân trang (khớp `PaginatedResult<T>` dùng chung toàn hệ thống).
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleEnum.ADMIN, RoleEnum.MANAGER)
  @ApiOperation({ summary: 'Admin/Manager get all orders (paginated)' })
  async findAll(
    @Query('pageNumber') pageNumber = 1,
    @Query('pageSize') pageSize = 10,
  ) {
    return await this.orderService.findAllPaginated(
      Number(pageNumber),
      Number(pageSize),
    );
  }

  @Post('vnpay')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Tạo đơn hàng và link thanh toán VNPay' })
  @ApiBody({ type: CreateOrderDto })
  async createWithVnpay(
    @Req() req: RequestWithUser,
    @Body() createOrderDto: CreateOrderDto,
  ) {
    const userId = req.user._id;

    const forwardedFor = req.headers['x-forwarded-for'];
    const ipAddr: string =
      (typeof forwardedFor === 'string'
        ? forwardedFor.split(',')[0]
        : undefined) ||
      (Array.isArray(forwardedFor) ? forwardedFor[0] : undefined) ||
      req.socket?.remoteAddress ||
      '127.0.0.1';

    return await this.orderService.createOrderWithVnpay(
      userId,
      createOrderDto,
      ipAddr,
      'NCB',
    );
  }

  @Get('vnpay/callback')
  @ApiOperation({
    summary: 'Webhook xử lý kết quả trả về từ VNPay và redirect về FE',
  })
  async vnpayCallback(
    @Query() query: Record<string, string>,
    @Res() res: Response,
  ) {
    const feUrlConfig =
      this.configService.get<string>('FE_URL') ||
      'http://localhost:5173/payment-result';

    try {
      await this.orderService.processVnPayCallback(query);

      const targetFeUrl = new URL(feUrlConfig);
      targetFeUrl.searchParams.append(
        'vnp_ResponseCode',
        query['vnp_ResponseCode'] || '',
      );
      targetFeUrl.searchParams.append('vnp_Amount', query['vnp_Amount'] || '0');
      targetFeUrl.searchParams.append('vnp_TxnRef', query['vnp_TxnRef'] || '');
      targetFeUrl.searchParams.append(
        'vnp_BankCode',
        query['vnp_BankCode'] || '',
      );
      targetFeUrl.searchParams.append(
        'vnp_PayDate',
        query['vnp_PayDate'] || '',
      );

      return res.redirect(targetFeUrl.toString());
    } catch (error) {
      console.error('VNPay Callback Error:', error);

      const targetFeUrl = new URL(feUrlConfig);
      targetFeUrl.searchParams.append(
        'vnp_ResponseCode',
        query['vnp_ResponseCode'] || '99',
      );
      targetFeUrl.searchParams.append('vnp_TxnRef', query['vnp_TxnRef'] || '');

      return res.redirect(targetFeUrl.toString());
    }
  }

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
}
