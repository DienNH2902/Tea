import { Expose, Transform } from 'class-transformer';

export class ResponseCartDto {
  @Expose()
  @Transform(({ obj }) => obj._id?.toString())
  _id: string;

  @Expose()
  @Transform(({ obj }) => obj.teaId?._id.toString())
  teaId: string;

  @Expose()
  @Transform(({ obj }) => obj.teaId?.name)
  teaName: string;

  @Expose()
  @Transform(({ obj }) => obj.teaId?.type)
  teaType: string;

  @Expose()
  @Transform(({ obj }) => obj.teaId?.price)
  teaPrice: number;

  @Expose()
  @Transform(({ obj }) => obj.teaId?.origin)
  teaOrigin: string;

  @Expose()
  @Transform(({ obj }) => obj.teaId?.stock)
  teaStock: number;

  @Expose()
  note?: string;

  @Expose()
  createdAt: Date;
}
