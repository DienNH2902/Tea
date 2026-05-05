import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { OrderItem, OrderItemSchema } from './order-item';
import { OrderStatus } from 'src/constants/statusEnum.enum';

export type OrderDocument = HydratedDocument<Order>;

@Schema({ timestamps: true })
export class Order {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: [OrderItemSchema], required: true })
  items: OrderItem[];

  @Prop({ type: Number, required: true })
  totalPrice: number;

  @Prop({
    type: String,
    enum: OrderStatus,
    default: OrderStatus.PENDING,
  })
  status: OrderStatus;

  @Prop({ type: String, required: true })
  shippingAddress: string;

  @Prop({ type: String, required: true })
  phoneNumber: string;

  @Prop({ type: String })
  note: string; // Ghi chú của khách (ví dụ: "ít đường", "giao giờ hành chính")
}

export const OrderSchema = SchemaFactory.createForClass(Order);
