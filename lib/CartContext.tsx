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

interface GiftCartSummary {
  totalItems: number;
  totalPrice: number;
  isFormValid: boolean;
}

interface CartContextType {
  cartSummary: CartSummary | null;
  setCartSummary: (s: CartSummary | null) => void;
  openCart: (() => void) | null;
  registerOpenCart: (fn: () => void) => void;
  giftCartSummary: GiftCartSummary | null;
  setGiftCartSummary: (s: GiftCartSummary | null) => void;
  openGiftCart: (() => void) | null;
  registerOpenGiftCart: (fn: () => void) => void;
}

const CartContext = createContext<CartContextType>({
  cartSummary: null,
  setCartSummary: () => {},
  openCart: null,
  registerOpenCart: () => {},
  giftCartSummary: null,
  setGiftCartSummary: () => {},
  openGiftCart: null,
  registerOpenGiftCart: () => {},
});

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cartSummary, setCartSummary] = useState<CartSummary | null>(null);
  const [openCart, setOpenCart] = useState<(() => void) | null>(null);
  const [giftCartSummary, setGiftCartSummary] = useState<GiftCartSummary | null>(null);
  const [openGiftCart, setOpenGiftCart] = useState<(() => void) | null>(null);

  const registerOpenCart = useCallback((fn: () => void) => {
    setOpenCart(() => fn);
  }, []);

  const registerOpenGiftCart = useCallback((fn: () => void) => {
    setOpenGiftCart(() => fn);
  }, []);

  return (
    <CartContext.Provider value={{ cartSummary, setCartSummary, openCart, registerOpenCart, giftCartSummary, setGiftCartSummary, openGiftCart, registerOpenGiftCart }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
