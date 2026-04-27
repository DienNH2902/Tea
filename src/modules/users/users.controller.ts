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
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ApiBody, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ResponseUserDto } from './dto/response-user.dto';
import { GenderEnum } from 'src/constants/genderEnum.enum';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new user' })
  @ApiBody({ type: CreateUserDto })
  create(@Body() createUserDto: CreateUserDto): Promise<ResponseUserDto> {
    return this.usersService.create(createUserDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all users' })
  findAll(): Promise<ResponseUserDto[]> {
    return this.usersService.findAll();
  }

  @Get('byUserName')
  @ApiQuery({ name: 'name', required: true, type: String })
  @ApiOperation({ summary: 'Search users by name queries' })
  async findAllByName(
    @Query('name') name: string,
  ): Promise<ResponseUserDto[] | null> {
    const user = await this.usersService.findUserByName(name);
    return user ? user : null;
  }

  @Get('byGender')
  @ApiQuery({ name: 'Gender', required: true, enum: GenderEnum })
  @ApiOperation({ summary: 'Get all users by gender' })
  async findByGender(
    @Query('Gender') gender: GenderEnum,
  ): Promise<ResponseUserDto[] | null> {
    const user = await this.usersService.findByGender(gender);
    return user ? user : null;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  findOne(@Param('id') id: string): Promise<ResponseUserDto> {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update user by ID' })
  @ApiBody({ type: UpdateUserDto })
  update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<ResponseUserDto> {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete user by ID' })
  remove(@Param('id') id: string): Promise<void> {
    return this.usersService.remove(id);
  }
}
