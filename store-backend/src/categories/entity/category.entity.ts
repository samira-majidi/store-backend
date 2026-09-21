// src/categories/entities/category.entity.ts

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

  // اسلاگ دسته‌بندی (فارسی یا انگلیسی)
  @Column({ length: 200, unique: true })
  @Index()
  slug: string;

  // اسلاگ کامل از ریشه تا این دسته: "پزشکی/فشارسنج/دیجیتال"
  @Column({ length: 1000, nullable: true })
  @Index()
  fullSlug: string;

  // Materialized Path — مثال: /0000000001/0000000005/0000000012/
  @Column({ length: 1000, nullable: true })
  @Index()
  path: string;

  // Adjacency List — منبع حقیقت ساختار سلسله‌مراتبی
  @Column({ nullable: true, name: 'parent_id' })
  parentId: number | null;

  @ManyToOne(() => Category, (cat) => cat.children, {
    nullable: true,
    onDelete: 'RESTRICT', // جلوگیری از حذف ناخواسته زیرشاخه‌ها
  })
  @JoinColumn({ name: 'parent_id' })
  parent: Category;

  @OneToMany(() => Category, (cat) => cat.parent)
  children: Category[];

  // عمق در درخت: ریشه = 0
  @Column({ default: 0 })
  depth: number;

  @Column({ nullable: true, length: 500 })
  description: string;

  @Column({ default: 0, name: 'sort_order' })
  sortOrder: number;

  @Column({ default: true, name: 'is_active' })
  isActive: boolean;

  // متادیتای سئو
  @Column({ nullable: true, name: 'meta_title', length: 200 })
  metaTitle: string;

  @Column({ nullable: true, name: 'meta_description', length: 500 })
  metaDescription: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
