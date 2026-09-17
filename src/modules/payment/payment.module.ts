import { Module } from '@nestjs/common';
import { VnPayService } from './vnpay.service';

@Module({
  providers: [VnPayService],
  exports: [VnPayService],
})
export class PaymentModule {}
