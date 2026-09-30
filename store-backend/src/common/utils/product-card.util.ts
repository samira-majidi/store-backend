
import { sortProductImages } from '#src/common/utils/product-images.util';
import { Product } from '#src/product/entity/product.entity';

export interface ProductCardDto {
  id: string;
  title: string;
  slug: string;
  brand: string | null;
  imageUrl: string | null;
  price: number;
  finalPrice: number;
  discountPercentage: number;
  stock: number;
}

export function formatProductCard(product: Product): ProductCardDto {
  const sortedImages = sortProductImages(product);
  const mainImage = sortedImages[0];
  const targetVariant =
    product.variants?.find((v) => v.isDefault) || product.variants?.[0];

  return {
    id: product.id,
    title: product.title,
    slug: product.slug,
    brand: product.brand || null,
    imageUrl: mainImage?.thumbnailPath || mainImage?.path || null,
    price: targetVariant?.price || 0,
    finalPrice: targetVariant?.finalPrice || 0,
    discountPercentage: targetVariant?.discountPercentage || 0,
    stock: targetVariant?.stock || 0,
  };
}
