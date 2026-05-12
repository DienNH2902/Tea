import { RoleEnum } from 'src/constants/roleEnum.enum';

export interface IUserPayload {
  _id: string;
  email: string;
  name: string;
  role: RoleEnum;
  age: number;
  gender: number;
  address: string;
  isRegular: boolean;
}
