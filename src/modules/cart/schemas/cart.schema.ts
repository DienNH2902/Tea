import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type CartDocument = HydratedDocument<Cart>;

@Schema({ timestamps: true })
export class Cart {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Tea', required: true })
  teaId: Types.ObjectId;

  @Prop({ type: String })
  note?: string; // Ghi chú riêng cho món yêu thích (ví dụ: "Món này uống khi trời mưa")
}

export const CartSchema = SchemaFactory.createForClass(Cart);
