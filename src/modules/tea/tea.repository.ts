import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, QueryFilter, UpdateQuery } from 'mongoose';
import { Tea } from './schemas/tea.schema';
import { SortTeaByPrice } from 'src/constants/teaSortByPrice-type.enum';

@Injectable()
export class TeaRepository {
  constructor(@InjectModel(Tea.name) private teaModel: Model<Tea>) {}

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

  async findByIdAndUpdate(
    id: string,
    updateData: UpdateQuery<Tea>,
  ): Promise<Tea | null> {
    return (await this.teaModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .lean()
      .exec()) as unknown as Tea | null;
  }

  async delete(id: string): Promise<Tea | null> {
    return this.teaModel.findByIdAndDelete(id).exec();
  }
}
