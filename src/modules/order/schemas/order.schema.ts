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

  // Kênh mà đơn hàng được tạo ra: 'web' (khách tự đặt qua web/app như cũ)
  // hoặc 'bot' (khách chat với BOT AI và được BOT tạo đơn giúp).
  // Trường này phục vụ thống kê/báo cáo sau này (ví dụ: bao nhiêu % đơn
  // hàng tới từ BOT), KHÔNG ảnh hưởng gì tới luồng xử lý đơn hàng hiện có.
  @Prop({ type: String, enum: ['web', 'bot'], default: 'web' })
  channel: string;
}

export const OrderSchema = SchemaFactory.createForClass(Order);
