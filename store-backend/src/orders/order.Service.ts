import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { CreateOrderDto } from './dto/create-order.dto';
import { CartEntity } from '../cart/entity/cart.entity';
import { CartItemEntity } from '../cart/entity/cart-item.entity';
import { OrderStatus } from './enums/order.enum';
import { CartUtils } from '../cart/utils/helper';
import { OrderItem } from './entities/order-item.entity';
import { Order } from './entities/order.entity';
import { OrderUtils } from './utils/OrderUtils';
import { ProductVariant } from '#src/product/entity/product-variant.entity';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    private dataSource: DataSource,
    @InjectQueue('order-expiration') private readonly expirationQueue: Queue,
  ) {}

  async checkout(userId: number, dto: CreateOrderDto) {
    this.logger.log(`[checkout] شروع فرآیند ثبت سفارش برای کاربر: ${userId}`);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const lockedCart = await queryRunner.manager
        .getRepository(CartEntity)
        .createQueryBuilder('cart')
        .setLock('pessimistic_write')
        .where('cart.userId = :userId', { userId })
        .getOne();

      if (!lockedCart) {
        throw new BadRequestException('سبد خرید شما خالی است.');
      }

      const cart = await queryRunner.manager.findOne(CartEntity, {
        where: { id: lockedCart.id },
        relations: ['items', 'items.variant', 'items.variant.product'],
      });

      if (!cart || !cart.items || cart.items.length === 0) {
        throw new BadRequestException('سبد خرید شما خالی است.');
      }

      const { validItems, hasChanges, messages } = CartUtils.reconcileCartItems(
        cart.items,
      );

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

      for (const item of validItems) {
        const qty = item.quantity;

        if (!Number.isSafeInteger(qty) || qty <= 0) {
          throw new BadRequestException('تعداد کالا نامعتبر است.');
        }

        const result = await queryRunner.manager
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

        return queryRunner.manager.create(OrderItem, {
          variantId: variant.id,
          productName: product.title,
          variantTitle: variantTitle,
          sku: variant.sku,

          quantity: item.quantity,
          unitPrice: unitPrice,
          lineTotal: unitPrice * item.quantity,
        });
      });

      const order = queryRunner.manager.create(Order, {
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

      const savedOrder = await queryRunner.manager.save(Order, order);

      for (const item of orderItemsToSave) {
        item.orderId = savedOrder.id;
        item.order = savedOrder;
      }
      await queryRunner.manager.save(OrderItem, orderItemsToSave);

      const validItemIds = validItems.map((item) => item.id);
      if (validItemIds.length > 0) {
        await queryRunner.manager.delete(CartItemEntity, {
          cartId: cart.id,
          id: In(validItemIds),
        });
      }
      await queryRunner.commitTransaction();
      this.logger.log(
        `[checkout] ✅ سفارش با موفقیت ثبت شد. OrderId: ${savedOrder.id}`,
      );

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
    } catch (error: any) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      const errorMsg = error instanceof Error ? error.message : 'نامشخص';
      this.logger.error(`[checkout] ❌ خطا در ثبت سفارش: ${errorMsg}`);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
