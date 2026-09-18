import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { HashUtil } from 'src/utils/helpers';
import { plainToInstance } from 'class-transformer';
import { ResponseUserDto } from './dto/response-user.dto';
import { UsersRepository } from './users.repository';
import { GenderEnum } from 'src/constants/genderEnum.enum';
import { MailService } from '../mail/mail.service';
import { UpdatePasswordDto } from './dto/update-password.dto';
@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly mailService: MailService,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<ResponseUserDto> {
    const checkExistedEmail = await this.usersRepository.findOne({
      email: createUserDto.email,
    });

    if (checkExistedEmail) {
      throw new ConflictException(
        `Email ${createUserDto.email} đã được sử dụng bởi người dùng khác`,
      );
    }

    // const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    const hashedPassword = await HashUtil.hash(createUserDto.password);

    const createdUser = await this.usersRepository.create({
      ...createUserDto,
      password: hashedPassword,
    });

    // this.mailService
    //   .sendVerificationEmail(createUserDto.email, createUserDto.name, otpCode)
    //   .catch((err) => {
    //     console.error('Lỗi gửi mail xác thực:', err);
    //   });

    this.mailService
      .sendWelcomeEmail(createUserDto.email, createUserDto.name)
      .catch((err) => {
        // Chỉ log lỗi ra console chứ không crash API đăng ký của khách hàng
        console.error('Lỗi gửi mail ngầm:', err);
      });

    return this.toResponseDto(createdUser);
  }

  async findAll(): Promise<ResponseUserDto[]> {
    const users = await this.usersRepository.findAll();
    return users.map((user) => this.toResponseDto(user));
  }

  async findOne(id: string): Promise<ResponseUserDto> {
    const user = await this.usersRepository.findOne({ _id: id });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return this.toResponseDto(user);
  }

  async findUserByName(name: string): Promise<ResponseUserDto[] | null> {
    const users = await this.usersRepository.findUserByName(name);
    if (!users || users.length === 0) {
      throw new NotFoundException(`No users found with name: ${name}`);
    }
    return users.map((user) => this.toResponseDto(user));
  }

  async findByGender(gender: GenderEnum): Promise<ResponseUserDto[]> {
    const users = await this.usersRepository.findByGender(gender);
    if (!users || users.length === 0) {
      throw new NotFoundException(`No users found with gender: ${gender}`);
    }
    return users.map((user) => this.toResponseDto(user));
  }

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
  ): Promise<ResponseUserDto> {
    if (updateUserDto.password) {
      updateUserDto.password = await HashUtil.hash(updateUserDto.password);
    }

    const updatedUser = await this.usersRepository.findByIdAndUpdate(
      id,
      updateUserDto,
    );
    if (!updatedUser) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return this.toResponseDto(updatedUser);
  }

  async updatePassword(
    userId: string,
    updatePasswordDto: UpdatePasswordDto,
  ): Promise<{ message: string }> {
    const { oldPassword, newPassword } = updatePasswordDto;

    // 1. Tìm user trực tiếp bằng ID và lấy luôn mật khẩu
    const user = await this.usersRepository.findByIdForAuth(userId);

    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    // 3. Kiểm tra mật khẩu cũ
    const isMatch = await HashUtil.compare(oldPassword, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Mật khẩu cũ không chính xác');
    }

    // 4. Hash mật khẩu mới và lưu
    const hashedNewPassword = await HashUtil.hash(newPassword);
    await this.usersRepository.updatePassword(userId, hashedNewPassword);

    return { message: 'Đổi mật khẩu thành công' };
  }

  /**
   * Kiểm tra và trừ tiền trong ví nội bộ của user. Dùng cho luồng thanh
   * toán đơn hàng bằng số dư (áp dụng cho cả đơn tự đặt lẫn đơn do bot tạo).
   *
   * Nếu không đủ tiền, message lỗi nêu rõ CẢ tổng tiền đơn hàng LẪN số dư
   * hiện có của khách, để khách biết chính xác đang thiếu bao nhiêu (bot
   * chỉ việc trả nguyên `error.message` này lại cho khách - xem
   * `create-order.tool.ts`, nhánh catch BadRequestException).
   */
  async deductBalance(userId: string, amount: number): Promise<void> {
    const updated = await this.usersRepository.deductBalance(userId, amount);
    if (!updated) {
      const currentUser = await this.usersRepository.findOne({ _id: userId });
      const currentBalance = currentUser?.balance ?? 0;

      throw new BadRequestException(
        `Số dư trong ví không đủ để thanh toán đơn hàng này. ` +
          `Tổng tiền đơn hàng: ${amount.toLocaleString('vi-VN')}đ, ` +
          `số dư hiện tại của bạn: ${currentBalance.toLocaleString('vi-VN')}đ.`,
      );
    }
  }

  async remove(id: string): Promise<void> {
    const deleted = await this.usersRepository.delete(id);
    if (!deleted) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
  }

  //helpers
  private toResponseDto(user: any): ResponseUserDto {
    const instance = plainToInstance(ResponseUserDto, user, {
      excludeExtraneousValues: true,
    });

    // Chuyển qua unknown trước khi ép kiểu để TS không than phiền về "overlap"
    return instance as unknown as ResponseUserDto;
  }
}
