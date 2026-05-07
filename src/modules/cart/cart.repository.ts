import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cart, CartDocument } from './schemas/cart.schema';
import { UpdateCartDto } from './dto/update-cart.dto';
import { Tea, TeaDocument } from '../tea/schemas/tea.schema';

@Injectable()
export class CartRepository {
  constructor(
    @InjectModel(Cart.name) private cartModel: Model<CartDocument>,
    @InjectModel(Tea.name) private teaModel: Model<TeaDocument>,
  ) {}

  async create(data: Partial<Cart>): Promise<Cart> {
    const newItem = new this.cartModel(data);
    return newItem.save();
  }

  async findAllByUserId(userId: string): Promise<Cart[]> {
    return this.cartModel
      .find({ userId: new Types.ObjectId(userId) })
      .populate('teaId') // Lấy thêm thông tin trà
      .sort({ createdAt: -1 })
      .lean()
      .exec();
  }

  async findOne(userId: string, teaId: string): Promise<Cart | null> {
    return this.cartModel
      .findOne({
        userId: new Types.ObjectId(userId),
        teaId: new Types.ObjectId(teaId),
      })
      .lean()
      .exec();
  }

  async findTeaById(teaId: string): Promise<Tea | null> {
    return this.teaModel.findById(teaId).lean().exec();
  }

  async update(id: string, updateCartDto: UpdateCartDto): Promise<Cart | null> {
    return this.cartModel
      .findByIdAndUpdate(
        id,
        { note: updateCartDto.note },
        { returnDocument: 'after' },
      )
      .lean()
      .exec();
  }

  async delete(id: string): Promise<Cart | null> {
    return this.cartModel.findByIdAndDelete(id).exec();
  }
}
