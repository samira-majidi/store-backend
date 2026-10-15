import { DataSource } from 'typeorm';
import { BadRequestException } from '@nestjs/common';

// سرویس‌ها
import { CartService } from './cart.service';
import { RedisService } from '#src/redis/providers/redis.service';

// انتیتی‌ها
import { CartEntity } from './entity/cart.entity';
import { CartItemEntity } from './entity/cart-item.entity';
import { ProductVariant } from '#src/product/entity/product-variant.entity';
import { Product } from '#src/product/entity/product.entity';
import { Category } from '#src/categories/entity/category.entity';
import { User } from '#src/users/entity/user.entity';
import { IntegrationTestHelper } from '#src/common/test/test-helper';

describe('CartService (Integration Tests)', () => {
  let service: CartService;
  let redisService: RedisService;
  let dataSource: DataSource;

  beforeAll(async () => {
    const module = await IntegrationTestHelper.createTestingModule({
      providers: [CartService],
    });

    service = module.get<CartService>(CartService);
    redisService = module.get<RedisService>(RedisService);
    dataSource = IntegrationTestHelper.dataSource;
  });

  afterAll(async () => {
    await IntegrationTestHelper.closeAll();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    await IntegrationTestHelper.cleanAll();
  });

  async function createInitialFixture(stock = 10) {
    const user = await dataSource.manager.save(User, {
      phoneNumber: '09188737488',
    } as Partial<User>);

    const category = await dataSource.manager.save(Category, {
      name: 'تجهیزات ارتوپدی',
      title: 'تجهیزات ارتوپدی',
      slug: 'orthopedic-equipment',
    } as Partial<Category>);

    const product = await dataSource.manager.save(Product, {
      title: 'زانوبند طبی آتل‌دار',
      slug: 'knee-brace',
      categoryId: category.id,
    } as Partial<Product>);

    const variant = await dataSource.manager.save(ProductVariant, {
      productId: product.id,
      sku: 'KNEE-BRACE-XL',
      price: 850000,
      finalPrice: 850000,
      stock,
      reservedStock: 0,
    } as Partial<ProductVariant>);

    return { user, variant, product };
  }

  // =========================================================================
  // تست ۱: ساخت خودکار سبد کاربر و تجمیع مقادیر (Auto Create & Increment)
  // =========================================================================
  it('should auto-create CartEntity on first item add, and increment quantity when adding same variant', async () => {
    const { user, variant } = await createInitialFixture(10);

    await service.addToUserCart(user.id, variant.id, 2);

    const cart = await dataSource.manager.findOne(CartEntity, {
      where: { userId: user.id },
      relations: ['items'],
    });

    expect(cart).toBeDefined();
    expect(cart?.items.length).toBe(1);
    expect(cart?.items[0].quantity).toBe(2);

    await service.addToUserCart(user.id, variant.id, 3);

    const updatedItem = await dataSource.manager.findOneBy(CartItemEntity, {
      cartId: cart!.id,
      variantId: variant.id,
    });

    expect(updatedItem?.quantity).toBe(5);
  });

  // =========================================================================
  // تست ۲: کنترل موجودی انبار و پرتاب اکسپشن (Overselling Prevention)
  // =========================================================================
  it('should throw BadRequestException when requested quantity exceeds available stock', async () => {
    const { user, variant } = await createInitialFixture(3); // موجودی انبار فقط ۳ تاست

    // درخواست ۵ عدد کالا
    await expect(service.addToUserCart(user.id, variant.id, 5)).rejects.toThrow(
      BadRequestException,
    );

    const cartItemsCount = await dataSource.manager.count(CartItemEntity);
    expect(cartItemsCount).toBe(0);
  });

  // =========================================================================
  // تست ۳: ادغام حیاتی سبد مهمان ردیس در دیتابیس کاربر (Merge Guest Cart)
  // =========================================================================
  it('should merge guest redis cart into user database cart and remove guest redis key', async () => {
    const { user, variant } = await createInitialFixture(20);
    const guestCartId = 'guest-uuid-12345';

    const userCart = await dataSource.manager.save(CartEntity, {
      userId: user.id,
    } as Partial<CartEntity>);
    await dataSource.manager.save(CartItemEntity, {
      cartId: userCart.id,
      variantId: variant.id,
      quantity: 1,
    } as Partial<CartItemEntity>);

    await redisService.set(`cart:guest:${guestCartId}`, [
      { variantId: variant.id, quantity: 2 },
    ]);

    await service.mergeGuestCart(user.id, guestCartId);

    const mergedItem = await dataSource.manager.findOneBy(CartItemEntity, {
      cartId: userCart.id,
      variantId: variant.id,
    });
    expect(mergedItem?.quantity).toBe(3);

    expect(await redisService.get(`cart:guest:${guestCartId}`)).toBeNull();
  });

  // =========================================================================
  // تست ۴: هماهنگی و حذف اتوماتیک کالای ناموجود در getUserCart (Reconciliation)
  // =========================================================================
  it('should auto-delete cart item from database when variant stock becomes 0', async () => {
    const { user, variant } = await createInitialFixture(5);

    const cart = await dataSource.manager.save(CartEntity, {
      userId: user.id,
    } as Partial<CartEntity>);
    await dataSource.manager.save(CartItemEntity, {
      cartId: cart.id,
      variantId: variant.id,
      quantity: 2,
    } as Partial<CartItemEntity>);

    await dataSource.manager.update(ProductVariant, variant.id, { stock: 0 });

    const result = await service.getUserCart(user.id);

    expect(result.items.length).toBe(0);

    const remainingItems = await dataSource.manager.count(CartItemEntity, {
      where: { cartId: cart.id },
    });
    expect(remainingItems).toBe(0);
  });
});
