import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { CartItemEntity } from './cart-item.entity'; // حتما اینو ایمپورت کن

@Entity('carts')
export class CartEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'int', unique: true })
  userId: number;

  // اینجا اصلاح شد: CartItemEntity جایگزین CartEntity شد
  @OneToMany(() => CartItemEntity, (item) => item.cart, { cascade: true })
  items: CartItemEntity[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
