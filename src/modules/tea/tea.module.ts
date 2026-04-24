import { Module } from '@nestjs/common';
import { TeaService } from './tea.service';
import { TeaController } from './tea.controller';
import { MongooseModule } from 'node_modules/@nestjs/mongoose/dist';
import { Tea, TeaSchema } from './schemas/tea.schema';
import { TeaRepository } from './tea.repository';

@Module({
  imports: [MongooseModule.forFeature([{ name: Tea.name, schema: TeaSchema }])],
  controllers: [TeaController],
  providers: [TeaService, TeaRepository],
})
export class TeaModule {}
