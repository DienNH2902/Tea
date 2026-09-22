import { UsersService } from './../users/users.service';
// src/modules/auth/auth.service.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersRepository } from '../users/users.repository';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { plainToInstance } from 'class-transformer';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { ResponseUserDto } from '../users/dto/response-user.dto';

@Injectable()
export class AuthService {
  constructor(
    private usersRepository: UsersRepository,
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  // 1. REGISTER
  async register(registerDto: RegisterDto) {
    // const { email, password } = registerDto;

    // // Kiểm tra email tồn tại
    // const user = await this.usersRepository.findOne({ email });
    // if (user) throw new ConflictException('Email đã tồn tại!');

    // // Mã hóa mật khẩu
    // const hashedPassword = await bcrypt.hash(password, 10);

    // return this.usersRepository.create({
    //   ...registerDto,
    //   password: hashedPassword,
    // });
    return await this.usersService.create({
      ...registerDto,
      role: 1,
      isRegular: false, // Chủ động gán giá trị mặc định cho người mới đăng ký
    } as CreateUserDto);
  }

  // 2. LOGIN
  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    // Tìm user (Lưu ý: Bạn cần một method trong repo cho phép lấy cả password)
    // Ở đây mình tạm dùng findOne, hãy đảm bảo Repo của bạn có method lấy pass khi cần auth
    const user = await this.usersRepository.findByEmailForAuth(email);
    // Vì repo của bạn đang select('-password'), bạn nên bổ sung 1 hàm findByEmail trong Repo.

    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    const payload = {
      sub: user._id.toString(), //sub là Subject, quy chuẩn quốc tế của JWT, thường dùng để lưu id người dùng
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      age: user.age,
      gender: user.gender,
      address: user.address,
      isRegular: user.isRegular,
    };

    return {
      access_token: await this.jwtService.signAsync(payload),
      // LỖI THỰC TẾ ĐÃ XẢY RA (khiến FE báo "response thiếu user" dù
      // backend "báo thành công"): trước đây dùng `new ResponseUserDto(user)`
      // - nhưng constructor của DTO đó tự gọi lại `plainToInstance(...)`,
      // mà `plainToInstance` khi cần tạo instance MỚI lại tự `new
      // ResponseUserDto()` (không tham số) để rồi gán field vào sau -
      // việc này KÍCH HOẠT LẠI constructor, gọi lại `plainToInstance` với
      // `partial = undefined` -> đệ quy hỏng, cuối cùng ra kết quả rỗng.
      // Gọi thẳng `plainToInstance` ở NGOÀI (không qua `new`) - ĐÚNG y hệt
      // cách `UsersService.toResponseDto()` đang làm (nơi KHÔNG bị lỗi
      // này) - để tránh đệ quy.
      user: plainToInstance(ResponseUserDto, user, {
        excludeExtraneousValues: true,
      }),
      refresh_token: await this.jwtService.signAsync(payload, {
        expiresIn: '7d',
      }),
    };
  }
}
