import { Module } from '@nestjs/common';
import { MongooseModule } from 'node_modules/@nestjs/mongoose/dist';
import { CartService } from './cart.service';
import { CartController } from './cart.controller';
import { Cart, CartSchema } from './schemas/cart.schema';
import { CartRepository } from './cart.repository';
import { Tea, TeaSchema } from '../tea/schemas/tea.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Cart.name, schema: CartSchema },
      { name: Tea.name, schema: TeaSchema },
    ]),
  ],
  controllers: [CartController],
  providers: [CartService, CartRepository],
})
export class CartModule {}
