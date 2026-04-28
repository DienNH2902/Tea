// src/modules/auth/strategies/jwt.strategy.ts
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from 'src/modules/users/users.service';

interface JwtPayload {
  sub: string;
  name: string;
  email: string;
  age: number;
  role: number;
  gender: number;
  address: string;
  isRegular: boolean;
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private usersService: UsersService,
  ) {
    const jwtSecret = configService.get<string>('JWT_SECRET');

    // Kiểm tra nếu thiếu SECRET thì báo lỗi ngay lúc khởi động
    if (!jwtSecret) {
      throw new Error('JWT_SECRET is not defined in environment variables');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), // Lấy token từ Header
      ignoreExpiration: false, // Kiểm tra hết hạn
      secretOrKey: jwtSecret, // Dùng chìa khóa nào để mở
    });
  }

  // Sau khi giải mã thành công, Payload sẽ tự được ném vào đây (nhờ super())
  async validate(payload: JwtPayload) {
    if (!payload.sub) {
      throw new UnauthorizedException(`Token không hợp lệ`);
    }
    const user = await this.usersService.findOne(payload.sub);
    if (!user) {
      throw new UnauthorizedException();
    }
    // Những gì return ở đây sẽ được NestJS gắn vào request (req.user)
    return user;
  }
}
