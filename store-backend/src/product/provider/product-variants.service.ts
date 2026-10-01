// src/products/providers/product-variants.service.ts
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import { CreateProductVariantDto } from '../dto/create-product.dto';
import { ProductVariant } from '../entity/product-variant.entity';
import { Product } from '../entity/product.entity';
import { UpdateProductVariantDto } from '../dto/update-product.dto';
import { SetDiscountDto } from '../dto/set-discount.dto';

@Injectable()
export class ProductVariantsService {
  private readonly logger = new Logger(ProductVariantsService.name);

  constructor(
    @InjectRepository(ProductVariant)
    private readonly variantRepository: Repository<ProductVariant>,
    private readonly dataSource: DataSource,
  ) {}

  async setVariantDiscount(
    productId: string,
    variantId: string,
    dto: SetDiscountDto,
  ): Promise<ProductVariant> {
    const variant = await this.variantRepository.findOne({
      where: { id: variantId, productId },
    });

    if (!variant) {
      throw new NotFoundException(
        `تنوعی با شناسه ${variantId} برای این محصول یافت نشد.`,
      );
    }

    const newDiscountPercentage = dto.discountPercentage ?? 0;

    const pricing = this.calculatePricing(variant.price, newDiscountPercentage);

    variant.discountPercentage = pricing.discountPercentage;
    variant.discountAmount = pricing.discountAmount;
    variant.finalPrice = pricing.finalPrice;

    const savedVariant = await this.variantRepository.save(variant);

    this.logger.log(
      `تخفیف واریانت ${variantId} از محصول ${productId} به ${newDiscountPercentage}% تغییر یافت.`,
    );

    return savedVariant;
  }

  calculatePricing(
    price: number,
    discountPercentage?: number,
  ): {
    discountPercentage: number;
    discountAmount: number;
    finalPrice: number;
  } {
    if (!discountPercentage || discountPercentage <= 0) {
      return {
        discountPercentage: 0,
        discountAmount: 0,
        finalPrice: price,
      };
    }

    const discountAmount = Math.round((price * discountPercentage) / 100);
    const finalPrice = Math.max(0, price - discountAmount);

    return {
      discountPercentage,
      discountAmount,
      finalPrice,
    };
  }

  buildInitialVariants(
    variantsDto: CreateProductVariantDto[],
    product: Product,
    manager: EntityManager,
  ): ProductVariant[] {
    const defaultVariantsCount = variantsDto.filter((v) =>
      Boolean(v.isDefault),
    ).length;

    if (defaultVariantsCount > 1) {
      throw new BadRequestException('فقط یک واریانت می‌تواند پیش‌فرض باشد.');
    }

    const hasDefault = defaultVariantsCount === 1;

    return variantsDto.map((vDto, index) => {
      const pricing = this.calculatePricing(
        vDto.price,
        vDto.discountPercentage,
      );

      return manager.create(ProductVariant, {
        ...vDto,
        ...pricing,

        isDefault: hasDefault ? Boolean(vDto.isDefault) : index === 0,
        product,
      });
    });
  }

  async syncVariantsForProduct(
    product: Product,
    variantsDto: UpdateProductVariantDto[],
    manager: EntityManager,
  ): Promise<ProductVariant[]> {
    if (!variantsDto.length) {
      throw new BadRequestException('حداقل یک واریانت الزامی است.');
    }

    const defaultCount = variantsDto.filter((v) => Boolean(v.isDefault)).length;
    if (defaultCount > 1) {
      throw new BadRequestException('فقط یک واریانت می‌تواند پیش‌فرض باشد.');
    }

    const currentVariants = product.variants || [];
    const incomingIds = new Set(variantsDto.map((v) => v.id).filter(Boolean));

    const variantsToRemove = currentVariants.filter(
      (v) => !incomingIds.has(v.id),
    );
    if (variantsToRemove.length > 0) {
      await manager.remove(ProductVariant, variantsToRemove);
    }

    const hasDefaultInPayload = defaultCount === 1;
    if (hasDefaultInPayload) {
      await manager.update(
        ProductVariant,
        { productId: product.id },
        { isDefault: false },
      );
    }
    const hasExistingDefault = currentVariants.some((v) => v.isDefault);
    const variantsToSave: ProductVariant[] = [];

    for (let index = 0; index < variantsDto.length; index++) {
      const vDto = variantsDto[index];
      let isDefault = false;
      if (hasDefaultInPayload) {
        isDefault = Boolean(vDto.isDefault);
      } else if (vDto.id) {
        const existing = currentVariants.find((v) => v.id === vDto.id);
        isDefault = existing ? existing.isDefault : false;
      } else {
        isDefault = !hasExistingDefault && index === 0;
      }

      if (vDto.id) {
        const existing = currentVariants.find((v) => v.id === vDto.id);
        if (!existing) {
          throw new BadRequestException(`واریانت ${vDto.id} نامعتبر است.`);
        }

        const newPrice = vDto.price ?? existing.price;
        const newDiscount =
          vDto.discountPercentage ?? existing.discountPercentage;
        const pricing = this.calculatePricing(newPrice, newDiscount);

        const updated = manager.merge(ProductVariant, existing, {
          ...vDto,
          ...pricing,
          isDefault,
        });
        variantsToSave.push(updated);
      } else {
        if (!vDto.sku || vDto.price == null || vDto.stock == null) {
          throw new BadRequestException(
            'برای واریانت جدید sku, price و stock الزامی است.',
          );
        }

        const pricing = this.calculatePricing(
          vDto.price,
          vDto.discountPercentage,
        );
        const created = manager.create(ProductVariant, {
          ...vDto,
          ...pricing,
          isDefault,
          product,
        });
        variantsToSave.push(created);
      }
    }
    const isAnyDefault = variantsToSave.some((v) => v.isDefault);
    if (!isAnyDefault && variantsToSave.length > 0) {
      variantsToSave[0].isDefault = true;
    }
    return await manager.save(ProductVariant, variantsToSave);
  }

  async addVariant(
    productId: string,
    dto: CreateProductVariantDto,
  ): Promise<ProductVariant> {
    if (!dto.sku || dto.price == null || dto.stock == null) {
      throw new BadRequestException(
        'برای ثبت واریانت فیلدهای sku، price و stock الزامی هستند.',
      );
    }

    const newVariantId = await this.dataSource.transaction(async (manager) => {
      const product = await manager
        .createQueryBuilder(Product, 'product')
        .leftJoinAndSelect('product.variants', 'variants')
        .where('product.id = :id', { id: productId })
        .getOne();

      if (!product) {
        throw new NotFoundException(`محصولی با شناسه ${productId} پیدا نشد!`);
      }

      const currentVariants = product.variants || [];

      const isDefault =
        currentVariants.length === 0 ? true : Boolean(dto.isDefault);

      if (isDefault && currentVariants.length > 0) {
        await manager.update(
          ProductVariant,
          { productId, isDefault: true },
          { isDefault: false },
        );
      }

      const pricing = this.calculatePricing(dto.price, dto.discountPercentage);

      const newVariant = manager.create(ProductVariant, {
        ...dto,
        ...pricing,
        isDefault,
        product,
      });

      const savedVariant = await manager.save(ProductVariant, newVariant);

      this.logger.log(
        `واریانت جدید با شناسه ${savedVariant.id} و SKU "${savedVariant.sku}" به محصول "${product.title}" اضافه شد.`,
      );

      return savedVariant.id;
    });

    return await this.variantRepository.findOneOrFail({
      where: { id: newVariantId },
    });
  }

  async removeVariant(
    productId: string,
    variantId: string,
  ): Promise<{ message: string }> {
    return await this.dataSource.transaction(async (manager) => {
      const variants = await manager.find(ProductVariant, {
        where: { productId },
        order: { id: 'ASC' },
      });

      if (variants.length <= 1) {
        throw new BadRequestException(
          'محصول نمی‌تواند بدون تنوع باشد. حداقل یک تنوع باید باقی بماند.',
        );
      }

      const targetVariant = variants.find((v) => v.id === variantId);
      if (!targetVariant) {
        throw new NotFoundException('تنوع مورد نظر پیدا نشد.');
      }

      const wasDefault = targetVariant.isDefault;

      await manager.remove(ProductVariant, targetVariant);

      if (wasDefault) {
        const remainingVariants = variants.filter((v) => v.id !== variantId);
        if (remainingVariants.length > 0) {
          const nextDefault = remainingVariants[0];
          nextDefault.isDefault = true;
          await manager.save(ProductVariant, nextDefault);
          this.logger.log(
            `تنوع ${nextDefault.id} به عنوان پیش‌فرض جدید محصول ${productId} انتخاب شد.`,
          );
        }
      }

      return { message: 'تنوع با موفقیت حذف شد.' };
    });
  }
}
