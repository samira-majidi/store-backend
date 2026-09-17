import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { UserRole } from '../dtos/user-role.enum';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  name: string;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  lastName: string;

  @Column({
    type: 'varchar',
    length: 15,
    nullable: false,
    unique: true,
  })
  phoneNumber: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.USER,
  })
  role: UserRole;

  // @OneToMany(() => Order, (order) => order.user)
  // orders: Order[];
  // (این رو فعلاً کامنت گذاشتم که یادت باشه بعداً برای فروشگاه اضافه‌اش کنی)
}
