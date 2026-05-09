// src/modules/mail/mail.module.ts
import { Global, Module } from '@nestjs/common';
import { MailService } from './mail.service';

@Global()
@Module({
  providers: [MailService],
  exports: [MailService], // Export để UsersService có thể thấy nó
})
export class MailModule {}
