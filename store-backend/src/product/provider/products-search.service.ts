import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';

import { Product } from '../entity/product.entity';
import { Category } from '#src/categories/entity/category.entity';
import { FilterProductsDto } from '../dto/filter-products.dto';
import { CategoriesTreeService } from '#src/categories/provider/CategoriesTreeCache.service';
import { resolveCategorySubtreeIds } from '#src/common/utils/category-tree.util';
import { formatProductCard } from '#src/common/utils/product-card.util';

interface CategorySearchRaw {
  id: string | number;
  title: string;
  slug: string;
  productCount: string | number;
}

@Injectable()
export class ProductsSearchService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,

    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,

    private readonly categoriesTreeService: CategoriesTreeService,
  ) {}

  private async getCategoryIds(categoryId?: number, categorySlug?: string) {
    if (!categoryId && !categorySlug) return null;
    const tree = await this.categoriesTreeService.getTree();
    return resolveCategorySubtreeIds(tree, {
      id: categoryId,
      slug: categorySlug,
    });
  }

  // 1. جستجوی آنی
  async instantSearch(keyword: string) {
    if (!keyword?.trim()) {
      return { categories: [], products: [] };
    }

    const query = `%${keyword.trim()}%`;

    const products = await this.productRepository.find({
      where: { title: ILike(query) },
      relations: ['images', 'variants'],
      take: 6,
    });

    const categories = await this.categoryRepository
      .createQueryBuilder('category')
      .leftJoin('category.products', 'product')
      .where('category.name ILIKE :query', { query })
      .select([
        'category.id AS id',
        'category.name AS title',
        'category.slug AS slug',
        'COUNT(product.id) AS "productCount"',
      ])
      .groupBy('category.id')
      .limit(5)
      .getRawMany<CategorySearchRaw>();

    return {
      categories: categories.map((cat) => ({
        id: Number(cat.id),
        title: cat.title,
        slug: cat.slug,
        productCount: Number(cat.productCount),
      })),
      products: products.map(formatProductCard),
    };
  }

  // 2. فیلتر محصولات
  async filterProducts(dto: FilterProductsDto) {
    const {
      keyword,
      minPrice,
      maxPrice,
      brands,
      categoryId,
      categorySlug,
      page = 1,
      limit = 20,
    } = dto;

    const targetCategoryIds = await this.getCategoryIds(
      categoryId,
      categorySlug,
    );

    // اگر دسته‌ای مشخص شده بود اما پیدا نشد، دیتای خالی برمی‌گردد
    if (
      (categoryId || categorySlug) &&
      (!targetCategoryIds || targetCategoryIds.length === 0)
    ) {
      return {
        data: [],
        total: 0,
        page: Number(page),
        limit: Number(limit),
        totalPages: 0,
      };
    }

    const query = this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.variants', 'variant')
      .leftJoinAndSelect('product.images', 'image');

    if (targetCategoryIds && targetCategoryIds.length > 0) {
      query.andWhere('product.categoryId IN (:...catIds)', {
        catIds: targetCategoryIds,
      });
    }

    if (keyword?.trim()) {
      query.andWhere('product.title ILIKE :kw', { kw: `%${keyword.trim()}%` });
    }

    if (brands && brands.length > 0) {
      query.andWhere('product.brand IN (:...brands)', { brands });
    }

    if (minPrice !== undefined) {
      query.andWhere('variant.finalPrice >= :minPrice', { minPrice });
    }

    if (maxPrice !== undefined) {
      query.andWhere('variant.finalPrice <= :maxPrice', { maxPrice });
    }

    query.orderBy('product.createdAt', 'DESC');
    query.skip((page - 1) * limit).take(limit);

    const [products, total] = await query.getManyAndCount();

    return {
      data: products.map(formatProductCard),
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit),
    };
  }

  // 3. گزینه‌های فیلتر
  async getFilterOptions(categoryId?: number, categorySlug?: string) {
    const targetCategoryIds = await this.getCategoryIds(
      categoryId,
      categorySlug,
    );

    if (
      (categoryId || categorySlug) &&
      (!targetCategoryIds || targetCategoryIds.length === 0)
    ) {
      return { brands: [], priceRange: { min: 0, max: 0 } };
    }

    const brandQuery = this.productRepository
      .createQueryBuilder('product')
      .select('DISTINCT product.brand', 'brand')
      .where('product.brand IS NOT NULL')
      .andWhere("product.brand != ''");

    if (targetCategoryIds && targetCategoryIds.length > 0) {
      brandQuery.andWhere('product.categoryId IN (:...catIds)', {
        catIds: targetCategoryIds,
      });
    }

    const rawBrands = await brandQuery.getRawMany<{ brand: string }>();
    const brands = rawBrands.map((b) => b.brand).filter(Boolean);

    const priceQuery = this.productRepository
      .createQueryBuilder('product')
      .leftJoin('product.variants', 'variant')
      .select('MIN(variant.finalPrice)', 'minPrice')
      .addSelect('MAX(variant.finalPrice)', 'maxPrice')
      .where('variant.finalPrice IS NOT NULL');

    if (targetCategoryIds && targetCategoryIds.length > 0) {
      priceQuery.andWhere('product.categoryId IN (:...catIds)', {
        catIds: targetCategoryIds,
      });
    }

    const priceRange = await priceQuery.getRawOne<{
      minPrice: string | null;
      maxPrice: string | null;
    }>();

    return {
      brands,
      priceRange: {
        min: Number(priceRange?.minPrice) || 0,
        max: Number(priceRange?.maxPrice) || 0,
      },
    };
  }
}
