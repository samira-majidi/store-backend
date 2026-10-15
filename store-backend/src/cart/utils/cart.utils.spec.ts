import { ProductVariant } from '#src/product/entity/product-variant.entity';
import { CartUtils, CartItemLike } from './helper';

describe('CartUtils (Unit Tests)', () => {
  describe('calculateSummary', () => {
    it('should return zero values for an empty cart', () => {
      const summary = CartUtils.calculateSummary([]);

      expect(summary).toEqual({
        totalItemsCount: 0,
        rawPrice: 0,
        totalDiscount: 0,
        payablePrice: 0,
      });
    });

    it('should correctly calculate total price, discount, and payable amount', () => {
      const mockItems = [
        {
          quantity: 2,
          variant: {
            price: 100_000,
            finalPrice: 80_000,
          } as ProductVariant,
        },
        {
          quantity: 1,
          variant: {
            price: 50_000,
          } as ProductVariant,
        },
      ];

      const summary = CartUtils.calculateSummary(mockItems);

      expect(summary.totalItemsCount).toBe(3);
      expect(summary.rawPrice).toBe(250_000);
      expect(summary.payablePrice).toBe(210_000);
      expect(summary.totalDiscount).toBe(40_000);
    });

    it('should not crash or return NaN if variant or prices are null/undefined', () => {
      const mockItems = [
        { quantity: 2, variant: null },
        {
          quantity: 1,
          variant: {
            price: undefined,
            finalPrice: undefined,
          } as unknown as ProductVariant,
        },
      ];

      const summary = CartUtils.calculateSummary(mockItems);

      expect(summary.totalItemsCount).toBe(3);
      expect(summary.rawPrice).toBe(0);
      expect(summary.payablePrice).toBe(0);
      expect(summary.totalDiscount).toBe(0);
    });
  });

  describe('reconcileStock', () => {
    it('should mark item as unavailable if stock is zero or negative', () => {
      expect(CartUtils.reconcileStock(2, 0)).toEqual({
        isAvailable: false,
        validQuantity: 0,
        wasAdjusted: true,
      });

      expect(CartUtils.reconcileStock(2, -5)).toEqual({
        isAvailable: false,
        validQuantity: 0,
        wasAdjusted: true,
      });
    });

    it('should not make changes if stock is greater than or equal to requested quantity', () => {
      const result = CartUtils.reconcileStock(3, 5);
      expect(result).toEqual({
        isAvailable: true,
        validQuantity: 3,
        wasAdjusted: false,
      });

      const exactResult = CartUtils.reconcileStock(5, 5);
      expect(exactResult).toEqual({
        isAvailable: true,
        validQuantity: 5,
        wasAdjusted: false,
      });
    });

    it('should adjust quantity if requested quantity exceeds stock', () => {
      const result = CartUtils.reconcileStock(5, 2);
      expect(result).toEqual({
        isAvailable: true,
        validQuantity: 2,
        wasAdjusted: true,
      });
    });
  });

  describe('reconcileCartItems', () => {
    it('should keep items unchanged if all have sufficient stock', () => {
      const items: CartItemLike[] = [
        {
          id: 'item-1',
          quantity: 2,
          variant: { stock: 10, sku: 'SKU-1' } as ProductVariant,
        },
      ];

      const result = CartUtils.reconcileCartItems(items);

      expect(result.validItems).toHaveLength(1);
      expect(result.itemsToUpdate).toHaveLength(0);
      expect(result.itemsToDelete).toHaveLength(0);
      expect(result.messages).toHaveLength(0);
      expect(result.hasChanges).toBe(false);
    });

    it('should move out-of-stock items to itemsToDelete and record a proper message', () => {
      const items: CartItemLike[] = [
        {
          id: 'item-1',
          quantity: 1,
          variant: {
            stock: 0,
            product: { title: 'Digital Blood Pressure Monitor' },
          } as unknown as ProductVariant,
        },
      ];

      const result = CartUtils.reconcileCartItems(items);

      expect(result.itemsToDelete).toHaveLength(1);
      expect(result.validItems).toHaveLength(0);
      expect(result.hasChanges).toBe(true);
      expect(result.messages[0]).toContain('Digital Blood Pressure Monitor');
      expect(result.messages[0]).toMatch(/out of stock/i);
    });

    it('should delete items without variant without adding any message', () => {
      const items: CartItemLike[] = [
        { id: 'item-orphan', quantity: 2, variant: null },
      ];

      const result = CartUtils.reconcileCartItems(items);

      expect(result.itemsToDelete).toHaveLength(1);
      expect(result.messages).toHaveLength(0);
      expect(result.hasChanges).toBe(true);
    });

    it('should update and adjust quantity if item quantity exceeds stock', () => {
      const items: CartItemLike[] = [
        {
          id: 'item-1',
          quantity: 5,
          variant: {
            stock: 3,
            sku: 'IPHONE-15',
          } as ProductVariant,
        },
      ];

      const result = CartUtils.reconcileCartItems(items);

      expect(result.itemsToUpdate).toHaveLength(1);
      expect(result.itemsToUpdate[0].quantity).toBe(3);
      expect(result.validItems).toHaveLength(1);
      expect(result.validItems[0].quantity).toBe(3);
      expect(result.hasChanges).toBe(true);
      expect(result.messages[0]).toContain('IPHONE-15');
      expect(result.messages[0]).toMatch(/reduced|adjusted/i);
    });

    it('should handle mixed scenarios (valid, itemsToUpdate, and itemsToDelete) simultaneously', () => {
      const items: CartItemLike[] = [
        {
          id: '1',
          quantity: 2,
          variant: { stock: 5, sku: 'VALID' } as ProductVariant,
        },
        {
          id: '2',
          quantity: 4,
          variant: { stock: 1, sku: 'ADJUST' } as ProductVariant,
        },
        {
          id: '3',
          quantity: 1,
          variant: { stock: 0, sku: 'DELETE' } as ProductVariant,
        },
      ];

      const result = CartUtils.reconcileCartItems(items);

      expect(result.validItems).toHaveLength(2);
      expect(result.itemsToUpdate).toHaveLength(1);
      expect(result.itemsToDelete).toHaveLength(1);
      expect(result.messages).toHaveLength(2);
      expect(result.hasChanges).toBe(true);
    });
  });
});
