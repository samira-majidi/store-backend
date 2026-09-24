import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
  JoinTable,
  ManyToMany,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { ProductVariant } from './product-variant.entity';
import { Upload } from '#src/common/upload/entity/upload.entity';
import { Category } from '#src/categories/entity/category.entity';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Index()
  @Column({ type: 'varchar', length: 255, unique: true })
  slug: string;

  // ================= تصاویر =================
  @ManyToOne(() => Upload, { eager: true, nullable: false }) // nullable: false یعنی محصول حتما باید عکس اصلی داشته باشه
  @JoinColumn({ name: 'mainImageId' })
  mainImage: Upload;

  @ManyToMany(() => Upload, { eager: true })
  @JoinTable({
    name: 'product_gallery', // ساخت خودکار جدول واسط در دیتابیس
    joinColumn: { name: 'productId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'uploadId', referencedColumnName: 'id' },
  })
  gallery: Upload[];

  @Column({ name: 'category_id' })
  categoryId: number;

  @ManyToOne(() => Category, (category) => category.products, {
    nullable: false, // محصول حتماً باید دسته‌بندی داشته باشه
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'category_id' })
  category: Category;

  @Column({ type: 'simple-array', nullable: true })
  features: string[];

  @Column({ type: 'text', nullable: true })
  shortDescription: string;

  @Column({ type: 'text', nullable: true })
  longDescription: string;

  @Column({ default: false })
  isSpecial: boolean;

  @Column({ type: 'int', default: 0 })
  salesCount: number;

  @OneToMany(() => ProductVariant, (variant) => variant.product, {
    cascade: true,
  })
  variants: ProductVariant[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
