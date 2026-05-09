// src/modules/mail/mail.service.ts

import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class MailService {
  constructor(private readonly mailerService: MailerService) {}

  async sendWelcomeEmail(to: string, name: string) {
    try {
      await this.mailerService.sendMail({
        to: to,
        subject: 'Chào mừng bạn đến với Tea Shop',
        template: './welcome',
        context: {
          name: name,
          email: to,
        },
      });
      console.log(`Đã gửi mail chào mừng đến: ${to}`);
    } catch (error) {
      console.error('Lỗi chi tiết tại MailService:', error);
      throw new InternalServerErrorException(
        'Không thể gửi email xác nhận đăng ký.',
      );
    }
  }
}
