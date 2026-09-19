import { Role } from '../enums/role.enum';
import { Permission } from '../enums/permission.enum';

export const RolePermissions: Record<Role, Permission[]> = {
  // دسترسی‌های مدیر کل (Admin)
  [Role.ADMIN]: [
    // محصولات و دسته‌بندی
    Permission.PRODUCT_CREATE,
    Permission.PRODUCT_READ,
    Permission.PRODUCT_UPDATE,
    Permission.PRODUCT_DELETE,
    Permission.PRODUCT_INVENTORY_MANAGE,
    Permission.CATEGORY_CREATE,
    Permission.CATEGORY_READ,
    Permission.CATEGORY_UPDATE,
    Permission.CATEGORY_DELETE,

    // سفارشات
    Permission.ORDER_READ_ALL,
    Permission.ORDER_UPDATE_STATUS,
    Permission.ORDER_CANCEL,

    // کد تخفیف
    Permission.COUPON_CREATE,
    Permission.COUPON_READ,
    Permission.COUPON_UPDATE,
    Permission.COUPON_DELETE,

    // کاربران
    Permission.USER_READ_ALL,
    Permission.USER_UPDATE_ROLE,
    Permission.USER_BLOCK,

    // نظرات
    Permission.REVIEW_READ,
    Permission.REVIEW_MODERATE,
    Permission.REVIEW_DELETE,

    // داشبورد و آمار
    Permission.DASHBOARD_READ,
    Permission.REPORTS_EXPORT,
  ],

  // دسترسی‌های خریدار / کاربر عادی (User)
  [Role.USER]: [
    Permission.PRODUCT_READ,
    Permission.CATEGORY_READ,
    Permission.ORDER_CREATE,
    Permission.ORDER_READ_OWN,
    Permission.ORDER_CANCEL,
    Permission.COUPON_APPLY,
    Permission.REVIEW_CREATE,
    Permission.REVIEW_READ,
  ],
};
