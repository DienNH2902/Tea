import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateTeaDto } from './dto/create-tea.dto';
import { UpdateTeaDto } from './dto/update-tea.dto';
import { plainToInstance } from 'class-transformer';
import { ResponseTeaDto } from './dto/response-tea.dto';
import { TeaRepository } from './tea.repository';
import { SortTeaByPrice } from 'src/constants/teaSortByPrice-type.enum';

@Injectable()
export class TeaService {
  constructor(private readonly teaRepository: TeaRepository) {}

  async create(createTeaDto: CreateTeaDto): Promise<ResponseTeaDto> {
    // 1. Kiểm tra tên trà đã tồn tại hay chưa (Logic tương tự check email)
    const checkExistedName = await this.teaRepository.findOne({
      name: createTeaDto.name,
    });

    if (checkExistedName) {
      throw new ConflictException(
        `Sản phẩm trà với tên "${createTeaDto.name}" đã tồn tại trong hệ thống`,
      );
    }

    // 2. Lưu vào database thông qua Repository
    const createdTea = await this.teaRepository.create(createTeaDto);

    return this.toResponseDto(createdTea);
  }

  async findByTeaType(teaType: string): Promise<ResponseTeaDto[] | null> {
    const teas = await this.teaRepository.findByTeaType(teaType);
    if (!teas || teas.length === 0) {
      throw new NotFoundException(`No teas found with type: ${teaType}`);
    }
    return teas.map((tea) => this.toResponseDto(tea));
  }

  async findByTeaName(name: string): Promise<ResponseTeaDto[] | null> {
    const teas = await this.teaRepository.findByTeaName(name);
    if (!teas || teas.length === 0) {
      throw new NotFoundException(`No teas found with name: ${name}`);
    }
    return teas.map((tea) => this.toResponseDto(tea));
  }

  async sortTeaByPrice(
    choose: SortTeaByPrice,
  ): Promise<ResponseTeaDto[] | null> {
    const sortedTeas = await this.teaRepository.sortTeaByPrice(choose);
    if (!sortedTeas || sortedTeas.length === 0) {
      throw new NotFoundException(`Cannot sort with type: ${choose}`);
    }
    return sortedTeas.map((tea) => this.toResponseDto(tea));
  }

  async findAll(): Promise<ResponseTeaDto[]> {
    const teas = await this.teaRepository.findAll();
    return teas.map((tea) => this.toResponseDto(tea));
  }

  async findOne(id: string): Promise<ResponseTeaDto> {
    const tea = await this.teaRepository.findOne({ _id: id });
    if (!tea) {
      throw new NotFoundException(`Tea with ID ${id} not found`);
    }
    return this.toResponseDto(tea);
  }

  async update(
    id: string,
    updateTeaDto: UpdateTeaDto,
  ): Promise<ResponseTeaDto> {
    const updatedTea = await this.teaRepository.findByIdAndUpdate(
      id,
      updateTeaDto,
    );

    if (!updatedTea) {
      throw new NotFoundException(`Tea with ID ${id} not found`);
    }

    return this.toResponseDto(updatedTea);
  }

  async remove(id: string): Promise<void> {
    const deleted = await this.teaRepository.delete(id);
    if (!deleted) {
      throw new NotFoundException(`Tea with ID ${id} not found`);
    }
  }

  // 🔥 Helpers Transform giống hệt User example
  private toResponseDto(tea: any): ResponseTeaDto {
    const instance = plainToInstance(ResponseTeaDto, tea, {
      excludeExtraneousValues: true,
    });

    // Ép kiểu qua unknown để dập tắt cảnh báo TS
    return instance as unknown as ResponseTeaDto;
  }
}
