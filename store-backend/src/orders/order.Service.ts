import { DataSource, In } from 'typeorm';
import { CreateOrderDto } from './dto/create-order.dto';
import { CartEntity } from '../cart/entity/cart.entity';
import { CartItemEntity } from '../cart/entity/cart-item.entity';
import { OrderStatus } from './enums/order.enum';
import { CartUtils } from '../cart/utils/helper';
import { OrderItem } from './entities/order-item.entity';
import { Order } from './entities/order.entity';

import { ProductVariant } from '#src/product/entity/product-variant.entity';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { OrderUtils } from './utils/orderUtils';

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    private dataSource: DataSource,
    @InjectQueue('order-expiration') private readonly expirationQueue: Queue,
  ) {}
  async checkout(userId: number, dto: CreateOrderDto) {
    this.logger.log(`[checkout] شروع فرآیند ثبت سفارش برای کاربر: ${userId}`);

    // ۱. اجرای اتمیک و امن ترنزکشن دیتابیس
    const { savedOrder, finalAmount } = await this.dataSource.transaction(
      async (manager) => {
        // قفل کردن سبد خرید کاربر برای جلوگیری از تغییر همزمان
        const lockedCart = await manager
          .getRepository(CartEntity)
          .createQueryBuilder('cart')
          .setLock('pessimistic_write')
          .where('cart.userId = :userId', { userId })
          .getOne();

        if (!lockedCart) {
          throw new BadRequestException('سبد خرید شما خالی است.');
        }

        const cart = await manager.findOne(CartEntity, {
          where: { id: lockedCart.id },
          relations: ['items', 'items.variant', 'items.variant.product'],
        });

        if (!cart || !cart.items || cart.items.length === 0) {
          throw new BadRequestException('سبد خرید شما خالی است.');
        }

        const { validItems, hasChanges, messages } =
          CartUtils.reconcileCartItems(cart.items);

        if (hasChanges) {
          throw new BadRequestException({
            message:
              'موجودی، وضعیت یا قیمت برخی از کالاهای سبد خرید شما تغییر کرده است. لطفاً سبد خرید خود را بازبینی کنید.',
            details: messages,
          });
        }

        const summary = CartUtils.calculateSummary(validItems);
        const { shippingFee, finalAmount } = OrderUtils.calculateOrderTotals(
          summary.payablePrice,
          dto.shippingMethod,
        );

        // رزرو و کسر اتمیک موجودی انبار
        for (const item of validItems) {
          const qty = item.quantity;

          if (!Number.isSafeInteger(qty) || qty <= 0) {
            throw new BadRequestException('تعداد کالا نامعتبر است.');
          }

          const result = await manager
            .createQueryBuilder()
            .update(ProductVariant)
            .set({
              stock: () => '"stock" - :qty',
              reservedStock: () => '"reservedStock" + :qty',
            })
            .where({ id: item.variant.id })
            .andWhere('"stock" >= :qty', { qty })
            .execute();

          if (result.affected !== 1) {
            throw new BadRequestException(
              `موجودی کالای «${item.variant.product.title}» کافی نیست.`,
            );
          }
        }

        // ساخت آیتم‌های سفارش
        const orderItemsToSave = validItems.map((item) => {
          const variant = item.variant;
          const product = variant.product;
          const unitPrice = Number(variant.finalPrice || variant.price);

          const variantAttributes = [
            variant.color,
            variant.size,
            variant.model,
          ].filter(Boolean);
          const variantTitle =
            variantAttributes.length > 0 ? variantAttributes.join(' - ') : null;

          return manager.create(OrderItem, {
            variantId: variant.id,
            productName: product.title,
            variantTitle: variantTitle,
            sku: variant.sku,
            quantity: item.quantity,
            unitPrice: unitPrice,
            lineTotal: unitPrice * item.quantity,
          });
        });

        const order = manager.create(Order, {
          userId,
          name: dto.name,
          lastName: dto.lastName,
          mobile: dto.mobile,
          province: dto.province,
          city: dto.city,
          fullAddress: dto.fullAddress,
          postalCode: dto.postalCode,
          shippingMethod: dto.shippingMethod,
          notes: dto.notes,
          totalAmount: summary.payablePrice,
          shippingFee: shippingFee,
          finalAmount: finalAmount,
          status: OrderStatus.PENDING_PAYMENT,
        });

        const savedOrder = await manager.save(Order, order);

        for (const item of orderItemsToSave) {
          item.orderId = savedOrder.id;
          item.order = savedOrder;
        }
        await manager.save(OrderItem, orderItemsToSave);

        const validItemIds = validItems.map((item) => item.id);
        if (validItemIds.length > 0) {
          await manager.delete(CartItemEntity, {
            cartId: cart.id,
            id: In(validItemIds),
          });
        }

        return { savedOrder, finalAmount };
      },
    );

    this.logger.log(
      `[checkout] ✅ سفارش با موفقیت ثبت شد. OrderId: ${savedOrder.id}`,
    );

    // ۲. ثبت جاب انقضا در BullMQ (بیرون از ترنزکشن دیتابیس)
    try {
      await this.expirationQueue.add(
        'check-pending-order',
        { orderId: savedOrder.id },
        {
          jobId: `order-${savedOrder.id}`,
          delay: 15 * 60 * 1000,
          removeOnComplete: true,
          removeOnFail: 1000,
        },
      );
    } catch (queueErr) {
      this.logger.error(
        `[checkout] خطا در ثبت جاب انقضا برای سفارش ${savedOrder.id}:`,
        queueErr,
      );
    }

    return {
      message: 'سفارش با موفقیت ایجاد شد و در انتظار پرداخت است.',
      orderId: savedOrder.id,
      payableAmount: finalAmount,
    };
  }

  async getMyOrders(userId: number) {
    const orders = await this.dataSource
      .getRepository(Order)
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.items', 'items')
      .where('order.userId = :userId', { userId })
      .orderBy('order.createdAt', 'DESC')
      .getMany();

    return {
      data: orders,
      count: orders.length,
    };
  }
  async getMyOrderById(userId: number, orderId: string) {
    const order = await this.dataSource
      .getRepository(Order)
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.items', 'items')
      .where('order.id = :orderId', { orderId })
      .andWhere('order.userId = :userId', { userId })
      .getOne();

    if (!order) {
      throw new NotFoundException('سفارش پیدا نشد.');
    }

    return order;
  }
  async getAllOrders() {
    const orders = await this.dataSource
      .getRepository(Order)
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.items', 'items')
      .orderBy('order.createdAt', 'DESC')
      .getMany();

    return {
      data: orders,
      count: orders.length,
    };
  }
  async cancelOrderAndReleaseStock(orderId: string) {
    return await this.dataSource.transaction(async (manager) => {
      const order = await manager
        .getRepository(Order)
        .createQueryBuilder('order')
        .setLock('pessimistic_write')
        .where('order.id = :orderId', { orderId })
        .getOne();

      if (!order) {
        throw new NotFoundException('سفارش پیدا نشد.');
      }

      if (order.status === OrderStatus.CANCELLED) {
        return { message: 'سفارش قبلاً لغو شده است.', order };
      }

      if (order.status !== OrderStatus.PENDING_PAYMENT) {
        return {
          message: `سفارش در وضعیت ${order.status} قرار دارد و قابل لغو نیست.`,
          order,
        };
      }

      const orderItems = await manager.find(OrderItem, {
        where: { orderId: order.id },
      });

      for (const item of orderItems) {
        if (!item.variantId) continue;

        const result = await manager
          .createQueryBuilder()
          .update(ProductVariant)
          .set({
            stock: () => '"stock" + :qty',
            reservedStock: () => '"reservedStock" - :qty',
          })
          .where('id = :variantId', { variantId: item.variantId })
          .andWhere('"reservedStock" >= :qty', { qty: item.quantity })
          .setParameter('qty', item.quantity)
          .execute();

        if (result.affected !== 1) {
          throw new BadRequestException(
            `موجودی رزروشده برای آیتم «${item.productName}» معتبر نیست.`,
          );
        }
      }

      // ۴. آپدیت وضعیت به لغو شده
      order.status = OrderStatus.CANCELLED;
      const updatedOrder = await manager.save(Order, order);

      return {
        message: 'سفارش لغو شد و موجودی رزروشده آزاد شد.',
        order: updatedOrder,
      };
    });
  }

  async updateOrderStatus(orderId: string, status: OrderStatus) {
    if (status === OrderStatus.CANCELLED) {
      return this.cancelOrderAndReleaseStock(orderId);
    }

    const orderRepository = this.dataSource.getRepository(Order);

    const order = await orderRepository.findOne({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('سفارش پیدا نشد.');
    }

    if (order.status === OrderStatus.DELIVERED) {
      throw new BadRequestException('وضعیت سفارش تحویل‌شده قابل تغییر نیست.');
    }

    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('وضعیت سفارش لغوشده قابل تغییر نیست.');
    }

    order.status = status;

    const updatedOrder = await orderRepository.save(order);

    this.logger.log(
      `[updateOrderStatus] وضعیت سفارش ${orderId} به ${status} تغییر کرد.`,
    );

    return {
      message: 'وضعیت سفارش با موفقیت تغییر کرد.',
      order: updatedOrder,
    };
  }
}
