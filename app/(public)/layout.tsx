"use client";
import { ToastProvider } from '@/components/ui/ToastProvider';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import ConsentBanner from '@/components/ui/ConsentBanner';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <main id="main-content" style={{ flex: 1 }}>
        <ToastProvider>
          <ErrorBoundary variant="public" zone="public/page">
            {children}
          </ErrorBoundary>
        </ToastProvider>
      </main>
      <ConsentBanner />
    </div>
  );
}
