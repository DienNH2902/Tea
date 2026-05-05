import { Module } from '@nestjs/common';

import { OrderController } from './order.controller';
import { MongooseModule } from 'node_modules/@nestjs/mongoose/dist';
import { Order, OrderSchema } from './schemas/order.schema';
import { OrdersService } from './order.service';
import { OrdersRepository } from './order.repository';
import { TeaModule } from '../tea/tea.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Order.name, schema: OrderSchema }]),
    TeaModule,
  ],
  controllers: [OrderController],
  providers: [OrdersService, OrdersRepository],
  exports: [OrdersRepository, OrdersService],
})
export class OrderModule {}
