import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { TeaType } from 'src/constants/tea-type.enum';

export type TeaDocument = HydratedDocument<Tea>;

@Schema({ timestamps: true })
export class Tea {
  //   @Prop({
  //     type: Types.ObjectId,
  //     default: () => new Types.ObjectId(),
  //   })
  //   _id: Types.ObjectId;

  @Prop({ type: String, required: true })
  name: string;

  @Prop({
    type: String,
    enum: TeaType,
    default: TeaType.GREEN_TEA,
    required: true,
  })
  type: TeaType; // Ví dụ: Trà xanh, Trà đen, Trà Oolong

  @Prop({ type: Number, required: true, default: 0 })
  price: number;

  @Prop({ type: String })
  description: string;

  @Prop({ type: String })
  origin: string; // Xuất xứ (Lâm Đồng, Thái Nguyên,...)

  @Prop({ type: Number, default: 0 })
  stock: number; // Số lượng tồn kho

  @Prop({ type: Boolean, default: true })
  isAvailable: boolean;
}

export const TeaSchema = SchemaFactory.createForClass(Tea);
