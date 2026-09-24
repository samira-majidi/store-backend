// src/modules/upload/upload.controller.ts
import {
  Controller,
  Post,
  Body,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiHeaders, ApiOperation } from '@nestjs/swagger';
import { UploadService } from './providers/upload.service';
import { ActiveUser } from '#src/auth/decorators/active-user.decorator';

@Controller('uploads')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}
  @UseInterceptors(FileInterceptor('file'))
  @ApiHeaders([
    { name: 'Content-Type', description: 'multipart/form-data' },
    { name: 'authorization', description: 'Bearer Token' },
  ])
  @ApiOperation({
    summary: 'upload a new image to the server',
  })
  @Post('file')
  public uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @ActiveUser('sub') userId: number,
  ) {
    return this.uploadService.uploadFile(file, userId);
  }
}
