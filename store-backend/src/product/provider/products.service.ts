// products.service.ts
import { GalleryManagerService } from '#src/common/upload/providers/gallery-manager.service';
import {
  Injectable,
  ConflictException,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { CreateProductDto } from '../dto/create-product.dto';
import { ProductVariant } from '../entity/product-variant.entity';
import { Product } from '../entity/product.entity';
import { Upload } from '#src/common/upload/entity/upload.entity';
import { Category } from '../../categories/entity/category.entity'; // <--- مسیر انتیتی دسته‌بندی رو بسته به پروژه‌ت تنظیم کن

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(ProductVariant)
    private readonly variantRepository: Repository<ProductVariant>,
    private readonly galleryManagerService: GalleryManagerService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * ایجاد اسلاگ یکتا و استاندارد
   */
  private generateSlug(title: string, customSlug?: string): string {
    const raw = customSlug || title;
    return raw
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\w\u0600-\u06FF-]+/g, '');
  }

  /**
   * سرویس ساخت محصول
   */
  async create(dto: CreateProductDto, userId: number): Promise<Product> {
    const slug = this.generateSlug(dto.title, dto.slug);

    // بررسی یکتا بودن slug
    const slugExists = await this.productRepository.findOne({
      where: { slug },
    });
    if (slugExists) {
      throw new ConflictException(
        `محصولی با این اسلاگ (${slug}) قبلاً ثبت شده است`,
      );
    }

    const skus = dto.variants.map((v) => v.sku);
    if (new Set(skus).size !== skus.length) {
      throw new BadRequestException(
        'کدهای SKU در تنوع‌های ارسالی نباید تکراری باشند',
      );
    }

    const categoryExists = await this.dataSource
      .getRepository(Category)
      .exists({ where: { id: dto.categoryId } });

    if (!categoryExists) {
      throw new NotFoundException(
        `دسته‌بندی با آیدی ${dto.categoryId} پیدا نشد!`,
      );
    }

    return await this.dataSource.transaction(async (manager) => {
      const [mainImageUpload] = await this.galleryManagerService.attachGallery(
        [dto.mainImageId],
        userId,
        { maxImages: 1, entityName: 'Product Main Image' },
        manager,
      );

      let galleryImages: Upload[] = [];

      if (dto.galleryImageIds && dto.galleryImageIds.length > 0) {
        galleryImages = await this.galleryManagerService.attachGallery(
          dto.galleryImageIds,
          userId,
          { maxImages: 10, entityName: 'Product Gallery' },
          manager,
        );
      }

      const product = manager.create(Product, {
        title: dto.title,
        slug: slug,
        categoryId: dto.categoryId,
        mainImage: mainImageUpload,
        gallery: galleryImages,
        features: dto.features || [],
        shortDescription: dto.shortDescription,
        longDescription: dto.longDescription,
        isSpecial: dto.isSpecial || false,
        salesCount: 0,
      });

      const savedProduct = await manager.save(Product, product);

      const hasDefault = dto.variants.some((v) => v.isDefault);

      const variants = dto.variants.map((vDto, index) => {
        return manager.create(ProductVariant, {
          ...vDto,
          isDefault: hasDefault ? !!vDto.isDefault : index === 0,
          product: savedProduct,
        });
      });

      savedProduct.variants = await manager.save(ProductVariant, variants);

      this.logger.log(
        `محصول "${savedProduct.title}" با شناسه ${savedProduct.id} ایجاد شد.`,
      );

      return savedProduct;
    });
  }
  async remove(id: string): Promise<{ message: string }> {
    return await this.dataSource.transaction(async (manager) => {
      const product = await manager.findOne(Product, {
        where: { id },
        relations: ['mainImage', 'gallery'],
      });

      if (!product) {
        throw new NotFoundException(`محصولی با شناسه ${id} پیدا نشد!`);
      }

      const imagesToRelease: Upload[] = [];

      if (product.mainImage) {
        imagesToRelease.push(product.mainImage);
      }

      if (product.gallery && product.gallery.length > 0) {
        imagesToRelease.push(...product.gallery);
      }

      await manager.remove(Product, product);

      await this.galleryManagerService.releaseImages(imagesToRelease, manager);

      this.logger.log(
        `محصول "${product.title}" با شناسه ${id} با موفقیت حذف شد.`,
      );

      return {
        message:
          'محصول با موفقیت حذف شد و تصاویر در صف پاک‌سازی (کران‌جاب) قرار گرفتند.',
      };
    });
  }
}
