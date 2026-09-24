// src/categories/entities/category.entity.ts

import { Product } from '#src/product/entity/product.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';

@Entity('categories')
export class Category {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 150 })
  name: string;

  @Column({ length: 200, unique: true })
  @Index()
  slug: string;

  @Column({ length: 1000, nullable: true })
  @Index()
  fullSlug: string;

  @Column({ length: 1000, nullable: true })
  @Index()
  path: string;

  @Column({ nullable: true, name: 'parent_id' })
  parentId: number | null;

  @ManyToOne(() => Category, (cat) => cat.children, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'parent_id' })
  parent: Category;

  @OneToMany(() => Category, (cat) => cat.parent)
  children: Category[];

  @Column({ default: 0 })
  depth: number;

  @Column({ nullable: true, length: 500 })
  description: string;

  @Column({ default: 0, name: 'sort_order' })
  sortOrder: number;

  @Column({ default: true, name: 'is_active' })
  isActive: boolean;

  @Column({ nullable: true, name: 'meta_title', length: 200 })
  metaTitle: string;

  @Column({ nullable: true, name: 'meta_description', length: 500 })
  metaDescription: string;

  @OneToMany(() => Product, (product) => product.category)
  products: Product[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
