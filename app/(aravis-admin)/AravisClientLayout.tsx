"use client";
import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { apiFetch } from '@/lib/api';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import AutoLogout from '@/components/AutoLogout';
import { ToastProvider } from '@/components/ui/ToastProvider';
import { Calendar, Menu, X, LogOut, ChevronLeft, ChevronRight, ClipboardList, ArrowLeftRight, User, Users, Settings, Wind } from 'lucide-react';

const MENU_ITEMS = [
  { name: 'Planning', icon: Calendar, path: '/aravis/planning' },
  { name: 'Demandes', icon: ClipboardList, path: '/aravis/demandes' },
  { name: 'Régularisation', icon: ArrowLeftRight, path: '/aravis/regularisation' },
  { name: 'Clients', icon: User, path: '/aravis/clients' },
  { name: 'Moniteurs', icon: Users, path: '/aravis/moniteurs' },
  { name: 'Prestations', icon: Wind, path: '/aravis/prestations' },
  { name: 'Configuration', icon: Settings, path: '/aravis/config' },
];

export default function AravisClientLayout({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [userName, setUserName] = useState('');
  const [standbyCount, setStandbyCount] = useState(0);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => { setIsMobileMenuOpen(false); }, [pathname]);

  useEffect(() => {
    if (!isAuthorized) return;
    if (pathname.startsWith('/aravis/demandes')) {
      localStorage.setItem('standby_last_visited', new Date().toISOString());
      setStandbyCount(0);
    } else {
      const since = localStorage.getItem('standby_last_visited') || new Date(0).toISOString();
      apiFetch(`/api/standby/new-count?since=${encodeURIComponent(since)}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => d && setStandbyCount(d.count ?? 0))
        .catch(() => {});
    }
  }, [pathname, isAuthorized]);

  useEffect(() => {
    document.title = 'Planning · Aravis Parapente';
    const userData = localStorage.getItem('user');
    if (!userData) { router.push('/login'); return; }
    const parsed = JSON.parse(userData);
    const isAravis = parsed.enseigne === 'aravis' || parsed.role === 'aravis';
    if (!isAravis && parsed.role !== 'admin') { router.push('/login'); return; }
    const name = parsed.first_name || parsed.firstName || parsed.email?.split('@')[0] || '';
    setUserName(name ? name.charAt(0).toUpperCase() + name.slice(1) : 'Utilisateur');
    setIsAuthorized(true);
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('user');
    fetch('/api/auth/logout', { method: 'POST' }).finally(() => router.push('/login'));
  };

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-[#1B2A4A] flex flex-col items-center justify-center">
        <span className="text-4xl block mb-4 animate-bounce">🔒</span>
        <p className="text-[#6CAED8] font-bold uppercase tracking-widest animate-pulse text-xs">Vérification...</p>
      </div>
    );
  }

  return (
    <ToastProvider>
      <div className="flex h-screen overflow-hidden bg-[#F0F4F8] font-sans text-[#1B2A4A]">
        <AutoLogout />

        {isMobileMenuOpen && (
          <div
            className="fixed inset-0 bg-[#1B2A4A]/70 backdrop-blur-sm z-40 md:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        {/* SIDEBAR */}
        <aside className={`
          fixed inset-y-0 left-0 z-50 flex flex-col bg-[#1B2A4A] text-white shadow-2xl transition-transform duration-300
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
          md:relative md:translate-x-0
          ${isCollapsed ? 'md:w-20' : 'md:w-64'} w-64
        `}>
          <div className="p-6 flex justify-between items-center border-b border-white/10 h-20">
            {(!isCollapsed || isMobileMenuOpen) ? (
              <div className="w-12 h-12 rounded-full overflow-hidden shrink-0">
                <Image src="/aravis.png" alt="Aravis Parapente" width={48} height={48} className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-full overflow-hidden shrink-0">
                <Image src="/aravis.png" alt="Aravis Parapente" width={40} height={40} className="w-full h-full object-cover" />
              </div>
            )}
            <button onClick={() => setIsCollapsed(!isCollapsed)} className="hidden md:block hover:bg-white/10 p-2 rounded-xl transition-colors">
              {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>
            <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden hover:bg-white/10 p-2 rounded-xl transition-colors">
              <X size={18} />
            </button>
          </div>

          <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
            {MENU_ITEMS.map(item => {
              const isActive = pathname.startsWith(item.path);
              const isDemandes = item.path === '/aravis/demandes';
              return (
                <div key={item.name}>
                  <Link
                    href={item.path}
                    className={`flex items-center justify-between p-3 rounded-xl transition-all ${
                      isActive
                        ? 'bg-[#4A8FBE] text-white'
                        : 'text-white/60 hover:bg-[#243860] hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <item.icon size={18} strokeWidth={2} />
                      {(!isCollapsed || isMobileMenuOpen) && <span className="font-bold text-sm">{item.name}</span>}
                    </div>
                    {(!isCollapsed || isMobileMenuOpen) && isDemandes && standbyCount > 0 && (
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                        isActive ? 'bg-white text-[#4A8FBE]' : 'bg-[#4A8FBE]/30 text-[#6CAED8]'
                      }`}>
                        {standbyCount}
                      </span>
                    )}
                  </Link>
                </div>
              );
            })}
          </nav>

          <div className="p-4 border-t border-white/10">
            <button
              onClick={handleLogout}
              className="flex items-center gap-4 p-3 text-rose-400 hover:bg-rose-500/10 w-full rounded-xl transition-colors font-bold text-sm"
            >
              <LogOut size={18} />
              {(!isCollapsed || isMobileMenuOpen) && <span>Déconnexion</span>}
            </button>
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-8 shrink-0">
            <div className="flex items-center gap-4">
              <button
                className="md:hidden p-2 bg-[#F0F4F8] rounded-xl text-[#1B2A4A] hover:bg-[#E2EAF4] transition-colors"
                onClick={() => { setIsMobileMenuOpen(true); setIsCollapsed(false); }}
              >
                <Menu size={20} />
              </button>
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#6CAED8] hidden sm:block">Aravis Parapente</span>
                <span className="text-sm font-bold text-[#1B2A4A] capitalize">
                  {pathname.split('/').pop()?.replace('-', ' ')}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-black text-[#1B2A4A] capitalize">{userName}</p>
                <p className="text-[10px] text-[#4A8FBE] font-bold uppercase tracking-widest">En ligne</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-[#1B2A4A] flex items-center justify-center font-black text-sm text-white">
                {userName ? userName.charAt(0).toUpperCase() : 'U'}
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto p-2 md:p-8 lg:p-12 bg-[#F0F4F8]">
            <div className="max-w-6xl mx-auto">
              <ErrorBoundary variant="admin" zone="aravis/page">
                {children}
              </ErrorBoundary>
            </div>
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
