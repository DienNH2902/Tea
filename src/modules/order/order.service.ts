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

@Injectable()
export class OrdersService {
  constructor(
    private readonly orderRepository: OrdersRepository,
    private readonly teaService: TeaService,
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

    return this.toResponseDto(order);
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
