import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { CreateCategoryDto } from './dto/create-category.dto';
import { Category } from './entity/category.entity';
import { CategoriesService } from './provider/categories.service';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { Permission } from '#src/rbac/enums/permission.enum';
import { Permissions } from '#src/rbac/decorators/permissions.decorator';

@ApiTags('categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  // ─── CREATE ──────────────────────────────────────────────

  @Post()
  @Permissions(Permission.CATEGORY_CREATE)
  @ApiOperation({ summary: 'ایجاد دسته‌بندی جدید' })
  @ApiResponse({ status: 201, type: Category })
  @ApiResponse({ status: 400, description: 'داده‌های نامعتبر' })
  @ApiResponse({ status: 409, description: 'اسلاگ تکراری' })
  create(@Body() dto: CreateCategoryDto): Promise<Category> {
    return this.categoriesService.create(dto);
  }

  // ─── READ ────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'لیست تمام دسته‌بندی‌ها (مرتب بر اساس path)' })
  @ApiResponse({ status: 200, type: [Category] })
  findAll(): Promise<Category[]> {
    return this.categoriesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'دریافت دسته‌بندی با آیدی' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, type: Category })
  @ApiResponse({ status: 404, description: 'پیدا نشد' })
  findOne(@Param('id', ParseIntPipe) id: number): Promise<Category> {
    return this.categoriesService.findOne(id);
  }

  @Get('by-slug/:slug')
  @ApiOperation({ summary: 'دریافت دسته‌بندی با اسلاگ (استفاده‌ی فرانت)' })
  @ApiParam({ name: 'slug', type: String })
  @ApiResponse({ status: 200, type: Category })
  @ApiResponse({ status: 404, description: 'پیدا نشد' })
  findBySlug(@Param('slug') slug: string): Promise<Category> {
    return this.categoriesService.findBySlug(slug);
  }

  @Get(':id/subtree')
  @ApiOperation({ summary: 'دریافت درخت زیرشاخه‌ها (فرزندان و نواده‌ها)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, type: [Category] })
  getSubtree(@Param('id', ParseIntPipe) id: number): Promise<Category[]> {
    return this.categoriesService.getSubtree(id);
  }

  @Get(':id/breadcrumbs')
  @ApiOperation({ summary: 'دریافت مسیر راهنما از ریشه تا دسته (Breadcrumbs)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, type: [Category] })
  getBreadcrumbs(@Param('id', ParseIntPipe) id: number): Promise<Category[]> {
    return this.categoriesService.getBreadcrumbs(id);
  }

  // ─── UPDATE ──────────────────────────────────────────────

  @Patch(':id')
  @ApiOperation({ summary: 'ویرایش دسته‌بندی' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, type: Category })
  @ApiResponse({
    status: 400,
    description: 'تغییر اسلاگ دسته‌ی منتشرشده مجاز نیست',
  })
  @ApiResponse({ status: 404, description: 'پیدا نشد' })
  @ApiResponse({ status: 409, description: 'اسلاگ تکراری' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCategoryDto,
  ): Promise<Category> {
    return this.categoriesService.update(id, dto);
  }

  // ─── DELETE ──────────────────────────────────────────────

  @Delete(':id')
  @Permissions(Permission.CATEGORY_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'حذف دسته‌بندی (بدون زیردسته)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 204, description: 'حذف شد' })
  @ApiResponse({ status: 400, description: 'دارای زیردسته است' })
  @ApiResponse({ status: 404, description: 'پیدا نشد' })
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.categoriesService.remove(id);
  }

  // ─── MAINTENANCE ─────────────────────────────────────────

  @Post('admin/rebuild-paths')
  @Permissions(Permission.CATEGORY_UPDATE)
  @ApiOperation({ summary: 'بازسازی path/fullSlug/depth برای کل درخت' })
  @ApiResponse({ status: 201, schema: { example: { rebuilt: 12 } } })
  rebuildPaths(): Promise<{ rebuilt: number }> {
    return this.categoriesService.rebuildPaths();
  }
}
