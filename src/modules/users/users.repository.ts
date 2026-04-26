import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, QueryFilter } from 'mongoose';
import { UpdateQuery } from 'mongoose';
import { User } from './schemas/user.schema';

@Injectable()
export class UsersRepository {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}

  async create(user: Partial<User>): Promise<User> {
    const newUser = new this.userModel(user);
    return newUser.save();
  }

  async findAll(): Promise<User[]> {
    return this.userModel.find().lean().exec() as Promise<User[]>;
  }

  async findOne(filter: QueryFilter<User>): Promise<User | null> {
    return (await this.userModel
      .findOne(filter)
      .select('-password -__v')
      .lean()
      .exec()) as unknown as User | null;
  }

  async findUserByName(name: string): Promise<User[] | null> {
    return await this.userModel
      .find({
        name: { $regex: name, $options: 'i' }, // 'i' là không phân biệt hoa thường
      })
      .lean()
      .exec();
  }

  async findByIdAndUpdate(
    id: string,
    updateData: UpdateQuery<User>,
  ): Promise<User | null> {
    return (await this.userModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .lean()
      .exec()) as unknown as User | null;
  }

  async delete(id: string): Promise<User | null> {
    return this.userModel.findByIdAndDelete(id).exec();
  }

  async findByEmailForAuth(email: string): Promise<User | null> {
    return (await this.userModel
      .findOne({ email })
      .select('+password') // Ép Mongoose phải lấy field password ra
      .lean()
      .exec()) as User | null;
  }
}
