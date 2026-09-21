import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CẤU HÌNH CORS CHUẨN CHO ĐỒ ÁN / DỰ ÁN CHẠY COOKIE
  app.enableCors({
    // 1. Chỉ định chính xác địa chỉ của Frontend được phép gọi tới
    // origin: 'http://localhost:5173', // Sửa lại đúng Port mà FE của bạn đang chạy (3000, 5173, v.v.)
    origin: [
      'http://localhost:3000',
      'https://horse-racing.io.vn', // Điền domain chính thức của Frontend vào đây
      'https://goldenhoof-fe.vercel.app',
      'null',
      'http://localhost:5500', // ← Live Server port mặc định
      'http://127.0.0.1:5500',
    ],

    // 2. Cho phép các phương thức HTTP nào được quyền tác động vào BE
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',

    // 3. Cho phép FE gửi kèm Cookie hoặc Header xác thực (Rất quan trọng khi dùng Cookie)
    credentials: true,

    // 4. Các Header mà FE được phép gửi lên
    allowedHeaders: 'Content-Type, Authorization, X-Requested-With, Accept',
  });

  const config = new DocumentBuilder()
    .setTitle('Tea Service') // Tiêu đề hiển thị trên Swagger UI
    .setDescription('Tea Service API Documentation') // Mô tả chi tiết hơn về API
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  // Tạo Swagger document dựa trên cấu hình và ứng dụng NestJS
  // NestJS sẽ tự động quét các controller và DTO có decorator của @nestjs/swagger
  const document = SwaggerModule.createDocument(app, config);

  // Thiết lập endpoint để phục vụ Swagger UI
  // '/api-docs' là đường dẫn bạn sẽ truy cập để xem UI (ví dụ: http://localhost:3000/api-docs)
  // Tham số thứ 2 là instance của ứng dụng NestJS
  // Tham số thứ 3 là document đã tạo ở trên
  SwaggerModule.setup('/tea-swagger/index.html', app, document, {
    // Tùy chỉnh đường dẫn cho file JSON tại đây
    jsonDocumentUrl: '/swagger-json',
  });

  const configService = app.get<ConfigService>(ConfigService);
  const port = configService.get<number>('PORT') ?? 8000;
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  await app.listen(port);
}

void bootstrap();
