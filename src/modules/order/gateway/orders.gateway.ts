import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { RoleEnum } from 'src/constants/roleEnum.enum';
import { ResponseOrderDto } from '../dto/response-order.dto';

interface SocketJwtPayload {
  sub: string;
  role: RoleEnum;
}

/**
 * ============================================================================
 *  ORDERS GATEWAY - ĐẨY CẬP NHẬT TRẠNG THÁI ĐƠN HÀNG THEO THỜI GIAN THỰC
 * ============================================================================
 * Trước đây backend KHÔNG có bất kỳ hạ tầng WebSocket nào - trang "đơn hàng
 * của tôi"/"quản lý đơn" ở frontend chỉ có thể biết trạng thái đơn mới bằng
 * cách gọi lại API (polling hoặc reload trang thủ công). Gateway này bổ
 * sung 1 kênh đẩy sự kiện: mỗi khi `OrdersService.updateStatus()` cập nhật
 * thành công, gọi `ordersGateway.emitOrderUpdated(order)` để đẩy NGAY sự
 * kiện `order:updated` tới đúng những client đang quan tâm, KHÔNG cần họ
 * tự hỏi lại server.
 *
 * CƠ CHẾ "PHÒNG" (room) để chỉ gửi đúng người cần nhận, không phát tán bừa:
 *  - Mỗi khách hàng, sau khi connect, tự động được cho vào phòng riêng
 *    `user:<userId>` (suy ra từ JWT gửi kèm lúc connect) - chỉ nhận được
 *    cập nhật của CHÍNH đơn hàng của mình.
 *  - Nếu là ADMIN/MANAGER, được cho vào thêm phòng `admin-orders` - nhận
 *    được cập nhật của TẤT CẢ đơn hàng, phục vụ trang quản lý đơn.
 *
 * XÁC THỰC: Next.js client kết nối kèm `auth: { token: '<JWT>' }` trong lúc
 * khởi tạo socket (xem `frontend/src/lib/socket.ts`). Gateway tự giải mã
 * JWT bằng CHÍNH `JwtService` mà `AuthModule` đang dùng (cùng secret) - vì
 * vậy không cần khai báo lại secret ở đây.
 * ============================================================================
 */
@Injectable()
@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    credentials: true,
  },
  namespace: '/orders',
})
export class OrdersGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(OrdersGateway.name);

  constructor(private readonly jwtService: JwtService) {}

  /** Chạy mỗi khi có 1 client (tab trình duyệt) kết nối tới namespace /orders */
  handleConnection(client: Socket) {
    try {
      const token =
        (client.handshake.auth?.token as string | undefined) ??
        (client.handshake.headers?.authorization as string)?.replace(
          'Bearer ',
          '',
        );

      if (!token) {
        // Khách vãng lai (chưa đăng nhập) vẫn được phép connect (ví dụ để
        // sau này mở rộng thông báo công khai), chỉ là không có phòng riêng.
        return;
      }

      const payload = this.jwtService.verify<SocketJwtPayload>(token);
      void client.join(`user:${payload.sub}`);

      if (
        payload.role === RoleEnum.ADMIN ||
        payload.role === RoleEnum.MANAGER
      ) {
        void client.join('admin-orders');
      }
    } catch {
      // Token sai/hết hạn -> không join phòng nào, không ném lỗi làm sập
      // kết nối - client vẫn connect được nhưng sẽ không nhận sự kiện nào.
      this.logger.warn(
        `Socket ${client.id} gửi token không hợp lệ khi connect`,
      );
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Socket ${client.id} đã ngắt kết nối`);
  }

  /**
   * Đẩy sự kiện "đơn hàng vừa được cập nhật" tới đúng chủ đơn hàng đó VÀ
   * mọi admin/manager đang mở trang quản lý đơn - gọi hàm này ngay sau khi
   * `OrdersService` ghi thành công xuống DB (tạo đơn mới hoặc đổi status).
   */
  emitOrderUpdated(order: ResponseOrderDto): void {
    this.server
      .to(`user:${order.userId}`)
      .to('admin-orders')
      .emit('order:updated', order);
  }
}
