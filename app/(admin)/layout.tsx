"use client";
import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import AutoLogout from '@/components/AutoLogout';
import { ToastProvider } from '@/components/ui/ToastProvider';
import { Calendar, Wind, Users, User, Gift, Settings, ChevronRight, ChevronLeft, X, Menu, LogOut, Handshake, ArrowLeftRight, Clock } from 'lucide-react';
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [clientCount, setClientCount] = useState(0);
  const [standbyCount, setStandbyCount] = useState(0);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>('');
  
  // NOUVEAU : L'état qui bloque l'affichage tant qu'on n'est pas sûr
  const [isAuthorized, setIsAuthorized] = useState(false); 
  // 🎯 NOUVEAU : État pour le menu hamburger sur mobile
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // 👉 On déclare le détecteur d'URL D'ABORD
  const router = useRouter();
  const pathname = usePathname();

  // 👉 On s'en sert ENSUITE pour fermer le menu automatiquement
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  // 1. RÉCUPÉRATION DES DONNÉES D'AFFICHAGE
  // La sécurité réelle est gérée par middleware.ts (vérifie le cookie auth_token côté serveur).
  // Ici on lit juste localStorage.user pour afficher le nom et filtrer le menu.
  useEffect(() => {
    document.title = 'Planning · Fluide Parapente';
    const userData = localStorage.getItem('user');

    if (!userData) {
      router.push('/login');
      return;
    }

    const parsed = JSON.parse(userData);
    const role = parsed.role;
    setUserRole(role);

    let finalName = parsed.first_name || parsed.firstName || parsed.email?.split('@')[0] || '';
    if (finalName) {
      finalName = finalName.charAt(0).toUpperCase() + finalName.slice(1);
    }
    setUserName(finalName || 'Utilisateur');

    setIsAuthorized(true);

    // Récupération du nombre de clients (uniquement si admin)
    if (role === 'admin') {
      const fetchCount = async () => {
        try {
          const res = await apiFetch('/api/clients');
          if (res.ok) {
            const data = await res.json();
            setClientCount(data.total ?? data.length ?? 0);
          }
        } catch (err) {
          console.error("Erreur compteur:", err);
        }
      };
      fetchCount();

      // Compteur nouvelles demandes
      if (pathname.startsWith('/fluide/standby')) {
        localStorage.setItem('standby_last_visited', new Date().toISOString());
        setStandbyCount(0);
      } else {
        const since = localStorage.getItem('standby_last_visited') || new Date(0).toISOString();
        apiFetch(`/api/standby/new-count?since=${encodeURIComponent(since)}`)
          .then(r => r.ok ? r.json() : null)
          .then(d => d && setStandbyCount(d.count ?? 0))
          .catch(() => {});
      }
    }
  }, [pathname, router]);

  const handleLogout = () => {
    localStorage.removeItem('user');
    fetch('/api/auth/logout', { method: 'POST' }).finally(() => {
      router.push('/login');
    });
  };

  // 2. Configuration du menu avec filtrage par RÔLE
  const allMenuItems = [
    { name: 'Calendrier', icon: Calendar, path: '/fluide/planning', roles: ['admin', 'permanent', 'monitor'] },
    { name: 'Demandes', icon: Clock, path: '/fluide/standby', badge: standbyCount, roles: ['admin'] },
    { name: 'Régularisation', icon: ArrowLeftRight, path: '/fluide/regularisation', roles: ['admin'] },
    { name: 'Clients', icon: User, path: '/fluide/clients', badge: clientCount, roles: ['admin'] },
    { name: 'Moniteurs', icon: Users, path: '/fluide/moniteurs', roles: ['admin', 'permanent'] },
    { name: 'Partenaires', icon: Handshake, path: '/fluide/partenaires', roles: ['admin'] },
    { name: 'Bons Cadeaux', icon: Gift, path: '/fluide/gift-cards', roles: ['admin'] },
    {
      name: 'Configurations',
      icon: Settings,
      path: '/fluide/config',
      roles: ['admin'],
      subItems: [{ name: 'Prestations', path: '/fluide/prestations' }, { name: 'Photos & Vidéos', path: '/fluide/prestations/complements' }]
    },
  ];

  const authorizedMenus = allMenuItems.filter(item => 
    userRole && item.roles.includes(userRole)
  );

  // ÉCRAN D'ATTENTE PENDANT LA VÉRIFICATION DU VIGILE
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center">
        <span className="text-4xl block mb-4 animate-bounce">🔒</span>
        <p className="text-sky-400 font-bold uppercase tracking-widest animate-pulse text-xs">Vérification de l'accréditation...</p>
      </div>
    );
  }

  // SI ON EST LÀ, C'EST QU'ON EST CONNECTÉ (Affichage normal)
  return (
    <ToastProvider>
    <div className="flex h-screen overflow-hidden bg-slate-50 font-sans text-slate-900">
      <AutoLogout />
      
      {/* 🎯 NOUVEAU : Overlay noir transparent qui apparaît derrière le menu sur mobile */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* SIDEBAR GAUCHE RESPONSIVE */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 flex flex-col bg-slate-900 text-white shadow-2xl transition-transform duration-300
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} 
        md:relative md:translate-x-0
        ${isCollapsed ? 'md:w-20' : 'md:w-64'} w-64
      `}>
        <div className="p-6 flex justify-between items-center border-b border-slate-800 h-20">
          {(!isCollapsed || isMobileMenuOpen) && (
            <div className="flex flex-col">
              <span className="font-black italic text-xl tracking-tighter leading-none">
                FLUIDE <span className="text-sky-400">PRO</span>
              </span>
              <span className="text-[8px] uppercase font-bold text-slate-500 mt-1 tracking-widest">
                {userRole === 'admin' ? '🛡️ Admin' : '🔑 Permanent'}
              </span>
            </div>
          )}
          
          {/* Bouton flèche (Bureau) */}
          <button 
            onClick={() => setIsCollapsed(!isCollapsed)} 
            className="hidden md:block hover:bg-slate-800 p-2 rounded-xl transition-colors"
          >
            {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>

          {/* Bouton fermer (Mobile) */}
          <button 
            onClick={() => setIsMobileMenuOpen(false)} 
            className="md:hidden hover:bg-slate-800 p-2 rounded-xl transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {authorizedMenus.map((item) => {
            const isActive = pathname.startsWith(item.path);
            
            return (
              <div key={item.name} className="space-y-1">
                <Link 
                  href={item.path} 
                  className={`flex items-center justify-between p-3 rounded-xl transition-all group ${
                    isActive ? 'bg-sky-600 text-white' : 'hover:bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <item.icon size={18} strokeWidth={2} />
                    {(!isCollapsed || isMobileMenuOpen) && <span className="font-bold text-sm">{item.name}</span>}
                  </div>

                  {(!isCollapsed || isMobileMenuOpen) && item.badge !== undefined && item.badge > 0 && (
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                      isActive ? 'bg-white text-sky-600' : 'bg-sky-500/20 text-sky-400'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </Link>
                
                {(!isCollapsed || isMobileMenuOpen) && item.subItems && isActive && (
                  <div className="ml-10 space-y-1">
                    {item.subItems.map(sub => (
                      <Link 
                        key={sub.name} 
                        href={sub.path} 
                        className={`block text-xs py-2 transition-colors ${
                          pathname === sub.path ? 'text-white font-bold' : 'text-slate-500 hover:text-white'
                        }`}
                      >
                        • {sub.name}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button 
            onClick={handleLogout}
            className="flex items-center gap-4 p-3 text-rose-400 hover:bg-rose-500/10 w-full rounded-xl transition-colors font-bold text-sm"
          >
            <LogOut size={18} />
            {(!isCollapsed || isMobileMenuOpen) && <span>Déconnexion</span>}
          </button>
        </div>
      </aside>

      {/* ZONE DE CONTENU PRINCIPALE */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-8 shrink-0">
          <div className="flex items-center gap-4">
            
            {/* 🎯 NOUVEAU : Bouton Hamburger pour mobile */}
            <button 
              className="md:hidden p-2 bg-slate-100 rounded-xl text-slate-600 hover:bg-sky-100 hover:text-sky-600 transition-colors"
              onClick={() => { setIsMobileMenuOpen(true); setIsCollapsed(false); }}
            >
              <Menu size={20} />
            </button>

            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hidden sm:block">Poste de pilotage</span>
              <span className="text-sm font-bold text-slate-700 capitalize">
                {pathname.split('/').pop()?.replace('-', ' ')}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-black text-slate-900 capitalize">
                {userName}
              </p>
              <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest text-right">En ligne</p>
            </div>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm text-white ${userRole === 'admin' ? 'bg-slate-900' : 'bg-sky-600'}`}>
              {userName ? userName.charAt(0).toUpperCase() : 'U'}
            </div>
          </div>
        </header>

        {/* 🎯 NOUVEAU : PADDING RÉDUIT SUR MOBILE (p-2 au lieu de p-8) */}
        <main className="flex-1 overflow-y-auto p-2 md:p-8 lg:p-12 bg-slate-50">
          <div className="max-w-6xl mx-auto">
            <ErrorBoundary variant="admin" zone="admin/page">
              {children}
            </ErrorBoundary>
          </div>
        </main>
      </div>
    </div>
    </ToastProvider>
  );
}