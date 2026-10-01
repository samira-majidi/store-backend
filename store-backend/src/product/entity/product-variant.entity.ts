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
import { ColumnNumericTransformer } from '#src/common/utils/numeric.transformer';
@Index('UQ_one_default_variant_per_product', ['productId'], {
  unique: true,
  where: '"isDefault" = true',
})
@Entity('product_variants')
export class ProductVariant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 100, unique: true })
  sku: string;

  @Column({
    type: 'bigint',
    transformer: new ColumnNumericTransformer(),
  })
  price: number;

  @Column({ type: 'int', default: 0 })
  discountPercentage: number;

  @Column({
    type: 'bigint',
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  discountAmount: number;

  @Column({
    type: 'bigint',
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  finalPrice: number;
  @Column({ type: 'int', default: 0 })
  stock: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  color: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  size: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  model: string;

  @Column({ type: 'boolean', default: false })
  isDefault: boolean;
  // ===============================================

  @Column({ type: 'uuid' })
  productId: string;
  @Exclude()
  @ManyToOne(() => Product, (product) => product.variants, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'productId' })
  product: Product;
}
