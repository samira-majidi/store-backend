import { sortProductImages } from '#src/common/utils/product-images.util';
import { ProductVariant } from '#src/product/entity/product-variant.entity';

export interface FormattedCartItemDto {
  id: string;
  variantId: string;
  productId: string;
  title: string;
  slug: string;
  brand: string | null;
  imageUrl: string | null;
  sku: string;
  color: string | null;
  size: string | null;
  model: string | null;
  price: number;
  finalPrice: number;
  discountPercentage: number;
  discountAmount: number;
  stock: number;
  quantity: number;
  totalPrice: number; // قیمت نهایی ضربدر تعداد
}

export function formatCartItem(
  itemId: string,
  quantity: number,
  variant: ProductVariant,
): FormattedCartItemDto {
  const product = variant.product;
  const sortedImages = product ? sortProductImages(product) : [];
  const mainImage = sortedImages[0];

  return {
    id: itemId,
    variantId: variant.id,
    productId: product?.id,
    title: product?.title || 'کالای نامشخص',
    slug: product?.slug || '',
    brand: product?.brand || null,
    imageUrl: mainImage?.thumbnailPath || mainImage?.path || null,
    sku: variant.sku,
    color: variant.color || null,
    size: variant.size || null,
    model: variant.model || null,
    price: Number(variant.price),
    finalPrice: Number(variant.finalPrice),
    discountPercentage: Number(variant.discountPercentage || 0),
    discountAmount: Number(variant.discountAmount || 0),
    stock: variant.stock,
    quantity,
    totalPrice: Number(variant.finalPrice) * quantity,
  };
}
