import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import BackToTop from '@/components/BackToTop';
import { CartProvider } from '@/lib/CartContext';

export default function BookingLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <Navbar transparentOnTop />
      {children}
      <Footer />
      <BackToTop />
    </CartProvider>
  );
}
