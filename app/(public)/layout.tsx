"use client";
import { usePathname } from 'next/navigation';
import { ToastProvider } from '@/components/ui/ToastProvider';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import ConsentBanner from '@/components/ui/ConsentBanner';
import RevealProvider from '@/components/RevealProvider';
import ChatWidget from '@/components/ChatWidget';

const CHAT_EXCLUDED_PATHS = ['/login'];

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showChat = !CHAT_EXCLUDED_PATHS.includes(pathname);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <RevealProvider />
      <main id="main-content" style={{ flex: 1 }}>
        <ToastProvider>
          <ErrorBoundary variant="public" zone="public/page">
            {children}
          </ErrorBoundary>
        </ToastProvider>
      </main>
      <ConsentBanner />
      {showChat && <ChatWidget />}
    </div>
  );
}
