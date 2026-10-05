import { ProductVariant } from '#src/product/entity/product-variant.entity';

export interface CartItemLike {
  id?: string;
  variantId?: string;
  quantity: number;
  variant?: ProductVariant | null;
}

export interface ReconcileResult<T extends CartItemLike> {
  validItems: T[];
  itemsToUpdate: T[];
  itemsToDelete: T[];
  messages: string[];
  hasChanges: boolean;
}

export const CartUtils = {
  calculateSummary: (
    items: { quantity: number; variant?: ProductVariant | null }[],
  ) => {
    return items.reduce(
      (acc, item) => {
        const qty = item.quantity;
        const price = Number(item.variant?.price || 0);
        const finalPrice = Number(item.variant?.finalPrice || price);

        acc.totalItemsCount += qty;
        acc.rawPrice += price * qty;
        acc.payablePrice += finalPrice * qty;
        acc.totalDiscount = acc.rawPrice - acc.payablePrice;
        return acc;
      },
      { totalItemsCount: 0, rawPrice: 0, totalDiscount: 0, payablePrice: 0 },
    );
  },

  reconcileStock: (quantity: number, stock: number) => {
    if (stock <= 0) {
      return { isAvailable: false, validQuantity: 0, wasAdjusted: true };
    }
    return {
      isAvailable: true,
      validQuantity: Math.min(quantity, stock),
      wasAdjusted: quantity > stock,
    };
  },

  reconcileCartItems: <T extends CartItemLike>(
    items: T[],
  ): ReconcileResult<T> => {
    const validItems: T[] = [];
    const itemsToUpdate: T[] = [];
    const itemsToDelete: T[] = [];
    const messages: string[] = [];

    for (const item of items) {
      const stock = item.variant?.stock ?? 0;
      const stockCheck = CartUtils.reconcileStock(item.quantity, stock);
      const itemName =
        item.variant?.product?.title || item.variant?.sku || 'کالا';

      if (!item.variant || !stockCheck.isAvailable) {
        itemsToDelete.push(item);
        if (item.variant) {
          messages.push(
            `کالای "${itemName}" به دلیل اتمام موجودی از سبد شما حذف شد.`,
          );
        }
        continue;
      }

      if (stockCheck.wasAdjusted) {
        item.quantity = stockCheck.validQuantity;
        itemsToUpdate.push(item);
        messages.push(
          `موجودی کالای "${itemName}" محدود است. تعداد درخواستی به ${stockCheck.validQuantity} عدد کاهش یافت.`,
        );
      }

      validItems.push(item);
    }

    return {
      validItems,
      itemsToUpdate,
      itemsToDelete,
      messages,
      hasChanges: itemsToDelete.length > 0 || itemsToUpdate.length > 0,
    };
  },
};
