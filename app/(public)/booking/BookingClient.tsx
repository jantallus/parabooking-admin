"use client";
import React, { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import type { FlightType, GiftCard, Partner, PublicSlot } from '@/lib/types';
import { useBookingData } from '@/hooks/useBookingData';
import { useAvailabilities } from '@/hooks/useAvailabilities';

// Passager avec les champs étendus propres au tunnel de réservation
interface BookingPassenger {
  id: string;
  flightKey: string;
  flightId: string;
  flightName: string;
  date: string;
  time: string;
  firstName: string;
  weightChecked: boolean;
  selectedComplements: number[];
  weight_min: number;
  weight_max: number;
}
import { useToast } from '@/components/ui/ToastProvider';
import { contactSchema } from '@/lib/schemas';
import { getLocalYYYYMMDD, getDayName, calculateGridStart, getMarketingInfo } from '@/lib/booking-utils';
import { getSeasonMessage } from '@/lib/season-schedule';
import { useScrollLock } from '@/hooks/useScrollLock';
import { calculateBookingPrice } from '@/lib/price-utils';
import { Gift, Camera, Zap, Clock, Weight, FileText, Mountain, Wind, Sun, Snowflake, CalendarDays, ChevronLeft, ChevronRight, ChevronDown, ShoppingCart, X, Plus, Trash2, AlertCircle } from 'lucide-react';
import { SkiIcon, SnowboardIcon, PedestrianIcon, ChildrenIcon, GoproIcon } from '@/components/icons/ActivityIcons';

function cloudinaryOptimize(url: string, w = 600, h = 300): string {
  if (!url.includes('res.cloudinary.com')) return url;
  return url.replace('/image/upload/', `/image/upload/w_${w},h_${h},c_fill,f_auto,q_auto/`);
}


export default function ReserverPage({ volOverride, seasonOverride }: { volOverride?: string; seasonOverride?: 'Standard' | 'Hiver' } = {}) {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const volParam = volOverride ?? searchParams.get('vol');
  const isDirect = !!volParam;

  const headerScrollRef = useRef<HTMLDivElement>(null);
  const bodyScrollRef = useRef<HTMLDivElement>(null);
  const hasAnimatedIntro = useRef(false);
  const bookingRootRef = useRef<HTMLDivElement>(null);
  const datesBarRef = useRef<HTMLDivElement>(null);
  const datesBarNaturalTopRef = useRef<number | null>(null);
  const cartBarRef = useRef<HTMLDivElement>(null);
  const [isEmbed, setIsEmbed] = useState(false);
  useEffect(() => {
    try { setIsEmbed(window.self !== window.top); } catch { setIsEmbed(true); }
  }, []);

  // Auto-resize : envoie la hauteur réelle au parent WordPress
  useEffect(() => {
    if (!isEmbed) return;
    const ro = new ResizeObserver(() => {
      window.parent.postMessage({ type: 'fluide-resize', height: document.documentElement.scrollHeight }, '*');
    });
    ro.observe(document.body);
    return () => ro.disconnect();
  }, [isEmbed]);

  // Dernier scroll reçu — partagé entre le handler et le useEffect panier
  const lastScrollData = useRef<{ scrollY: number; iframeTop: number; headerHeight: number; viewportHeight: number } | null>(null);

  // Fake sticky dates + panier flottant : repositionnement JS via scroll WordPress
  useEffect(() => {
    if (!isEmbed) return;
    let rafId: number | null = null;

    const applyPositions = () => {
      rafId = null;
      const data = lastScrollData.current;
      if (!data) return;
      const { scrollY, iframeTop, headerHeight, viewportHeight } = data;

      // Dates bar : fake sticky via transform (composited — pas de reflow)
      if (datesBarRef.current) {
        if (datesBarNaturalTopRef.current === null) {
          let top = 0;
          let el: HTMLElement | null = datesBarRef.current;
          while (el) { top += el.offsetTop; el = el.offsetParent as HTMLElement | null; }
          datesBarNaturalTopRef.current = top;
        }
        const targetPos = scrollY - iframeTop + headerHeight;
        const offset = targetPos - datesBarNaturalTopRef.current;
        datesBarRef.current.style.transform = offset > 0
          ? `translate3d(0,${offset}px,0)`
          : '';
      }

      // Panier flottant : translate3d depuis top:0 (composited — pas de reflow)
      if (cartBarRef.current) {
        const visibleBottom = scrollY + viewportHeight - iframeTop;
        const cartHeight = cartBarRef.current.offsetHeight;
        const maxY = document.documentElement.scrollHeight - cartHeight;
        const y = Math.min(Math.max(0, visibleBottom - cartHeight), maxY);
        cartBarRef.current.style.transform = `translate3d(0,${y}px,0)`;
      }
    };

    const handler = (e: MessageEvent) => {
      if (e.data?.type !== 'fluide-scroll') return;
      lastScrollData.current = e.data;
      if (rafId === null) rafId = requestAnimationFrame(applyPositions);
    };

    window.addEventListener('message', handler);
    return () => {
      window.removeEventListener('message', handler);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [isEmbed]);

  const [selectedFlight, setSelectedFlight] = useState<FlightType | null>(null);
  const [step, setStep] = useState<number>(isDirect ? 2 : 1);
  const [infoFlight, setInfoFlight] = useState<FlightType | null>(null);
  const scrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSwipingRef = useRef(false);
  const [isGridExpanded, setIsGridExpanded] = useState(false); // 🚀 LE TURBO : Mémoire d'expansion
  const skipInitialScroll = useRef(isDirect); // sur les pages /vols, pas de scroll auto à l'ouverture

  // 🎯 CORRECTION : On réinitialise les mémoires et on gère la hauteur de page (Sans remonter en haut !)
  useEffect(() => {
    if (step !== 2) {
      hasAnimatedIntro.current = false;
      setIsGridExpanded(false);
      datesBarNaturalTopRef.current = null; // recalculer quand la barre réapparaît
    }

    // 🎯 On glisse PILE sur la zone de l'étape correspondante
    if (step === 2) {
      if (skipInitialScroll.current) { skipInitialScroll.current = false; return; }
      setTimeout(() => {
        const isMobile = window.innerWidth < 768;
        // Sur mobile : scroll instantané vers le titre du vol (juste sous la navbar)
        // Sur desktop : smooth scroll vers le container
        const el = isMobile
          ? (document.getElementById('etape-2-vol-titre') ?? document.getElementById('etape-2-container'))
          : document.getElementById('etape-2-container');
        if (!el) return;
        if (isEmbed) {
          window.parent.postMessage({ type: 'fluide-scroll-to', offsetY: el.offsetTop - 80 }, '*');
        } else {
          const behavior = isMobile ? 'instant' : 'smooth';
          window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 80, behavior });
        }
      }, 50);
    } else if (step === 3) {
      setTimeout(() => {
        const el = document.getElementById('etape-3-container');
        if (!el) return;
        if (isEmbed) {
          window.parent.postMessage({ type: 'fluide-scroll-to', offsetY: el.offsetTop }, '*');
        } else {
          window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 100, behavior: 'smooth' });
        }
      }, 50);
    }
  }, [step, isEmbed]);

  useScrollLock(!!infoFlight);

  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);

  // Réinitialise isCheckingOut si l'utilisateur revient en arrière depuis Stripe (bfcache)
  useEffect(() => {
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) setIsCheckingOut(false);
    };
    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  }, []);

  // Restaure le panier si l'utilisateur revient depuis Stripe via le bouton "Retour"
  useEffect(() => {
    const saved = sessionStorage.getItem('booking_restore');
    if (!saved) return;
    try {
      const state = JSON.parse(saved);
      if (state.cart) setCart(state.cart);
      if (state.contact) setContact(state.contact);
      if (state.passengers) setPassengers(state.passengers);
      setStep(3);
    } catch (e) {}
    sessionStorage.removeItem('booking_restore');
  }, []);
  const [showCalendar, setShowCalendar] = useState(false);
  const [calAvailDates, setCalAvailDates] = useState<Set<string>>(new Set());
  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date();
    if (d.getHours() >= 12) d.setDate(d.getDate() + 1);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const calendarRef = useRef<HTMLDivElement>(null);
  const [showFlightSelect, setShowFlightSelect] = useState(false);
  const flightSelectRef = useRef<HTMLDivElement>(null);

  // pickedDate et gridStartDate déclarés avant les hooks pour que le callback onReady puisse les setter
  const [pickedDate, setPickedDate] = useState<string>(() => {
    const defaultDate = new Date();
    if (defaultDate.getHours() >= 12) defaultDate.setDate(defaultDate.getDate() + 1);
    return getLocalYYYYMMDD(defaultDate);
  });
  const [gridStartDate, setGridStartDate] = useState<string>(() => {
    const d = new Date();
    if (d.getHours() >= 12) d.setDate(d.getDate() + 1);
    return getLocalYYYYMMDD(d);
  });

  // Données de base : vols, compléments, templates, saison, displayDaysCount
  const { flights, giftTemplates, complementsList, displayDaysCount, isLoading, activeSeason, setActiveSeason } = useBookingData(
    (dateStr, count) => {
      setPickedDate(dateStr);
      setGridStartDate(calculateGridStart(dateStr, count));
    }
  );

  // Disponibilités : se recharge automatiquement quand gridStartDate ou selectedFlight change
  const { rawSlots, isSearchingTimes } = useAvailabilities(gridStartDate, selectedFlight, displayDaysCount);

  // Mode direct : sélectionne le vol correspondant à ?vol= dès que l'API répond
  useEffect(() => {
    if (!volParam || flights.length === 0) return;
    const regex = new RegExp('\\b' + volParam + '\\b', 'i');
    const pool = seasonOverride
      ? flights.filter(f => {
          const s = String(f.season || 'ALL').toUpperCase().trim();
          if (seasonOverride === 'Hiver') return s === 'WINTER' || s === 'HIVER';
          return s === 'STANDARD' || s === 'ALL' || s === 'ETE' || s === 'ÉTÉ' || s === 'SUMMER';
        })
      : flights;
    const match = pool.find(f => regex.test(f.name)) ?? flights.find(f => regex.test(f.name));
    if (!match) return;
    const s = String(match.season || 'ALL').toUpperCase().trim();
    if (s === 'WINTER' || s === 'HIVER') setActiveSeason('Hiver');
    else setActiveSeason('Standard');
    setSelectedFlight(match);
    setStep(2);
  }, [flights]);

  const [cart, setCart] = useState<Record<string, number>>({});
  
  const [voucherInput, setVoucherInput] = useState('');
  const [appliedVoucher, setAppliedVoucher] = useState<GiftCard | null>(null);
  const [appliedPartner, setAppliedPartner] = useState<Partner | null>(null);
  const [voucherError, setVoucherError] = useState('');
  const [isApplyingVoucher, setIsApplyingVoucher] = useState(false);
  const [contact, setContact] = useState({ firstName: '', lastName: '', phone: '', email: '', isPassenger: false, notes: '' });
  const [contactErrors, setContactErrors] = useState<Record<string, string>>({});
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  const [passengers, setPassengers] = useState<BookingPassenger[]>([]);
  
  // 🎯 RÉFÉRENCES SÉCURISÉES POUR ÉVITER L'EFFET DOMINO (Double-clic)
  const selectedFlightRef = useRef(selectedFlight);
  useEffect(() => { selectedFlightRef.current = selectedFlight; }, [selectedFlight]);

  const cartRef = useRef(cart);
  useEffect(() => { cartRef.current = cart; }, [cart]);

  // 🎯 GESTION SÉCURISÉE DU BOUTON RETOUR
  useEffect(() => {
    const handlePopState = () => {
      const hash = window.location.hash;
      const isDirectMode = new URLSearchParams(window.location.search).has('vol');

      // En mode direct on ne revient jamais au step 1 (catalogue)
      if (isDirectMode) {
        const itemsInCart = Object.values(cartRef.current).reduce((sum: number, qty: number) => sum + qty, 0);
        if (hash === '#etape-3' && itemsInCart > 0) setStep(3);
        else setStep(2);
        return;
      }

      // On lit les références "secrètes" pour ne pas déclencher de rechargement en boucle
      const itemsInCart = Object.values(cartRef.current).reduce((sum: number, qty: number) => sum + qty, 0);
      const needsReset = (hash === '#etape-2' && !selectedFlightRef.current) || (hash === '#etape-3' && itemsInCart === 0);

      if (needsReset) {
        setStep(1);
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      } else {
        if (hash === '#etape-3') setStep(3);
        else if (hash === '#etape-2') setStep(2);
        else setStep(1);
      }
    };

    window.addEventListener('popstate', handlePopState);
    handlePopState(); 
    
    return () => window.removeEventListener('popstate', handlePopState);
  }, []); // 🛑 AUCUNE DÉPENDANCE ICI : C'est le secret pour éviter le double clic !

  // 2. On met à jour l'URL (sans recharger) quand on change d'étape via vos boutons
  useEffect(() => {
    const expectedHash = step === 1 ? '' : `#etape-${step}`;
    const currentHash = window.location.hash;
    
    if (currentHash !== expectedHash) {
      const newUrl = step === 1 
        ? window.location.pathname + window.location.search 
        : window.location.pathname + window.location.search + expectedHash;
        
      window.history.pushState({ step }, '', newUrl);
    }
  }, [step]);
  

  useEffect(() => {
    if (step === 3) {
      const newPassengers: BookingPassenger[] = [];
      
      // 🎯 1. RECHERCHE ROBUSTE : On cherche l'option peu importe son nom (photo, vidéo, gopro...)
      const photoOption = complementsList.find(c => 
        c.name.toLowerCase().includes('photo') || 
        c.name.toLowerCase().includes('vidéo') || 
        c.name.toLowerCase().includes('video') || 
        c.name.toLowerCase().includes('gopro')
      );

      Object.entries(cart).forEach(([key, qty]) => {
        const [fId, dStr, tStr] = key.split('|');
        const flight = flights.find(f => f.id.toString() === fId);
        
        for (let i = 0; i < qty; i++) {
          newPassengers.push({
            id: `${key}-${i}`,
            flightKey: key, 
            flightId: fId,
            flightName: flight?.name || 'Vol',
            date: dStr,
            time: tStr,
            firstName: '',
            weightChecked: false,
            selectedComplements: [], 
            weight_min: flight?.weight_min ?? 20,
            weight_max: flight?.weight_max ?? 110,
          });
        }
      });
      
      setPassengers(prev => newPassengers.map((nP) => {
        const existing = prev.find(p => p.id === nP.id);
        const flight = flights.find(f => f.id.toString() === nP.flightId);
        
        // On récupère ce qui est déjà coché par l'utilisateur
        let currentComplements = existing ? [...(existing.selectedComplements || [])] : [];
        
        // 🎯 2. LA SOURCE UNIQUE DE VÉRITÉ : C'est ici que la magie opère !
        if (appliedVoucher && appliedVoucher.type === 'gift_card' && photoOption && flight) {
           // On vérifie que le bon est soit générique, soit lié à ce vol précis
           const isSameFlight = !appliedVoucher.flight_type_id || appliedVoucher.flight_type_id.toString() === nP.flightId;

           if (isSameFlight) {
             const vVal = Number(appliedVoucher.price_paid_cents) / 100;
             const fPri = flight.price_cents / 100;
             const pPri = photoOption.price_cents / 100;

             // Si la valeur du bon couvre [Vol + Photo] et que la photo n'est pas encore cochée
             if (vVal >= (fPri + pPri) && !currentComplements.includes(photoOption.id)) {
               currentComplements.push(photoOption.id);
             }
           }
        }

        // GoPro incluse dans le vol : auto-sélection
        if (flight?.activity_gopro && photoOption && !currentComplements.includes(photoOption.id)) {
          currentComplements.push(photoOption.id);
        }

        return { 
          ...nP, 
          firstName: existing?.firstName || '', 
          weightChecked: existing?.weightChecked || false, 
          selectedComplements: currentComplements
        };
      }));
    }
  }, [step, cart, flights, appliedVoucher, complementsList]);

  useEffect(() => {
    if (contact.isPassenger && passengers.length > 0 && contact.firstName) {
      setPassengers(prev => {
        const newP = [...prev];
        if (!newP[0].firstName) newP[0].firstName = contact.firstName;
        return newP;
      });
    }
  }, [contact.isPassenger, contact.firstName]);

  // 🎯 L'ANIMATION CINÉMATIQUE (100% Horizontale, Ultra-Rapide, Sans Voile)
  useEffect(() => {
    // 🛑 SÉCURITÉ ABSOLUE : On refuse de jouer l'animation si on n'est pas sur l'étape 2
    if (step !== 2) return;

    if (!isSearchingTimes && rawSlots.length > 0 && bodyScrollRef.current) {
      
      // 🛑 SÉCURITÉ SWIPE : Si le client a glissé au doigt, on ne force pas le recentrage horizontal !
      if (isSwipingRef.current) {
        isSwipingRef.current = false; // On désarme le verrou
        setIsGridExpanded(true);
        // Scroll vertical retour au premier créneau visible (sous navbar + barre sticky des jours)
        setTimeout(() => {
          const el = bodyScrollRef.current;
          if (!el) return;
          const stickyBarHeight = 80 + (datesBarRef.current?.offsetHeight ?? 60);
          if (isEmbed) {
            window.parent.postMessage({ type: 'fluide-scroll-to', offsetY: el.offsetTop - stickyBarHeight }, '*');
          } else {
            window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - stickyBarHeight, behavior: 'smooth' });
          }
        }, 100);
        return;
      }

      const container = bodyScrollRef.current;
      const headerContainer = headerScrollRef.current;

      // 🛠️ Fonction de centrage 100% horizontale (AUCUN saut vertical !)
      const centerHorizontally = (el: HTMLElement, behavior: 'auto' | 'smooth') => {
        const pos = el.offsetLeft - (container.clientWidth / 2) + (el.clientWidth / 2);
        container.scrollTo({ left: pos, behavior });
        if (headerContainer && behavior === 'auto') headerContainer.scrollLeft = pos;
      };

      // 🪄 On enlève le "voile blanc" (opacity-0) du body instantanément
      container.classList.remove('opacity-0');
      // Le header sera révélé après l'animation pour éviter le conflit de compositing

      if (window.innerWidth >= 768) {
        if (headerContainer) headerContainer.classList.remove('opacity-0');
        setTimeout(() => {
          const targetEl = document.getElementById(`mobile-col-${pickedDate}`);
          if (targetEl) centerHorizontally(targetEl, 'auto');
          setIsGridExpanded(true);
        }, 10); // Instantané sur PC
        return;
      }

      if (!hasAnimatedIntro.current) {
        hasAnimatedIntro.current = true;

        const startAnimDate = new Date(pickedDate);
        startAnimDate.setDate(startAnimDate.getDate() - 1);
        const startAnimDateStr = getLocalYYYYMMDD(startAnimDate);

        const animDelay = isEmbed ? 400 : 80;
        setTimeout(() => {
          const startEl = document.getElementById(`mobile-col-${startAnimDateStr}`);
          const targetEl = document.getElementById(`mobile-col-${pickedDate}`);

          if (startEl && targetEl) {
            container.style.scrollSnapType = 'none';
            centerHorizontally(startEl, 'auto');

            requestAnimationFrame(() => {
              setTimeout(() => {
                centerHorizontally(targetEl, 'smooth');

                setTimeout(() => {
                  container.style.scrollSnapType = '';
                  // Sync header à la position finale puis le révéler
                  if (headerContainer) {
                    headerContainer.scrollLeft = container.scrollLeft;
                    headerContainer.classList.remove('opacity-0');
                  }
                  setIsGridExpanded(true);
                }, 300);
              }, 50);
            });
          } else if (targetEl) {
             centerHorizontally(targetEl, 'auto');
             if (headerContainer) headerContainer.classList.remove('opacity-0');
             setIsGridExpanded(true);
          }
        }, animDelay);

      } else {
        // 🧭 NAVIGATION CLASSIQUE (Flèches ou calendrier)
        if (headerContainer) headerContainer.classList.remove('opacity-0');
        setTimeout(() => {
          const targetEl = document.getElementById(`mobile-col-${pickedDate}`);
          if (targetEl) centerHorizontally(targetEl, 'smooth');
          setTimeout(() => { setIsGridExpanded(true); }, 100);
        }, 20);
      }
    }
  }, [pickedDate, isSearchingTimes, rawSlots.length, step]); // 🎯 NOUVEAU : On a ajouté "step" ici pour forcer le réveil !

  // Le calendrier est maintenant une modale fixed — fermeture gérée par le backdrop

  useEffect(() => {
    if (!showFlightSelect) return;
    const handler = (e: MouseEvent) => {
      if (flightSelectRef.current && !flightSelectRef.current.contains(e.target as Node)) {
        setShowFlightSelect(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showFlightSelect]);

  const gridData = useMemo(() => {
    if (!selectedFlight || rawSlots.length === 0) return {};

    const delayHours = selectedFlight.booking_delay_hours || 0;
    const now = new Date();
    const cutoffMs = now.getTime() + (delayHours * 60 * 60 * 1000);

    const flightDur = selectedFlight.duration_minutes || 0;
    const allowedSlots = Array.isArray(selectedFlight.allowed_time_slots) ? selectedFlight.allowed_time_slots : [];
    
    let baseDur = 15;
    const sample = rawSlots[0];
    if (sample) baseDur = Math.round((new Date(sample.end_time).getTime() - new Date(sample.start_time).getTime()) / 60000) || 15;
    
    const isMulti = selectedFlight.allow_multi_slots === true;
    const slotsNeeded = (isMulti && flightDur > baseDur) ? Math.ceil(flightDur / baseDur) : 1;

    // GridSlot étend PublicSlot avec 'booked_by_cart' — valeur interne utilisée
    // pour marquer les créneaux réservés dans le panier sans toucher au backend.
    type GridSlot = Omit<PublicSlot, 'status'> & { status: 'available' | 'booked' | 'booked_by_cart' | 'unavailable' };
    const monSchedules: Record<string, Record<number, GridSlot>> = {};
    const timeToMs: Record<string, number> = {};
    const uniqueTimesByDate: Record<string, Set<string>> = {};

    rawSlots.forEach(s => {
      const dObj = new Date(s.start_time);
      const ms = dObj.getTime(); 
      
      if (!monSchedules[s.monitor_id]) monSchedules[s.monitor_id] = {};
      monSchedules[s.monitor_id][ms] = { ...s }; 

      const dStr = dObj.toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' });
      const tStr = dObj.toLocaleTimeString('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', hour12: false }); 
      
      if (!uniqueTimesByDate[dStr]) uniqueTimesByDate[dStr] = new Set();
      uniqueTimesByDate[dStr].add(tStr);

      timeToMs[`${dStr}|${tStr}`] = ms; 
    });

    Object.entries(cart).forEach(([key, qty]) => {
      if (qty === 0) return;
      const [fId, dStr, tStr] = key.split('|');
      const flightInCart = flights.find(f => f.id.toString() === fId);
      if (!flightInCart) return;

      const fDurCart = flightInCart.duration_minutes || 0;
      const isMultiCart = flightInCart.allow_multi_slots === true;
      const sNeededCart = (isMultiCart && fDurCart > baseDur) ? Math.ceil(fDurCart / baseDur) : 1;
      
      const targetMs = timeToMs[`${dStr}|${tStr}`];
      if (!targetMs) return;

      let consumed = 0;
      for (const monId of Object.keys(monSchedules)) {
        if (consumed >= qty) break;
        let canBook = true;
        for (let i = 0; i < sNeededCart; i++) {
          const ms = targetMs + (i * baseDur * 60000);
          const slot = monSchedules[monId][ms];
          if (!slot || slot.status !== 'available') { canBook = false; break; }
        }
        if (canBook) {
          for (let i = 0; i < sNeededCart; i++) {
            const ms = targetMs + (i * baseDur * 60000);
            monSchedules[monId][ms].status = 'booked_by_cart';
          }
          consumed++;
        }
      }
    });

    const grid: Record<string, Record<string, number>> = {};
    
    // 🎯 2. LE MOTEUR CONSTRUIT 71 JOURS (-10 à +60)
    const weekDays = Array.from({ length: 71 }).map((_, i) => {
      const d = new Date(gridStartDate);
      d.setDate(d.getDate() - 10 + i);
      return getLocalYYYYMMDD(d);
    });
    weekDays.forEach(d => grid[d] = {});

    weekDays.forEach(dateStr => {
      if (!uniqueTimesByDate[dateStr]) return;
      Array.from(uniqueTimesByDate[dateStr]).forEach(timeStr => {
        if (allowedSlots.length > 0 && !allowedSlots.includes(timeStr)) return;
        
        const targetMs = timeToMs[`${dateStr}|${timeStr}`];
        if (!targetMs) return;

        if (targetMs <= cutoffMs) return;

        let capacity = 0;
        for (const monId of Object.keys(monSchedules)) {
          let isFree = true;
          for (let i = 0; i < slotsNeeded; i++) {
            const ms = targetMs + (i * baseDur * 60000);
            const slot = monSchedules[monId][ms];
            if (!slot || slot.status !== 'available') { isFree = false; break; }
          }
          if (isFree) capacity++;
        }
        grid[dateStr][timeStr] = capacity;
      });
    });

    return grid;
  }, [rawSlots, selectedFlight, cart, gridStartDate, flights, displayDaysCount]);

  // Dates qui ont des créneaux pilote planifiés mais tous complets (capacity=0)
  const fullDates = useMemo(() => {
    const today = getLocalYYYYMMDD(new Date());
    const datesWithSlots = new Set<string>();
    rawSlots.forEach(s => {
      const dStr = new Date(s.start_time).toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' });
      if (dStr >= today) datesWithSlots.add(dStr);
    });
    const out = new Set<string>();
    datesWithSlots.forEach(d => {
      if (Object.keys(gridData[d] || {}).length === 0) out.add(d);
    });
    return out;
  }, [rawSlots, gridData]);

  const [nextAvailableDate, setNextAvailableDate] = useState<string | null>(null);
  useEffect(() => {
    const today = getLocalYYYYMMDD(new Date());
    fetch(`/api/proxy/public/next-available?start=${today}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => setNextAvailableDate(data?.date ?? null))
      .catch(() => setNextAvailableDate(null));
  }, [selectedFlight?.id]);

  useEffect(() => {
    if (!showCalendar) return;
    const year = calMonth.getFullYear();
    const month = calMonth.getMonth();
    const start = getLocalYYYYMMDD(new Date(year, month, 1));
    const end = getLocalYYYYMMDD(new Date(year, month + 1, 0));
    fetch(`/api/proxy/public/available-dates?start=${start}&end=${end}`)
      .then(r => r.ok ? r.json() : [])
      .then((dates: string[]) => setCalAvailDates(new Set(dates)))
      .catch(() => setCalAvailDates(new Set()));
  }, [calMonth, showCalendar]);

  const pickDate = (dateStr: string) => {
    setPickedDate(dateStr);
    setGridStartDate(calculateGridStart(dateStr, displayDaysCount));
    setShowCalendar(false);
  };

  const formatPickedDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long' });
  };

  const shiftDays = (offset: number) => {
    const d = new Date(gridStartDate);
    d.setDate(d.getDate() + offset);
    setGridStartDate(getLocalYYYYMMDD(d));
    
    const p = new Date(pickedDate);
    p.setDate(p.getDate() + offset);
    setPickedDate(getLocalYYYYMMDD(p));
  };

  const handleAdd = (date: string, time: string) => {
    if (!selectedFlight) return;
    const key = `${selectedFlight.id}|${date}|${time}`;
    setCart(prev => ({ ...prev, [key]: (prev[key] || 0) + 1 }));
  };
  const handleRemove = (date: string, time: string) => {
    if (!selectedFlight) return;
    const key = `${selectedFlight.id}|${date}|${time}`;
    setCart(prev => {
      const newCart = { ...prev };
      if (newCart[key] > 1) newCart[key]--; else delete newCart[key];
      return newCart;
    });
  };

  const handleDecrementCart = (key: string) => {
    setCart(prev => {
      const newCart = { ...prev };
      if (newCart[key] > 1) newCart[key]--;
      else delete newCart[key];
      return newCart;
    });
  };

  const handleDeleteCartItem = (key: string) => {
    setCart(prev => {
      const newCart = { ...prev };
      delete newCart[key];
      return newCart;
    });
  };

  const handleIncrementCart = (key: string) => {
    const [, dateStr, timeStr] = key.split('|');
    const capacity = gridData[dateStr]?.[timeStr] ?? 0;
    if (capacity <= 0) return;
    setCart(prev => ({ ...prev, [key]: (prev[key] || 0) + 1 }));
  };

  const handleClearCart = () => {
    setCart({});
    setCartOpen(false);
  };


  let totalItems = 0;
  Object.values(cart).forEach(qty => { totalItems += qty; });

  // Hors-saison basée sur la date affichée dans la grille (pas la date réelle)
  const pickedMonth = new Date(pickedDate + 'T12:00:00').getMonth(); // 0 = janvier
  const isWinterOffSeason = pickedMonth >= 4 && pickedMonth <= 10;
  const isSummerOffSeason = pickedMonth <= 3 || pickedMonth >= 10;

  const rawPrices = calculateBookingPrice(cart, flights, passengers, complementsList, appliedVoucher);
  const { originalPrice } = rawPrices;
  const discountAmount = appliedPartner ? originalPrice : rawPrices.discountAmount;
  const finalPrice = appliedPartner ? 0 : rawPrices.finalPrice;

  useEffect(() => {
    if (totalItems === 0) setCartOpen(false);
    if (step === 3 && totalItems === 0) setStep(isDirect ? 2 : 1);
  }, [totalItems, step]);

  // Repositionne le panier avant le paint quand il apparaît (useLayoutEffect = avant le paint)
  useLayoutEffect(() => {
    if (!isEmbed || totalItems === 0 || !cartBarRef.current) return;
    if (!lastScrollData.current) {
      // Pas encore de données scroll : demande au parent WordPress
      window.parent.postMessage({ type: 'fluide-request-scroll' }, '*');
      return;
    }
    const { scrollY, iframeTop, viewportHeight } = lastScrollData.current;
    const cartHeight = cartBarRef.current.offsetHeight;
    const maxY = document.documentElement.scrollHeight - cartHeight;
    const y = Math.min(Math.max(0, scrollY + viewportHeight - iframeTop - cartHeight), maxY);
    cartBarRef.current.style.transform = `translate3d(0,${y}px,0)`;
  }, [isEmbed, totalItems]);

  // 🎯 3. LA VARIABLE POUR DESSINER L'ÉCRAN (71 JOURS)
  const weekDays = Array.from({ length: 71 }).map((_, i) => {
    const d = new Date(gridStartDate);
    d.setDate(d.getDate() - 10 + i);
    return getLocalYYYYMMDD(d);
  });

  const filteredFlights = flights.filter(f => {
    const flightSeason = String(f.season || 'ALL').toUpperCase().trim(); 
    const isLegacy = flightSeason === 'STANDARD' || flightSeason === 'ALL';

    if (activeSeason === 'Hiver') {
      return flightSeason === 'WINTER' || flightSeason === 'HIVER' || isLegacy;
    } else {
      return flightSeason === 'SUMMER' || flightSeason === 'ETE' || flightSeason === 'ÉTÉ' || isLegacy;
    }
  });

  const pf = appliedPartner?.booking_fields;
  const needsName   = !pf || pf.name   !== false;
  const needsPhone  = !pf || pf.phone  !== false;
  const needsEmail  = !pf || pf.email  !== false;
  const needsWeight = !pf || pf.weight !== false;

  const isFormValid =
    (!needsName  || (contact.firstName && contact.lastName)) &&
    (!needsPhone || contact.phone) &&
    (!needsEmail || contact.email) &&
    passengers.length > 0 &&
    passengers.every(p => (!needsName || p.firstName) && (!needsWeight || p.weightChecked));

  const missingFields: string[] = step === 3 ? [
    needsName  && !contact.firstName ? 'Prénom du contact' : null,
    needsName  && !contact.lastName  ? 'Nom du contact'    : null,
    needsPhone && !contact.phone     ? 'Téléphone'         : null,
    needsEmail && !contact.email     ? 'Email'             : null,
    ...passengers.flatMap((p, i) => [
      needsName   && !p.firstName    ? `Prénom passager ${i + 1}` : null,
      needsWeight && !p.weightChecked ? `Confirmation de poids passager ${i + 1}` : null,
    ]),
  ].filter((v): v is string => !!v) : [];

  const handleApplyVoucher = async () => {
    if (!voucherInput.trim()) return;
    setIsApplyingVoucher(true);
    setVoucherError('');
    try {
      // Try partner code first
      const partnerRes = await fetch(`/api/proxy/public/partners/check/${voucherInput.trim()}`);
      if (partnerRes.ok) {
        const partnerData = await partnerRes.json();
        setAppliedPartner(partnerData);
        setAppliedVoucher(null);
        setVoucherInput('');
        return;
      }

      // Fall through to gift card / promo code
      const res = await fetch(`/api/proxy/gift-cards/check/${voucherInput.trim()}`);

      if (!res.ok) {
        const errData = await res.json();
        setVoucherError(errData.message || "Code invalide ou expiré");
        setAppliedVoucher(null);
      } else {
        const data = await res.json();
        if (data.flight_type_id) {
          const hasRequiredFlight = Object.keys(cart).some(key => key.startsWith(`${data.flight_type_id}|`));
          if (!hasRequiredFlight) {
            setVoucherError(`Ce code n'est valable que pour la prestation : ${data.flight_name}`);
            setAppliedVoucher(null);
            setIsApplyingVoucher(false);
            return;
          }
        }

        setAppliedPartner(null);
        setAppliedVoucher(data);
        setVoucherInput('');
      }
    } catch (err) {
      setVoucherError("Erreur de connexion.");
    } finally {
      setIsApplyingVoucher(false);
    }
  };

  const validateField = (field: string, value: string) => {
    const result = contactSchema.safeParse({ ...contact, [field]: value });
    if (!result.success) {
      const issue = result.error.issues.find(i => i.path[0] === field);
      setContactErrors(prev => ({ ...prev, [field]: issue?.message ?? '' }));
    } else {
      setContactErrors(prev => { const next = { ...prev }; delete next[field]; return next; });
    }
  };

  const handleSubmit = async () => {
    setHasAttemptedSubmit(true);
    if (!isFormValid || isCheckingOut) return;

    // When a partner is active, only validate the required fields
    if (appliedPartner) {
      setContactErrors({});
    } else {
      const result = contactSchema.safeParse(contact);
      if (!result.success) {
        const fieldErrors: Record<string, string> = {};
        result.error.issues.forEach(issue => {
          const field = issue.path[0] as string;
          if (!fieldErrors[field]) fieldErrors[field] = issue.message;
        });
        setContactErrors(fieldErrors);
        return;
      }
      setContactErrors({});
    }
    setIsCheckingOut(true);

    // Build the contact to submit — replace empty partner fields with safe placeholders
    const partnerLabel = appliedPartner ? `Client ${appliedPartner.name}` : '';
    const submitContact = {
      ...contact,
      firstName: needsName ? contact.firstName : partnerLabel,
      lastName:  needsName ? contact.lastName  : '',
      phone:     needsPhone ? contact.phone    : '',
      email:     needsEmail ? contact.email    : 'partenaire@noreply.com',
    };

    try {
      // Formatage intelligent des prénoms pour les groupes
      const passengersToSubmit = passengers.map((p, index) => {
        let finalName = needsName ? p.firstName.trim() : partnerLabel;

        if (needsName && passengers.length > 1) {
          const isContact = contact.isPassenger && (index === 0 || finalName.toLowerCase() === contact.firstName.trim().toLowerCase());
          if (!isContact) finalName = `${finalName} (${contact.firstName.trim()})`;
        }

        // Filtrer les compléments offerts par l'activité (ex: photos incluses dans le vol loupiot)
        const passengerFlight = flights.find(f => f.id.toString() === p.flightId);
        const filteredComplements = (p.selectedComplements || []).filter(compId => {
          const comp = complementsList.find(c => c.id === compId);
          if (!comp) return true;
          const isLockedByActivity = !!(passengerFlight?.activity_gopro && (
            comp.name.toLowerCase().includes('photo') ||
            comp.name.toLowerCase().includes('vidéo') ||
            comp.name.toLowerCase().includes('video') ||
            comp.name.toLowerCase().includes('gopro')
          ));
          return !isLockedByActivity;
        });

        return { ...p, firstName: finalName, selectedComplements: filteredComplements };
      });

      const res = await fetch(`/api/proxy/public/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact: submitContact,
          passengers: passengersToSubmit,
          voucher_code: appliedVoucher ? appliedVoucher.code : null,
          partner_code: appliedPartner ? appliedPartner.code : null,
        })
      });

      const data = await res.json();

      if (data.url) {
        sessionStorage.setItem('booking_restore', JSON.stringify({ cart, contact, passengers }));
        window.location.href = data.url;
      } else if (res.status === 409) {
        // Créneau plus disponible — retour à la sélection
        toast.error(data.error || "Ce créneau n'est plus disponible. Veuillez en choisir un autre.");
        setIsCheckingOut(false);
        setCart({});
        setPassengers([]);
        setStep(2);
      } else {
        toast.error(data.error || "Une erreur est survenue. Veuillez réessayer ou nous contacter par téléphone.");
        setIsCheckingOut(false);
      }
    } catch (err) {
      console.error(err);
      toast.error("Erreur de connexion au serveur de paiement. Veuillez réessayer.");
      setIsCheckingOut(false);
    }
  };

  return (
    <div ref={bookingRootRef} className={`relative ${!isEmbed && !isDirect ? 'min-h-screen ' : ''}${isDirect && isEmbed ? 'overflow-clip direct-mode-reveal' : ''}`} style={{ backgroundColor: '#FFFFFF', color: '#1D1D1B' }}>
      
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes ultraSmoothReveal { 0% { opacity: 0; transform: translateY(40px); } 100% { opacity: 1; transform: translateY(0); } }
        @keyframes pageReveal { 0% { opacity: 0; } 100% { opacity: 1; } }
        .flight-img-wrap { background-color: #f1f5f9; transform: translateZ(0); }
        .flight-img-wrap img { display: block; width: 100%; height: 100%; object-fit: cover; }
        .hero-animation-block { animation: ultraSmoothReveal 0.5s ease forwards; }
        .direct-mode-reveal { animation: pageReveal 0.25s ease 0.15s both; }
        .hero-booking { background: transparent !important; margin-top: -90px; }
        .btn-reserver { background-color: #E6007E !important; color: white !important; border: none; transition: background-color 0.3s ease !important; border-radius: 5px; font-size: 1.125rem; font-weight: 700; padding: 12px 17px; }
        .btn-reserver:hover { background-color: #312783 !important; }
@media (max-width: 1024px) { .hero-booking { min-height: 532px !important; margin-top: -80px; padding-left: 0 !important; padding-top: 0 !important; justify-content: center; align-items: center !important; } .hero-animation-block { text-align: center; padding: 0 6vw; } .hero-animation-block h1 { font-size: 3.2rem !important; line-height: 1.1 !important; } .hero-booking-bg { background-size: 105% !important; background-position: center 10% !important; } .hero-booking-bg.hero-booking-bg-ete { background-size: 120% !important; background-position: center 48% !important; } .hero-grad-1 { background: linear-gradient(22deg, rgba(47,82,160,0.90) 5%, rgba(47,82,160,0.65) 28%, rgba(47,82,160,0.45) 47%, rgba(47,82,160,0.28) 62%, rgba(47,82,160,0.15) 75%, rgba(47,82,160,0.06) 88%, rgba(47,82,160,0) 100%) !important; } .hero-grad-1-ete { background: linear-gradient(to bottom, rgba(47,82,160,0.60) 0%, rgba(47,82,160,0.25) 50%, rgba(47,82,160,0.0) 80%) !important; } .hero-grad-2 { background: linear-gradient(to right, rgba(79,69,161,1) 0%, rgba(79,69,161,0.7) 20%, rgba(79,69,161,0) 50%) !important; height: 100% !important; } .hero-grad-2.hero-grad-2-ete { background: linear-gradient(180deg, rgba(79,69,161,0.85) 0%, rgba(79,69,161,0) 55%) !important; height: 100% !important; } }
@media (max-width: 768px) { .hero-booking-bg { background-size: 170% !important; background-position: center 5% !important; } .hero-booking-bg.hero-booking-bg-ete { background-size: 190% !important; background-position: center 38% !important; } }
      `}} />

      {!isDirect && <section className="hero-booking" style={{
          position: 'relative', width: '100%', minHeight: '520px',
          display: 'flex', alignItems: 'flex-start', paddingLeft: 'calc(6vw - 4px)', paddingTop: '154px',
          backgroundColor: '#2F52A0',
          overflow: 'hidden',
        }}>
        {/* Couche 1 : photo */}
        <div className={activeSeason === 'Hiver' ? 'hero-booking-bg' : 'hero-booking-bg hero-booking-bg-ete'} style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          backgroundImage: activeSeason === 'Hiver' ? 'url(/hiver-hero.webp)' : 'url(/hero1ete.webp)',
          backgroundSize: activeSeason === 'Hiver' ? '88%' : '100%',
          backgroundPosition: activeSeason === 'Hiver' ? 'right 12%' : 'center 55%',
          backgroundRepeat: 'no-repeat', zIndex: 1,
        }} />
        {/* Couche 2 : dégradé */}
        <div className={activeSeason === 'Hiver' ? 'hero-grad-1' : 'hero-grad-1-ete'} style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: activeSeason === 'Hiver'
            ? 'linear-gradient(to right, rgba(47,82,160,1) 0%, rgba(47,82,160,1) 18%, rgba(47,82,160,0) 30%), linear-gradient(45deg, rgba(47,82,160,1) 15%, rgba(47,82,160,0.55) 50%, rgba(47,82,160,0.20) 65%, rgba(47,82,160,0) 80%)'
            : 'linear-gradient(to bottom, rgba(47,82,160,0.18) 0%, rgba(47,82,160,0.05) 50%, rgba(47,82,160,0.0) 70%)',
          zIndex: 2,
        }} />
        {/* Couche 3 : fond violet en haut */}
        <div className={activeSeason === 'Hiver' ? 'hero-grad-2' : 'hero-grad-2 hero-grad-2-ete'} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '500px', background: 'linear-gradient(180deg, rgba(79,69,161,1) 0%, rgba(79,69,161,0) 100%)', zIndex: 3 }} />
        <div className="hero-animation-block" style={{ position: 'relative', zIndex: 10 }}>
          <h1 style={{ color: 'white', fontSize: 'clamp(2.5rem, 7vw, 4.375rem)', fontWeight: 700, margin: 0, lineHeight: 1.0, textTransform: 'none' }}>
            Réserver votre vol et<br className="max-lg:hidden" />{' '}baptême de<br />parapente à La<br className="max-lg:hidden" />{' '}Clusaz
          </h1>
        </div>
      </section>}

      <div className={`relative z-20 max-w-7xl mx-auto px-4 pb-48 ${isDirect ? 'pt-6' : 'pt-12'}`}>
        
        {/* Chargement en mode direct — les vols n'ont pas encore été reçus de l'API */}
        {isDirect && !selectedFlight && (
          <div className="flex flex-col items-center justify-center gap-4" style={{ minHeight: isDirect && !isEmbed ? '120px' : '700px' }}>
            <div className="w-8 h-8 rounded-full border-4 border-slate-200 animate-spin" style={{ borderTopColor: '#E6007E' }} />
            <p style={{ fontSize: '1rem', fontWeight: 700, color: '#94a3b8' }}>Chargement des disponibilités…</p>
          </div>
        )}

        {/* ÉTAPE 1 : CHOIX DU VOL */}
        {step === 1 && !isDirect && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* 🎯 SÉLECTEUR DE SAISON "COLLANT" (STICKY) */}
            <div className="flex justify-center mb-12 sticky top-[80px] lg:top-[90px] z-40 transition-all duration-300">
              <div className="bg-white p-1.5 rounded-[10px] inline-flex border border-slate-200" style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.07)' }}>
                <button aria-pressed={activeSeason === 'Standard'} onClick={() => setActiveSeason('Standard')} className={`px-6 py-3 rounded-[5px] transition-all duration-300 flex items-center gap-2 ${activeSeason === 'Standard' ? 'text-white shadow-md scale-105' : 'text-slate-500 hover:text-slate-800'}`} style={activeSeason === 'Standard' ? { backgroundColor: '#E6007E', fontSize: '1.125rem', fontWeight: 700 } : { fontSize: '1.125rem', fontWeight: 700 }}><Sun size={18} strokeWidth={1.5} />été</button>
                <button aria-pressed={activeSeason === 'Hiver'} onClick={() => setActiveSeason('Hiver')} className={`px-6 py-3 rounded-[5px] transition-all duration-300 flex items-center gap-2 ${activeSeason === 'Hiver' ? 'text-white shadow-md scale-105' : 'text-slate-500 hover:text-slate-800'}`} style={activeSeason === 'Hiver' ? { backgroundColor: '#312783', fontSize: '1.125rem', fontWeight: 700 } : { fontSize: '1.125rem', fontWeight: 700 }}><Snowflake size={18} strokeWidth={1.5} />hiver</button>
              </div>
            </div>

            {/* 💡 BANDEAU DE RÉASSURANCE (ASTUCES FLUIDES) */}
          <div className="max-w-7xl mx-auto mb-12 rounded-[10px] p-6 shadow-sm" style={{ backgroundColor: 'rgba(49,39,131,0.04)' }}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">

              <div className="flex items-start gap-4">
                <div className="flex items-center justify-center shrink-0" style={{ color: '#312783' }}><Gift size={28} strokeWidth={1.5} /></div>
                <div>
                  <h4 style={{ color: '#312783', fontSize: '1.25rem', fontWeight: 700, marginBottom: '4px' }}>Bon Cadeau</h4>
                  <p style={{ color: '#1D1D1B', fontSize: '1.125rem', fontWeight: 400, lineHeight: 1.625 }}>
                    Vous avez un code cadeau, un code promo ? Inutile de le chercher maintenant, vous pourrez le saisir à la dernière étape, juste avant le paiement.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex items-center justify-center shrink-0" style={{ color: '#312783' }}><Camera size={28} strokeWidth={1.5} /></div>
                <div>
                  <h4 style={{ color: '#312783', fontSize: '1.25rem', fontWeight: 700, marginBottom: '4px' }}>Photos & Vidéos</h4>
                  <p style={{ color: '#1D1D1B', fontSize: '1.125rem', fontWeight: 400, lineHeight: 1.625 }}>
                    Option accessible plus tard dans le processus de réservation ! Pas complètement décidé ? Vous pourrez demander l'option directement à votre moniteur le jour J.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex items-center justify-center shrink-0" style={{ color: '#312783' }}><Zap size={28} strokeWidth={1.5} /></div>
                <div>
                  <h4 style={{ color: '#312783', fontSize: '1.25rem', fontWeight: 700, marginBottom: '4px' }}>Sensations Fortes</h4>
                  <p style={{ color: '#1D1D1B', fontSize: '1.125rem', fontWeight: 400, lineHeight: 1.625 }}>
                    Envie d'acrobaties et de piloter un peu ? C'est inclus et 100% gratuit. Il suffira de le demander une fois en l'air !
                  </p>
                </div>
              </div>

            </div>
          </div>

            {isLoading ? (
              /* ☠️ EFFET "SKELETON" POUR LES CARTES DE VOLS */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-white rounded-[10px] p-8 border border-slate-100 flex flex-col justify-between animate-pulse">
                    {/* Fausse image */}
                    <div className="w-full h-40 md:h-52 bg-slate-200/60 rounded-2xl md:rounded-[20px] mb-6"></div>
                    
                    <div>
                      {/* Faux titre */}
                      <div className="h-8 bg-slate-200/80 rounded-xl w-3/4 mb-4"></div>
                      {/* Faux tags */}
                      <div className="flex gap-3 mb-6">
                        <div className="h-6 bg-slate-100 rounded-lg w-28"></div>
                        <div className="h-6 bg-slate-100 rounded-lg w-24"></div>
                      </div>
                      {/* Fausse saison */}
                      <div className="h-5 bg-slate-100 rounded-lg w-40 mb-4"></div>
                    </div>
                    
                    {/* Faux prix et bouton */}
                    <div className="mt-4 pt-6 border-t border-slate-100 flex items-center justify-between">
                      <div className="h-10 bg-slate-200/80 rounded-xl w-20"></div>
                      <div className="h-12 bg-slate-200/50 rounded-2xl w-32"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredFlights.length === 0 ? (
               <div className="text-center py-20 bg-white rounded-[10px] border border-slate-100"><Wind size={48} strokeWidth={1} style={{ color: '#312783', margin: '0 auto 16px', display: 'block' }} /><h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#312783' }}>Aucun vol configuré pour cette saison</h3></div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {filteredFlights.map((flight) => {
                  const s = String(flight.season || 'ALL').toUpperCase().trim();
                  const isWinter = s === 'WINTER' || s === 'HIVER';
                  const isSummer = s === 'SUMMER' || s === 'ETE' || s === 'ÉTÉ';
                  const seasonLabel = isWinter ? 'Hiver uniquement' : isSummer ? 'Été uniquement' : null;
                  const SeasonPictoIcon: React.ElementType | null = isWinter ? Snowflake : isSummer ? Sun : null;

                  return (
                  <div key={flight.id} className="flight-card bg-slate-50 rounded-[10px] p-8 border border-slate-100 flex flex-col justify-between">
                    
                    {flight.image_url && (
                      <div className="flight-img-wrap w-full h-40 md:h-52 rounded-[10px] mb-6 border border-slate-100 overflow-hidden">
                        <img src={cloudinaryOptimize(flight.image_url)} alt={flight.name} decoding="async" />
                      </div>
                    )}

                    <div>
                      <div className="flex justify-between items-start mb-3 gap-2">
                        <h3 className="flex-1" style={{ fontSize: '1.5rem', fontWeight: 700, color: '#312783' }}>{flight.name}</h3>
                        
                        {/* On n'affiche le bouton 'i' que si vous l'avez activé et rempli dans le backoffice ! */}
                        {flight.show_popup && flight.popup_content && (
                          <span className="relative group">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setInfoFlight(flight);
                              }}
                              className="w-8 h-8 shrink-0 rounded-full bg-transparent flex items-center justify-center transition-all border cursor-pointer" style={{ color: '#009FE3', borderColor: '#009FE3' }} onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(0,159,227,0.1)'; }} onMouseLeave={e => { e.currentTarget.style.backgroundColor = ''; }}
                            >
                              <span className="font-georgia font-serif italic font-bold text-lg leading-none" style={{ fontFamily: 'Georgia, serif' }}>i</span>
                            </button>
                            <span className="pointer-events-none absolute bottom-full right-0 mb-2 whitespace-nowrap rounded px-2 py-1 text-xs font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100" style={{ backgroundColor: '#312783' }}>Plus d'informations sur ce vol</span>
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col gap-2 mb-3">
                        {(() => { const info = getMarketingInfo(flight.name); const Icon = info.includes('dénivelé') ? Mountain : info.includes('min') || info.includes('h de vol') ? Clock : Wind; return <span style={{ color: '#E6007E', fontSize: '1.125rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Icon size={18} strokeWidth={1.5} />{info}</span>; })()}
                        <span style={{ color: '#E6007E', fontSize: '1.125rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Weight size={18} strokeWidth={1.5} />{flight.weight_min !== undefined ? flight.weight_min : 20} – {flight.weight_max !== undefined ? flight.weight_max : 110} kg</span>
                      </div>
                      {(flight.activity_ski || flight.activity_snowboard || flight.activity_pedestrian || flight.activity_children || flight.activity_gopro || seasonLabel) && (
                        <div className="flex flex-wrap items-center gap-3 mb-6" style={{ color: '#E6007E' }}>
                          {SeasonPictoIcon && (
                            <span className="relative group cursor-default">
                              <SeasonPictoIcon size={22} strokeWidth={1.5} />
                              <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-24 text-center rounded px-2 py-1 text-xs font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100" style={{ backgroundColor: '#312783' }}>
                                {isWinter ? 'Hiver uniquement' : 'Printemps, été, automne'}
                              </span>
                            </span>
                          )}
                          {flight.activity_ski && (
                            <span className="relative group cursor-default">
                              <SkiIcon size={22} />
                              <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-24 text-center rounded px-2 py-1 text-xs font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100" style={{ backgroundColor: '#312783' }}>Accessible aux skieurs</span>
                            </span>
                          )}
                          {flight.activity_snowboard && (
                            <span className="relative group cursor-default">
                              <SnowboardIcon size={22} />
                              <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-24 text-center rounded px-2 py-1 text-xs font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100" style={{ backgroundColor: '#312783' }}>Accessible aux snowboardeurs</span>
                            </span>
                          )}
                          {flight.activity_pedestrian && (
                            <span className="relative group cursor-default">
                              <PedestrianIcon size={22} />
                              <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-24 text-center rounded px-2 py-1 text-xs font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100" style={{ backgroundColor: '#312783' }}>Accessible aux piétons</span>
                            </span>
                          )}
                          {flight.activity_children && (
                            <span className="relative group cursor-default">
                              <ChildrenIcon size={22} />
                              <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-24 text-center rounded px-2 py-1 text-xs font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100" style={{ backgroundColor: '#312783' }}>Pour les enfants et les poids légers</span>
                            </span>
                          )}
                          {flight.activity_gopro && (
                            <span className="relative group cursor-default">
                              <GoproIcon size={22} />
                              <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-24 text-center rounded px-2 py-1 text-xs font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100" style={{ backgroundColor: '#312783' }}>Photos-vidéos comprises</span>
                            </span>
                          )}
                        </div>
                      )}
                      {flight.description && (
                        <p style={{ color: '#1D1D1B', fontSize: '1.125rem', fontWeight: 400, lineHeight: 1.625, marginBottom: '0.25rem' }}>{flight.description}</p>
                      )}
                    </div>
                    <div className="mt-2 pt-3 border-t border-slate-100">
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="shrink-0" style={{ fontSize: '2rem', fontWeight: 700, color: '#E6007E' }}>{flight.price_cents ? flight.price_cents / 100 : 0}€</div>
                        {(() => {
                          const matchedTpl = giftTemplates.find(t => t.price_cents === flight.price_cents);
                          if (!matchedTpl) return null;
                          return (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                window.location.href = `/bons-cadeaux?templateId=${matchedTpl.id}&flightName=${encodeURIComponent(flight.name)}`;
                              }}
                              className="cursor-pointer px-4 py-3 rounded-[5px] transition-all flex items-center justify-center gap-2"
                              style={{ backgroundColor: 'rgba(230,0,126,0.1)', color: '#E6007E', fontSize: '1rem', fontWeight: 700 }}
                              onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#312783'; e.currentTarget.style.color = 'white'; }}
                              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(230,0,126,0.1)'; e.currentTarget.style.color = '#E6007E'; }}
                            >
                              <Gift size={16} strokeWidth={1.5} />Offrir
                            </button>
                          );
                        })()}
                      </div>
                      <button onClick={() => { setSelectedFlight(flight); setStep(2); }} className="btn-reserver cursor-pointer text-white w-full py-3 md:py-4 rounded-[5px] font-bold flex items-center justify-center" style={{ fontSize: '1.125rem' }} onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#312783')} onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#E6007E')}>
                        Réserver ce vol
                      </button>
                    </div>
                  </div>
                )})}
              </div>
            )}
          </div>
        )}

        {/* ÉTAPE 2 : LA GRILLE DES JOURS */}
        {step === 2 && selectedFlight && (
          <div id="etape-2-container" className={`animate-in fade-in slide-in-from-right-8 duration-500 ${isDirect ? 'mt-0' : 'mt-16 md:mt-24'}`}>
            {!isDirect && (
              <button onClick={() => setStep(1)} className="mb-6 bg-white px-4 py-2 rounded-[5px] text-slate-600 flex items-center gap-2 border border-slate-200 w-fit transition-colors hover:border-slate-300 hover:bg-slate-50" style={{ fontSize: '0.875rem', fontWeight: 700 }} onMouseEnter={e => (e.currentTarget.style.color = '#312783')} onMouseLeave={e => (e.currentTarget.style.color = '')}>
                ← Retour au catalogue
              </button>
            )}

            <div className="bg-white rounded-[10px] p-6 md:p-10">
              
              <div id="etape-2-vol-titre" className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10 pb-10 border-b border-slate-100">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="font-bold leading-tight" style={{ color: '#312783', fontSize: '2rem', fontWeight: 700 }}>Réservation :</h2>
                    {isDirect ? (
                      <span style={{ color: '#E6007E', fontSize: '2rem', fontWeight: 700, lineHeight: 1.1 }}>
                        {selectedFlight.name}
                      </span>
                    ) : (
                      <div className="relative" ref={flightSelectRef}>
                        <button
                          onClick={() => setShowFlightSelect(v => !v)}
                          className="flex items-center gap-3 border-2 rounded-[5px] py-1 pl-4 pr-4 transition-all"
                          style={{ color: '#E6007E', backgroundColor: 'rgba(230,0,126,0.04)', borderColor: showFlightSelect ? 'rgba(230,0,126,0.5)' : 'rgba(230,0,126,0.2)', fontSize: '2rem', fontWeight: 700 }}
                        >
                          {selectedFlight.name}
                          <ChevronDown size={20} strokeWidth={2.5} style={{ flexShrink: 0, marginTop: '2px', transform: showFlightSelect ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }} />
                        </button>

                        {showFlightSelect && (
                          <div className="absolute left-0 mt-2 z-50 bg-white rounded-[10px] border border-slate-200 overflow-hidden"
                            style={{ minWidth: '100%', boxShadow: '0 8px 32px rgba(49,39,131,0.13)' }}>
                            {filteredFlights.map(f => {
                              const isActive = f.id === selectedFlight.id;
                              return (
                                <button
                                  key={f.id}
                                  onClick={() => { setSelectedFlight(f); setShowFlightSelect(false); }}
                                  className="w-full text-left px-5 py-3 transition-colors flex items-center justify-between gap-4"
                                  style={{
                                    fontSize: '1.1rem',
                                    fontWeight: 700,
                                    color: isActive ? '#fff' : '#312783',
                                    backgroundColor: isActive ? '#312783' : 'transparent',
                                  }}
                                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.backgroundColor = 'rgba(49,39,131,0.06)'; }}
                                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.backgroundColor = 'transparent'; }}
                                >
                                  <span>{f.name}</span>
                                  {isActive && <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>✓</span>}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <p style={{ fontSize: '1rem', fontWeight: 700, color: '#009FE3', marginTop: '12px' }}>{getMarketingInfo(selectedFlight.name)}</p>
                </div>
                
                {/* Sélecteur de date — bouton + calendrier custom */}
                <div className="relative shrink-0" ref={calendarRef}>
                  <button
                    onClick={() => setShowCalendar(v => !v)}
                    className="flex items-center gap-2 px-6 py-3 rounded-[5px] border border-slate-200 bg-white font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors"
                    style={{ fontSize: '1.05rem' }}
                  >
                    <CalendarDays size={16} style={{ color: '#312783', flexShrink: 0 }} />
                    {formatPickedDate(pickedDate)}
                    <ChevronDown size={14} style={{ color: '#94a3b8', flexShrink: 0, transform: showCalendar ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }} />
                  </button>

                  {showCalendar && (() => {
                    const today = getLocalYYYYMMDD(new Date());
                    const year = calMonth.getFullYear();
                    const month = calMonth.getMonth();
                    const firstDayOfWeek = (new Date(year, month, 1).getDay() + 6) % 7;
                    const daysInMonth = new Date(year, month + 1, 0).getDate();
                    const monthLabel = calMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
                    const cells: (number | null)[] = [
                      ...Array(firstDayOfWeek).fill(null),
                      ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
                    ];
                    const ds = (d: number) => getLocalYYYYMMDD(new Date(year, month, d));
                    return (
                      <>
                      {/* Backdrop */}
                      <div className="fixed inset-0 z-[9998] bg-black/30 backdrop-blur-sm" onClick={() => setShowCalendar(false)} />
                      <div className="fixed z-[9999] bg-white rounded-[12px] border border-slate-200 p-4 select-none"
                        style={{ width: '288px', boxShadow: '0 8px 40px rgba(49,39,131,0.18)', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
                        {/* En-tête mois */}
                        <div className="flex items-center justify-between mb-3">
                          <button onClick={() => setCalMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
                            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors text-slate-500">
                            <ChevronLeft size={16} />
                          </button>
                          <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#312783', textTransform: 'capitalize' }}>{monthLabel}</span>
                          <div className="flex items-center gap-1">
                            <button onClick={() => setCalMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
                              className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors text-slate-500">
                              <ChevronRight size={16} />
                            </button>
                            <button onClick={() => setShowCalendar(false)}
                              className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors text-slate-400">
                              <X size={15} />
                            </button>
                          </div>
                        </div>
                        {/* Noms des jours */}
                        <div className="grid grid-cols-7 mb-1">
                          {['L','M','M','J','V','S','D'].map((d, i) => (
                            <div key={i} className="flex items-center justify-center h-7"
                              style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8' }}>{d}</div>
                          ))}
                        </div>
                        {/* Grille des jours */}
                        <div className="grid grid-cols-7 gap-y-1">
                          {cells.map((d, i) => {
                            if (!d) return <div key={i} />;
                            const dateStr = ds(d);
                            const isPast = dateStr < today;
                            const isSelected = dateStr === pickedDate;
                            const isToday = dateStr === today;
                            const hasSlots = calAvailDates.has(dateStr);
                            return (
                              <button
                                key={i}
                                disabled={isPast}
                                onClick={() => { pickDate(dateStr); setCalMonth(new Date(year, month, 1)); }}
                                className="flex flex-col items-center justify-center h-8 w-8 mx-auto rounded-full transition-colors"
                                style={{
                                  fontSize: '0.82rem',
                                  fontWeight: isSelected || isToday ? 700 : 400,
                                  backgroundColor: isSelected ? '#312783' : 'transparent',
                                  color: isSelected ? '#fff' : isPast ? '#cbd5e1' : '#1e293b',
                                  outline: isToday && !isSelected ? '2px solid #E6007E' : 'none',
                                  outlineOffset: '-2px',
                                  cursor: isPast ? 'default' : 'pointer',
                                }}
                                onMouseEnter={e => { if (!isPast && !isSelected) e.currentTarget.style.backgroundColor = 'rgba(49,39,131,0.08)'; }}
                                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent'; }}
                              >
                                <span style={{ lineHeight: 1 }}>{d}</span>
                                {hasSlots && !isPast && (
                                  <span style={{ width: 4, height: 4, borderRadius: '50%', backgroundColor: isSelected ? 'rgba(255,255,255,0.7)' : '#E6007E', flexShrink: 0, marginTop: 1 }} />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              <p style={{ color: '#E6007E', fontWeight: 700, fontSize: 'clamp(1.25rem, 2.5vw, 1.5rem)', margin: '0 0 1.25rem' }}>
                Choisissez un créneau
              </p>

              <div className={`transition-opacity duration-75 ${isSearchingTimes && rawSlots.length > 0 ? 'opacity-50 pointer-events-none' : ''}`}>
                
                {isSearchingTimes && rawSlots.length === 0 ? (
                  /* ☠️ EFFET "SKELETON" : Chargement initial ultra-pro */
                  <div className="flex overflow-hidden gap-4 px-[12.5vw] md:px-0 pt-6">
                    {Array.from({ length: displayDaysCount === 7 ? 7 : 5 }).map((_, i) => (
                      <div key={i} className="min-w-[75vw] md:min-w-[220px] flex-1 flex flex-col gap-3 animate-pulse">
                         {/* Faux header de jour */}
                         <div className="h-14 bg-slate-200/60 rounded-[5px] mb-4"></div>
                         {/* Fausses cases horaires */}
                         <div className="h-20 bg-slate-100 rounded-[5px]"></div>
                         <div className="h-20 bg-slate-100 rounded-[5px]"></div>
                         <div className="h-20 bg-slate-100/50 rounded-[5px]"></div>
                      </div>
                    ))}
                  </div>
                ) : (() => {
                    if (!selectedFlight || isSearchingTimes) return false;
                    const s = String(selectedFlight.season || 'ALL').toUpperCase().trim();
                    const isWinterFlight = s === 'WINTER' || s === 'HIVER';
                    const isSummerFlight = s === 'SUMMER' || s === 'ETE' || s === 'ÉTÉ';
                    return (isWinterFlight && isWinterOffSeason) || (isSummerFlight && isSummerOffSeason);
                  })() ? (
                  /* Hors-saison pour ce vol — message saisonnier */
                  (() => {
                    const s = String(selectedFlight!.season || 'ALL').toUpperCase().trim();
                    const isWinterFlight = s === 'WINTER' || s === 'HIVER';
                    return (
                      <div className="text-center py-14 px-6 bg-slate-50 rounded-[10px] border border-slate-100">
                        <p style={{ fontSize: '1.05rem', fontWeight: 700, color: '#312783', marginBottom: '8px' }}>
                          {isWinterFlight
                            ? 'Prochaines dispos en ligne pour ce vol à partir de décembre.'
                            : 'Pas de dispos pour ce vol avant juin.'}
                        </p>
                        <p style={{ fontSize: '1rem', fontWeight: 400, color: '#1D1D1B' }}>
                          Avant cela, recherchez un créneau sur{' '}
                          <a
                            href={isWinterFlight ? 'https://www.fluide-parapente.fr/bapteme-vol-ete/' : 'https://www.fluide-parapente.fr/bapteme-vol-biplace/'}
                            style={{ color: '#E6007E', fontWeight: 700, textDecoration: 'underline' }}
                          >
                            {isWinterFlight ? 'un vol été' : 'nos vols hiver'}
                          </a>
                          {' '}ou appelez le{' '}
                          <a href="tel:+33677285102" style={{ color: '#E6007E', fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                            06 77 28 51 02
                          </a>
                          .
                        </p>
                      </div>
                    );
                  })()
                ) : (
                  <div className="relative">
                    {/* 🎯 LE BANDEAU DES JOURS (Esclave) */}
                    <div ref={datesBarRef} className={`${isEmbed ? 'relative ' : 'sticky top-[80px] lg:top-[90px] '}z-40 bg-white pt-4 pb-4 border-b border-slate-200`} style={isEmbed ? { willChange: 'transform' } : undefined}>
                      <div ref={headerScrollRef} className="flex overflow-hidden gap-4 px-[12.5vw] md:px-0 opacity-0 md:opacity-100 transition-opacity duration-300">
                        {weekDays.map((dateStr, i) => {
                          const isFirstDesktop = i === 10;
                          const isLastDesktop = i === 10 + displayDaysCount - 1;
                          const isHiddenOnDesktop = i < 10 || i >= 10 + displayDaysCount;
                          return (
                            <div key={`header-${dateStr}`} className={`min-w-[75vw] max-w-[75vw] md:min-w-[220px] md:max-w-none flex-1 flex gap-2 ${isHiddenOnDesktop ? 'md:hidden' : ''}`}>
                              {isFirstDesktop && (
                                <button onClick={() => shiftDays(-1)} className="hidden md:flex shrink-0 w-12 shadow-md rounded-[5px] items-center justify-center text-white transition-colors cursor-pointer outline-none border-none" style={{ backgroundColor: '#009FE3' }} onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#312783')} onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#009FE3')}><ChevronLeft size={22} strokeWidth={2.5} /></button>
                              )}
                              <button
                                onClick={() => setShowCalendar(true)}
                                className="flex-1 shadow-md rounded-[5px] p-4 flex flex-col items-center justify-center text-center transition-colors outline-none border-none"
                                style={{ backgroundColor: '#312783', cursor: 'pointer' }}
                                onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#1e1a5e')}
                                onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#312783')}
                                title="Changer de date"
                              >
                                <p className="font-bold text-white capitalize text-md leading-tight">{getDayName(dateStr)}</p>
                                <CalendarDays size={11} color="rgba(255,255,255,0.45)" style={{ marginTop: '4px' }} />
                              </button>
                              {isLastDesktop && (
                                <button onClick={() => shiftDays(1)} className="hidden md:flex shrink-0 w-12 shadow-md rounded-[5px] items-center justify-center text-white transition-colors cursor-pointer outline-none border-none" style={{ backgroundColor: '#009FE3' }} onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#312783')} onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#009FE3')}><ChevronRight size={22} strokeWidth={2.5} /></button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* 🎯 LA ZONE DES CRÉNEAUX (Unique et Corrigée) */}
                    <div 
                      ref={bodyScrollRef}
                      onScroll={(e) => { 
                        if (headerScrollRef.current) headerScrollRef.current.scrollLeft = e.currentTarget.scrollLeft; 
                        
                        // 🎯 NOUVEAU : Synchronisation magique du Swipe (Uniquement sur mobile)
                        if (window.innerWidth < 768) {
                          clearTimeout(scrollTimeout.current ?? undefined);
                          scrollTimeout.current = setTimeout(() => {
                            if (!bodyScrollRef.current) return;
                            const container = bodyScrollRef.current;
                            const scrollCenter = container.scrollLeft + (container.clientWidth / 2);
                            
                            let closestDate = pickedDate;
                            let minDistance = Infinity;
                            
                            // On cherche quelle carte de jour est la plus proche du centre de l'écran
                            weekDays.forEach(dateStr => {
                              const el = document.getElementById(`mobile-col-${dateStr}`);
                              if (el) {
                                const elCenter = el.offsetLeft + (el.clientWidth / 2);
                                const distance = Math.abs(elCenter - scrollCenter);
                                if (distance < minDistance) {
                                  minDistance = distance;
                                  closestDate = dateStr;
                                }
                              }
                            });
                            
                            // Si le jour au centre a changé, on met à jour le calendrier silencieusement
                            if (closestDate !== pickedDate) {
                              isSwipingRef.current = true; // On active le verrou anti-rebond
                              setPickedDate(closestDate);
                            }
                          }, 150); // Un délai de 150ms pour laisser le doigt finir son mouvement
                        }
                      }}
                      className="relative flex overflow-x-auto gap-4 px-[12.5vw] md:px-0 pb-4 snap-x snap-mandatory md:snap-proximity pt-6 custom-scrollbar opacity-0 md:opacity-100 transition-opacity duration-300"
                    >
                      {weekDays.map((dateStr, i) => {
                        const isHiddenOnDesktop = i < 10 || i >= 10 + displayDaysCount;
                        const times = Object.keys(gridData[dateStr] || {}).sort();
                        const pickedIndex = weekDays.indexOf(pickedDate);
                        const diffIndex = Math.abs(i - pickedIndex);
                        const showRealSlots = isGridExpanded || diffIndex <= 1;

                        return (
                          <div 
                            id={`mobile-col-${dateStr}`} 
                            key={dateStr} 
                            // 🚀 LA MARGE MAGIQUE : scroll-mt-32 (128px) ou scroll-mt-48 (192px)
                            className={`min-w-[75vw] max-w-[75vw] md:min-w-[220px] md:max-w-none flex-1 snap-center md:snap-start h-fit scroll-mt-32 md:scroll-mt-48 ${isHiddenOnDesktop ? 'md:hidden' : ''}`}
                          >
                            {showRealSlots ? (
                              <div className="flex flex-col gap-2 animate-in fade-in duration-500">
                                {times.length === 0 ? (() => {
                                  const today = getLocalYYYYMMDD(new Date());
                                  const contextDate = dateStr >= today ? dateStr : today;
                                  const nextFromHere = Object.keys(gridData)
                                    .filter(d => d > contextDate && Object.keys(gridData[d]).length > 0)
                                    .sort()[0] ?? nextAvailableDate;
                                  const isFull = fullDates.has(dateStr);

                                  if (isFull) {
                                    return (
                                      <div className="rounded-[5px] py-5 px-3 border border-slate-200 flex flex-col items-center justify-center gap-1.5 text-center" style={{ backgroundColor: 'rgba(230,0,126,0.03)' }}>
                                        <p className="text-[9px] font-bold uppercase tracking-wider leading-tight" style={{ color: '#E6007E', opacity: 0.7 }}>Complet</p>
                                        {nextFromHere ? (
                                          <button
                                            onClick={() => pickDate(nextFromHere)}
                                            className="flex flex-col items-center gap-0.5 group cursor-pointer"
                                            style={{ background: 'none', border: 'none', padding: 0 }}
                                          >
                                            <p className="text-[9px] leading-tight group-hover:underline" style={{ color: '#312783', opacity: 0.5 }}>Prochaines réservations disponibles le</p>
                                            <p className="text-[10px] font-black leading-tight group-hover:underline" style={{ color: '#312783' }}>
                                              {new Date(nextFromHere + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                                            </p>
                                          </button>
                                        ) : (
                                          <p className="text-[9px] leading-tight" style={{ color: '#312783', opacity: 0.5 }}>Prochaines réservations disponibles bientôt</p>
                                        )}
                                        <div className="w-8 border-t border-slate-300 my-0.5" />
                                        <a href="tel:0677285102" className="text-xs font-black" style={{ color: '#E6007E' }}>06 77 28 51 02</a>
                                      </div>
                                    );
                                  }

                                  const msg = getSeasonMessage(contextDate, nextFromHere);
                                  return (
                                    <div className="rounded-[5px] py-5 px-3 border border-slate-200 flex flex-col items-center justify-center gap-1.5 text-center" style={{ backgroundColor: 'rgba(49,39,131,0.03)' }}>
                                      {msg && !msg.offSeason && (
                                        <>
                                          {nextFromHere ? (
                                            <button
                                              onClick={() => pickDate(nextFromHere)}
                                              className="flex flex-col items-center gap-1 group cursor-pointer"
                                              style={{ background: 'none', border: 'none', padding: 0 }}
                                            >
                                              <p className="text-[9px] font-bold uppercase tracking-wider leading-tight group-hover:underline" style={{ color: '#312783', opacity: 0.45 }}>{msg.headline}</p>
                                              {msg.lines.map((line, i) => (
                                                <p key={i} className="text-[10px] font-black leading-tight group-hover:underline" style={{ color: '#312783' }}>{line}</p>
                                              ))}
                                            </button>
                                          ) : (
                                            <>
                                              <p className="text-[9px] font-bold uppercase tracking-wider leading-tight" style={{ color: '#312783', opacity: 0.45 }}>{msg.headline}</p>
                                              {msg.lines.map((line, i) => (
                                                <p key={i} className="text-[10px] font-black leading-tight" style={{ color: '#312783' }}>{line}</p>
                                              ))}
                                            </>
                                          )}
                                          <div className="w-8 border-t border-slate-300 my-0.5" />
                                          <p className="text-[9px] leading-tight" style={{ color: '#312783', opacity: 0.4 }}>En dehors de ces dates, appelez le</p>
                                        </>
                                      )}
                                      {(!msg || msg.offSeason) && (
                                        <p className="text-[9px] leading-tight" style={{ color: '#312783', opacity: 0.4 }}>En période de fermeture des remontées mécaniques, appelez le :</p>
                                      )}
                                      <a href="tel:0677285102" className="text-xs font-black" style={{ color: '#E6007E' }}>06 77 28 51 02</a>
                                    </div>
                                  );
                                })() : (() => {
                                  const today = getLocalYYYYMMDD(new Date());
                                  const contextDate = dateStr >= today ? dateStr : today;
                                  const allFull = times.length > 0 && times.every(t => {
                                    const key = `${selectedFlight.id}|${dateStr}|${t}`;
                                    return gridData[dateStr][t] === 0 && (cart[key] || 0) === 0;
                                  });
                                  if (allFull) {
                                    const nextFromHere = Object.keys(gridData)
                                      .filter(d => d > contextDate && Object.keys(gridData[d]).some(t => gridData[d][t] > 0))
                                      .sort()[0] ?? nextAvailableDate;
                                    return (
                                      <div className="rounded-[5px] py-5 px-3 border border-rose-100 flex flex-col items-center justify-center gap-1.5 text-center" style={{ backgroundColor: 'rgba(230,0,126,0.03)' }}>
                                        <p className="text-[9px] font-bold uppercase tracking-wider leading-tight" style={{ color: '#E6007E', opacity: 0.7 }}>Complet</p>
                                        {nextFromHere ? (
                                          <button onClick={() => pickDate(nextFromHere)} className="flex flex-col items-center gap-0.5 group cursor-pointer" style={{ background: 'none', border: 'none', padding: 0 }}>
                                            <p className="text-[9px] leading-tight group-hover:underline" style={{ color: '#312783', opacity: 0.5 }}>Prochaines réservations disponibles le</p>
                                            <p className="text-[10px] font-black leading-tight group-hover:underline" style={{ color: '#312783' }}>
                                              {new Date(nextFromHere + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                                            </p>
                                          </button>
                                        ) : (
                                          <p className="text-[9px] leading-tight" style={{ color: '#312783', opacity: 0.5 }}>Prochaines réservations disponibles bientôt</p>
                                        )}
                                        <div className="w-8 border-t border-slate-300 my-0.5" />
                                        <a href="tel:0677285102" className="text-xs font-black" style={{ color: '#E6007E' }}>06 77 28 51 02</a>
                                      </div>
                                    );
                                  }
                                  return times.map(timeStr => {
                                    const capacity = gridData[dateStr][timeStr];
                                    const currentFlightKey = `${selectedFlight.id}|${dateStr}|${timeStr}`;
                                    const qtyInCart = cart[currentFlightKey] || 0;
                                    const isSelected = qtyInCart > 0;
                                    const isFull = capacity === 0 && qtyInCart === 0;

                                    if (isFull) {
                                      return (
                                        <div key={timeStr} className="px-3 py-2.5 rounded-[5px] border border-slate-100 flex items-center justify-between" style={{ backgroundColor: '#f8f9fa' }}>
                                          <span className="font-bold text-sm text-slate-300">{timeStr}</span>
                                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-[4px]" style={{ backgroundColor: 'rgba(0,0,0,0.05)', color: '#cbd5e1' }}>Complet</span>
                                        </div>
                                      );
                                    }

                                    return (
                                      <div key={timeStr} className={`p-4 rounded-[5px] border transition-colors ${isSelected ? 'shadow-sm' : 'bg-slate-50 border-slate-200 hover:bg-slate-100 hover:border-slate-300'}`} style={isSelected ? { backgroundColor: 'rgba(230,0,126,0.06)', borderColor: '#E6007E' } : {}}>
                                        <div className="flex justify-between items-center mb-4">
                                          <span className={`font-bold text-lg ${isSelected ? '' : 'text-slate-700'}`} style={isSelected ? { color: '#312783' } : {}}>{timeStr}</span>
                                          <span className="text-[10px] font-bold px-2 py-1 rounded-[4px] border" style={{ backgroundColor: 'rgba(49,39,131,0.06)', color: '#312783', borderColor: 'rgba(49,39,131,0.15)' }}>
                                            {capacity} place{capacity > 1 ? 's' : ''}
                                          </span>
                                        </div>
                                        <div className="flex items-center justify-between border-t border-slate-200/60 pt-3">
                                          <button
                                            aria-label={`Retirer un passager – ${getDayName(dateStr)} à ${timeStr}`}
                                            onClick={() => handleRemove(dateStr, timeStr)}
                                            disabled={qtyInCart === 0}
                                            className={`w-8 h-8 rounded-[5px] font-bold text-lg flex items-center justify-center transition-colors ${qtyInCart === 0 ? 'text-slate-300 cursor-not-allowed' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 shadow-sm'}`}
                                          >-</button>
                                          <span aria-live="polite" aria-label={`${qtyInCart} passager${qtyInCart > 1 ? 's' : ''} sélectionné${qtyInCart > 1 ? 's' : ''}`} className="font-bold text-lg w-8 text-center" style={isSelected ? { color: '#312783' } : { color: '#1D1D1B' }}>{qtyInCart}</span>
                                          <button
                                            aria-label={`Ajouter un passager – ${getDayName(dateStr)} à ${timeStr}`}
                                            onClick={() => handleAdd(dateStr, timeStr)}
                                            disabled={capacity === 0}
                                            className={`w-8 h-8 rounded-[5px] font-bold text-lg flex items-center justify-center transition-colors ${capacity === 0 ? 'text-slate-300 cursor-not-allowed' : 'text-white shadow-sm'}`}
                                            style={capacity > 0 ? { backgroundColor: '#009FE3' } : {}}
                                            onMouseEnter={e => { if (capacity > 0) e.currentTarget.style.backgroundColor = '#312783'; }}
                                            onMouseLeave={e => { if (capacity > 0) e.currentTarget.style.backgroundColor = '#009FE3'; }}
                                          >+</button>
                                        </div>
                                      </div>
                                    );
                                  });
                                })()}
                              </div>
                            ) : (
                              <div className="flex flex-col gap-2 opacity-0 pointer-events-none">
                                <div className="h-[90px] bg-slate-50 rounded-lg w-full"></div>
                                <div className="h-[90px] bg-slate-50 rounded-lg w-full"></div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ÉTAPE 3 : FORMULAIRE PASSAGER */}
        {step === 3 && (
          <div id="etape-3-container" className="animate-in fade-in slide-in-from-right-8 duration-500 max-w-3xl mx-auto mt-16 md:mt-24">
            <button onClick={() => setStep(2)} className="mb-6 bg-white/80 backdrop-blur-sm px-4 py-2 rounded-[5px] text-slate-600 flex items-center gap-2 shadow-sm border border-slate-100 w-fit transition-colors" style={{ fontSize: '0.875rem', fontWeight: 700 }} onMouseEnter={e => (e.currentTarget.style.color = '#312783')} onMouseLeave={e => (e.currentTarget.style.color = '')}>
              ← Modifier le panier
            </button>

            <div className="bg-white rounded-[10px] p-8 md:p-12 border border-slate-100">
              
              <div className="text-center mb-10 pb-10 border-b border-slate-100">
                <FileText size={48} strokeWidth={1.5} style={{ color: '#312783', margin: '0 auto 24px', display: 'block' }} />
                <h2 className="font-bold leading-tight" style={{ fontSize: '3rem', fontWeight: 700, color: '#312783' }}>Détails des passagers</h2>
                <p style={{ fontSize: '1.125rem', fontWeight: 400, color: '#1D1D1B' }} className="mt-2">Dernière étape avant de voler !</p>
              </div>

              {/* 🎯 NOUVEAU : LA SECTION BON CADEAU EST MAINTENANT TOUT EN HAUT ! */}
              {/* 🎯 SECTION BON CADEAU (Douce et Rassurante) */}
              <div className="mb-12 border-2 rounded-[10px] p-6 md:p-8 relative overflow-hidden shadow-sm" style={{ backgroundColor: 'rgba(49,39,131,0.04)', borderColor: 'rgba(49,39,131,0.2)' }}>
                <img src="/cadeau.svg" aria-hidden="true" className="absolute -right-4 -top-4 pointer-events-none select-none" style={{ width: '140px', height: '140px', opacity: 0.07, filter: 'invert(18%) sepia(82%) saturate(600%) hue-rotate(220deg)' }} />
                <h3 className="mb-2 flex items-center gap-3 relative z-10" style={{ fontSize: '1.25rem', fontWeight: 700, color: '#312783' }}>
                  Vous avez un bon cadeau ou un code promo ?
                </h3>
                <p className="mb-6 relative z-10" style={{ fontSize: '1rem', fontWeight: 700, color: '#312783', opacity: 0.8 }}>
                  Saisissez-le ici. La réduction s'appliquera immédiatement sur votre total avant le paiement.
                </p>

                {appliedPartner ? (
                  <div className="bg-white border-2 border-emerald-500 rounded-[10px] p-4 md:p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10 shadow-sm">
                    <div>
                      <p className="font-bold text-emerald-900 uppercase tracking-widest text-sm">
                        🤝 Partenaire {appliedPartner.name} appliqué
                      </p>
                      <p className="text-emerald-700 font-bold mt-1">
                        Code : <span className="uppercase">{appliedPartner.code}</span> · Inscription gratuite
                      </p>
                    </div>
                    <div className="text-left md:text-right w-full md:w-auto">
                      <p className="text-3xl font-bold text-emerald-600">Gratuit</p>
                      <button onClick={() => setAppliedPartner(null)} className="text-[10px] font-bold uppercase text-rose-500 mt-2 hover:underline">
                        Retirer le code
                      </button>
                    </div>
                  </div>
                ) : appliedVoucher ? (
                  <div className="bg-white border-2 border-emerald-500 rounded-[10px] p-4 md:p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10 shadow-sm">
                    <div>
                      <p className="font-bold text-emerald-900 uppercase tracking-widest text-sm">
                        ✅ {appliedVoucher.type === 'promo' ? 'Code Promo appliqué' : 'Bon cadeau activé !'}
                      </p>
                      <p className="text-emerald-700 font-bold mt-1">
                        Code : <span className="uppercase">{appliedVoucher.code}</span>
                      </p>
                    </div>
                    <div className="text-left md:text-right w-full md:w-auto">
                      <p className="text-3xl font-bold text-emerald-600">
                        - {discountAmount.toFixed(2)} €
                      </p>
                      <button onClick={() => setAppliedVoucher(null)} className="text-[10px] font-bold uppercase text-rose-500 mt-2 hover:underline">
                        Retirer le code
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="relative z-10">
                    <div className="flex flex-col md:flex-row gap-3">
                      <input
                        type="text"
                        placeholder="Ex: FLUIDE-1234 ou NOEL2024"
                        className="flex-1 bg-white border-2 rounded-[10px] p-4 font-bold uppercase text-slate-800 outline-none transition-colors shadow-sm" style={{ borderColor: 'rgba(49,39,131,0.15)' }}
                        value={voucherInput}
                        onChange={e => setVoucherInput(e.target.value.toUpperCase())}
                      />
                      <button 
                        onClick={handleApplyVoucher}
                        disabled={isApplyingVoucher || !voucherInput.trim()}
                        className={`px-8 py-4 md:py-0 rounded-[5px] uppercase tracking-widest transition-all ${!voucherInput.trim() || isApplyingVoucher ? 'text-slate-400' : 'text-white shadow-md hover:-translate-y-0.5'}`} style={!voucherInput.trim() || isApplyingVoucher ? { backgroundColor: 'rgba(49,39,131,0.1)', fontSize: '1.125rem', fontWeight: 700 } : { backgroundColor: '#312783', fontSize: '1.125rem', fontWeight: 700 }}
                      >
                        {isApplyingVoucher ? '...' : 'Appliquer'}
                      </button>
                    </div>
                    {/* 🎯 On remplace le rouge par du violet et la croix par un "i" */}
                    {voucherError && <p className="flex items-center gap-2 mt-3" style={{ fontSize: '1rem', fontWeight: 700, color: '#7c3aed' }}>ℹ {voucherError}</p>}
                  </div>
                )}
              </div>

              {/* SECTION 1 : CONTACT */}
              <div className="mb-12">
                <h3 className="mb-6 flex items-center gap-3" style={{ fontSize: '1.25rem', fontWeight: 700, color: '#312783' }}>
                  <span className="text-white w-8 h-8 rounded-full flex items-center justify-center text-sm" style={{ backgroundColor: '#312783' }}>1</span>
                  Personne à contacter
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className={!needsName ? 'opacity-40 pointer-events-none' : ''}>
                    <label style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1D1D1B', display: 'block', marginBottom: '6px' }} className="ml-2">
                      Prénom{!needsName && <span className="ml-2 text-xs font-normal text-slate-400">(non requis par le partenaire)</span>}
                    </label>
                    <input
                      type="text"
                      disabled={!needsName}
                      className={`w-full bg-slate-50 border-2 rounded-[10px] p-4 font-bold focus:border-[#312783] outline-none text-slate-800 ${contactErrors.firstName ? 'border-rose-400 bg-rose-50' : 'border-slate-100'}`}
                      placeholder={needsName ? 'Jean' : '—'}
                      value={contact.firstName}
                      onChange={e => { setContact({...contact, firstName: e.target.value}); if (contactErrors.firstName) validateField('firstName', e.target.value); }}
                    />
                    {contactErrors.firstName && <p className="text-rose-500 text-[11px] font-bold mt-1 ml-2">{contactErrors.firstName}</p>}
                  </div>
                  <div className={!needsName ? 'opacity-40 pointer-events-none' : ''}>
                    <label style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1D1D1B', display: 'block', marginBottom: '6px' }} className="ml-2">
                      Nom{!needsName && <span className="ml-2 text-xs font-normal text-slate-400">(non requis)</span>}
                    </label>
                    <input
                      type="text"
                      disabled={!needsName}
                      className={`w-full bg-slate-50 border-2 rounded-[10px] p-4 font-bold focus:border-[#312783] outline-none text-slate-800 ${contactErrors.lastName ? 'border-rose-400 bg-rose-50' : 'border-slate-100'}`}
                      placeholder={needsName ? 'Dupont' : '—'}
                      value={contact.lastName}
                      onChange={e => { setContact({...contact, lastName: e.target.value}); if (contactErrors.lastName) validateField('lastName', e.target.value); }}
                    />
                    {contactErrors.lastName && <p className="text-rose-500 text-[11px] font-bold mt-1 ml-2">{contactErrors.lastName}</p>}
                  </div>
                  <div className={!needsPhone ? 'opacity-40 pointer-events-none' : ''}>
                    <label style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1D1D1B', display: 'block', marginBottom: '6px' }} className="ml-2">
                      Téléphone (le jour du vol){!needsPhone && <span className="ml-2 text-xs font-normal text-slate-400">(non requis)</span>}
                    </label>
                    <input
                      type="tel"
                      disabled={!needsPhone}
                      className={`w-full bg-slate-50 border-2 rounded-[10px] p-4 font-bold focus:border-[#312783] outline-none text-slate-800 ${contactErrors.phone ? 'border-rose-400 bg-rose-50' : 'border-slate-100'}`}
                      placeholder={needsPhone ? '06 12 34 56 78' : '—'}
                      value={contact.phone}
                      onChange={e => { setContact({...contact, phone: e.target.value}); if (contactErrors.phone) validateField('phone', e.target.value); }}
                      onBlur={e => { if (e.target.value) validateField('phone', e.target.value); }}
                    />
                    {contactErrors.phone && <p className="text-rose-500 text-[11px] font-bold mt-1 ml-2">{contactErrors.phone}</p>}
                  </div>
                  <div className={!needsEmail ? 'opacity-40 pointer-events-none' : ''}>
                    <label style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1D1D1B', display: 'block', marginBottom: '6px' }} className="ml-2">
                      Email{!needsEmail && <span className="ml-2 text-xs font-normal text-slate-400">(non requis)</span>}
                    </label>
                    <input
                      type="email"
                      disabled={!needsEmail}
                      className={`w-full bg-slate-50 border-2 rounded-[10px] p-4 font-bold focus:border-[#312783] outline-none text-slate-800 ${contactErrors.email ? 'border-rose-400 bg-rose-50' : 'border-slate-100'}`}
                      placeholder={needsEmail ? 'jean@email.com' : '—'}
                      value={contact.email}
                      onChange={e => { setContact({...contact, email: e.target.value}); if (contactErrors.email) validateField('email', e.target.value); }}
                      onBlur={e => { if (e.target.value) validateField('email', e.target.value); }}
                    />
                    {contactErrors.email && <p className="text-rose-500 text-[11px] font-bold mt-1 ml-2">{contactErrors.email}</p>}
                  </div>
                </div>

                <div className="mb-6">
                  <label style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1D1D1B', display: 'block', marginBottom: '6px' }} className="ml-2">Message / Remarque (Facultatif)</label>
                  <textarea
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-[10px] p-4 font-bold outline-none focus:border-[#312783] h-24 text-slate-800"
                    placeholder="Une information à transmettre au pilote ? (ex: cadeau surprise, problème de genou...)"
                    value={contact.notes}
                    onChange={e => setContact({...contact, notes: e.target.value})}
                  />
                </div>

                <label className="flex items-center gap-3 cursor-pointer p-4 rounded-[10px] border transition-colors" style={{ backgroundColor: 'rgba(0,159,227,0.06)', borderColor: 'rgba(0,159,227,0.2)' }}>
                  <input type="checkbox" className="w-5 h-5" style={{ accentColor: '#009FE3' }} checked={contact.isPassenger} onChange={e => setContact({...contact, isPassenger: e.target.checked})} />
                  <span style={{ fontSize: '1rem', fontWeight: 700, color: '#312783' }}>Je suis aussi l'un des passagers (m'ajouter au vol)</span>
                </label>
              </div>

              {/* SECTION 2 : PASSAGERS */}
              <div>
                <h3 className="mb-6 flex items-center gap-3" style={{ fontSize: '1.25rem', fontWeight: 700, color: '#312783' }}>
                  <span className="text-white w-8 h-8 rounded-full flex items-center justify-center text-sm" style={{ backgroundColor: '#009FE3' }}>2</span>
                  Les passagers
                </h3>

                <div className="space-y-6">
                  {passengers.map((p, index) => (
                    <div key={p.id} className="bg-white border-2 border-slate-100 rounded-[10px] p-6 relative overflow-hidden group">
                      <div className="absolute top-0 left-0 w-2 h-full" style={{ backgroundColor: '#009FE3' }}></div>
                      
                      <div className="flex flex-wrap items-center gap-3 mb-5">
                        <h4 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#1D1D1B' }}>Passager {index + 1}</h4>
                        <span className="bg-slate-100 text-slate-500 px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-widest">
                          {p.flightName} • {getDayName(p.date)} à {p.time}
                        </span>
                      </div>

                      {needsName ? (
                        <div className="mb-4">
                          <label style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1D1D1B', display: 'block', marginBottom: '6px' }} className="ml-2">Prénom de la personne qui vole</label>
                          <input
                            type="text"
                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-[10px] p-4 font-bold focus:border-[#312783] outline-none text-slate-800"
                            placeholder="Prénom du passager"
                            value={p.firstName}
                            onChange={e => {
                              const newP = [...passengers];
                              newP[index].firstName = e.target.value;
                              setPassengers(newP);
                            }}
                          />
                        </div>
                      ) : (
                        <div className="mb-4 opacity-40">
                          <label style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1D1D1B', display: 'block', marginBottom: '6px' }} className="ml-2">
                            Prénom <span className="text-xs font-normal text-slate-400">(non requis — sera enregistré comme « Client {appliedPartner?.name} »)</span>
                          </label>
                          <div className="w-full bg-slate-50 border-2 border-slate-100 rounded-[10px] p-4 font-bold text-slate-400">Client {appliedPartner?.name}</div>
                        </div>
                      )}

                      {needsWeight ? (
                      <label className={`flex items-start gap-3 cursor-pointer p-4 rounded-[10px] border transition-colors mb-4 ${p.weightChecked ? 'bg-emerald-50 border-emerald-200' : hasAttemptedSubmit ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-200'}`}>
                        <input
                          type="checkbox"
                          className={`w-6 h-6 mt-0.5 ${p.weightChecked ? 'accent-emerald-500' : hasAttemptedSubmit ? 'accent-rose-500' : 'accent-slate-400'}`}
                          checked={p.weightChecked}
                          onChange={e => {
                            const newP = [...passengers];
                            newP[index].weightChecked = e.target.checked;
                            setPassengers(newP);
                          }}
                        />
                        <div>
                          <span className={`font-bold block ${p.weightChecked ? 'text-emerald-900' : hasAttemptedSubmit ? 'text-rose-900' : 'text-slate-700'}`}>
                            Je certifie peser entre {p.weight_min} et {p.weight_max} kg *
                          </span>
                          <span className={`text-xs ${p.weightChecked ? 'text-emerald-600' : hasAttemptedSubmit ? 'text-rose-500' : 'text-slate-500'}`}>
                            Information obligatoire pour des raisons de sécurité.
                          </span>
                        </div>
                      </label>
                      ) : null}

                      {complementsList.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-slate-100">
                          <p style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1D1D1B', display: 'block', marginBottom: '12px' }} className="ml-2">Options disponibles (en cas de doute, possibilité de l'ajouter le jour du vol)</p>
                          <div className="grid gap-3">
                            {complementsList.map((comp) => {
                              const isSelected = p.selectedComplements?.includes(comp.id) || false;
                              
                              // 🎯 NOUVEAU : On vérifie si cette option est couverte par le bon cadeau
                              let isLockedByVoucher = false;
                              const currentFlight = flights.find(f => f.id.toString() === p.flightId);

                              if (appliedVoucher && appliedVoucher.type === 'gift_card' && currentFlight) {
                                const isSameFlight = !appliedVoucher.flight_type_id || appliedVoucher.flight_type_id.toString() === p.flightId;
                                if (isSameFlight) {
                                  const vVal = Number(appliedVoucher.price_paid_cents) / 100;
                                  const fPri = currentFlight.price_cents / 100;
                                  const pPri = comp.price_cents / 100;
                                  // Si le bon paie le vol + cette option, on verrouille !
                                  if (vVal >= (fPri + pPri)) {
                                    isLockedByVoucher = true;
                                  }
                                }
                              }

                              // GoPro incluse dans le vol : verrouillage
                              const isLockedByActivity = !!(currentFlight?.activity_gopro && (
                                comp.name.toLowerCase().includes('photo') ||
                                comp.name.toLowerCase().includes('vidéo') ||
                                comp.name.toLowerCase().includes('video') ||
                                comp.name.toLowerCase().includes('gopro')
                              ));
                              const isLocked = isLockedByVoucher || isLockedByActivity;

                              return (
                                <label
                                  key={comp.id}
                                  className={`flex items-start gap-3 p-4 rounded-[10px] border transition-colors ${isLocked ? 'opacity-80 cursor-not-allowed' : 'cursor-pointer'} ${isSelected && !isLocked ? 'bg-slate-50' : (!isLocked ? 'bg-slate-50 border-slate-100' : '')}`}
                                  style={
                                    isLocked ? { backgroundColor: 'rgba(49,39,131,0.04)', borderColor: 'rgba(49,39,131,0.2)' } :
                                    isSelected ? { borderColor: '#312783', backgroundColor: 'rgba(49,39,131,0.05)' } : {}
                                  }
                                >
                                  <input
                                    type="checkbox"
                                    className={`w-6 h-6 mt-0.5 accent-sky-500 ${isLocked ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                                    checked={isSelected}
                                    disabled={isLocked}
                                    onChange={(e) => {
                                      if (isLocked) return;
                                      const newP = [...passengers];
                                      newP[index] = { ...newP[index] };
                                      const selected = newP[index].selectedComplements || [];

                                      if (e.target.checked) {
                                        newP[index].selectedComplements = [...selected, comp.id];
                                      } else {
                                        newP[index].selectedComplements = selected.filter((id: number) => id !== comp.id);
                                      }
                                      setPassengers(newP);
                                    }}
                                  />
                                  <div className="flex-1 flex items-center gap-4">
                                    {comp.image_url && (
                                      <div className={`w-10 h-10 shrink-0 bg-white rounded-[5px] p-1 border flex items-center justify-center shadow-sm ${isLocked ? 'border-sky-200' : 'border-slate-200'}`}>
                                        <img src={comp.image_url} alt={comp.name} className="w-full h-full object-contain" />
                                      </div>
                                    )}

                                    <div>
                                      <span className={`font-bold block ${isSelected ? 'text-sky-900' : 'text-slate-700'}`}>
                                        {comp.name} <span className={isLocked ? 'text-emerald-600' : ''}>
                                          {isLockedByActivity ? '(Inclus dans le vol)' : isLockedByVoucher ? '(Inclus dans le Bon)' : `(+${comp.price_cents / 100}€)`}
                                        </span>
                                      </span>
                                      {comp.description && (
                                        <span className="text-xs text-slate-500 mt-1 block leading-tight">
                                          {comp.description}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      )}

                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* --- PANIER FAB + PANNEAU --- */}
      {totalItems > 0 && (step === 1 || step === 2 || step === 3) && (
        <>
          {/* Backdrop */}
          {cartOpen && (
            <div
              className="fixed inset-0 z-[9997] bg-black/30 backdrop-blur-sm"
              onClick={() => setCartOpen(false)}
            />
          )}

          {/* Panneau expansible */}
          {cartOpen && (
            <div
              ref={cartBarRef}
              className="fixed z-[9998] bg-white rounded-2xl shadow-2xl"
              style={{ bottom: '80px', right: '16px', width: 'min(360px, calc(100vw - 32px))' }}
            >
              {/* En-tête */}
              <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-slate-100">
                <span style={{ fontWeight: 700, color: '#312783', fontSize: '1rem' }}>
                  {totalItems} vol{totalItems > 1 ? 's' : ''} sélectionné{totalItems > 1 ? 's' : ''}
                </span>
                <button onClick={() => setCartOpen(false)} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors">
                  <X size={16} color="#94a3b8" />
                </button>
              </div>

              {/* Champs manquants — affiché uniquement à l'étape 3 si formulaire incomplet */}
              {step === 3 && missingFields.length > 0 && (
                <div className="mx-4 mt-3 rounded-[10px] border border-amber-200 bg-amber-50 px-3 py-2">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertCircle size={13} color="#f59e0b" />
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#92400e' }}>À compléter avant de payer :</span>
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '16px' }}>
                    {missingFields.map((f, i) => (
                      <li key={i} style={{ fontSize: '0.72rem', color: '#92400e', lineHeight: 1.6 }}>{f}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Articles */}
              <div className="px-4 py-3 flex flex-col gap-2 max-h-48 overflow-y-auto custom-scrollbar">
                {Object.entries(cart).map(([key, qty]) => {
                  if (qty === 0) return null;
                  const [fId, dStr, tStr] = key.split('|');
                  const f = flights.find(fl => fl.id.toString() === fId);
                  const slotCapacity = gridData[dStr]?.[tStr] ?? 0;
                  const atCapacity = slotCapacity <= 0;
                  return (
                    <div key={key} className="bg-slate-50 rounded-[10px] pl-3 pr-2 py-2 flex items-center justify-between gap-2 text-xs font-bold text-slate-700 border border-slate-200">
                      <span className="flex-1 min-w-0 truncate">{f?.name} <span className="text-slate-400 font-normal">({tStr})</span> × <span style={{ color: '#009FE3' }}>{qty}</span></span>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => handleDecrementCart(key)} className="w-6 h-6 bg-white border border-slate-200 rounded-[5px] flex items-center justify-center hover:text-rose-500 transition-colors" title="Enlever 1">−</button>
                        <button onClick={() => handleIncrementCart(key)} disabled={atCapacity} className={`w-6 h-6 bg-white border rounded-[5px] flex items-center justify-center transition-colors ${atCapacity ? 'border-slate-100 text-slate-300 cursor-not-allowed' : 'border-slate-200 hover:text-emerald-500'}`} title="Ajouter 1"><Plus size={12} /></button>
                        <button onClick={() => handleDeleteCartItem(key)} className="w-6 h-6 bg-rose-50 rounded-[5px] flex items-center justify-center text-rose-400 hover:bg-rose-500 hover:text-white transition-colors" title="Supprimer cette ligne"><Trash2 size={12} /></button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Options sélectionnées */}
              {step === 3 && (() => {
                const compCounts: Record<number, number> = {};
                passengers.forEach(p => {
                  (p.selectedComplements || []).forEach((id: number) => {
                    compCounts[id] = (compCounts[id] || 0) + 1;
                  });
                });
                const entries = Object.entries(compCounts);
                if (entries.length === 0) return null;
                return (
                  <div className="px-4 pb-2 flex flex-col gap-1.5">
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Options</span>
                    {entries.map(([idStr, count]) => {
                      const comp = complementsList.find(c => c.id === parseInt(idStr));
                      if (!comp) return null;
                      return (
                        <div key={idStr} className="bg-slate-50 rounded-[10px] px-3 py-2 flex items-center justify-between gap-2 text-xs font-bold text-slate-700 border border-slate-200">
                          <span className="flex-1 min-w-0 truncate">{comp.name} × <span style={{ color: '#009FE3' }}>{count}</span></span>
                          <span style={{ color: '#94a3b8', fontWeight: 600 }}>+{(comp.price_cents / 100 * count).toFixed(0)} €</span>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {/* Total + bouton */}
              <div className="px-4 pb-4 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between mb-3">
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Total</span>
                  <div className="text-right">
                    {discountAmount > 0 && (
                      <span className="text-sm font-bold text-rose-400 line-through mr-2">{originalPrice.toFixed(2)} €</span>
                    )}
                    <span className="text-2xl font-bold" style={{ color: '#009FE3' }}>{finalPrice.toFixed(2)} €</span>
                  </div>
                </div>

                {step === 3 ? (
                  <button
                    onClick={handleSubmit}
                    disabled={!isFormValid || isCheckingOut}
                    className={`w-full py-3 rounded-[8px] font-bold uppercase text-xs tracking-widest transition-all shadow-md ${isFormValid && !isCheckingOut ? 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-emerald-500/30' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                  >
                    {isCheckingOut ? 'Validation...' : (finalPrice === 0 ? '✨ Valider (Gratuit)' : '🔒 Payer la réservation')}
                  </button>
                ) : (
                  <button
                    onClick={() => { setStep(3); setCartOpen(false); }}
                    className="w-full text-white py-3 rounded-[8px] transition-all font-bold"
                    style={{ backgroundColor: '#E6007E', fontSize: '0.95rem' }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#312783')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#E6007E')}
                  >
                    Passer à l'inscription
                  </button>
                )}

                <button
                  onClick={handleClearCart}
                  className="w-full flex items-center justify-center gap-2 mt-3 py-2 rounded-[8px] border border-rose-100 text-rose-400 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-colors"
                  style={{ fontSize: '0.78rem', fontWeight: 600 }}
                >
                  <Trash2 size={13} />
                  Vider le panier
                </button>

                <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.68rem', marginTop: '8px' }}>
                  En finalisant, vous acceptez nos <a href="https://www.fluide-parapente.fr/cgv/" target="_blank" rel="noopener" style={{ color: '#312783', textDecoration: 'underline' }}>CGV</a> et notre <a href="/politique-confidentialite" target="_blank" rel="noopener" style={{ color: '#312783', textDecoration: 'underline' }}>politique de confidentialité</a>.
                </p>
              </div>
            </div>
          )}

          {/* FAB */}
          {(() => {
            const fabBg = step === 3 ? (isFormValid ? '#E6007E' : '#94a3b8') : '#E6007E';
            const hasDiscount = discountAmount > 0;
            return (
              <div className="fixed z-[9999]" style={{ bottom: '20px', right: '16px' }}>
                <div className="flex items-center gap-2">
                  {step === 3 && !cartOpen && (
                    <button
                      onClick={isFormValid ? handleSubmit : () => setCartOpen(true)}
                      disabled={!!isFormValid && isCheckingOut}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-full shadow-lg transition-all active:scale-95 whitespace-nowrap"
                      style={{ backgroundColor: isFormValid ? '#E6007E' : '#94a3b8', color: 'white', fontSize: '13px', fontWeight: 700, border: 'none', cursor: 'pointer' }}
                    >
                      {isCheckingOut ? 'Validation...' : (isFormValid ? (finalPrice === 0 ? '✨ Valider (Gratuit) →' : 'Payer la réservation →') : 'Voir le récapitulatif →')}
                    </button>
                  )}
                  {/* Bouton FAB — position relative pour centrer l'étiquette prix */}
                  <div className="relative">
                    {step === 3 && !cartOpen && (
                      <svg
                        width="96"
                        height={hasDiscount ? 60 : 50}
                        viewBox={`-1 ${hasDiscount ? 4 : 5} 26 ${hasDiscount ? 16 : 14}`}
                        style={{ display: 'block', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.08))', cursor: 'pointer', position: 'absolute', bottom: 'calc(100% + 4px)', left: '50%', transform: 'translateX(-50%)' }}
                        onClick={isFormValid ? handleSubmit : () => setCartOpen(true)}
                      >
                        <g transform="rotate(45 12 12)">
                          <path
                            d="m4 20c1.88 1.88 4.54 1 6 2.5l12.5-12.5c-1.5-1.46-.62-4.12-2.5-6s-4.54-1-6-2.5l-12.5 12.5c1.5 1.46.62 4.12 2.5 6z"
                            fill="#e8eaed"
                            stroke="#94a3b8"
                            strokeOpacity={0.4}
                            strokeWidth="0.5"
                            strokeLinejoin="round"
                            strokeLinecap="round"
                          />
                        </g>
                        {hasDiscount && (
                          <text x="12" y="9.5" textAnchor="middle" dominantBaseline="middle" fontSize="2.8" fontWeight="700" fill="#94a3b8" style={{ textDecoration: 'line-through' }}>
                            {originalPrice.toFixed(2)} €
                          </text>
                        )}
                        <text x="12" y={hasDiscount ? 14 : 12} textAnchor="middle" dominantBaseline="middle" fontSize="4" fontWeight="800" fill="#E6007E">
                          {finalPrice.toFixed(2)} €
                        </text>
                      </svg>
                    )}
                  <button
                    onClick={step === 3 && isFormValid ? handleSubmit : () => setCartOpen(o => !o)}
                    disabled={step === 3 && !!isFormValid && isCheckingOut}
                    className="relative flex items-center justify-center shadow-xl transition-all active:scale-95"
                    style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: fabBg, border: 'none', cursor: 'pointer' }}
                    aria-label={step === 3 && isFormValid ? 'Payer la réservation' : 'Voir le panier'}
                  >
                    <ShoppingCart size={24} color="white" strokeWidth={2} />
                    {step !== 3 && (
                      <span
                        className="absolute flex items-center justify-center font-bold"
                        style={{ top: '-4px', right: '-4px', minWidth: '20px', height: '20px', borderRadius: '10px', backgroundColor: '#312783', color: 'white', fontSize: '11px', padding: '0 4px' }}
                      >
                        {totalItems}
                      </span>
                    )}
                  </button>
                  </div>{/* fin relative FAB wrapper */}
                </div>{/* fin flex items-center */}
              </div>
            );
          })()}
        </>
      )}
      {/* 🎯 POPUP D'INFORMATION SUR LE VOL */}
      {infoFlight && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm" onClick={() => setInfoFlight(null)}>

          {/* role="dialog" + aria-modal indique aux lecteurs d'écran que c'est une fenêtre modale */}
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="info-flight-dialog-title"
            className="bg-white rounded-[10px] shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh] animate-in zoom-in-95"
            onClick={e => e.stopPropagation()}
          >
            
            {/* 🎯 2. L'en-tête (Fixe en haut) */}
            <div className="p-6 md:p-8 pb-4 shrink-0 flex justify-between items-start border-b border-slate-100">
              {/* Le pr-4 (padding-right) empêche le titre de déborder sur la croix */}
              <h3 id="info-flight-dialog-title" className="text-2xl font-bold pr-4" style={{ color: '#312783' }}>À propos de ce vol</h3>
              
              <button 
                onClick={() => setInfoFlight(null)} 
                className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-rose-100 hover:text-rose-500 transition-colors shrink-0 cursor-pointer active:scale-95"
                aria-label="Fermer"
              >
                {/* 🎯 Une vraie icône vectorielle au lieu d'un caractère texte */}
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* 🎯 3. Le contenu (Avec défilement interne activé via overflow-y-auto) */}
            <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar relative">
              
              <div className="relative prose prose-sm max-w-none text-slate-600 whitespace-pre-wrap font-medium leading-relaxed bg-slate-50 p-6 md:p-8 rounded-[10px] border border-slate-100 overflow-hidden shadow-inner">
                
                {/* 🎯 4. Le filigrane ultra-léger (10% d'opacité) placé en arrière-plan du texte */}
                {infoFlight.image_url && (
                  <div 
                    className="absolute inset-0 bg-cover bg-center opacity-10 pointer-events-none" 
                    style={{ backgroundImage: `url(${cloudinaryOptimize(infoFlight.image_url, 800, 600)})` }}
                  />
                )}
                
                {/* Le texte formaté par-dessus le filigrane */}
                <div className="relative z-10 text-base">
                  {infoFlight.popup_content && infoFlight.popup_content.split(/(\*\*.*?\*\*)/g).map((part: string, i: number) => 
                    part.startsWith('**') && part.endsWith('**') 
                      ? <strong key={i} className="font-black text-slate-900">{part.slice(2, -2)}</strong> 
                      : part
                  )}
                </div>
              </div>
              
              <button
                onClick={(e) => { e.stopPropagation(); setInfoFlight(null); }}
                className="mt-8 w-full text-white py-4 rounded-[5px] uppercase tracking-widest transition-colors shadow-md shrink-0 active:scale-[0.98]"
                style={{ fontSize: '1.125rem', fontWeight: 700, backgroundColor: '#E6007E' }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#312783')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#E6007E')}
              >
                J'ai compris
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}