import {
  BadRequestException,
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
import { PaginatedResult } from 'src/interface/pagination.interface';

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

  // async findAll(): Promise<ResponseTeaDto[]> {
  //   const teas = await this.teaRepository.findAll();
  //   return teas.map((tea) => this.toResponseDto(tea));
  // }

  async findAll(
    page: number = 1,
    limit: number = 10,
  ): Promise<PaginatedResult<ResponseTeaDto>> {
    // Khống chế tối đa 10 items để tránh quá tải
    const pageSize = limit > 10 ? 10 : limit;
    const pageNumber = page < 1 ? 1 : page;

    const { data, total } = await this.teaRepository.findAll(
      pageNumber,
      pageSize,
    );

    return {
      data: data.map((tea) => this.toResponseDto(tea)),
      totalItems: total,
      pageSize: pageSize,
      pageNumber: pageNumber,
      totalPages: Math.ceil(total / pageSize),
    };
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

    if (updatedTea.stock <= 0) {
      await this.teaRepository.findByIdAndUpdate(id, {
        isAvailable: false,
        stock: 0,
      });
      updatedTea.isAvailable = false;
      updatedTea.stock = 0;
    } else if (updatedTea.stock > 0 && !updatedTea.isAvailable) {
      await this.teaRepository.findByIdAndUpdate(id, { isAvailable: true });
      updatedTea.isAvailable = true;
    }

    return this.toResponseDto(updatedTea);
  }

  async updateStock(id: string, quantity: number): Promise<ResponseTeaDto> {
    // 1. Thực hiện cập nhật stock
    const updatedTea = await this.teaRepository.updateStock(id, quantity);

    if (!updatedTea) {
      throw new NotFoundException(`Tea with ID ${id} not found`);
    }

    // 2. Logic bổ sung: Nếu hết hàng thì tự động set isAvailable = false
    // Hoặc nếu nhập thêm hàng (quantity > 0) thì set isAvailable = true
    if (updatedTea.stock <= 0) {
      await this.teaRepository.findByIdAndUpdate(id, {
        isAvailable: false,
        stock: 0,
      });
      updatedTea.isAvailable = false;
      updatedTea.stock = 0;
    } else if (updatedTea.stock > 0 && !updatedTea.isAvailable) {
      await this.teaRepository.findByIdAndUpdate(id, { isAvailable: true });
      updatedTea.isAvailable = true;
    }

    return this.toResponseDto(updatedTea);
  }

  async remove(id: string): Promise<void> {
    const linkedOrder = await this.teaRepository.findOrderByTeaId(id);
    if (linkedOrder) {
      throw new BadRequestException(
        `Cannot delete tea with ID ${id} because related in an order`,
      );
    } else {
      const deleted = await this.teaRepository.delete(id);
      if (!deleted) {
        throw new NotFoundException(`Tea with ID ${id} not found`);
      }
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
