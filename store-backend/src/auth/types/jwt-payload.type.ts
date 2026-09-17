export interface JwtPayload {
  [x: string]: any;
  sub: number;
  email?: string;
  role?: string;
  name?: string; // 👈 اینجا اضافه شد
}
