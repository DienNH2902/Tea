import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { CartRepository } from './cart.repository';
import { CreateCartDto } from './dto/create-cart.dto';
import { ResponseCartDto } from './dto/response-cart.dto';
import { plainToInstance } from 'class-transformer';
import { Types } from 'mongoose';
import { UpdateCartDto } from './dto/update-cart.dto';

@Injectable()
export class CartService {
  constructor(private readonly cartRepository: CartRepository) {}

  async addToCart(
    userId: string,
    createCartDto: CreateCartDto,
  ): Promise<ResponseCartDto> {
    const { teaId, note } = createCartDto;
    // Kiểm tra xem đã tồn tại trong danh sách yêu thích chưa
    const existing = await this.cartRepository.findOne(userId, teaId);
    if (existing) {
      throw new ConflictException('Món này đã có trong danh sách yêu thích');
    }

    const item = await this.cartRepository.create({
      userId: new Types.ObjectId(userId) as unknown as Types.ObjectId,
      teaId: new Types.ObjectId(teaId) as unknown as Types.ObjectId,
      note: note,
    });
    return this.toResponseDto(item);
  }

  async getMyCart(userId: string): Promise<ResponseCartDto[]> {
    const items = await this.cartRepository.findAllByUserId(userId);
    return items.map((item) => this.toResponseDto(item));
  }

  async updateNote(id: string, note: UpdateCartDto): Promise<ResponseCartDto> {
    const updated = await this.cartRepository.update(id, note);
    if (!updated) throw new NotFoundException('Không tìm thấy mục yêu thích');
    return this.toResponseDto(updated);
  }

  async removeItem(id: string) {
    const result = await this.cartRepository.delete(id);
    if (!result) throw new NotFoundException('Không tìm thấy mục yêu thích');
    return { message: 'Đã xóa khỏi danh sách yêu thích' };
  }

  //Hepler
  private toResponseDto(cart: any): ResponseCartDto {
    return plainToInstance(ResponseCartDto, cart, {
      excludeExtraneousValues: true,
    });
  }
}
