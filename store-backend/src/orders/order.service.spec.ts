jest.mock('@nestjs/bullmq', () => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const { Inject } = jest.requireActual('@nestjs/common');
  return {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
    InjectQueue: (name: string) => Inject(`BullQueue_${name}`),
    getQueueToken: (name: string) => `BullQueue_${name}`,
  };
});

jest.mock('bullmq', () => ({
  Queue: class {},
}));

import { DataSource } from 'typeorm';
import { BadRequestException } from '@nestjs/common';

// انتیتی‌ها و سرویس
import { ProductVariant } from '#src/product/entity/product-variant.entity';
import { Product } from '#src/product/entity/product.entity';
import { Category } from '#src/categories/entity/category.entity';
import { User } from '#src/users/entity/user.entity';
import { CartItemEntity } from '#src/cart/entity/cart-item.entity';
import { CartEntity } from '#src/cart/entity/cart.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderItem } from './entities/order-item.entity';
import { Order } from './entities/order.entity';
import { ShippingMethod, OrderStatus } from './enums/order.enum';
import { OrderService } from './order.service';
import { IntegrationTestHelper } from '#src/common/test/test-helper';

describe('OrderService (Integration Tests)', () => {
  let service: OrderService;
  let dataSource: DataSource;

  const defaultShippingMethod = Object.values(ShippingMethod)[0];

  const mockQueue = {
    add: jest
      .fn()
      .mockImplementation(() => Promise.resolve({ id: 'mock-job-id' })),
  };

  beforeAll(async () => {
    const module = await IntegrationTestHelper.createTestingModule({
      providers: [
        OrderService,
        {
          provide: 'BullQueue_order-expiration',
          useValue: mockQueue,
        },
      ],
    });

    service = module.get<OrderService>(OrderService);
    dataSource = IntegrationTestHelper.dataSource;
  });

  afterAll(async () => {
    await IntegrationTestHelper.closeAll();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    await IntegrationTestHelper.cleanAll();
  });

  // =========================================================================
  // تست ۱: سناریوی خرید موفق (Happy Path)
  // =========================================================================
  it('should successfully checkout, create order, reserve stock, clear cart, and queue expiration job', async () => {
    const user = await dataSource.manager.save(User, {
      phoneNumber: '09120000000',
    } as Partial<User>);

    const category = await dataSource.manager.save(Category, {
      name: 'تجهیزات تنفسی',
      title: 'تجهیزات تنفسی',
      slug: 'respiratory-equipment',
    } as Partial<Category>);

    const product = await dataSource.manager.save(Product, {
      title: 'دستگاه اکسیژن‌ساز ۵ لیتری',
      slug: 'oxygen-concentrator-5l',
      categoryId: category.id,
    } as Partial<Product>);

    const variant = await dataSource.manager.save(ProductVariant, {
      productId: product.id,
      sku: 'OMR-OXY-5L',
      price: 1000000,
      finalPrice: 1000000,
      stock: 10,
      reservedStock: 0,
    } as Partial<ProductVariant>);

    const cart = await dataSource.manager.save(CartEntity, {
      userId: user.id,
    } as Partial<CartEntity>);

    await dataSource.manager.save(CartItemEntity, {
      cartId: cart.id,
      variantId: variant.id,
      quantity: 2,
    } as Partial<CartItemEntity>);

    const dto: CreateOrderDto = {
      name: 'سمیرا',
      lastName: 'مجیدی',
      mobile: '09120000000',
      province: 'تهران',
      city: 'تهران',
      fullAddress: 'میدان ولیعصر',
      postalCode: '1234567890',
      shippingMethod: defaultShippingMethod,
    };

    const result = await service.checkout(user.id, dto);

    expect(result.orderId).toBeDefined();

    const updatedVariant = await dataSource.manager.findOneBy(ProductVariant, {
      id: variant.id,
    });
    expect(updatedVariant?.stock).toBe(8);
    expect(updatedVariant?.reservedStock).toBe(2);

    const order = await dataSource.manager.findOneBy(Order, {
      id: result.orderId,
    });
    expect(order?.status).toBe(OrderStatus.PENDING_PAYMENT);

    const cartItemsCount = await dataSource.manager.count(CartItemEntity, {
      where: { cartId: cart.id },
    });
    expect(cartItemsCount).toBe(0);

    expect(mockQueue.add).toHaveBeenCalledTimes(1);
  });

  // =========================================================================
  // تست ۲: سناریوی سبد خرید خالی (Empty Cart)
  // =========================================================================
  it('should throw BadRequestException when the user cart is empty', async () => {
    const user = await dataSource.manager.save(User, {
      phoneNumber: '09129999999',
    } as Partial<User>);

    await dataSource.manager.save(CartEntity, {
      userId: user.id,
    } as Partial<CartEntity>);

    const dto: CreateOrderDto = {
      name: 'سمیرا',
      lastName: 'مجیدی',
      mobile: '09120000000',
      province: 'تهران',
      city: 'تهران',
      fullAddress: 'میدان ولیعصر',
      postalCode: '1234567890',
      shippingMethod: defaultShippingMethod,
    };

    await expect(service.checkout(user.id, dto)).rejects.toThrow(
      BadRequestException,
    );
  });

  // =========================================================================
  // تست ۳: سناریوی کمبود موجودی انبار و رول‌بک (Out of Stock & Rollback)
  // =========================================================================
  it('should throw BadRequestException and rollback transaction on insufficient stock', async () => {
    const user = await dataSource.manager.save(User, {
      phoneNumber: '09121111111',
    } as Partial<User>);

    const category = await dataSource.manager.save(Category, {
      name: 'فشارسنج',
      title: 'فشارسنج',
      slug: 'digital-arm-blood-pressure',
    } as Partial<Category>);

    const product = await dataSource.manager.save(Product, {
      title: 'فشارسنج بازویی دیجیتال',
      slug: 'blood-pressure-monitor',
      categoryId: category.id,
    } as Partial<Product>);

    const variant = await dataSource.manager.save(ProductVariant, {
      productId: product.id,
      sku: 'OM-BP-M3',
      price: 5000000,
      finalPrice: 5000000,
      stock: 1,
      reservedStock: 0,
    } as Partial<ProductVariant>);

    const cart = await dataSource.manager.save(CartEntity, {
      userId: user.id,
    } as Partial<CartEntity>);

    await dataSource.manager.save(CartItemEntity, {
      cartId: cart.id,
      variantId: variant.id,
      quantity: 2,
    } as Partial<CartItemEntity>);

    const dto: CreateOrderDto = {
      name: 'تست',
      lastName: 'تستی',
      mobile: '09120000000',
      province: 'تهران',
      city: 'تهران',
      fullAddress: 'آدرس تستی',
      postalCode: '1234567890',
      shippingMethod: defaultShippingMethod,
    };

    await expect(service.checkout(user.id, dto)).rejects.toThrow(
      BadRequestException,
    );

    const unchangedVariant = await dataSource.manager.findOneBy(
      ProductVariant,
      { id: variant.id },
    );
    expect(unchangedVariant?.stock).toBe(1);
    expect(unchangedVariant?.reservedStock).toBe(0);

    const orderCount = await dataSource.manager.count(Order);
    expect(orderCount).toBe(0);
  });

  // =========================================================================
  // تست ۴: سناریوی لغو سفارش و بازگشت موجودی (Cancel Order & Release Stock)
  // =========================================================================
  it('should cancel the order, set status to CANCELLED, and release reserved stock back to inventory', async () => {
    const user = await dataSource.manager.save(User, {
      phoneNumber: '09122222222',
    } as Partial<User>);

    const category = await dataSource.manager.save(Category, {
      name: 'تجهیزات سنجش و مانیتورینگ',
      title: 'تجهیزات سنجش و مانیتورینگ',
      slug: 'monitoring-equipment',
    } as Partial<Category>);

    const product = await dataSource.manager.save(Product, {
      title: 'پالس اکسیمتر انگشتی',
      slug: 'pulse-oximeter',
      categoryId: category.id,
    } as Partial<Product>);

    const variant = await dataSource.manager.save(ProductVariant, {
      productId: product.id,
      sku: 'PULSE-OXI-PRO',
      price: 2000000,
      finalPrice: 2000000,
      stock: 5,
      reservedStock: 2,
    } as Partial<ProductVariant>);

    const order = await dataSource.manager.save(Order, {
      userId: user.id,
      totalAmount: 4000000,
      shippingFee: 0,
      finalAmount: 4000000,
      status: OrderStatus.PENDING_PAYMENT,
      shippingMethod: defaultShippingMethod,
      name: 'سمیرا',
      lastName: 'مجیدی',
      mobile: '09120000000',
      province: 'تهران',
      city: 'تهران',
      fullAddress: 'آدرس',
      postalCode: '1234567890',
    } as Partial<Order>);

    await dataSource.manager.save(OrderItem, {
      orderId: order.id,
      variantId: variant.id,
      productName: product.title,
      quantity: 2,
      unitPrice: 2000000,
      lineTotal: 4000000,
    } as Partial<OrderItem>);

    const cancelResult = await service.cancelOrderAndReleaseStock(order.id);

    expect(cancelResult.order.status).toBe(OrderStatus.CANCELLED);

    const restoredVariant = await dataSource.manager.findOneBy(ProductVariant, {
      id: variant.id,
    });
    expect(restoredVariant?.stock).toBe(7);
    expect(restoredVariant?.reservedStock).toBe(0);
  });
});
