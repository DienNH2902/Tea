import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class VnPayService {
  constructor(private readonly configService: ConfigService) {}

  createPaymentUrl(
    referenceId: string,
    amount: number,
    ipAddr: string,
    bankCode?: string,
  ): string {
    const tmnCode = this.configService.get<string>('VNP_TMN_CODE') || '';
    const secretKey = this.configService.get<string>('VNP_HASH_SECRET') || '';
    let vnpUrl = this.configService.get<string>('VNP_URL') || '';
    const returnUrl = this.configService.get<string>('VNP_RETURN_URL') || ''; //Nơi vnpay tự gọi hàm callback ở backend

    const date = new Date();
    const createDate =
      date.getFullYear().toString() +
      ('0' + (date.getMonth() + 1)).slice(-2) +
      ('0' + date.getDate()).slice(-2) +
      ('0' + date.getHours()).slice(-2) +
      ('0' + date.getMinutes()).slice(-2) +
      ('0' + date.getSeconds()).slice(-2);

    let vnp_Params: Record<string, string> = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: tmnCode,
      vnp_Locale: 'vn',
      vnp_CurrCode: 'VND',
      vnp_TxnRef: referenceId,
      vnp_OrderInfo: `Nap tien vao tai khoan ${referenceId}`,
      vnp_OrderType: 'other',
      vnp_Amount: (amount * 100).toString(),
      vnp_ReturnUrl: returnUrl,
      vnp_IpAddr: ipAddr,
      vnp_CreateDate: createDate,
    };

    if (bankCode && bankCode.trim() !== '') {
      vnp_Params['vnp_BankCode'] = bankCode;
    }

    vnp_Params = this.sortObject(vnp_Params);
    const signData = new URLSearchParams(vnp_Params).toString();
    const hmac = crypto.createHmac('sha512', secretKey);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    vnp_Params['vnp_SecureHash'] = signed;
    vnpUrl += '?' + new URLSearchParams(vnp_Params).toString();

    return vnpUrl;
  }

  verifyCallback(vnp_Params: Record<string, string>): {
    isValid: boolean;
    txnRef: string;
    responseCode: string;
    amount: number;
  } {
    const secretKey = this.configService.get<string>('VNP_HASH_SECRET') || '';
    const secureHash = vnp_Params['vnp_SecureHash'] || '';

    const paramsCopy = { ...vnp_Params };
    delete paramsCopy['vnp_SecureHash'];
    delete paramsCopy['vnp_SecureHashType'];

    const sortedParams = this.sortObject(paramsCopy);
    const signData = new URLSearchParams(sortedParams).toString();
    const hmac = crypto.createHmac('sha512', secretKey);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    return {
      isValid: secureHash === signed,
      txnRef: vnp_Params['vnp_TxnRef'] || '',
      responseCode: vnp_Params['vnp_ResponseCode'] || '',
      amount: parseInt(vnp_Params['vnp_Amount'] || '0') / 100,
    };
  }

  private sortObject(obj: Record<string, string>): Record<string, string> {
    const sorted: Record<string, string> = {};
    const keys = Object.keys(obj).sort();
    for (let i = 0; i < keys.length; i++) {
      sorted[keys[i]] = obj[keys[i]];
    }
    return sorted;
  }
}
