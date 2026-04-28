import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { ResponseUserDto } from './dto/response-user.dto';
import { GenderEnum } from 'src/constants/genderEnum.enum';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RoleEnum } from 'src/constants/roleEnum.enum';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create a new user' })
  @Roles(RoleEnum.MANAGER, RoleEnum.ADMIN)
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

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get current user information' })
  getProfile(@Request() req: any): Promise<ResponseUserDto> {
    return req.user;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  findOne(@Param('id') id: string): Promise<ResponseUserDto> {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleEnum.ADMIN, RoleEnum.MANAGER)
  @ApiOperation({ summary: 'Update user by ID' })
  @ApiBody({ type: UpdateUserDto })
  update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<ResponseUserDto> {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleEnum.ADMIN)
  @ApiOperation({ summary: 'Delete user by ID' })
  remove(@Param('id') id: string): Promise<void> {
    return this.usersService.remove(id);
  }
}
