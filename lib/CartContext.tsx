"use client";
import { createContext, useContext, useState, useCallback } from 'react';

interface CartSummary {
  totalItems: number;
  finalPrice: number;
  originalPrice: number;
  discountAmount: number;
  flightName: string;
  step: number;
  isFormValid: boolean;
}

interface CartContextType {
  cartSummary: CartSummary | null;
  setCartSummary: (s: CartSummary | null) => void;
  openCart: (() => void) | null;
  registerOpenCart: (fn: () => void) => void;
}

const CartContext = createContext<CartContextType>({
  cartSummary: null,
  setCartSummary: () => {},
  openCart: null,
  registerOpenCart: () => {},
});

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cartSummary, setCartSummary] = useState<CartSummary | null>(null);
  const [openCart, setOpenCart] = useState<(() => void) | null>(null);

  const registerOpenCart = useCallback((fn: () => void) => {
    setOpenCart(() => fn);
  }, []);

  return (
    <CartContext.Provider value={{ cartSummary, setCartSummary, openCart, registerOpenCart }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
