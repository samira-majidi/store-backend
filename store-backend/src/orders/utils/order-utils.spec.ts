import { ShippingMethod } from '../enums/order.enum';
import { OrderUtils, POST_PISHTAZ_COST } from './orderUtils';

describe('OrderUtils (Unit Tests)', () => {
  describe('calculateShippingCost', () => {
    it('should return correct cost for POST_PISHTAZ (پیش‌کرایه)', () => {
      const cost = OrderUtils.calculateShippingCost(
        ShippingMethod.POST_PISHTAZ,
      );
      expect(cost).toBe(POST_PISHTAZ_COST);
    });

    it('should return 0 for TIPAX because it is COD / pay on delivery (پس‌کرایه)', () => {
      const cost = OrderUtils.calculateShippingCost(ShippingMethod.TIPAX);
      expect(cost).toBe(0);
    });

    it('should return 0 for LOCAL_EXPRESS because it is pay on delivery (پس‌کرایه)', () => {
      const cost = OrderUtils.calculateShippingCost(
        ShippingMethod.LOCAL_EXPRESS,
      );
      expect(cost).toBe(0);
    });

    it('should return 0 for unknown shipping method (fallback default)', () => {
      const cost = OrderUtils.calculateShippingCost(
        'UNKNOWN' as ShippingMethod,
      );
      expect(cost).toBe(0);
    });
  });

  describe('calculateOrderTotals', () => {
    const cartPayablePrice = 11_500_000;

    it('should add shipping cost to final amount when method is POST_PISHTAZ', () => {
      const result = OrderUtils.calculateOrderTotals(
        cartPayablePrice,
        ShippingMethod.POST_PISHTAZ,
      );

      expect(result).toEqual({
        shippingFee: POST_PISHTAZ_COST,
        finalAmount: cartPayablePrice + POST_PISHTAZ_COST,
      });
    });

    it('should not add shipping cost to final amount when method is TIPAX (پس‌کرایه)', () => {
      const result = OrderUtils.calculateOrderTotals(
        cartPayablePrice,
        ShippingMethod.TIPAX,
      );

      expect(result).toEqual({
        shippingFee: 0,
        finalAmount: cartPayablePrice,
      });
    });

    it('should handle zero cart price correctly', () => {
      const result = OrderUtils.calculateOrderTotals(
        0,
        ShippingMethod.POST_PISHTAZ,
      );

      expect(result).toEqual({
        shippingFee: POST_PISHTAZ_COST,
        finalAmount: POST_PISHTAZ_COST,
      });
    });
  });
});
