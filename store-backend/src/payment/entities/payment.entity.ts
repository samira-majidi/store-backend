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

import { ColumnNumericTransformer } from '#src/common/utils/numeric.transformer';
import { Order } from '#src/orders/entities/order.entity';

export enum PaymentStatus {
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

@Entity('payments')
@Index(['authority'], { unique: true })
@Index(['orderId'])
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  orderId: string;

  @ManyToOne(() => Order, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Column({
    type: 'bigint',
    transformer: new ColumnNumericTransformer(),
  })
  amount: number;

  @Column({ type: 'varchar', length: 255 })
  authority: string;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  status: PaymentStatus;

  @Column({ type: 'varchar', length: 100, nullable: true })
  refId?: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  cardNumber?: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  gatewayCode?: string | null;

  @Column({ type: 'text', nullable: true })
  failureReason?: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
