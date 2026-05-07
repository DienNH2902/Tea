import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, QueryFilter, UpdateQuery } from 'mongoose';
import { Tea } from './schemas/tea.schema';
import { SortTeaByPrice } from 'src/constants/teaSortByPrice-type.enum';
import { Order } from '../order/schemas/order.schema';

@Injectable()
export class TeaRepository {
  constructor(
    @InjectModel(Tea.name) private teaModel: Model<Tea>,
    @InjectModel(Order.name) private orderModel: Model<Order>,
  ) {}

  async create(tea: Partial<Tea>): Promise<Tea> {
    const newTea = new this.teaModel(tea);
    return newTea.save();
  }

  async findAll(): Promise<Tea[]> {
    return this.teaModel.find().lean().exec() as Promise<Tea[]>;
  }

  async findByTeaType(teaType: string): Promise<Tea[] | null> {
    return (await this.teaModel
      .find({ type: teaType })
      .lean()
      .exec()) as unknown as Tea[] | null;
  }

  async findByTeaName(name: string): Promise<Tea[] | null> {
    return await this.teaModel
      .find({
        name: { $regex: name, $options: 'i' }, // 'i' là không phân biệt hoa thường
      })
      .lean()
      .exec();
  }

  async sortTeaByPrice(chooseOrder: SortTeaByPrice): Promise<Tea[] | null> {
    return await this.teaModel
      .find()
      .sort({ price: chooseOrder })
      .lean()
      .exec();
  }

  async findOne(filter: QueryFilter<Tea>): Promise<Tea | null> {
    return (await this.teaModel
      .findOne(filter)
      .select('-__v')
      .lean()
      .exec()) as unknown as Tea | null;
  }

  // async findTeaById(teaId: string): Promise<Tea | null> {
  //   return this.teaModel.findById(teaId).lean().exec();
  // }

  async findOrderByTeaId(teaId: string): Promise<Order | null> {
    return this.orderModel
      .findOne({ 'items.teaId': `${teaId}` })
      .lean()
      .exec();
  }

  async findByIdAndUpdate(
    id: string,
    updateData: UpdateQuery<Tea>,
  ): Promise<Tea | null> {
    return (await this.teaModel
      .findByIdAndUpdate(id, updateData, { returnDocument: 'after' })
      .lean()
      .exec()) as unknown as Tea | null;
  }

  async updateStock(id: string, quantity: number): Promise<Tea | null> {
    return this.teaModel
      .findByIdAndUpdate(
        id,
        {
          $inc: { stock: quantity }, // Sử dụng $inc để cộng/trừ trực tiếp trong DB
        },
        { returnDocument: 'after' }, // Trả về data sau khi đã cập nhật
      )
      .exec();
  }

  async delete(id: string): Promise<Tea | null> {
    return this.teaModel.findByIdAndDelete(id).exec();
  }
}
