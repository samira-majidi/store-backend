import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';

import { Product } from '../entity/product.entity';
import { CategoriesTreeService } from '#src/categories/provider/CategoriesTreeCache.service';
import { resolveCategorySubtreeIds } from '#src/common/utils/category-tree.util';
import { formatProductCard } from '#src/common/utils/product-card.util';
import { sortProductImages } from '#src/common/utils/product-images.util';

@Injectable()
export class PublicProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    private readonly categoriesTreeService: CategoriesTreeService,
  ) {}

  async getProductById(id: string) {
    const product = await this.productRepo.findOne({
      where: { id },
      relations: ['images', 'variants', 'category'],
    });

    if (!product) {
      throw new NotFoundException('محصول مورد نظر یافت نشد');
    }

    const sortedImages = sortProductImages(product);
    const sortedVariants = (product.variants || []).sort((a, b) => {
      if (a.isDefault) return -1;
      if (b.isDefault) return 1;
      return 0;
    });

    return {
      id: product.id,
      title: product.title,
      slug: product.slug,
      brand: product.brand,
      shortDescription: product.shortDescription,
      longDescription: product.longDescription,
      features: product.features,
      isSpecial: product.isSpecial,
      salesCount: product.salesCount,
      category: product.category
        ? {
            id: product.category.id,
            name: product.category.name,
            slug: product.category.slug,
          }
        : null,
      images: sortedImages.map((img) => ({
        id: img.id,
        path: img.path,
        thumbnailPath: img.thumbnailPath,
      })),
      variants: sortedVariants.map((v) => ({
        id: v.id,
        sku: v.sku,
        price: v.price,
        discountPercentage: v.discountPercentage,
        discountAmount: v.discountAmount,
        finalPrice: v.finalPrice,
        stock: v.stock,
        color: v.color,
        size: v.size,
        model: v.model,
        isDefault: v.isDefault,
      })),
      createdAt: product.createdAt,
    };
  }

  async findProductsByCategorySlug(slug: string, page = 1, limit = 20) {
    const tree = await this.categoriesTreeService.getTree();
    const categoryIds = resolveCategorySubtreeIds(tree, { slug });

    if (!categoryIds || categoryIds.length === 0) {
      throw new NotFoundException('دسته‌بندی مورد نظر یافت نشد یا غیرفعال است');
    }

    const [products, total] = await this.productRepo.findAndCount({
      where: { categoryId: In(categoryIds) },
      relations: ['images', 'variants'],
      select: {
        id: true,
        title: true,
        slug: true,
        imageOrder: true,
        createdAt: true,
        images: {
          id: true,
          path: true,
          thumbnailPath: true,
        },
        variants: {
          id: true,
          price: true,
          finalPrice: true,
          discountPercentage: true,
          stock: true,
          isDefault: true,
        },
      },
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return {
      data: products.map(formatProductCard),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getSpecialProducts(limit: number = 10) {
    const products = await this.productRepo.find({
      where: { isSpecial: true },
      relations: ['images', 'variants'],
      select: {
        id: true,
        title: true,
        slug: true,
        brand: true,
        imageOrder: true,
        createdAt: true,
        images: {
          id: true,
          path: true,
          thumbnailPath: true,
        },
        variants: {
          id: true,
          price: true,
          finalPrice: true,
          discountPercentage: true,
          stock: true,
          isDefault: true,
        },
      },
      order: { createdAt: 'DESC' },
      take: limit,
    });

    return products.map(formatProductCard);
  }
}
