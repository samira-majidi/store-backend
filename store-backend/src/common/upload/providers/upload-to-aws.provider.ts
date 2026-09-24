// src/common/upload/providers/upload-to-aws.provider.ts
import { Inject, Injectable, Logger } from '@nestjs/common';
import * as config from '@nestjs/config';
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import appConfig from '../../config/app.config'; // مسیر فایل کانفیگ خودت رو بده

@Injectable()
export class UploadToAwsProvider {
  private readonly s3Client: S3Client;
  private readonly logger = new Logger(UploadToAwsProvider.name);
  private readonly bucket: string;
  private readonly endpoint: string;

  constructor(
    @Inject(appConfig.KEY)
    private readonly appConfiguration: config.ConfigType<typeof appConfig>,
  ) {
    this.bucket = this.appConfiguration.arvanBucketName || '';
    this.endpoint = this.appConfiguration.arvanEndpoint || '';

    this.s3Client = new S3Client({
      region: this.appConfiguration.arvanRegion || 'default',
      endpoint: this.endpoint,
      credentials: {
        accessKeyId: this.appConfiguration.arvanAccessKey || '',
        secretAccessKey: this.appConfiguration.arvanSecretKey || '',
      },
      forcePathStyle: true,
    });

    this.logger.log('S3Client initialized successfully');
  }

  public generateFileName(originalName: string, suffix: string = ''): string {
    const lastDotIndex = originalName.lastIndexOf('.');
    const name =
      lastDotIndex !== -1
        ? originalName.substring(0, lastDotIndex)
        : originalName;
    const cleanName = name.replace(/[^a-zA-Z0-9_-]/g, '_');
    return `${cleanName}-${Date.now()}-${randomUUID()}${suffix}.webp`;
  }

  // آپلود مستقیم بافر پردازش‌شده Sharp
  public async uploadBuffer(
    buffer: Buffer,
    fileName: string,
    mimeType: string = 'image/webp',
  ) {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: fileName,
      Body: buffer,
      ContentType: mimeType,
      ACL: 'public-read',
    });

    try {
      const result = await this.s3Client.send(command);
      const fileUrl = `${this.endpoint}/${this.bucket}/${fileName}`;
      return { url: fileUrl, key: fileName, result };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to upload buffer ${fileName} to S3: ${message}`,
      );
      throw new Error(`Failed to upload file to S3: ${message}`);
    }
  }

  // متد پاک‌سازی فایل از S3
  public async deleteFile(key: string) {
    if (!key) return;
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });
      await this.s3Client.send(command);
      this.logger.log(`Deleted orphan file from S3: ${key}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to delete file ${key} from S3: ${message}`);
    }
  }
}
