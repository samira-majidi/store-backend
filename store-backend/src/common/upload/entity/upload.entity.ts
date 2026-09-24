// src/modules/upload/entity/upload.entity.ts
import { User } from '#src/users/entity/user.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Index(['uploadedById', 'isAttached'])
@Index(['isAttached', 'createDate']) // برای سرعت اجرای کوئری کران‌جاب پاک‌سازی
@Entity('uploads')
export class Upload {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 500 })
  name: string;

  // آدرس نسخه اصلی با کیفیت بهینه (WebP 1200px)
  @Column({ type: 'varchar', length: 1024 })
  path: string;

  // آدرس نسخه بندانگشتی مخصوص کارت محصول (WebP 400px)
  @Column({ type: 'varchar', length: 1024, nullable: true })
  thumbnailPath: string;

  @Column({ type: 'varchar', length: 50, default: 'image/webp' })
  mime: string;

  @Column({ type: 'int' })
  size: number;

  @Column({ type: 'int', nullable: true })
  width: number;

  @Column({ type: 'int', nullable: true })
  height: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  altText: string;

  @Column({ type: 'boolean', default: false })
  isAttached: boolean;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'uploadedById' })
  uploadedBy: User;

  @Column()
  uploadedById: number;

  @CreateDateColumn()
  createDate: Date;

  @UpdateDateColumn()
  updateDate: Date;
}
