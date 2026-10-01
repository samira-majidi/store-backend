import { PickType } from '@nestjs/swagger';
import { GuestAddToCartDto, UserAddToCartDto } from './add-to-cart.dto';

export class UpdateUserCartDto extends PickType(UserAddToCartDto, [
  'variantId',
  'quantity',
] as const) {}

export class UpdateGuestCartDto extends PickType(GuestAddToCartDto, [
  'cartId',
  'variantId',
  'quantity',
] as const) {}
