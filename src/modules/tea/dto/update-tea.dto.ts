import { PartialType } from '@nestjs/swagger';
import { CreateTeaDto } from './create-tea.dto';

export class UpdateTeaDto extends PartialType(CreateTeaDto) {}
