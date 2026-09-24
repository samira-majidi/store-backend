import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Product } from './product.entity';
import { Exclude } from 'class-transformer';

@Entity('product_variants')
export class ProductVariant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 100, unique: true })
  sku: string;

  @Column({ type: 'decimal', precision: 12, scale: 0 })
  price: number;

  @Column({ type: 'int', default: 0 })
  discountPercentage: number;

  @Column({ type: 'int', default: 0 })
  stock: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  color: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  size: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  model: string;

  // ===============================================

  @Column({ default: false })
  isDefault: boolean;
  @Column()
  productId: number;

  @Exclude()
  @ManyToOne(() => Product, (product) => product.variants, {
    onDelete: 'CASCADE', // 👈 این بادیگارد دیتابیست هست، حتماً بمونه!
  })
  @JoinColumn({ name: 'productId' })
  product: Product;
}
