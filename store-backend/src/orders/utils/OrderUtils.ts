import { ShippingMethod } from '../enums/order.enum';

export const OrderUtils = {
  calculateShippingCost: (method: ShippingMethod): number => {
    switch (method) {
      case ShippingMethod.POST_PISHTAZ:
        return 50000;
      case ShippingMethod.TIPAX:
        return 100000;
      case ShippingMethod.LOCAL_EXPRESS:
        return 70000;
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
