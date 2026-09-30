// products.service.ts
import { GalleryManagerService } from '#src/common/upload/providers/gallery-manager.service';
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  CreateProductDto,
  CreateProductVariantDto,
} from '../dto/create-product.dto';
import { ProductVariant } from '../entity/product-variant.entity';
import { Product } from '../entity/product.entity';
import { Upload } from '#src/common/upload/entity/upload.entity';
import { Category } from '../../categories/entity/category.entity';
import { UpdateProductDto } from '../dto/update-product.dto';
import { ProductVariantsService } from './product-variants.service';
import { formatProductResponse } from '#src/common/utils/product-images.util';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    private readonly productVariantsService: ProductVariantsService,
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

  async create(dto: CreateProductDto, userId: number): Promise<Product> {
    // ۱. اعتبارسنجی اولیه
    if (!dto.imageIds || dto.imageIds.length === 0) {
      throw new BadRequestException('حداقل یک تصویر برای محصول الزامی است.');
    }

    const skus = dto.variants.map((v) => v.sku);
    if (new Set(skus).size !== skus.length) {
      throw new BadRequestException(
        'کدهای SKU در تنوع‌های ارسالی نباید تکراری باشند',
      );
    }

    const category = await this.dataSource.getRepository(Category).findOne({
      where: { id: dto.categoryId },
      select: ['id', 'isActive'],
    });

    if (!category) {
      throw new NotFoundException(
        `دسته‌بندی با آیدی ${dto.categoryId} پیدا نشد!`,
      );
    }
    if (!category.isActive) {
      throw new BadRequestException(
        'دسته‌بندی انتخاب‌شده غیرفعال است و امکان ثبت محصول در آن وجود ندارد.',
      );
    }

    const defaultVariantsCount = dto.variants.filter((v) => v.isDefault).length;
    if (defaultVariantsCount > 1) {
      throw new BadRequestException('فقط یک تنوع می‌تواند پیش‌فرض باشد.');
    } else if (defaultVariantsCount === 0 && dto.variants.length > 0) {
      dto.variants[0].isDefault = true;
    }

    const slug = this.generateSlug(dto.title, dto.slug);

    // بررسی یکتا بودن اسلاگ قبل از ورود به تراکنش
    const existingSlug = await this.productRepository.findOne({
      where: { slug },
    });
    if (existingSlug) {
      throw new ConflictException(
        'این اسلاگ یا عنوان قبلاً برای محصول دیگری ثبت شده است.',
      );
    }

    // ۲. ورود به تراکنش
    const newProductId = await this.dataSource.transaction(async (manager) => {
      let attachedImages: Upload[] = [];

      // 👈 اصلاح مهم: استفاده از dto.imageIds به جای galleryImageIds
      if (dto.imageIds && dto.imageIds.length > 0) {
        attachedImages = await this.galleryManagerService.attachGallery(
          dto.imageIds,
          userId,
          { maxImages: 10, entityName: 'Product Images' },
          manager,
        );
      }

      const product = manager.create(Product, {
        title: dto.title,
        slug: slug,
        brand: dto.brand,
        categoryId: dto.categoryId,
        images: attachedImages, // 👈 اینجا هم ستون images مقداردهی می‌شه
        imageOrder: dto.imageIds, // 👈 ترتیب ارسالی فرانت در دیتابیس ذخیره می‌شه
        features: dto.features || [],
        shortDescription: dto.shortDescription,
        longDescription: dto.longDescription,
        isSpecial: dto.isSpecial || false,
        salesCount: 0,
      });

      const savedProduct = await manager.save(Product, product);

      const variants = this.productVariantsService.buildInitialVariants(
        dto.variants,
        savedProduct,
        manager,
      );

      savedProduct.variants = await manager.save(ProductVariant, variants);

      this.logger.log(
        `محصول "${savedProduct.title}" با شناسه ${savedProduct.id} ایجاد شد.`,
      );

      return savedProduct.id;
    });

    // ۳. واکشی محصول بعد از ثبت کامل
    const createdProduct = await this.productRepository.findOneOrFail({
      where: { id: newProductId },
      relations: ['images', 'variants'], // 👈 رابطه images واکشی می‌شه
    });

    // 👈 اصلاح نهایی: پاس دادن محصول به هلپر برای مرتب‌سازی قبل از برگشت به فرانت‌اند
    return formatProductResponse(createdProduct);
  }

  /**
   * ویرایش محصول
   */
  async update(
    id: string,
    dto: UpdateProductDto,
    userId: number,
  ): Promise<Product> {
    // ۱. انجام تمام عملیات نوشتن و ویرایش داخل تراکنش
    await this.dataSource.transaction(async (manager) => {
      const product = await manager
        .createQueryBuilder(Product, 'product')
        .leftJoinAndSelect('product.images', 'images')
        .leftJoinAndSelect('product.variants', 'variants')
        .where('product.id = :id', { id })
        .getOne();

      if (!product)
        throw new NotFoundException(`محصولی با شناسه ${id} پیدا نشد!`);

      const { categoryId, imageIds, variants, ...basicFields } = dto;

      manager.merge(Product, product, basicFields);

      if (categoryId !== undefined && categoryId !== product.categoryId) {
        const category = await manager.findOne(Category, {
          where: { id: categoryId },
          select: ['id', 'isActive'],
        });

        if (!category) {
          throw new NotFoundException('دسته‌بندی معتبر نیست!');
        }
        if (!category.isActive) {
          throw new BadRequestException(
            'دسته‌بندی انتخاب‌شده غیرفعال است و نمی‌توانید محصول را به آن منتقل کنید.',
          );
        }

        product.categoryId = categoryId;
      }

      if (imageIds !== undefined) {
        const incomingIds = new Set(imageIds);
        const currentImages = product.images || [];

        const imagesToRelease = currentImages.filter(
          (img) => !incomingIds.has(img.id),
        );
        if (imagesToRelease.length > 0) {
          await this.galleryManagerService.releaseImages(
            imagesToRelease,
            manager,
          );
        }

        const currentIds = new Set(currentImages.map((img) => img.id));
        const idsToAttach = imageIds.filter((id) => !currentIds.has(id));

        const newImages =
          idsToAttach.length > 0
            ? await this.galleryManagerService.attachGallery(
                idsToAttach,
                userId,
                { maxImages: 10, entityName: 'Product' }, // 👈 تنظیم اسم انتیتی بر اساس دیتابیس
                manager,
              )
            : [];

        // آپدیت کردن آبجکت‌های रिलेशन (مجموع عکس‌های قدیمیِ حفظ‌شده + عکس‌های جدید)
        product.images = [
          ...currentImages.filter((img) => incomingIds.has(img.id)),
          ...newImages,
        ];

        // 👈 ذخیره منبع حقیقت (Source of Truth) برای ترتیب عکس‌ها
        product.imageOrder = imageIds;
      }
      // --- هندل کردن واریانت‌ها ---
      if (variants !== undefined) {
        product.variants =
          await this.productVariantsService.syncVariantsForProduct(
            product,
            variants,
            manager,
          );
      }

      await manager.save(Product, {
        ...product,
        variants: undefined,
      });

      this.logger.log(`محصول "${product.title}" با موفقیت ویرایش شد.`);
    });

    const updatedProduct = await this.productRepository.findOneOrFail({
      where: { id },
      relations: ['images', 'variants'], // 👈 واکشی روابط جدید
    });
    return formatProductResponse(updatedProduct);
  }

  /**
   * واگذاری مستقیم افزودن واریانت به پرووایدر واریانت‌ها
   */
  async addVariant(
    productId: string,
    dto: CreateProductVariantDto,
  ): Promise<ProductVariant> {
    return await this.productVariantsService.addVariant(productId, dto);
  }

  /**
   * واگذاری مستقیم حذف واریانت به پرووایدر واریانت‌ها
   */
  async removeVariant(
    productId: string,
    variantId: string,
  ): Promise<{ message: string }> {
    return await this.productVariantsService.removeVariant(
      productId,
      variantId,
    );
  }
  /**
   * حذف کامل محصول
   */
  async remove(id: string): Promise<{ message: string }> {
    return await this.dataSource.transaction(async (manager) => {
      const product = await manager
        .createQueryBuilder(Product, 'product')
        // 👇 اینجا دیگه gallery و mainImage نداریم، فقط images رو جوین می‌کنیم
        .leftJoinAndSelect('product.images', 'images')
        .where('product.id = :id', { id })
        .getOne();

      if (!product) {
        throw new NotFoundException(`محصولی با شناسه ${id} پیدا نشد!`);
      }

      // 👇 خیلی ساده تمام عکس‌های متصل به محصول رو می‌ریزیم تو این آرایه
      const imagesToRelease: Upload[] =
        product.images && product.images.length > 0 ? product.images : [];

      // اول خود محصول رو پاک می‌کنیم
      await manager.remove(Product, product);

      // بعد عکس‌ها رو آزاد می‌کنیم (تا کران‌جاب بعداً پاکشون کنه)
      if (imagesToRelease.length > 0) {
        await this.galleryManagerService.releaseImages(
          imagesToRelease,
          manager,
        );
      }

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
