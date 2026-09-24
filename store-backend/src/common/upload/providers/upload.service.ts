import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import sharp from 'sharp';
import { UploadToAwsProvider } from './upload-to-aws.provider';
import { Upload } from '../entity/upload.entity';

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);

  constructor(
    @InjectRepository(Upload)
    private readonly uploadRepository: Repository<Upload>,
    private readonly uploadToAwsProvider: UploadToAwsProvider,
  ) {}

  public async uploadFile(
    file: Express.Multer.File,
    userId: number,
    altText?: string,
  ) {
    try {
      if (!file) {
        throw new BadRequestException('No file uploaded');
      }

      if (!file.mimetype) {
        throw new BadRequestException('File mimetype is missing');
      }

      const allowedMimeTypes = [
        'image/gif',
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/webp',
      ];

      if (!allowedMimeTypes.includes(file.mimetype)) {
        throw new BadRequestException(
          `MIME type not supported. Allowed types: ${allowedMimeTypes.join(', ')}`,
        );
      }

      const mainSharp = sharp(file.buffer)
        .resize({ width: 1200, withoutEnlargement: true })
        .webp({ quality: 80 });

      const [mainBuffer, metadata] = await Promise.all([
        mainSharp.toBuffer(),
        mainSharp.metadata(),
      ]);

      const thumbBuffer = await sharp(file.buffer)
        .resize(400, 400, { fit: 'cover', position: 'centre' })
        .webp({ quality: 75 })
        .toBuffer();

      const mainKey = this.uploadToAwsProvider.generateFileName(
        file.originalname,
        '-main',
      );
      const thumbKey = this.uploadToAwsProvider.generateFileName(
        file.originalname,
        '-thumb',
      );

      const [mainUploadResult, thumbUploadResult] = await Promise.all([
        this.uploadToAwsProvider.uploadBuffer(
          mainBuffer,
          mainKey,
          'image/webp',
        ),
        this.uploadToAwsProvider.uploadBuffer(
          thumbBuffer,
          thumbKey,
          'image/webp',
        ),
      ]);

      const upload = this.uploadRepository.create({
        name: mainUploadResult.key,
        path: mainUploadResult.url,
        thumbnailPath: thumbUploadResult.url,
        width: metadata.width,
        height: metadata.height,
        altText: altText || file.originalname.split('.')[0],
        mime: 'image/webp',
        size: mainBuffer.length,
        isAttached: false,
        uploadedById: userId,
      });

      return await this.uploadRepository.save(upload);
    } catch (error: unknown) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      const errorMessage =
        error instanceof Error ? error.message : 'Upload failed';
      this.logger.error(`Upload error: ${errorMessage}`);
      throw new ConflictException(errorMessage);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  public async handleOrphanFilesCleanup() {
    this.logger.log('Starting orphan files cleanup task...');

    const expirationDate = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const orphanFiles = await this.uploadRepository.find({
      where: {
        isAttached: false,
        createDate: LessThan(expirationDate),
      },
    });

    if (orphanFiles.length === 0) {
      this.logger.log('No orphan files found.');
      return;
    }

    this.logger.log(`Found ${orphanFiles.length} orphan files to remove.`);

    for (const file of orphanFiles) {
      try {
        if (file.name) {
          await this.uploadToAwsProvider.deleteFile(file.name);

          const thumbKey = file.name.replace('-main.webp', '-thumb.webp');
          await this.uploadToAwsProvider.deleteFile(thumbKey);
        }

        await this.uploadRepository.remove(file);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        this.logger.error(
          `Error deleting orphan file id ${file.id}: ${message}`,
        );
      }
    }

    this.logger.log('Orphan files cleanup task finished.');
  }
}
