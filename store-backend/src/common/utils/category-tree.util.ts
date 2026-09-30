import { CategoryNode } from '#src/categories/provider/CategoriesTreeCache.service';

/**
 * جستجوی یک گره در کل درخت دسته‌بندی‌ها با یک شرط دلخواه
 */
export function findNodeInTree(
  tree: CategoryNode[],
  predicate: (node: CategoryNode) => boolean,
): CategoryNode | null {
  for (const node of tree) {
    if (predicate(node)) return node;
    if (node.children && node.children.length > 0) {
      const found = findNodeInTree(node.children, predicate);
      if (found) return found;
    }
  }
  return null;
}

/**
 * استخراج شناسه تمام فرزندان و خود گره
 */
export function extractCategoryIds(node: CategoryNode): number[] {
  const ids: number[] = [node.id];
  if (node.children && node.children.length > 0) {
    for (const child of node.children) {
      ids.push(...extractCategoryIds(child));
    }
  }
  return ids;
}

/**
 * دریافت لیست شناسه‌های یک دسته (شامل زیرمجموعه‌ها) بر اساس slug یا id
 */
export function resolveCategorySubtreeIds(
  tree: CategoryNode[],
  options: { id?: number; slug?: string },
): number[] | null {
  const { id, slug } = options;
  if (!id && !slug) return null;

  let targetNode: CategoryNode | null = null;
  if (slug) {
    targetNode = findNodeInTree(tree, (n) => n.slug === slug);
  } else if (id) {
    targetNode = findNodeInTree(tree, (n) => n.id === id);
  }

  if (!targetNode) {
    return id ? [id] : [];
  }

  return extractCategoryIds(targetNode);
}
