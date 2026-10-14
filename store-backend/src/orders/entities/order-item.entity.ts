import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Order } from './order.entity';
import { ProductVariant } from '#src/product/entity/product-variant.entity';
import { ColumnNumericTransformer } from '#src/common/utils/numeric.transformer';

@Entity('order_items')
export class OrderItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  orderId: string;

  @ManyToOne(() => Order, (order) => order.items, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  order: Order;

  @ManyToOne(() => ProductVariant, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'variantId' })
  variant?: ProductVariant | null;

  @Column({ nullable: true })
  variantId?: string | null;

  // --- اطلاعات منجمد شده (Snapshot) ---
  @Column({ type: 'varchar', length: 255 })
  productName: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  variantTitle?: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  sku?: string | null;

  @Column({ type: 'text', nullable: true })
  productImage?: string | null;

  @Column({ type: 'int' })
  quantity: number;

  @Column({
    type: 'bigint',
    transformer: new ColumnNumericTransformer(),
  })
  unitPrice: number;
  @Column({
    type: 'bigint',
    transformer: new ColumnNumericTransformer(),
  })
  lineTotal: number;
}
