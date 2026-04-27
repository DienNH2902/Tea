import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { HashUtil } from 'src/utils/helpers';
import { plainToInstance } from 'class-transformer';
import { ResponseUserDto } from './dto/response-user.dto';
import { UsersRepository } from './users.repository';
import { GenderEnum } from 'src/constants/genderEnum.enum';
@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async create(createUserDto: CreateUserDto): Promise<ResponseUserDto> {
    const checkExistedEmail = await this.usersRepository.findOne({
      email: createUserDto.email,
    });

    if (checkExistedEmail) {
      throw new ConflictException(
        `Email ${createUserDto.email} đã được sử dụng bởi người dùng khác`,
      );
    }
    const hashedPassword = await HashUtil.hash(createUserDto.password);

    const createdUser = await this.usersRepository.create({
      ...createUserDto,
      password: hashedPassword,
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
