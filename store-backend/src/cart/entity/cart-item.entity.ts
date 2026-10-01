import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { CartEntity } from './cart.entity';
import { ProductVariant } from '#src/product/entity/product-variant.entity';

@Entity('cart_items')
@Index(['cartId', 'variantId'], { unique: true })
export class CartItemEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ================= ارتباط با سبد خرید =================
  @Column({ type: 'uuid' })
  cartId: string;

  @ManyToOne(() => CartEntity, (cart) => cart.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cartId' })
  cart: CartEntity;

  // ================= ارتباط با تنوع محصول (Variant) =================
  @Column({ type: 'uuid' })
  variantId: string;

  // این Relation بهت کمک می‌کنه وقت واکشی سبد، قیمت، عکس و اسم محصول رو هم باهاش Join کنی
  @ManyToOne(() => ProductVariant)
  @JoinColumn({ name: 'variantId' })
  variant: ProductVariant;

  // ================= اطلاعات آیتم =================
  @Column({ type: 'int', default: 1 })
  quantity: number;
}
