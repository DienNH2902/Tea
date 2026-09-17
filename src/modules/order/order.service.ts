import { RoleEnum } from 'src/constants/roleEnum.enum';
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
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
import { VnPayService } from '../payment/vnpay.service';
import { OrderDocument } from './schemas/order.schema';

interface VnPayCallbackResponse {
  success: boolean;
  message: string;
  amount?: number;
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly orderRepository: OrdersRepository,
    private readonly teaService: TeaService,
    private readonly mailService: MailService,
    private readonly userService: UsersService,
    private readonly vnPayService: VnPayService,
  ) {}

  async create(
    userId: string,
    createOrderDto: CreateOrderDto,
    // Kênh tạo đơn: 'web' = khách tự đặt qua web/app (mặc định, giữ nguyên
    // hành vi cũ), 'bot' = do BOT AI tạo giúp khách sau khi tự kiểm kho và
    // xác nhận với khách qua chat (xem src/modules/bot/tools/create-order.tool.ts)
    channel: 'web' | 'bot' = 'web',
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
      channel,
    });

    // 2. Sau khi lưu thành công, gửi mail ngay (gửi ngầm để không chậm API)
    // const user = await this.userService.findOne(userId);

    // if (user) {
    //   this.mailService
    //     .sendMail(
    //       user.email, // TypeScript sẽ hiểu user.email tồn tại ở đây
    //       `Xác nhận đơn hàng #${(order as any)._id.toString().toUpperCase()}`,
    //       'order-success',
    //       {
    //         name: user.name || 'Khách hàng',
    //         orderId: (order as any)._id.toString(),
    //         items: orderItems,
    //         totalPrice: totalPrice.toLocaleString(),
    //         shippingAddress,
    //         phoneNumber,
    //         note: note || 'Không có ghi chú',
    //       },
    //     )
    //     .catch((err) => console.error('Gửi mail hóa đơn thất bại:', err));
    // }

    return this.toResponseDto(order);
  }

  /**
   * Tạo đơn hàng và trả về link thanh toán VNPay (thay thế cho PayOS trước đây).
   * Giữ nguyên toàn bộ logic tạo đơn / trừ kho / gửi mail như bản PayOS cũ,
   * chỉ thay phần sinh link thanh toán từ PayOS sang VNPay.
   */
  async createOrderWithVnpay(
    userId: string,
    createOrderDto: CreateOrderDto,
    ipAddr: string,
    bankCode?: string,
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

    const orderId = (order as OrderDocument)._id.toString();

    // Nhúng orderId + số tiền gốc vào vnp_TxnRef để đối chiếu khi VNPay
    // gọi callback về, giống cách bảo mật đã dùng ở dự án cũ (referenceId
    // chứa amount gốc để tránh bị giả mạo số tiền).
    const referenceId = `${orderId}_${totalPrice}_${Date.now()}`;

    try {
      const paymentUrl = this.vnPayService.createPaymentUrl(
        referenceId,
        totalPrice,
        ipAddr,
        bankCode,
      );

      // Gửi mail xác nhận đơn ngay (gửi ngầm để không chậm API), giữ nguyên
      // hành vi như bản PayOS cũ.
      // const user = await this.userService.findOne(userId);

      // if (user) {
      //   this.mailService
      //     .sendMail(
      //       user.email,
      //       `Xác nhận đơn hàng #${orderId.toUpperCase()}`,
      //       'order-success',
      //       {
      //         name: user.name || 'Khách hàng',
      //         orderId,
      //         items: orderItems,
      //         totalPrice: totalPrice.toLocaleString(),
      //         shippingAddress,
      //         phoneNumber,
      //         note: note || 'Không có ghi chú',
      //       },
      //     )
      //     .catch((err) => console.error('Gửi mail hóa đơn thất bại:', err));
      // }

      return {
        ...this.toResponseDto(order),
        paymentUrl,
      };
    } catch (error) {
      console.error('Lỗi VNPay:', error);
      throw new BadRequestException('Không thể tạo link thanh toán');
    }
  }

  /**
   * Xử lý callback VNPay trả về (thay thế cho handleWebhook của PayOS).
   */
  async processVnPayCallback(
    query: Record<string, string>,
  ): Promise<VnPayCallbackResponse> {
    const result = this.vnPayService.verifyCallback(query);
    if (!result.isValid) {
      throw new BadRequestException('Chữ ký không hợp lệ');
    }

    const { txnRef, responseCode, amount: callbackAmount } = result;

    // Bóc tách referenceId để lấy orderId và originalAmount
    const parts = txnRef.split('_');
    const orderId = parts[0];
    const originalAmount = parseInt(parts[1] || '0', 10);

    // Đối chiếu số tiền trả về từ VNPay với số tiền gốc lúc khởi tạo
    if (callbackAmount !== originalAmount) {
      throw new BadRequestException(
        'Số tiền thanh toán không khớp với yêu cầu khởi tạo',
      );
    }

    const order = await this.orderRepository.findOne(orderId);
    if (!order) {
      throw new NotFoundException(`Không tìm thấy đơn hàng với ID ${orderId}`);
    }

    // Idempotency: nếu đơn không còn ở trạng thái PENDING thì đã xử lý trước đó
    if (order.status !== OrderStatus.PENDING) {
      return { success: true, message: 'Giao dịch đã được xử lý trước đó' };
    }

    if (responseCode === '00') {
      await this.orderRepository.updateOrderStatusById(
        orderId,
        OrderStatus.PAID,
      );

      const user = await this.userService.findOne(order.userId.toString());
      if (user) {
        await this.mailService.sendMail(
          user.email,
          `Hóa đơn thanh toán thành công cho đơn hàng #${orderId}`,
          'order-success',
          {
            name: user.name,
            orderId,
            totalPrice: order.totalPrice.toLocaleString(),
            items: order.items,
            status: 'Đã thanh toán (VNPay)',
          },
        );
      }

      return {
        success: true,
        message: 'Thanh toán thành công',
        amount: callbackAmount,
      };
    }

    return { success: false, message: 'Giao dịch thất bại hoặc bị hủy' };
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
