import { PayOS } from '@payos/node';
import { ConfigService } from '@nestjs/config';

export const PayOSProvider = {
  provide: 'PAYOS_CLIENT',
  useFactory: (configService: ConfigService) => {
    return new PayOS({
      clientId: configService.get('CLIENT_ID'),
      apiKey: configService.get('API_KEY'),
      checksumKey: configService.get('CHECKSUM_KEY'),
    });
  },
  inject: [ConfigService],
};
