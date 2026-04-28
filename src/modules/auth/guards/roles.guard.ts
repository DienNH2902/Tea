// src/modules/auth/guards/roles.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { RoleEnum } from 'src/constants/roleEnum.enum';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // 1. Lấy danh sách roles yêu cầu từ Decorator @Roles()
    const requiredRoles = this.reflector.getAllAndOverride<RoleEnum[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Nếu API không dán nhãn @Roles, thì cho qua (public trong hệ thống đã đăng nhập)
    if (!requiredRoles) {
      return true;
    }

    // 2. Lấy user từ request (do JwtAuthGuard nạp vào trước đó)
    const request = context
      .switchToHttp()
      .getRequest<{ user: { role: RoleEnum } }>();
    const user = request.user;

    // 3. Kiểm tra quyền
    const hasRole = requiredRoles.some((role) => user?.role === role);

    if (!hasRole) {
      throw new ForbiddenException(
        'Bạn không có quyền thực hiện hành động này',
      );
    }

    return true;
  }
}
