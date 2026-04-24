import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { TeaService } from './tea.service';
import { CreateTeaDto } from './dto/create-tea.dto';
import { UpdateTeaDto } from './dto/update-tea.dto';
import { ApiBody, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ResponseTeaDto } from './dto/response-tea.dto';
import { TeaType } from 'src/constants/tea-type.enum';
import {
  LabelToValue,
  SortTeaByPrice,
} from 'src/constants/teaSortByPrice-type.enum';

@ApiTags('tea')
@Controller('tea')
export class TeaController {
  constructor(private readonly teaService: TeaService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new tea product' })
  @ApiBody({ type: CreateTeaDto })
  create(@Body() createTeaDto: CreateTeaDto): Promise<ResponseTeaDto> {
    return this.teaService.create(createTeaDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all tea products' })
  findAll(): Promise<ResponseTeaDto[]> {
    return this.teaService.findAll();
  }

  @Get('byTeaType')
  @ApiQuery({ name: 'TeaType', required: true, enum: TeaType })
  @ApiOperation({ summary: 'Get all tea by queries' })
  async findAllByQueries(
    @Query('TeaType') teaType: TeaType,
  ): Promise<ResponseTeaDto[] | null> {
    const tea = await this.teaService.findByTeaType(teaType);
    return tea ? tea : null;
  }

  @Get('byTeaName')
  @ApiQuery({ name: 'TeaName', required: true, type: String })
  @ApiOperation({ summary: 'Get all tea by queries' })
  async findAllByName(
    @Query('TeaName') teaName: string,
  ): Promise<ResponseTeaDto[] | null> {
    const tea = await this.teaService.findByTeaName(teaName);
    return tea ? tea : null;
  }

  // @Get('sortTeaByPrice')
  // @ApiQuery({ name: 'name', required: true, enum: LabelToValue })
  // @ApiOperation({ summary: 'Sort teas by price queries' })
  // async sortTeaByPrice(
  //   @Query('name') sortTeaByPrice: SortTeaByPrice,
  // ): Promise<ResponseTeaDto[] | null> {
  //   const sortedTea = await this.teaService.sortTeaByPrice(sortTeaByPrice);
  //   return sortedTea ? sortedTea : null;
  // }

  @Get('sortTeaByPrice')
  @ApiQuery({
    name: 'name',
    required: true,
    enum: Object.keys(LabelToValue), // Lấy mảng ['Tăng dần', 'Giảm dần']
  })
  @ApiOperation({ summary: 'Sort teas by price queries' })
  async sortTeaByPrice(
    @Query('name') label: string, // Nhận vào chuỗi "Tăng dần" hoặc "Giảm dần"
  ): Promise<ResponseTeaDto[] | null> {
    // Chuyển từ nhãn sang giá trị asc/desc trước khi đưa vào service
    const order = LabelToValue[label] || SortTeaByPrice.ASCENDING;

    const sortedTea = await this.teaService.sortTeaByPrice(order);
    return sortedTea ? sortedTea : null;
  }
  @Get(':id')
  @ApiOperation({ summary: 'Get tea by ID' })
  findOne(@Param('id') id: string): Promise<ResponseTeaDto> {
    return this.teaService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update tea by ID' })
  @ApiBody({ type: UpdateTeaDto })
  update(
    @Param('id') id: string,
    @Body() updateTeaDto: UpdateTeaDto,
  ): Promise<ResponseTeaDto> {
    return this.teaService.update(id, updateTeaDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete tea by ID' })
  remove(@Param('id') id: string): Promise<void> {
    return this.teaService.remove(id);
  }
}
