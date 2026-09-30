import { Upload } from '#src/common/upload/entity/upload.entity';
import { Product } from '#src/product/entity/product.entity';

export function sortProductImages(product: Product): Upload[] {
  if (!product.images?.length) return [];
  if (!product.imageOrder?.length) return product.images;

  const imagesMap = new Map(product.images.map((img) => [img.id, img]));

  return product.imageOrder
    .map((id) => imagesMap.get(id))
    .filter((img): img is Upload => Boolean(img));
}

export function formatProductResponse(product: Product): Product {
  product.images = sortProductImages(product);
  return product;
}
