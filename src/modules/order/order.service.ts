import { RoleEnum } from 'src/constants/roleEnum.enum';
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { TeaService } from '../tea/tea.service';
import { OrdersRepository } from './order.repository';
import { OrderStatus } from 'src/constants/statusEnum.enum';
import { OrderItem } from './schemas/order-item';
import { Types } from 'mongoose';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { ResponseOrderDto } from './dto/response-order.dto';
import { plainToInstance } from 'class-transformer';
import { UpdateOrderDto } from './dto/update-order.dto';
import { MailService } from '../mail/mail.service';
import { UsersService } from '../users/users.service';
interface PayOSWebhookData {
  orderCode: number;
  amount: number;
  description: string;
  status: string;
  // ... thêm các trường khác nếu cần
}
interface PayOSClient {
  createPaymentLink(data: any): Promise<{ checkoutUrl: string }>;
  verifyPaymentWebhookData(body: any): PayOSWebhookData;
}
@Injectable()
export class OrdersService {
  constructor(
    private readonly orderRepository: OrdersRepository,
    private readonly teaService: TeaService,
    private readonly mailService: MailService,
    private readonly userService: UsersService,
    // Inject với Token 'PAYOS_CLIENT' và dùng kiểu any hoặc PayOS
    @Inject('PAYOS_CLIENT') private readonly payos: PayOSClient,
  ) {}

  async create(
    userId: string,
    createOrderDto: CreateOrderDto,
  ): Promise<ResponseOrderDto> {
    const { items, shippingAddress, phoneNumber, note } = createOrderDto;
    let totalPrice = 0;
    const orderItems: OrderItem[] = [];

    // Duyệt qua từng món trà khách đặt
    for (const item of items) {
      // 1. Tìm thông tin trà
      const tea = await this.teaService.findOne(item.teaId);

      // 2. Kiểm tra tính khả dụng và tồn kho
      // Lưu ý: tea ở đây là ResponseTeaDto nên hãy đảm bảo bạn đã @Expose trường stock và isAvailable
      if (!tea) {
        throw new NotFoundException(
          `Sản phẩm với ID ${item.teaId} không tồn tại`,
        );
      }

      if (!tea.isAvailable || tea.stock < item.quantity) {
        throw new BadRequestException(
          `Sản phẩm ${tea.name} hiện không đủ hàng hoặc đã ngừng bán, trạng thái còn hàng: ${tea.isAvailable}, số lượng kho: ${tea.stock}`,
        );
      }

      // 3. Tính toán giá tiền
      const itemPrice = tea.price * item.quantity;
      totalPrice += itemPrice;

      // 4. Lưu snapshot thông tin sản phẩm vào mảng items của đơn hàng
      // Snapshot giúp giữ nguyên giá và tên tại thời điểm mua
      orderItems.push({
        teaId: item.teaId,
        name: tea.name,
        quantity: item.quantity,
        price: tea.price,
      });

      // 5. Cập nhật tồn kho (Trừ kho)
      // Hàm updateStock trong TeaService bạn vừa cập nhật sẽ lo việc check isAvailable
      await this.teaService.updateStock(item.teaId, -item.quantity);
    }

    // 6. Tạo đơn hàng hoàn chỉnh
    const order = await this.orderRepository.create({
      userId: new Types.ObjectId(userId) as unknown as Types.ObjectId,
      items: orderItems,
      totalPrice,
      shippingAddress,
      phoneNumber,
      note,
      status: OrderStatus.PENDING,
    });

    // 2. Sau khi lưu thành công, gửi mail ngay (gửi ngầm để không chậm API)
    const user = await this.userService.findOne(userId);

    if (user) {
      this.mailService
        .sendMail(
          user.email, // TypeScript sẽ hiểu user.email tồn tại ở đây
          `Xác nhận đơn hàng #${(order as any)._id.toString().toUpperCase()}`,
          'order-success',
          {
            name: user.name || 'Khách hàng',
            orderId: (order as any)._id.toString(),
            items: orderItems,
            totalPrice: totalPrice.toLocaleString(),
            shippingAddress,
            phoneNumber,
            note: note || 'Không có ghi chú',
          },
        )
        .catch((err) => console.error('Gửi mail hóa đơn thất bại:', err));
    }

    return this.toResponseDto(order);
  }

  async createOrderWithQR(
    userId: string,
    createOrderDto: CreateOrderDto,
  ): Promise<any> {
    const { items, shippingAddress, phoneNumber, note } = createOrderDto;
    let totalPrice = 0;
    const orderItems: OrderItem[] = [];

    // Duyệt qua từng món trà khách đặt
    for (const item of items) {
      // 1. Tìm thông tin trà
      const tea = await this.teaService.findOne(item.teaId);

      // 2. Kiểm tra tính khả dụng và tồn kho
      // Lưu ý: tea ở đây là ResponseTeaDto nên hãy đảm bảo bạn đã @Expose trường stock và isAvailable
      if (!tea) {
        throw new NotFoundException(
          `Sản phẩm với ID ${item.teaId} không tồn tại`,
        );
      }

      if (!tea.isAvailable || tea.stock < item.quantity) {
        throw new BadRequestException(
          `Sản phẩm ${tea.name} hiện không đủ hàng hoặc đã ngừng bán, trạng thái còn hàng: ${tea.isAvailable}, số lượng kho: ${tea.stock}`,
        );
      }

      // 3. Tính toán giá tiền
      const itemPrice = tea.price * item.quantity;
      totalPrice += itemPrice;

      // 4. Lưu snapshot thông tin sản phẩm vào mảng items của đơn hàng
      // Snapshot giúp giữ nguyên giá và tên tại thời điểm mua
      orderItems.push({
        teaId: item.teaId,
        name: tea.name,
        quantity: item.quantity,
        price: tea.price,
      });

      // 5. Cập nhật tồn kho (Trừ kho)
      // Hàm updateStock trong TeaService bạn vừa cập nhật sẽ lo việc check isAvailable
      await this.teaService.updateStock(item.teaId, -item.quantity);
    }

    // 6. Tạo đơn hàng hoàn chỉnh
    const order = await this.orderRepository.create({
      userId: new Types.ObjectId(userId) as unknown as Types.ObjectId,
      items: orderItems,
      totalPrice,
      shippingAddress,
      phoneNumber,
      note,
      status: OrderStatus.PENDING,
    });

    // 1. Tạo orderCode cho PayOS (phải là số và không trùng)
    const orderCode = Number(Date.now().toString().slice(-6));

    // 2. Tạo link thanh toán 2.000đ (Fix cứng để demo)
    try {
      const paymentData = {
        orderCode: orderCode,
        amount: 2000, // SỐ TIỀN THỰC TẾ KHÁCH QUÉT QR
        description: `Thanh toan don hang #${orderCode}`,
        items: orderItems.map((item) => ({
          name: item.name, // Khớp với productName trong template mail nếu cần
          quantity: item.quantity,
          price: item.price,
        })),
        returnUrl: `http://localhost:3000/success`, // Link khi khách trả xong
        cancelUrl: `http://localhost:3000/cancel`,
      };

      const paymentLink = (await this.payos.createPaymentLink(paymentData)) as {
        checkoutUrl: string;
      };

      // 2. Sau khi lưu thành công, gửi mail ngay (gửi ngầm để không chậm API)
      const user = await this.userService.findOne(userId);

      if (user) {
        this.mailService
          .sendMail(
            user.email, // TypeScript sẽ hiểu user.email tồn tại ở đây
            `Xác nhận đơn hàng #${(order as any)._id.toString().toUpperCase()}`,
            'order-success',
            {
              name: user.name || 'Khách hàng',
              orderId: (order as any)._id.toString(),
              items: orderItems,
              totalPrice: totalPrice.toLocaleString(),
              shippingAddress,
              phoneNumber,
              note: note || 'Không có ghi chú',
            },
          )
          .catch((err) => console.error('Gửi mail hóa đơn thất bại:', err));
      }
      return {
        ...this.toResponseDto(order),
        checkoutUrl: paymentLink.checkoutUrl,
      };
    } catch (error) {
      console.error('Lỗi PayOS:', error);
      throw new BadRequestException('Không thể tạo link thanh toán');
    }

    // return this.toResponseDto(order);
  }

  // async handleWebhook(body: unknown) {
  //   // 1. Xác thực dữ liệu từ PayOS (hết lỗi Unsafe call)
  //   const webhookData: PayOSWebhookData =
  //     this.payos.verifyPaymentWebhookData(body);

  //   if (webhookData.description.includes('Thanh toan don hang')) {
  //     const orderCode = webhookData.orderCode;

  //     // Tìm đơn hàng bằng orderCode (Ép kiểu filter để khớp với repository)
  //     const order = await this.orderRepository.findOne({ orderCode } as any);

  //     if (order && order.status === OrderStatus.PENDING) {
  //       // Cập nhật trạng thái thành PAID
  //       // Sử dụng (order as any)._id nếu Order type của Điền chưa có trường _id
  //       await this.orderRepository.updateOrderStatusById(
  //         (order as any)._id.toString(),
  //         OrderStatus.PAID,
  //       );

  //       // Gửi mail thông báo thành công
  //       const user = await this.userService.findOne(order.userId.toString());
  //       if (user) {
  //         await this.mailService.sendMail(
  //           user.email,
  //           'Thanh toán thành công',
  //           'order-success',
  //           {
  //             name: user.name,
  //             orderId: (order as any)._id.toString(),
  //             totalPrice: order.totalPrice.toLocaleString(),
  //             items: order.items,
  //           },
  //         );
  //       }
  //     }
  //   }
  //   return { success: true };
  // }

  async handleWebhook(body: unknown) {
    const webhookData: PayOSWebhookData =
      this.payos.verifyPaymentWebhookData(body);

    if (webhookData.description.includes('Thanh toan don hang')) {
      const orderCode = webhookData.orderCode;
      const order = await this.orderRepository.findOne({ orderCode } as any);

      if (order && order.status === OrderStatus.PENDING) {
        // 1. Cập nhật trạng thái thành PAID
        await this.orderRepository.updateOrderStatusById(
          (order as any)._id.toString(),
          OrderStatus.PAID,
        );

        // 2. TÌM USER ĐỂ LẤY EMAIL (Đây là lúc thích hợp nhất để gửi mail)
        const user = await this.userService.findOne(order.userId.toString());
        if (user) {
          await this.mailService.sendMail(
            user.email,
            `Hóa đơn thanh toán thành công cho đơn hàng #${orderCode}`,
            'order-success', // Template hóa đơn thành công
            {
              name: user.name,
              orderId: (order as any)._id.toString(),
              totalPrice: order.totalPrice.toLocaleString(),
              items: order.items,
              status: 'Đã thanh toán (PayOS)',
            },
          );
        }
      }
    }
    return { success: true };
  }

  async getAllOrdersByUserId(userId: string): Promise<ResponseOrderDto[]> {
    const orders = await this.orderRepository.findAllByUserId(userId);
    if (!orders || orders.length === 0) {
      throw new NotFoundException(
        `Không tìm thấy đơn hàng với user ID ${userId}`,
      );
    }
    return orders.map((order) => this.toResponseDto(order));
  }

  async findOne(orderId: string): Promise<ResponseOrderDto> {
    const order = await this.orderRepository.findOne(orderId);
    if (!order) {
      throw new NotFoundException(`Không tìm thấy đơn hàng với ID ${orderId}`);
    }
    return this.toResponseDto(order);
  }

  async updateStatus(
    id: string,
    updateDto: UpdateOrderStatusDto,
    currentUser: any,
  ) {
    const order = await this.orderRepository.findOne(id);
    if (!order) {
      throw new NotFoundException(`Không tìm thấy đơn hàng với ID: ${id}`);
    }

    const isOwner = order.userId.toString() === currentUser._id.toString();
    const isAdminOrManager = [RoleEnum.ADMIN, RoleEnum.MANAGER].includes(
      currentUser.role,
    );

    if (!isOwner && !isAdminOrManager) {
      throw new ForbiddenException(
        'Bạn không có quyền thực hiện hành động này',
      );
    }

    if (!isAdminOrManager && updateDto.status !== OrderStatus.CANCELLED) {
      throw new ForbiddenException(
        'Bạn chỉ có quyền hủy đơn, không có quyền cập nhật trạng thái',
      );
    }

    if (
      order.status === OrderStatus.CANCELLED ||
      order.status === OrderStatus.DELIVERED
    ) {
      throw new BadRequestException(
        `Trạng thái đơn hàng: ${order.status}, không thể cập nhật`,
      );
    }

    if (updateDto.status == OrderStatus.CANCELLED) {
      for (const item of order.items) {
        await this.orderRepository.updateTeaStock(
          item.teaId.toString(),
          item.quantity,
        );
      }
    }

    // Giả sử updateDto của bạn có trường status
    const updated = await this.orderRepository.updateOrderStatusById(
      id,
      updateDto.status,
    );

    if (!updated) {
      throw new NotFoundException('Cập nhật thất bại');
    }

    return this.toResponseDto(updated);
  }

  // async updateOrder(
  //   id: string,
  //   updateTeaDto: UpdateOrderDto,
  // ): Promise<ResponseOrderDto> {
  //   const updateOrder = await this.orderRepository.findByIdAndUpdate(
  //     id,
  //     updateTeaDto,
  //   );

  //   if (!updateOrder) {
  //     throw new NotFoundException(`Order with ID ${id} not found`);
  //   }

  //   return this.toResponseDto(updateOrder);
  // }

  async updateOrder(
    id: string,
    updateOrderDto: UpdateOrderDto,
  ): Promise<ResponseOrderDto> {
    const currentOrder = await this.orderRepository.findOne(id);

    if (!currentOrder) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    if (currentOrder.status != OrderStatus.PENDING) {
      throw new BadRequestException(
        `Current order status: ${currentOrder.status}, cannot update Order with ID ${id}`,
      );
    }

    const updateOrder = this.orderRepository.findByIdAndUpdate(
      id,
      updateOrderDto,
    );

    return this.toResponseDto(updateOrder);
  }

  async cancelOrder(id: string): Promise<ResponseOrderDto> {
    const order = await this.orderRepository.findOne(id);
    if (!order) {
      throw new NotFoundException(`Không tìm thấy đơn hàng với ID ${id}`);
    }

    if (order.status != OrderStatus.PENDING) {
      throw new BadRequestException(
        `Trạng thái đơn hàng: ${order.status}, không thể hủy`,
      );
    }

    for (const item of order.items) {
      await this.orderRepository.updateTeaStock(
        item.teaId.toString(),
        item.quantity,
      );
    }

    const cancelOrder = this.orderRepository.updateOrderStatusById(
      id,
      OrderStatus.CANCELLED,
    );

    return this.toResponseDto(cancelOrder);
  }

  async removeOrder(id: string) {
    const result = await this.orderRepository.delete(id);
    if (!result) throw new NotFoundException('Không tìm thấy đơn hàng');
    return { message: 'Đã xóa khỏi danh sách đơn hàng' };
  }

  // 🔥 Helpers Transform giống hệt User example
  private toResponseDto(order: any): ResponseOrderDto {
    const instance = plainToInstance(ResponseOrderDto, order, {
      excludeExtraneousValues: true,
    });

    // Ép kiểu qua unknown để dập tắt cảnh báo TS
    return instance as unknown as ResponseOrderDto;
  }
}
