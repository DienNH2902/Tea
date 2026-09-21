import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, QueryFilter, UpdateQuery } from 'mongoose';
import { Tea } from './schemas/tea.schema';
import { SortTeaByPrice } from 'src/constants/teaSortByPrice-type.enum';
import { Order } from '../order/schemas/order.schema';
import { TeaAvailabilityFilter } from 'src/constants/sortAvailableEnum.enum';

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

  // async findAll(): Promise<Tea[]> {
  //   return this.teaModel.find().lean().exec() as Promise<Tea[]>;
  // }

  async findAll(
    page: number,
    limit: number,
  ): Promise<{ data: Tea[]; total: number }> {
    const skip = (page - 1) * limit;

    // Chạy song song cả 2 lệnh để tối ưu tốc độ
    const [data, total] = await Promise.all([
      this.teaModel
        .find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.teaModel.countDocuments().exec(),
    ]);

    return { data, total };
  }

  async findByTeaType(teaType: string): Promise<Tea[] | null> {
    return (await this.teaModel
      .find({ type: teaType })
      .sort({ createdAt: -1 })
      .lean()
      .exec()) as unknown as Tea[] | null;
  }

  async findByTeaName(name: string): Promise<Tea[] | null> {
    return await this.teaModel
      .find({
        $or: [
          {
            name: { $regex: name, $options: 'i' },
          },
          {
            nameEn: { $regex: name, $options: 'i' },
          },
        ],
      })
      .sort({ createdAt: -1 })
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

  async sortAvailableTea(status?: TeaAvailabilityFilter): Promise<Tea[]> {
    const filterQuery: QueryFilter<Tea> = {};

    if (status === TeaAvailabilityFilter.AVAILABLE) {
      filterQuery.isAvailable = true;
    } else if (status === TeaAvailabilityFilter.OUT_OF_STOCK) {
      filterQuery.isAvailable = false;
    }
    // Nếu status === TeaAvailabilityFilter.ALL thì filterQuery = {} (lấy tất cả)

    return await this.teaModel
      .find(filterQuery)
      .sort({ createdAt: -1 }) // Sắp xếp theo ngày tạo mới nhất (hoặc trường bạn muốn)
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
  //   return this.teaModel.findById(id).lean().exec();
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
          $inc: { stock: quantity },
        },
        { returnDocument: 'after' },
      )
      .exec();
  }

  async delete(id: string): Promise<Tea | null> {
    return this.teaModel.findByIdAndDelete(id).exec();
  }
}
