import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { ProductVariantsService } from './product-variants.service';
import { ProductVariant } from '../entity/product-variant.entity';
import { Product } from '../entity/product.entity';
import { CreateProductVariantDto } from '../dto/create-product.dto';

describe('ProductVariantsService', () => {
  let service: ProductVariantsService;
  let mockEntityManager: jest.Mocked<Partial<EntityManager>>;
  beforeEach(async () => {
    mockEntityManager = {
      create: jest
        .fn()
        .mockImplementation(
          (_entityClass: any, plainObject: Partial<ProductVariant>) => {
            return plainObject as ProductVariant;
          },
        ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductVariantsService,
        {
          provide: getRepositoryToken(ProductVariant),
          useValue: {},
        },
        {
          provide: DataSource,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<ProductVariantsService>(ProductVariantsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ==========================================================
  // Unit Tests for: calculatePricing
  // ==========================================================
  describe('calculatePricing', () => {
    it('باید قیمت اصلی را برگرداند وقتی تخفیف داده نشده است (undefined)', () => {
      const result = service.calculatePricing(100000);
      expect(result).toEqual({
        discountPercentage: 0,
        discountAmount: 0,
        finalPrice: 100000,
      });
    });

    it('باید قیمت اصلی را برگرداند وقتی تخفیف صفر یا منفی است', () => {
      const resultZero = service.calculatePricing(50000, 0);
      const resultNegative = service.calculatePricing(50000, -10);

      expect(resultZero.finalPrice).toBe(50000);
      expect(resultNegative.finalPrice).toBe(50000);
      expect(resultNegative.discountPercentage).toBe(0);
    });

    it('باید مبلغ تخفیف و قیمت نهایی را به درستی محاسبه کند', () => {
      const result = service.calculatePricing(200000, 15);
      expect(result).toEqual({
        discountPercentage: 15,
        discountAmount: 30000,
        finalPrice: 170000,
      });
    });

    it('باید مبلغ تخفیف را به درستی گِرد (Round) کند', () => {
      const result = service.calculatePricing(1050, 15);
      expect(result.discountAmount).toBe(158);
      expect(result.finalPrice).toBe(892);
    });

    it('نباید اجازه دهد قیمت نهایی کمتر از صفر شود (مثلا تخفیف بالای 100 درصد)', () => {
      const result = service.calculatePricing(10000, 150);
      expect(result.discountAmount).toBe(15000);
      expect(result.finalPrice).toBe(0);
    });
  });

  // ==========================================================
  // Unit Tests for: buildInitialVariants
  // ==========================================================
  describe('buildInitialVariants', () => {
    const mockProduct = { id: 'prod-uuid-1', title: 'Test Product' } as Product;

    it('اگر هیچ واریانتی پیش‌فرض نباشد، باید اولین مورد را به عنوان پیش‌فرض در نظر بگیرد', () => {
      const dtos: Partial<CreateProductVariantDto>[] = [
        { sku: 'SKU-1', price: 1000, isDefault: false },
        { sku: 'SKU-2', price: 2000, isDefault: false },
      ];

      const result = service.buildInitialVariants(
        dtos as CreateProductVariantDto[],
        mockProduct,
        mockEntityManager as EntityManager,
      );

      expect(result).toHaveLength(2);
      expect(result[0].isDefault).toBe(true);
      expect(result[1].isDefault).toBe(false);
      expect(mockEntityManager.create).toHaveBeenNthCalledWith(
        1,
        ProductVariant,
        expect.objectContaining({
          sku: 'SKU-1',
          price: 1000,
          product: mockProduct,
          isDefault: true,
        }),
      );

      expect(mockEntityManager.create).toHaveBeenNthCalledWith(
        2,
        ProductVariant,
        expect.objectContaining({
          sku: 'SKU-2',
          price: 2000,
          product: mockProduct,
          isDefault: false,
        }),
      );
    });
    it('اگر چند واریانت پیش‌فرض باشند، باید اولین واریانت آرایه را پیش‌فرض کند', () => {
      const dtos: Partial<CreateProductVariantDto>[] = [
        { sku: 'SKU-1', price: 1000, isDefault: false },
        { sku: 'SKU-2', price: 2000, isDefault: true },
        { sku: 'SKU-3', price: 3000, isDefault: true },
      ];

      const result = service.buildInitialVariants(
        dtos as CreateProductVariantDto[],
        mockProduct,
        mockEntityManager as EntityManager,
      );

      expect(result.map((variant) => variant.isDefault)).toEqual([
        true,
        false,
        false,
      ]);
    });
    it('اگر دقیقاً یک واریانت پیش‌فرض مشخص شده باشد، باید به همان احترام بگذارد', () => {
      const dtos: Partial<CreateProductVariantDto>[] = [
        { sku: 'SKU-1', price: 1000, isDefault: false },
        { sku: 'SKU-2', price: 2000, isDefault: true },
        { sku: 'SKU-3', price: 3000, isDefault: false },
      ];

      const result = service.buildInitialVariants(
        dtos as CreateProductVariantDto[],
        mockProduct,
        mockEntityManager as EntityManager,
      );

      expect(result[0].isDefault).toBe(false);
      expect(result[1].isDefault).toBe(true);
      expect(result[2].isDefault).toBe(false);
    });

    it('اگر فرانت‌اند به اشتباه چند واریانت را پیش‌فرض بفرستد، باید برای امنیت فقط اولی را پیش‌فرض کند', () => {
      const dtos: Partial<CreateProductVariantDto>[] = [
        { sku: 'SKU-1', price: 1000, isDefault: true },
        { sku: 'SKU-2', price: 2000, isDefault: true },
      ];

      const result = service.buildInitialVariants(
        dtos as CreateProductVariantDto[],
        mockProduct,
        mockEntityManager as EntityManager,
      );

      expect(result[0].isDefault).toBe(true);
      expect(result[1].isDefault).toBe(false);
    });

    it('باید قیمت‌گذاری (Pricing) و Relation محصول را به درستی روی موجودیت‌ها Map کند', () => {
      const dtos: Partial<CreateProductVariantDto>[] = [
        {
          sku: 'SKU-1',
          price: 100000,
          discountPercentage: 10,
          isDefault: true,
        },
      ];

      const calculateSpy = jest.spyOn(service, 'calculatePricing');

      const result = service.buildInitialVariants(
        dtos as CreateProductVariantDto[],
        mockProduct,
        mockEntityManager as EntityManager,
      );

      expect(calculateSpy).toHaveBeenCalledWith(100000, 10);

      expect(result[0]).toEqual(
        expect.objectContaining({
          sku: 'SKU-1',
          price: 100000,
          discountPercentage: 10,
          discountAmount: 10000,
          finalPrice: 90000,
          isDefault: true,
          product: mockProduct,
        }),
      );
    });
  });
});
