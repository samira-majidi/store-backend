// src/categories/categories.service.ts

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CreateCategoryDto } from '../dto/create-category.dto';
import { UpdateCategoryDto } from '../dto/update-category.dto';
import { Category } from '../entity/category.entity';
import { CategoriesTreeService } from './CategoriesTreeCache.service';

function padId(id: number): string {
  return String(id).padStart(10, '0');
}

function normalizeSlug(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\u0600-\u06FFa-z0-9-]/g, '');
}

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
    private readonly dataSource: DataSource,
    private readonly categoriesTreeService: CategoriesTreeService,
  ) {}

  // ─── CREATE ──────────────────────────────────────────────

  async create(dto: CreateCategoryDto): Promise<Category> {
    let parent: Category | null = null;

    if (dto.parentId) {
      parent = await this.categoryRepo.findOne({ where: { id: dto.parentId } });
      if (!parent) {
        throw new NotFoundException(
          `دسته‌بندی والد با آیدی ${dto.parentId} پیدا نشد`,
        );
      }
    }

    const slug = dto.slug ? normalizeSlug(dto.slug) : normalizeSlug(dto.name);

    const existing = await this.categoryRepo.findOne({ where: { slug } });
    if (existing) {
      throw new ConflictException(`اسلاگ "${slug}" قبلاً استفاده شده`);
    }

    // تغییر: ذخیره نتیجه‌ی تراکنش در یک متغیر و انتقال کش به بعد از اتمام تراکنش
    const savedCategory = await this.dataSource.transaction(async (manager) => {
      const category = manager.create(Category, {
        name: dto.name,
        slug,
        description: dto.description,
        sortOrder: dto.sortOrder ?? 0,
        metaTitle: dto.metaTitle,
        metaDescription: dto.metaDescription,
        isActive: dto.isActive ?? true,
        parentId: parent?.id ?? null,
        depth: parent ? parent.depth + 1 : 0,
      });

      const saved = await manager.save(Category, category);

      const path = parent
        ? `${parent.path}${padId(saved.id)}/`
        : `/${padId(saved.id)}/`;

      const fullSlug = parent ? `${parent.fullSlug}/${slug}` : slug;

      await manager.update(Category, saved.id, { path, fullSlug });

      saved.path = path;
      saved.fullSlug = fullSlug;
      return saved;
    });

    // اینجا چون تراکنش نهایی شده، کش دیتای جدید رو به درستی می‌خونه
    await this.categoriesTreeService.invalidate();
    await this.categoriesTreeService.getTree();

    return savedCategory;
  }

  // ─── READ ────────────────────────────────────────────────

  async findAll(): Promise<Category[]> {
    return this.categoryRepo.find({ order: { path: 'ASC' } });
  }

  async findOne(id: number): Promise<Category> {
    const category = await this.categoryRepo.findOne({
      where: { id },
      relations: ['parent', 'children'],
    });
    if (!category) {
      throw new NotFoundException(`دسته‌بندی با آیدی ${id} پیدا نشد`);
    }
    return category;
  }

  async findBySlug(slug: string): Promise<Category> {
    const category = await this.categoryRepo.findOne({
      where: { slug },
      relations: ['parent', 'children'],
    });
    if (!category) {
      throw new NotFoundException(`دسته‌بندی با اسلاگ "${slug}" پیدا نشد`);
    }
    return category;
  }

  async getSubtree(id: number): Promise<Category[]> {
    const category = await this.findOne(id);

    return this.categoryRepo
      .createQueryBuilder('cat')
      .where('cat.path LIKE :prefix', { prefix: `${category.path}%` })
      .orderBy('cat.path', 'ASC')
      .getMany();
  }

  async getBreadcrumbs(id: number): Promise<Category[]> {
    const category = await this.findOne(id);

    const segments = category.path
      .split('/')
      .filter(Boolean)
      .map((seg) => parseInt(seg, 10));

    if (segments.length === 0) return [];

    const ancestors = await this.categoryRepo
      .createQueryBuilder('cat')
      .select(['cat.id', 'cat.name', 'cat.slug', 'cat.fullSlug'])
      .where('cat.id IN (:...ids)', { ids: segments })
      .getMany();

    const map = new Map(ancestors.map((a) => [a.id, a]));

    return segments
      .map((segId) => map.get(segId))
      .filter((c): c is Category => Boolean(c));
  }

  // ─── UPDATE ──────────────────────────────────────────────

  async update(id: number, dto: UpdateCategoryDto): Promise<Category> {
    const category = await this.findOne(id);

    let nextFullSlug: string | null = null;

    if (dto.slug !== undefined) {
      const newSlug = normalizeSlug(dto.slug);

      if (newSlug !== category.slug) {
        if (category.isActive) {
          throw new BadRequestException(
            'اسلاگ دسته‌ی منتشرشده قابل تغییر نیست — URLهای ایندکس‌شده می‌شکنند',
          );
        }

        const conflict = await this.categoryRepo.findOne({
          where: { slug: newSlug },
        });
        if (conflict) {
          throw new ConflictException(`اسلاگ "${newSlug}" قبلاً استفاده شده`);
        }

        const parent = category.parentId
          ? await this.categoryRepo.findOne({
              where: { id: category.parentId },
            })
          : null;

        nextFullSlug = parent ? `${parent.fullSlug}/${newSlug}` : newSlug;
      }

      dto.slug = newSlug;
    }

    Object.assign(category, dto);

    if (nextFullSlug) {
      category.fullSlug = nextFullSlug;
    }

    // تغییر: اول تغییرات در دیتابیس ذخیره می‌شه، بعد کش رو آپدیت می‌کنیم
    const updatedCategory = await this.categoryRepo.save(category);

    await this.categoriesTreeService.invalidate();
    await this.categoriesTreeService.getTree();

    return updatedCategory;
  }

  // ─── DELETE ──────────────────────────────────────────────

  async remove(id: number): Promise<void> {
    const category = await this.findOne(id);

    const childCount = await this.categoryRepo.count({
      where: { parentId: id },
    });
    if (childCount > 0) {
      throw new BadRequestException('ابتدا زیردسته‌ها را حذف یا منتقل کنید');
    }

    // تغییر: اول رکورد رو از دیتابیس پاک می‌کنیم تا دوباره کش نشه
    await this.categoryRepo.remove(category);

    await this.categoriesTreeService.invalidate();
    await this.categoriesTreeService.getTree();
  }

  // ─── MAINTENANCE ─────────────────────────────────────────

  async rebuildPaths(): Promise<{ rebuilt: number }> {
    // تغییر: ذخیره خروجیِ تراکنش و انتقال کش به بعد از اتمام آن
    const result = await this.dataSource.transaction(async (manager) => {
      const all = await manager.find(Category, {
        order: { depth: 'ASC', id: 'ASC' },
      });

      const idMap = new Map<number, Category>(all.map((c) => [c.id, c]));
      let rebuilt = 0;

      for (const cat of all) {
        const parent = cat.parentId ? idMap.get(cat.parentId) : undefined;

        const path = parent
          ? `${parent.path}${padId(cat.id)}/`
          : `/${padId(cat.id)}/`;
        const fullSlug = parent ? `${parent.fullSlug}/${cat.slug}` : cat.slug;
        const depth = parent ? parent.depth + 1 : 0;

        if (
          cat.path !== path ||
          cat.fullSlug !== fullSlug ||
          cat.depth !== depth
        ) {
          await manager.update(Category, cat.id, { path, fullSlug, depth });
          rebuilt++;
        }

        // in-memory هم آپدیت می‌شه تا محاسبه‌ی فرزندها درست باشه
        cat.path = path;
        cat.fullSlug = fullSlug;
        cat.depth = depth;
      }

      return { rebuilt };
    });

    // حالا که تغییراتِ Transaction کاملاً ذخیره شده، کش رو باطل و از نو می‌سازیم
    if (result.rebuilt > 0) {
      await this.categoriesTreeService.invalidate();
      await this.categoriesTreeService.getTree();
    }

    return result;
  }
}
