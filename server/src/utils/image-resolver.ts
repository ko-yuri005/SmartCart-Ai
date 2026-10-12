/**
 * Image resolver utility providing reliable image sources and fallback representations.
 * Allows images to be swapped with custom CDN, local assets, or mock URLs.
 */

const CATEGORY_DEFAULT_IMAGES: Record<string, string> = {
  headphones: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop&q=80',
  smartphones: 'https://images.unsplash.com/photo-1511707171634-5f897ff0252a?w=600&auto=format&fit=crop&q=80',
  smartwatches: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80',
  laptops: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=600&auto=format&fit=crop&q=80',
  'keyboards-mice': 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=600&auto=format&fit=crop&q=80',
  'power-accessories': 'https://images.unsplash.com/photo-1609592424109-dd9892f1b177?w=600&auto=format&fit=crop&q=80',
};

export const FALLBACK_PRODUCT_IMAGE =
  'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=600&auto=format&fit=crop&q=80';

export function resolveProductImage(imageUrl?: string, category?: string): string {
  if (imageUrl && imageUrl.trim().startsWith('http')) {
    return imageUrl.trim();
  }
  if (category && CATEGORY_DEFAULT_IMAGES[category.toLowerCase()]) {
    return CATEGORY_DEFAULT_IMAGES[category.toLowerCase()];
  }
  return FALLBACK_PRODUCT_IMAGE;
}
