import { useState, useCallback } from 'react';
import { Product } from '../types/shopping';

export function useComparison() {
  const [selectedProducts, setSelectedProducts] = useState<Product[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [maxWarning, setMaxWarning] = useState<string | null>(null);

  const toggleProduct = useCallback((product: Product) => {
    setSelectedProducts((prev) => {
      const exists = prev.some((p) => p.id === product.id);
      if (exists) {
        setMaxWarning(null);
        return prev.filter((p) => p.id !== product.id);
      }

      if (prev.length >= 4) {
        setMaxWarning('You can compare a maximum of 4 products at once.');
        setTimeout(() => setMaxWarning(null), 3000);
        return prev;
      }

      setMaxWarning(null);
      return [...prev, product];
    });
  }, []);

  const removeProduct = useCallback((productId: string) => {
    setSelectedProducts((prev) => prev.filter((p) => p.id !== productId));
  }, []);

  const clearComparison = useCallback(() => {
    setSelectedProducts([]);
    setMaxWarning(null);
  }, []);

  const isCompared = useCallback(
    (productId: string) => selectedProducts.some((p) => p.id === productId),
    [selectedProducts]
  );

  return {
    selectedProducts,
    isDrawerOpen,
    openDrawer: () => setIsDrawerOpen(true),
    closeDrawer: () => setIsDrawerOpen(false),
    toggleProduct,
    removeProduct,
    clearComparison,
    isCompared,
    maxWarning,
  };
}
