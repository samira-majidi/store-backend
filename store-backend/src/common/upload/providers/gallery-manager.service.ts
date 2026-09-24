import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager, In } from 'typeorm';
import { Upload } from '../entity/upload.entity';

export interface GalleryConfig {
  maxImages: number;
  entityName: string;
}

@Injectable()
export class GalleryManagerService {
  private readonly logger = new Logger(GalleryManagerService.name);

  constructor(
    @InjectRepository(Upload)
    private readonly uploadRepository: Repository<Upload>,
  ) {}

  /**
   * اعتبارسنجی و دریافت فایل‌های معتبر
   */
  async validateAndGetImages(
    imageIds: number[],
    userId: number,
    config: GalleryConfig,
    manager?: EntityManager,
  ): Promise<Upload[]> {
    if (imageIds.length > config.maxImages) {
      throw new BadRequestException(
        `Maximum ${config.maxImages} images allowed for ${config.entityName}`,
      );
    }

    const repo = manager
      ? manager.getRepository(Upload)
      : this.uploadRepository;

    const attachedFiles = await repo.find({
      where: {
        id: In(imageIds),
        uploadedById: userId,
        isAttached: false,
      },
      lock: manager ? { mode: 'pessimistic_write' } : undefined,
    });

    if (attachedFiles.length !== imageIds.length) {
      throw new BadRequestException(
        'Some pictures are invalid, already attached, or not owned by you',
      );
    }

    return attachedFiles;
  }

  /**
   * Mark کردن فایل‌ها به عنوان attached
   */
  async markAsAttached(
    imageIds: number[],
    manager?: EntityManager,
  ): Promise<void> {
    const repo = manager
      ? manager.getRepository(Upload)
      : this.uploadRepository;

    await repo.update({ id: In(imageIds) }, { isAttached: true });

    this.logger.debug(`Marked ${imageIds.length} images as attached`);
  }

  /**
   * آزاد کردن فایل‌های قبلی
   */
  async releaseImages(
    images: Upload[],
    manager?: EntityManager,
  ): Promise<void> {
    if (!images?.length) return;

    const imageIds = images.map((img) => img.id);
    const repo = manager
      ? manager.getRepository(Upload)
      : this.uploadRepository;

    await repo.update({ id: In(imageIds) }, { isAttached: false });

    this.logger.debug(`Released ${imageIds.length} images`);
  }

  /**
   * جایگزینی کامل گالری (برای update)
   */
  async replaceGallery(
    oldImages: Upload[],
    newImageIds: number[],
    userId: number,
    config: GalleryConfig,
    manager: EntityManager,
  ): Promise<Upload[]> {
    // 1️⃣ آزاد کردن فایل‌های قبلی
    await this.releaseImages(oldImages, manager);

    // 2️⃣ اعتبارسنجی و دریافت فایل‌های جدید
    const newImages = await this.validateAndGetImages(
      newImageIds,
      userId,
      config,
      manager,
    );

    // 3️⃣ Mark کردن فایل‌های جدید
    await this.markAsAttached(newImageIds, manager);

    this.logger.log(
      `Gallery replaced for ${config.entityName}: ${oldImages.length} → ${newImages.length}`,
    );

    return newImages;
  }

  /**
   * اضافه کردن گالری جدید (برای create)
   */
  async attachGallery(
    imageIds: number[],
    userId: number,
    config: GalleryConfig,
    manager: EntityManager,
  ): Promise<Upload[]> {
    const images = await this.validateAndGetImages(
      imageIds,
      userId,
      config,
      manager,
    );

    await this.markAsAttached(imageIds, manager);

    this.logger.log(
      `Gallery attached for ${config.entityName}: ${images.length} images`,
    );

    return images;
  }
}
