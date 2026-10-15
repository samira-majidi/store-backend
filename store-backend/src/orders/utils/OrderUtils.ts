import { ShippingMethod } from '../enums/order.enum';

// ثابت هزینه پست پیشتاز (به راحتی از همین‌جا تغییر می‌کنه)
export const POST_PISHTAZ_COST = 200_000;

export const OrderUtils = {
  calculateShippingCost: (method: ShippingMethod): number => {
    switch (method) {
      case ShippingMethod.POST_PISHTAZ:
        return POST_PISHTAZ_COST;

      case ShippingMethod.TIPAX:
      case ShippingMethod.LOCAL_EXPRESS:
        return 0;

      default:
        return 0;
    }
  },

  calculateOrderTotals: (
    cartPayablePrice: number,
    shippingMethod: ShippingMethod,
  ) => {
    const shippingFee = OrderUtils.calculateShippingCost(shippingMethod);
    const finalAmount = cartPayablePrice + shippingFee;

    return {
      shippingFee,
      finalAmount,
    };
  },
};
