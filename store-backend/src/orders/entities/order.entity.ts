import { User } from '#src/users/entity/user.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { OrderItem } from './order-item.entity';
import { ShippingMethod, OrderStatus } from '../enums/order.enum';
import { ColumnNumericTransformer } from '#src/common/utils/numeric.transformer';
import { Payment } from '#src/payment/entities/payment.entity';

@Entity('orders')
@Index(['userId', 'createdAt'])
@Index(['status', 'createdAt'])
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;
  @ManyToOne(() => User, (user) => user.orders, {
    onDelete: 'RESTRICT',
    nullable: false,
  })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'int' })
  userId: number;

  @OneToMany(() => OrderItem, (item) => item.order, { cascade: ['insert'] })
  items: OrderItem[];

  // --- اطلاعات گیرنده (Snapshot) ---
  @Column({ type: 'varchar', length: 100 }) name: string;
  @Column({ type: 'varchar', length: 100 }) lastName: string;
  @Column({ type: 'varchar', length: 20 }) mobile: string;
  @Column({ type: 'varchar', length: 100 }) province: string;
  @Column({ type: 'varchar', length: 100 }) city: string;
  @Column({ type: 'text' }) fullAddress: string;

  @Column({ type: 'varchar', length: 10 })
  postalCode: string;
  // --- تنظیمات ارسال ---
  @Column({ type: 'enum', enum: ShippingMethod })
  shippingMethod: ShippingMethod;

  @Column({ type: 'text', nullable: true })
  notes?: string | null;

  // --- مبالغ و وضعیت ---
  @Column({
    type: 'bigint',
    transformer: new ColumnNumericTransformer(),
  })
  totalAmount: number;

  @Column({
    type: 'bigint',
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  shippingFee: number;

  @Column({
    type: 'bigint',
    transformer: new ColumnNumericTransformer(),
  })
  finalAmount: number;

  @Column({
    type: 'enum',
    enum: OrderStatus,
    default: OrderStatus.PENDING_PAYMENT,
  })
  status: OrderStatus;

  @Index()
  @Column({ type: 'varchar', length: 100, nullable: true })
  trackingCode?: string | null;

  @OneToMany(() => Payment, (payment) => payment.order)
  payments: Payment[];

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
