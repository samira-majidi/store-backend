import { RedisService } from '#src/redis/providers/redis.service';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { GuestCartItem } from './dto/guest-cart.interface';
import { CartItemEntity } from './entity/cart-item.entity';
import { CartEntity } from './entity/cart.entity';
import { RedisLockService } from '#src/redis/providers/redis-lock.service';
import { ProductVariant } from '#src/product/entity/product-variant.entity';
import { CartUtils } from './utils/helper';
import { formatCartItem } from './utils/format.util';

@Injectable()
export class CartService {
  private readonly logger = new Logger(CartService.name);

  constructor(
    @InjectRepository(CartEntity) private cartRepo: Repository<CartEntity>,
    @InjectRepository(CartItemEntity)
    private cartItemRepo: Repository<CartItemEntity>,
    private redisService: RedisService,
    private redisLockService: RedisLockService,
    private dataSource: DataSource,
  ) {} // 🔍 متد کمکی برای بررسی موجودی انبار
  private async validateStock(variantId: string, requestedQuantity: number) {
    if (requestedQuantity <= 0) {
      throw new BadRequestException('تعداد کالا باید حداقل ۱ عدد باشد.');
    }

    const variant = await this.dataSource
      .getRepository(ProductVariant)
      .findOne({
        where: { id: variantId },
      });

    if (!variant) {
      throw new NotFoundException('این کالا یا تنوع یافت نشد.');
    }

    if (variant.stock <= 0) {
      throw new BadRequestException(
        `متاسفانه کالای «${variant.sku}» ناموجود شده است.`,
      );
    }

    if (requestedQuantity > variant.stock) {
      throw new BadRequestException(
        `تعداد درخواستی بیشتر از موجودی انبار است. (حداکثر موجودی: ${variant.stock} عدد)`,
      );
    }

    return variant;
  }

  // ۱. افزودن برای مهمان (فقط Redis)
  async addToGuestCart(cartId: string, variantId: string, quantity: number) {
    this.logger.log(
      `[addToGuestCart] 🛒 شروع افزودن کالا برای مهمان | cartId: ${cartId}, variantId: ${variantId}, quantity: ${quantity}`,
    );
    const redisKey = `cart:guest:${cartId}`;

    const cart: GuestCartItem[] = (await this.redisService.get(redisKey)) || [];
    this.logger.debug(
      `[addToGuestCart] سبد فعلی در ردیس (${redisKey}): ${JSON.stringify(cart)}`,
    );

    const existingItem = cart.find((item) => item.variantId === variantId);
    const targetQuantity = (existingItem?.quantity || 0) + quantity;
    await this.validateStock(variantId, targetQuantity);
    if (existingItem) {
      existingItem.quantity += quantity;
      this.logger.log(
        `[addToGuestCart] 🔁 کالا از قبل موجود بود؛ تعداد جدید: ${existingItem.quantity}`,
      );
    } else {
      cart.push({ variantId, quantity });
      this.logger.log(`[addToGuestCart] ➕ کالای جدید به سبد اضافه شد.`);
    }

    await this.redisService.set(redisKey, cart, 60 * 60 * 24 * 7);
    this.logger.log(
      `[addToGuestCart] 💾 سبد در ردیس با موفقیت به‌روزرسانی شد. کل آیتم‌ها: ${cart.length}`,
    );
    return cart;
  }

  // ۲. افزودن برای کاربر (فقط دیتابیس)
  async addToUserCart(userId: number, variantId: string, quantity: number) {
    this.logger.log(
      `[addToUserCart] 👤 شروع افزودن کالا برای کاربر لاگین‌شده | userId: ${userId}, variantId: ${variantId}, quantity: ${quantity}`,
    );

    let cart = await this.cartRepo.findOne({
      where: { userId },
      relations: ['items'],
    });

    if (!cart) {
      this.logger.log(
        `[addToUserCart] 🆕 سبدی برای کاربر یافت نشد؛ در حال ایجاد سبد خرید جدید در دیتابیس...`,
      );
      cart = await this.cartRepo.save(this.cartRepo.create({ userId }));
      cart.items = [];
      this.logger.log(
        `[addToUserCart] ✅ سبد با موفقیت ساخته شد | cartId: ${cart.id}`,
      );
    } else {
      this.logger.debug(
        `[addToUserCart] سبد قبلی پیدا شد | cartId: ${cart.id}`,
      );
    }

    const cartItem = await this.cartItemRepo.findOne({
      where: { cartId: cart.id, variantId },
    });
    const targetQuantity = (cartItem?.quantity || 0) + quantity;

    await this.validateStock(variantId, targetQuantity);

    if (cartItem) {
      cartItem.quantity += quantity;
      await this.cartItemRepo.save(cartItem);
      this.logger.log(
        `[addToUserCart] 🔁 تعداد آیتم موجود در دیتابیس به ${cartItem.quantity} تغییر یافت.`,
      );
    } else {
      await this.cartItemRepo.save(
        this.cartItemRepo.create({ cartId: cart.id, variantId, quantity }),
      );
      this.logger.log(`[addToUserCart] ➕ آیتم جدید در دیتابیس ذخیره شد.`);
    }

    return this.getUserCart(userId);
  }

  async mergeGuestCart(userId: number, guestCartId: string) {
    const lockKey = `lock:cart:merge:${guestCartId}`;
    this.logger.log(
      `[mergeGuestCart] 🔀 شروع فرآیند مرج | userId: ${userId}, guestCartId: ${guestCartId}`,
    );

    return await this.redisLockService.withLock(lockKey, async () => {
      this.logger.log(
        `[mergeGuestCart] 🔒 قفل ردیس با کلید ${lockKey} گرفته شد.`,
      );
      const redisKey = `cart:guest:${guestCartId}`;
      const guestCart: GuestCartItem[] | null =
        await this.redisService.get(redisKey);

      if (!guestCart || guestCart.length === 0) {
        this.logger.warn(
          `[mergeGuestCart] ⚠️ سبد مهمانی یافت نشد یا خالی بود؛ عملیات مرج لغو شد.`,
        );
        return this.getUserCart(userId);
      }

      this.logger.log(
        `[mergeGuestCart] 📦 تعداد ${guestCart.length} آیتم در ردیس برای مرج پیدا شد.`,
      );

      await this.dataSource.transaction(async (manager) => {
        this.logger.debug(`[mergeGuestCart] 🔄 ورود به ترنزاکشن دیتابیس...`);
        let userCart = await manager.findOne(CartEntity, {
          where: { userId },
          relations: ['items'],
        });

        if (!userCart) {
          this.logger.log(
            `[mergeGuestCart] ایجاد سبد خرید جدید در حین مرج برای userId: ${userId}`,
          );
          userCart = await manager.save(
            CartEntity,
            manager.create(CartEntity, { userId }),
          );
        }

        for (const gItem of guestCart) {
          const existing = await manager.findOne(CartItemEntity, {
            where: { cartId: userCart.id, variantId: gItem.variantId },
          });

          if (existing) {
            existing.quantity += gItem.quantity;
            await manager.save(CartItemEntity, existing);
            this.logger.debug(
              `[mergeGuestCart] بروزرسانی تعداد واریانت ${gItem.variantId} به ${existing.quantity}`,
            );
          } else {
            await manager.save(
              CartItemEntity,
              manager.create(CartItemEntity, {
                cartId: userCart.id,
                variantId: gItem.variantId,
                quantity: gItem.quantity,
              }),
            );
            this.logger.debug(
              `[mergeGuestCart] درج واریانت جدید ${gItem.variantId} با تعداد ${gItem.quantity}`,
            );
          }
        }
      });
      this.logger.log(
        `[mergeGuestCart] ✅ ترنزاکشن دیتابیس با موفقیت ثبت (Commit) شد.`,
      );

      await this.redisService.del(redisKey);
      this.logger.log(
        `[mergeGuestCart] 🗑️ کلید سبد مهمان در ردیس (${redisKey}) حذف شد.`,
      );

      return this.getUserCart(userId);
    });
  }
  async getGuestCart(cartId: string) {
    this.logger.log(`[getGuestCart] 👀 دریافت سبد مهمان | cartId: ${cartId}`);
    const redisKey = `cart:guest:${cartId}`;
    const guestItems: GuestCartItem[] =
      (await this.redisService.get(redisKey)) || [];

    if (!guestItems.length) {
      return {
        id: cartId,
        items: [],
        summary: CartUtils.calculateSummary([]),
        messages: [],
      };
    }

    const variants = await this.dataSource.getRepository(ProductVariant).find({
      where: { id: In(guestItems.map((i) => i.variantId)) },
      relations: ['product', 'product.images'],
    });
    const variantMap = new Map(variants.map((v) => [v.id, v]));

    // آماده‌سازی اولیه برای سنجش استاک
    const itemsToCheck = guestItems.map((item) => ({
      id: `guest-item-${item.variantId}`,
      cartId,
      variantId: item.variantId,
      quantity: item.quantity,
      variant: variantMap.get(item.variantId) || null,
    }));

    // 🌟 تمام کثیف‌کاری‌ها در یک خط!
    const { validItems, messages, hasChanges } =
      CartUtils.reconcileCartItems(itemsToCheck);

    // سینک ردیس در صورت نیاز
    if (hasChanges) {
      const updated = validItems.map((i) => ({
        variantId: i.variantId,
        quantity: i.quantity,
      }));
      if (updated.length > 0) {
        await this.redisService.set(redisKey, updated, 60 * 60 * 24 * 7);
      } else {
        await this.redisService.del(redisKey);
      }
    }

    return {
      id: cartId,
      items: validItems.map((item) =>
        formatCartItem(item.id, item.quantity, item.variant!),
      ),
      summary: CartUtils.calculateSummary(validItems),
      messages,
    };
  }
  async getUserCart(userId: number) {
    this.logger.log(
      `[getUserCart] 👤 واکشی سبد خرید کاربر | userId: ${userId}`,
    );

    const cart = await this.cartRepo.findOne({
      where: { userId },
      relations: [
        'items',
        'items.variant',
        'items.variant.product',
        'items.variant.product.images',
      ],
    });

    if (!cart?.items?.length) {
      return {
        id: cart?.id,
        items: [],
        summary: CartUtils.calculateSummary([]),
        messages: [],
      };
    }

    // 🌟 همون جادو، برای دیتابیس!
    const { validItems, itemsToUpdate, itemsToDelete, messages } =
      CartUtils.reconcileCartItems(cart.items);

    // اعمال تغییرات در دیتابیس
    if (itemsToDelete.length) {
      await this.cartItemRepo.delete(itemsToDelete.map((i) => i.id));
    }
    if (itemsToUpdate.length) {
      await this.cartItemRepo.save(itemsToUpdate);
    }
    return {
      id: cart.id,
      items: validItems.map((item) =>
        formatCartItem(item.id, item.quantity, item.variant),
      ),
      summary: CartUtils.calculateSummary(validItems),
      messages,
    };
  }

  async updateGuestCartItem(
    cartId: string,
    variantId: string,
    quantity: number,
  ) {
    this.logger.log(
      `[updateGuestCartItem] 🔄 تغییر تعداد آیتم مهمان | cartId: ${cartId}, variantId: ${variantId}, newQuantity: ${quantity}`,
    );
    await this.validateStock(variantId, quantity);
    const redisKey = `cart:guest:${cartId}`;
    const cart: GuestCartItem[] = (await this.redisService.get(redisKey)) || [];

    const item = cart.find((i) => i.variantId === variantId);
    if (!item) {
      this.logger.warn(
        `[updateGuestCartItem] ⚠️ آیتم ${variantId} در سبد مهمان یافت نشد.`,
      );
      throw new NotFoundException('این کالا در سبد خرید یافت نشد.');
    }

    item.quantity = quantity;

    await this.redisService.set(redisKey, cart, 60 * 60 * 24 * 7);
    this.logger.log(
      `[updateGuestCartItem] ✏️ تعداد آیتم مهمان به ${quantity} تغییر یافت.`,
    );

    return this.getGuestCart(cartId);
  }

  async updateUserCartItem(
    userId: number,
    variantId: string,
    quantity: number,
  ) {
    this.logger.log(
      `[updateUserCartItem] 👤 تغییر تعداد آیتم کاربر | userId: ${userId}, variantId: ${variantId}, newQuantity: ${quantity}`,
    );
    await this.validateStock(variantId, quantity);
    const cart = await this.cartRepo.findOne({
      where: { userId },
    });

    if (!cart) {
      this.logger.warn(
        `[updateUserCartItem] ⚠️ سبدی برای کاربر ${userId} یافت نشد.`,
      );
      throw new NotFoundException('سبد خریدی برای شما یافت نشد.');
    }

    const cartItem = await this.cartItemRepo.findOne({
      where: { cartId: cart.id, variantId },
    });

    if (!cartItem) {
      this.logger.warn(
        `[updateUserCartItem] ⚠️ آیتم ${variantId} در سبد کاربر یافت نشد.`,
      );
      throw new NotFoundException('این کالا در سبد خرید شما وجود ندارد.');
    }

    cartItem.quantity = quantity;
    await this.cartItemRepo.save(cartItem);

    this.logger.log(
      `[updateUserCartItem] ✏️ تعداد آیتم در دیتابیس به ${quantity} به‌روزرسانی شد.`,
    );
    return this.getUserCart(userId);
  }
  async removeGuestCartItem(cartId: string, variantId: string) {
    this.logger.log(
      `[removeGuestCartItem] 🗑️ حذف کالا از سبد مهمان | cartId: ${cartId}, variantId: ${variantId}`,
    );

    const redisKey = `cart:guest:${cartId}`;
    const cart: GuestCartItem[] = (await this.redisService.get(redisKey)) || [];

    const itemIndex = cart.findIndex((i) => i.variantId === variantId);
    if (itemIndex === -1) {
      this.logger.warn(
        `[removeGuestCartItem] ⚠️ آیتم ${variantId} در سبد مهمان پیدا نشد.`,
      );
      throw new NotFoundException('این کالا در سبد خرید یافت نشد.');
    }

    cart.splice(itemIndex, 1);

    if (cart.length === 0) {
      await this.redisService.del(redisKey);
      this.logger.log(
        `[removeGuestCartItem] 🧹 سبد مهمان خالی شد و کلید ردیس حذف گردید.`,
      );
    } else {
      await this.redisService.set(redisKey, cart, 60 * 60 * 24 * 7);
      this.logger.log(
        `[removeGuestCartItem] 💾 کالا حذف شد؛ تعداد آیتم‌های باقی‌مانده: ${cart.length}`,
      );
    }

    return this.getGuestCart(cartId);
  }

  // ۸. حذف آیتم از سبد کاربر لاگین‌شده (Database)
  async removeUserCartItem(userId: number, variantId: string) {
    this.logger.log(
      `[removeUserCartItem] 🗑️ حذف کالا از سبد کاربر | userId: ${userId}, variantId: ${variantId}`,
    );

    const cart = await this.cartRepo.findOne({
      where: { userId },
    });

    if (!cart) {
      this.logger.warn(
        `[removeUserCartItem] ⚠️ سبدی برای کاربر ${userId} یافت نشد.`,
      );
      throw new NotFoundException('سبد خریدی برای شما یافت نشد.');
    }

    const cartItem = await this.cartItemRepo.findOne({
      where: { cartId: cart.id, variantId },
    });

    if (!cartItem) {
      this.logger.warn(
        `[removeUserCartItem] ⚠️ آیتم ${variantId} در سبد کاربر یافت نشد.`,
      );
      throw new NotFoundException('این کالا در سبد خرید شما وجود ندارد.');
    }

    await this.cartItemRepo.remove(cartItem);
    this.logger.log(
      `[removeUserCartItem] ✅ آیتم ${variantId} با موفقیت از دیتابیس حذف شد.`,
    );

    return this.getUserCart(userId);
  }
}
