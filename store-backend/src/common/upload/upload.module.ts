// src/modules/upload/upload.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UploadService } from './providers/upload.service';
import { UploadToAwsProvider } from './providers/upload-to-aws.provider';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Upload } from './entity/upload.entity';
import { UploadController } from './upload.controller';
import { GalleryManagerService } from './providers/gallery-manager.service';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([Upload])],
  controllers: [UploadController],
  providers: [UploadService, UploadToAwsProvider, GalleryManagerService],
  exports: [
    UploadService,
    UploadToAwsProvider,
    TypeOrmModule,
    GalleryManagerService,
  ],
})
export class UploadModule {}
