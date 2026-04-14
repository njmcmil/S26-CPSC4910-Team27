import { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';

export interface CartItem {
  item_id: string;
  sponsor_user_id: number;
  sponsor_name: string;
  title: string;
  points_cost: number;
  image_url: string | null;
  stock_quantity: number;
  quantity: number;
}

interface CartState {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'quantity'>) => void;
  removeItem: (item_id: string, sponsor_user_id?: number) => void;
  clearCart: () => void;
  totalPoints: number;
  totalCount: number;
}

const CartContext = createContext<CartState | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  const addItem = useCallback((item: Omit<CartItem, 'quantity'>) => {
    setItems(prev => {
      const existing = prev.find(
        i => i.item_id === item.item_id && i.sponsor_user_id === item.sponsor_user_id,
      );
      if (existing) {
        // Already in cart — don't add duplicates, just notify (handled in UI)
        return prev;
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  }, []);

  const removeItem = useCallback((item_id: string, sponsor_user_id?: number) => {
    setItems(prev =>
      prev.filter(i =>
        sponsor_user_id == null
          ? i.item_id !== item_id
          : !(i.item_id === item_id && i.sponsor_user_id === sponsor_user_id),
      ),
    );
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const totalPoints = items.reduce((sum, i) => sum + i.points_cost * i.quantity, 0);
  const totalCount = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, clearCart, totalPoints, totalCount }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartState {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
