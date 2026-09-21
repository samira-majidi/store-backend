import { RedisService } from '#src/redis/providers/redis.service';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from '../entity/category.entity';

export interface CategoryNode {
  id: number;
  name: string;
  slug: string;
  parentId: number | null;
  children: CategoryNode[];
}

@Injectable()
export class CategoriesTreeService {
  private readonly logger = new Logger(CategoriesTreeService.name);
  private readonly CACHE_KEY = 'categories:tree:v1';
  private readonly CACHE_TTL = 0; // ۲۴ ساعت به ثانیه

  // برای جلوگیری از هجوم همزمان به دیتابیس (Single-flight)
  private pendingBuild: Promise<CategoryNode[]> | null = null;

  constructor(
    @InjectRepository(Category)
    private readonly catRepo: Repository<Category>,
    private readonly redisService: RedisService,
  ) {}

  /**
   * دریافت درخت کامل دسته‌بندی‌ها (مسیر اصلی)
   */
  async getTree(): Promise<CategoryNode[]> {
    try {
      const cachedTree = await this.redisService.get<CategoryNode[]>(
        this.CACHE_KEY,
      );
      if (cachedTree) {
        return cachedTree;
      }
    } catch (error) {
      this.logger.error('Redis error while getting categories tree:', error);
    }
    this.logger.warn(
      '⚠️ Category tree NOT found in cache (Cache Miss), fetching from DB...',
    );

    if (!this.pendingBuild) {
      this.pendingBuild = this.buildAndCacheTree().finally(() => {
        this.pendingBuild = null;
      });
    }

    return this.pendingBuild;
  }

  /**
   * ساخت درخت از دیتابیس و ذخیره در ردیس
   */
  private async buildAndCacheTree(): Promise<CategoryNode[]> {
    this.logger.log('Building category tree from Database...');

    const rawCategories = await this.catRepo.find({
      select: ['id', 'name', 'slug', 'parentId'],
      where: { isActive: true },
      order: { id: 'ASC' },
    });

    const nodeMap = new Map<number, CategoryNode>();
    const roots: CategoryNode[] = [];

    // ساخت نودها
    for (const cat of rawCategories) {
      nodeMap.set(cat.id, {
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        parentId: cat.parentId ?? null,
        children: [],
      });
    }

    // اتصال بچه‌ها به والدین
    for (const node of nodeMap.values()) {
      if (node.parentId && nodeMap.has(node.parentId)) {
        nodeMap.get(node.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    // تشخیص چرخه / نود یتیم: هر نودی که از roots قابل دسترسی نیست، دیتاش گم می‌شه
    const reachable = new Set<number>();
    const stack = [...roots];
    while (stack.length) {
      const node = stack.pop()!;
      if (reachable.has(node.id)) continue;
      reachable.add(node.id);
      stack.push(...node.children);
    }

    if (reachable.size !== nodeMap.size) {
      const orphans = [...nodeMap.keys()].filter((id) => !reachable.has(id));
      this.logger.error(
        `Cycle/orphan detected in category tree: ${orphans.join(', ')}`,
      );
      for (const id of orphans) {
        roots.push(nodeMap.get(id)!);
      }
    }

    // ذخیره در ردیس
    try {
      await this.redisService.set(this.CACHE_KEY, roots, this.CACHE_TTL);
      this.logger.log(
        `💾 Category tree built (${rawCategories.length} items) and cached in Redis successfully!`,
      );
    } catch (error) {
      this.logger.error('Redis error while setting categories tree:', error);
    }

    return roots;
  }

  /**
   * باطل کردن کش هنگام ایجاد/ویرایش/حذف دسته‌بندی
   */
  async invalidate(): Promise<void> {
    try {
      await this.redisService.del(this.CACHE_KEY);
      this.logger.log('Category tree cache invalidated successfully 🧹');
    } catch (error) {
      this.logger.error('Failed to invalidate categories cache:', error);
    }
  }
}
