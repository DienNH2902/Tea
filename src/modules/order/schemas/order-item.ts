import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ _id: false }) // Không cần tạo _id riêng cho từng dòng item
export class OrderItem {
  @Prop({ type: String, ref: 'Tea', required: true })
  teaId: string;

  @Prop({ type: String, required: true })
  name: string; // Lưu tên trà tại thời điểm mua (phòng trường hợp sau này bạn đổi tên sp)

  @Prop({ type: Number, required: true })
  quantity: number;

  @Prop({ type: Number, required: true })
  price: number; // Quan trọng: Giá chè tại thời điểm chốt đơn
}

export const OrderItemSchema = SchemaFactory.createForClass(OrderItem);
