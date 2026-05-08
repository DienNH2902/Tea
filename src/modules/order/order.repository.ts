import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, UpdateQuery } from 'mongoose';
import { Order, OrderDocument } from './schemas/order.schema';
import { OrderStatus } from 'src/constants/statusEnum.enum';
import { Tea, TeaDocument } from '../tea/schemas/tea.schema';

@Injectable()
export class OrdersRepository {
  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(Tea.name) private teaModel: Model<TeaDocument>,
  ) {}

  async create(orderData: Partial<Order>): Promise<Order> {
    const newOrder = new this.orderModel(orderData);
    return newOrder.save();
  }

  async findAllByUserId(userId: string): Promise<Order[]> {
    return this.orderModel
      .find({ userId: new Types.ObjectId(userId) })
      .populate('userId')
      .sort({ createdAt: -1 })
      .lean()
      .exec();
  }

  async findOne(id: string): Promise<Order | null> {
    return this.orderModel.findById(id).lean().exec();
  }

  // async findOrderByTeaId(teaId: string): Promise<Order | null> {
  //   return this.orderModel
  //     .findById({ teaId: new Types.ObjectId(teaId) })
  //     .lean()
  //     .exec();
  // }

  async updateOrderStatusById(
    id: string,
    status: OrderStatus,
  ): Promise<Order | null> {
    return await this.orderModel
      .findByIdAndUpdate(
        id,
        { $set: { status: status } },
        { returnDocument: 'after' },
      )
      .lean()
      .exec();
  }

  async updateTeaStock(id: string, quantity: number): Promise<Tea | null> {
    const updateTea = await this.teaModel
      .findByIdAndUpdate(
        id,
        {
          $inc: { stock: quantity }, // Sử dụng $inc để cộng/trừ trực tiếp trong DB
        },
        { returnDocument: 'after' }, // Trả về data sau khi đã cập nhật
      )
      .exec();

    if (updateTea && updateTea.stock > 0 && !updateTea.isAvailable) {
      await this.teaModel.findByIdAndUpdate(id, { isAvailable: true });
      updateTea.isAvailable = true;
    }

    return updateTea;
  }

  async findByIdAndUpdate(
    id: string,
    updateData: UpdateQuery<Order>,
  ): Promise<Order | null> {
    return await this.orderModel
      .findByIdAndUpdate(id, updateData, { returnDocument: 'after' })
      .lean()
      .exec();
  }

  async delete(id: string): Promise<Order | null> {
    return this.orderModel.findByIdAndDelete(id).exec();
  }
}
