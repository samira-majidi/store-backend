import { Request } from 'express';
import { ActiveUserData } from './active-user.interface';

export interface RequestWithUser extends Request {
  user: ActiveUserData;
}
