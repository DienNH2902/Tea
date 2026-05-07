import { Module } from '@nestjs/common';
import { TeaService } from './tea.service';
import { TeaController } from './tea.controller';
import { MongooseModule } from 'node_modules/@nestjs/mongoose/dist';
import { Tea, TeaSchema } from './schemas/tea.schema';
import { TeaRepository } from './tea.repository';
import { Order, OrderSchema } from '../order/schemas/order.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Tea.name, schema: TeaSchema },
      { name: Order.name, schema: OrderSchema },
    ]),
  ],
  controllers: [TeaController],
  providers: [TeaService, TeaRepository],
  exports: [TeaRepository, TeaService, MongooseModule],
})
export class TeaModule {}
