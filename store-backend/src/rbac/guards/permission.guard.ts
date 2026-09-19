import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { Permission } from '../enums/permission.enum';
import { Role } from '../enums/role.enum';
import { RolePermissions } from '../mapping/role-permission.map';
import { REQUEST_USER_KEY } from '#src/auth/constants/auth-constant';
import { PERMISSIONS_KEY } from '../constants/permission-constant';
// 👇 ایمپورت اینترفیس خودت
import { ActiveUserData } from '#src/auth/interfaces/active-user.interface';

// تایپ اختصاصی ریکوئست بر پایه اینترفیس خودت
interface AuthenticatedRequest extends Request {
  [REQUEST_USER_KEY]?: ActiveUserData;
}

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // ۱. بررسی دسترسی‌های تعیین‌شده روی متد یا کنترلر
    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // اگر هیچ دسترسی خاصی مشخص نشده بود، عبور آزاد است
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    // ۲. گرفتن ریکوئست با تایپ ایمن
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request[REQUEST_USER_KEY];

    if (!user) {
      throw new UnauthorizedException('لطفاً ابتدا وارد حساب کاربری خود شوید.');
    }

    const userRole = user.role as Role;
    if (!userRole) {
      throw new ForbiddenException('نقش کاربری در توکن یافت نشد.');
    }

    // ۳. استخراج مجوزهای مرتبط با نقش کاربر
    const userPermissions = RolePermissions[userRole] ?? [];

    // ۴. بررسی دارا بودن تمامی مجوزهای الزامی
    const hasAllRequiredPermissions = requiredPermissions.every((permission) =>
      userPermissions.includes(permission),
    );

    if (!hasAllRequiredPermissions) {
      throw new ForbiddenException('شما مجوز دسترسی به این بخش را ندارید.');
    }

    return true;
  }
}
