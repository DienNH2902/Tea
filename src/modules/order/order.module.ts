import { Module } from '@nestjs/common';

import { OrderController } from './order.controller';
import { MongooseModule } from 'node_modules/@nestjs/mongoose/dist';
import { Order, OrderSchema } from './schemas/order.schema';
import { OrdersService } from './order.service';
import { OrdersRepository } from './order.repository';
import { TeaModule } from '../tea/tea.module';
import { MailModule } from '../mail/mail.module';
import { UsersModule } from '../users/users.module';
import { PayOSProvider } from '../PayOS/payos.provider';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Order.name, schema: OrderSchema }]),
    TeaModule,
    MailModule,
    UsersModule,
  ],
  controllers: [OrderController],
  providers: [OrdersService, OrdersRepository, PayOSProvider],
  exports: [OrdersService, OrdersRepository],
})
export class OrderModule {}
