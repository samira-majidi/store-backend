import { Controller, Post, Body, Get, Param, Patch } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CartService } from './cart.service';

import { Auth } from '#src/auth/decorators/auth.decorator';
import { ActiveUser } from '#src/auth/decorators/active-user.decorator';
import { AuthType } from '#src/auth/enums/auth-type.enum';
import { GuestAddToCartDto, UserAddToCartDto } from './dto/add-to-cart.dto';
import { MergeCartDto } from './dto/merge-cart.dto';
import { UpdateGuestCartDto, UpdateUserCartDto } from './dto/update-cart.dto';

@ApiTags('سبد خرید')
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}
  // ================= مشاهده سبد مهمان =================
  @Get('guest/:cartId')
  @Auth(AuthType.None) // بدون نیاز به توکن
  async getGuestCart(@Param('cartId') cartId: string) {
    return await this.cartService.getGuestCart(cartId);
  }

  // ================= مشاهده سبد کاربر =================
  @Get('user')
  async getUserCart(@ActiveUser('sub') userId: number) {
    const cart = await this.cartService.getUserCart(userId);

    // اگه سبد نداشت، یه آبجکت خالی برمی‌گردونیم که فرانت ارور نگیره
    if (!cart) {
      return { items: [] };
    }

    return cart;
  }
  // ================= مسیر مهمان =================
  @Post('guest/add')
  @Auth(AuthType.None) // بدون نیاز به توکن
  async addToGuestCart(@Body() dto: GuestAddToCartDto) {
    return await this.cartService.addToGuestCart(
      dto.cartId,
      dto.variantId,
      dto.quantity,
    );
  }

  // ================= مسیر کاربر لاگین‌شده =================
  @Post('user/add')
  // گارد لاگین به صورت پیش‌فرض فعاله
  async addToUserCart(
    @ActiveUser('sub') userId: number,
    @Body() dto: UserAddToCartDto,
  ) {
    return await this.cartService.addToUserCart(
      userId,
      dto.variantId,
      dto.quantity,
    );
  }
  @Post('user/merge')
  async mergeGuestCart(
    @ActiveUser('sub') userId: number,
    @Body() dto: MergeCartDto,
  ) {
    return await this.cartService.mergeGuestCart(userId, dto.guestCartId);
  }

  @Patch('guest/update')
  @Auth(AuthType.None)
  async updateGuestCart(@Body() dto: UpdateGuestCartDto) {
    return this.cartService.updateGuestCartItem(
      dto.cartId,
      dto.variantId,
      dto.quantity,
    );
  }

  @Patch('user/update')
  async updateUserCart(
    @ActiveUser('sub') userId: number,
    @Body() dto: UpdateUserCartDto,
  ) {
    return this.cartService.updateUserCartItem(
      userId,
      dto.variantId,
      dto.quantity,
    );
  }
}
