import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true })
export class User {
  // @Prop({
  //   type: Types.ObjectId,
  //   default: () => new Types.ObjectId(),
  // })
  // _id: Types.ObjectId;

  @Prop({ type: String, required: true })
  name: string;

  @Prop({ type: String, required: true, unique: true }) // Thêm unique cho email
  email: string;

  @Prop({ type: String, required: true })
  password: string;

  @Prop({ type: Number })
  age: number;

  @Prop({ type: Boolean })
  gender: boolean;

  @Prop({ type: Number, default: 0 })
  role: number;

  @Prop({ type: String })
  address: string;

  @Prop({ type: Boolean, default: false })
  isRegular: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);
