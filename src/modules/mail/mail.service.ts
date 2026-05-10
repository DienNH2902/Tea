// import { Injectable, InternalServerErrorException } from '@nestjs/common';
// import { MailerService } from '@nestjs-modules/mailer';

// @Injectable()
// export class MailService {
//   constructor(private readonly mailerService: MailerService) {}

//   async sendWelcomeEmail(to: string, name: string) {
//     try {
//       await this.mailerService.sendMail({
//         to: to,
//         subject: 'Chào mừng bạn đến với Tea Shop',
//         template: './welcome',
//         context: {
//           name: name,
//           email: to,
//         },
//       });
//       console.log(`Đã gửi mail chào mừng đến: ${to}`);
//     } catch (error) {
//       console.error('Lỗi chi tiết tại MailService:', error);
//       throw new InternalServerErrorException(
//         'Không thể gửi email xác nhận đăng ký.',
//       );
//     }
//   }
// }

// src/modules/mail/mail.service.ts
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class MailService {
  constructor(private readonly mailerService: MailerService) {}

  // Hàm dùng chung cho tất cả các loại mail
  async sendMail(
    to: string,
    subject: string,
    template: string,
    context: Record<string, unknown>,
  ) {
    try {
      await this.mailerService.sendMail({
        to,
        subject,
        template: `./${template}`, // Tên file template truyền vào (welcome, order-success...)
        context,
      });
      console.log(`[MailService] Đã gửi mail "${subject}" đến: ${to}`);
    } catch (error) {
      console.error('Lỗi gửi mail:', error);
      throw new InternalServerErrorException('Lỗi hệ thống gửi email.');
    }
  }

  // Giữ lại hàm này nhưng gọi qua hàm chung để code gọn hơn
  async sendWelcomeEmail(to: string, name: string) {
    return this.sendMail(to, 'Chào mừng đến với Tea Shop', 'welcome', {
      name,
      email: to,
    });
  }
}
