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

  @Index()
  @Column({ type: 'varchar', length: 100, nullable: true })
  brand?: string | null;
  // ================= تصاویر =================
  @ManyToMany(() => Upload)
  @JoinTable({
    name: 'product_images',
    joinColumn: { name: 'productId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'uploadId', referencedColumnName: 'id' },
  })
  images: Upload[];

  @Column({ type: 'jsonb', default: [] })
  imageOrder: number[];

  @Column({ type: 'int' })
  categoryId: number;

  @ManyToOne(() => Category)
  @JoinColumn({ name: 'categoryId' })
  category: Category;

  @Column({ type: 'jsonb', nullable: true, default: [] })
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
