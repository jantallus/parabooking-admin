"use client";
import React, { useState, useEffect } from 'react';
import { useScrollLock } from '@/hooks/useScrollLock';
import type { GiftCardShopTemplate, Complement } from '@/lib/types';
import { useToast } from '@/components/ui/ToastProvider';
import { Clock, Wallet, MapPin, Mail, CalendarDays, Package, Sparkles, Gift } from 'lucide-react';

export default function CadeauPage() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<GiftCardShopTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<GiftCardShopTemplate | null>(null);
  
  const [buyer, setBuyer] = useState({ name: '', email: '', phone: '' });
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  // 🎯 NOUVEAU : Gestion de l'envoi postal
  const [shippingSettings, setShippingSettings] = useState({ enabled: false, price: 0 });
  const [wantsShipping, setWantsShipping] = useState(false);
  const [address, setAddress] = useState({ street: '', zip: '', city: '' });
  // 🎯 NOUVEAU : Gestion des options additionnelles
  const [complements, setComplements] = useState<Complement[]>([]);
  const [selectedComplements, setSelectedComplements] = useState<Complement[]>([]);

  const [infoTemplate, setInfoTemplate] = useState<GiftCardShopTemplate | null>(null);
  const [redemptionCode, setRedemptionCode] = useState('');
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [redemptionError, setRedemptionError] = useState('');
  const hasAutoScrolled = React.useRef(false);
  const [urlFlightName, setUrlFlightName] = useState<string | null>(null);
  // Mode direct vol (depuis page réservation, sans template boutique)
  const [directFlightId, setDirectFlightId] = useState<number | null>(null);
  const [directFlightName, setDirectFlightName] = useState<string | null>(null);
  const [directFlightPrice, setDirectFlightPrice] = useState<number | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // 1. On charge les offres
        const res = await fetch(`/api/proxy/gift-card-templates?publicOnly=true`, { cache: 'no-store' });
        if (res.ok) {
          const data: GiftCardShopTemplate[] = await res.json();
          setTemplates(data);

          // 🎯 On se contente de sélectionner le modèle, le moteur de scroll fera le reste
          const params = new URLSearchParams(window.location.search);
          const targetId = params.get('templateId');
          const incomingFlightName = params.get('flightName'); // 🎯 On lit le nom du vol

          if (targetId) {
            const found = data.find(t => t.id.toString() === targetId);
            if (found) {
              setSelectedTemplate(found);
              if (incomingFlightName) setUrlFlightName(incomingFlightName);
            }
          }

          // Mode direct vol : ?flightId=X&flightName=...&flightPrice=...
          const flightId = params.get('flightId');
          if (flightId && !targetId) {
            const fName = params.get('flightName') || '';
            const fPrice = parseInt(params.get('flightPrice') || '0') || null;
            setDirectFlightId(parseInt(flightId));
            setDirectFlightName(fName);
            setDirectFlightPrice(fPrice);
          }
        }

        // 2. On charge vos paramètres postaux
        const setRes = await fetch(`/api/proxy/public/site-settings`);
        if (setRes.ok) {
          const s = await setRes.json();
          setShippingSettings({
            enabled: s.physical_gift_card_enabled === 'true',
            price: parseInt(s.physical_gift_card_price) || 0
          });
        }
        // 🎯 3. On charge les options additionnelles (Photos, etc.)
        const compRes = await fetch(`/api/proxy/complements`);
        if (compRes.ok) {
          setComplements(await compRes.json());
        }
      } catch (err) {
        console.error("Erreur chargement boutique", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  // 🎯 MOTEUR DE DÉFILEMENT ROBUSTE (Uniquement à l'arrivée sur la page)
  useEffect(() => {
    // On ne le déclenche que si on n'a pas encore fait le saut automatique !
    if ((selectedTemplate || directFlightId) && !isLoading && !hasAutoScrolled.current) {
      hasAutoScrolled.current = true; // 🔒 On verrouille pour ne plus jamais le refaire
      
      const performScroll = () => {
        const formEl = document.getElementById('achat-form');
        if (formEl) {
          const y = formEl.getBoundingClientRect().top + window.scrollY - 60; 
          // ⚡ MAGIE : 'auto' au lieu de 'smooth'. La page se téléporte instantanément !
          window.scrollTo({ top: y, behavior: 'auto' });
        }
      };

      // ⚡ TURBO MAX : 50ms suffisent car on ne fait plus glisser la page
      const timer = setTimeout(performScroll, 50);
      return () => clearTimeout(timer);
    }
  }, [selectedTemplate, directFlightId, isLoading]);

  // 🎯 GESTION DU BOUTON RETOUR DU NAVIGATEUR (Bons Cadeaux)
  // 1. On écoute la flèche "Retour"
  useEffect(() => {
    const handlePopState = () => {
      if (!window.location.hash.includes('#personnaliser')) {
        setSelectedTemplate(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // 2. On met à jour l'URL sans recharger la page quand on clique sur un bon
  useEffect(() => {
    const expectedHash = selectedTemplate ? '#personnaliser' : '';
    const currentHash = window.location.hash;
    
    if (selectedTemplate && currentHash !== expectedHash) {
      const newUrl = window.location.pathname + window.location.search + expectedHash;
      
      // 🎯 CORRECTION : Si on arrive via le bouton "Offrir" (présence de ?templateId= dans l'URL),
      // on REMPLACE l'état actuel au lieu d'en rajouter un dans l'historique.
      // Ainsi, le bouton "Retour" ramènera directement à la page de réservation !
      if (window.location.search.includes('templateId=')) {
        window.history.replaceState({ personnalisation: true }, '', newUrl);
      } else {
        window.history.pushState({ personnalisation: true }, '', newUrl);
      }
    }
  }, [selectedTemplate]);

  useScrollLock(!!infoTemplate);

  // 🎯 SÉCURITÉ : Le formulaire vérifie aussi l'adresse si la case est cochée
  const isShippingValid = !wantsShipping || (address.street && address.zip && address.city);
  const isFormValid = buyer.name && buyer.email && buyer.phone && isShippingValid && (!!selectedTemplate || !!directFlightId);

  const handleCheckout = async () => {
    if (!isFormValid || (!selectedTemplate && !directFlightId)) return;
    setIsCheckingOut(true);

    try {
      const payload = selectedTemplate
        ? { template: selectedTemplate, buyer, physicalShipping: wantsShipping ? { enabled: true, address: `${address.street}, ${address.zip} ${address.city}` } : null, selectedComplements }
        : { flight_type_id: directFlightId, buyer, physicalShipping: wantsShipping ? { enabled: true, address: `${address.street}, ${address.zip} ${address.city}` } : null, selectedComplements };

      const res = await fetch(`/api/proxy/public/checkout-gift-card`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast.error("Erreur lors de la création du paiement.");
        setIsCheckingOut(false);
      }
    } catch (err) {
      toast.error("Erreur de connexion au serveur de paiement.");
      setIsCheckingOut(false);
    }
  };

  // 🎯 NOUVEAU : Fonction de défilement intelligente et précise
  const scrollToForm = () => {
    // Délai plus court pour le clic manuel car la page est déjà chargée
    setTimeout(() => { 
      const formEl = document.getElementById('achat-form');
      if (formEl) {
        const y = formEl.getBoundingClientRect().top + window.scrollY - 60; 
        window.scrollTo({ top: y, behavior: 'smooth' });
      }
    }, 100); 
  };

  const handleRedeemCode = async () => {
    if (!redemptionCode.trim()) return;
    setIsRedeeming(true);
    setRedemptionError('');
    try {
      const partnerRes = await fetch(`/api/proxy/public/partners/check/${redemptionCode.trim()}`);
      if (partnerRes.ok) {
        window.location.href = `/booking?bon=${encodeURIComponent(redemptionCode.trim())}`;
        return;
      }
      const res = await fetch(`/api/proxy/gift-cards/check/${redemptionCode.trim()}`);
      if (res.ok) {
        window.location.href = `/booking?bon=${encodeURIComponent(redemptionCode.trim())}`;
      } else {
        const err = await res.json();
        setRedemptionError(err.message || 'Code invalide ou expiré');
        setIsRedeeming(false);
      }
    } catch {
      setRedemptionError('Erreur de connexion.');
      setIsRedeeming(false);
    }
  };

  const inputStyle = { width: '100%', padding: '15px', borderRadius: '10px', border: '2px solid #e2e8f0', fontSize: '1rem', fontWeight: 700, outline: 'none' };
  
  // Calcul du prix total affiché sur le bouton
  const optionsPrice = selectedComplements.reduce((sum, c) => sum + (c.price_cents / 100), 0);
  const basePriceCents = selectedTemplate ? selectedTemplate.price_cents : (directFlightPrice ?? 0);
  const totalPrice = (basePriceCents / 100) + (wantsShipping ? shippingSettings.price : 0) + optionsPrice;

  return (
    <main className="main-bons-cadeaux" style={{ width: '100%', overflowX: 'hidden', position: 'relative' }}>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes ultraSmoothReveal { 0% { opacity: 0; transform: translateY(40px); } 100% { opacity: 1; transform: translateY(0); } }
        .hero-animation-block { will-change: transform, opacity; animation: ultraSmoothReveal 1s cubic-bezier(0.16, 1, 0.3, 1) forwards; animation-fill-mode: forwards; }
        .btn-page-action { background-color: #E6007E !important; color: white !important; border: 2px solid #E6007E !important; transition: background-color 0.3s ease, border-color 0.3s ease !important; padding: 12px 17px; border-radius: 5px; text-decoration: none; font-weight: 700; display: inline-block; font-size: 1.125rem; cursor: pointer; }
        .btn-page-action:hover { background-color: #312783 !important; border-color: #312783 !important; }
        .content-section { display: flex; align-items: center; gap: 60px; max-width: 1400px; margin: 0 auto; padding: 70px 4vw; }
        .main-bons-cadeaux { margin-top: -90px; }
        @media (max-width: 1024px) { .main-bons-cadeaux { margin-top: 0; } }
        .hero-cadeau { background: transparent !important; }
        .card-template .btn-choisir { background-color: #E6007E; transition: background-color 0.3s ease; }
        .card-template .btn-choisir:hover { background-color: #312783; }
        @media (max-width: 1024px) { .content-section { flex-direction: column; text-align: center; } .hero-cadeau { padding-left: 0 !important; padding-top: 0 !important; height: calc(60vh + 100px) !important; justify-content: center; align-items: center !important; } .hero-cadeau .hero-animation-block { text-align: center; padding: 0 6vw; } .hero-cadeau .hero-animation-block h1 { font-size: 3.2rem !important; line-height: 1.1 !important; } .hero-cadeau .hero-animation-block p { font-size: 1.9rem !important; } .cadeau-grad-bg { display: none !important; } .cadeau-heatmap { mix-blend-mode: normal !important; opacity: 1 !important; } .hero-cadeau::before { content: ''; position: absolute; inset: 0; background: rgba(20, 10, 80, 0.28); z-index: 5; pointer-events: none; } }
      `}} />

      <section className="hero-cadeau" style={{
          position: 'relative', width: '100%', height: '450px',
          display: 'flex', alignItems: 'flex-start',
          paddingLeft: 'max(calc(4vw + 20px), calc((100vw - 1240px) / 2 + 20px))',
          paddingTop: '200px',
          overflow: 'hidden',
        }}>
        {/* Couche 1 : dégradé CSS lisse (remplace bg-fond.png) */}
        <div className="cadeau-grad-bg" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, #4D5EBE 0%, #B8C2EE 100%)', zIndex: 1 }} />
        {/* Couche 2 : bg-heatmap */}
        <div className="cadeau-heatmap" style={{ position: 'absolute', inset: 0, backgroundImage: 'url(/bg-heatmap.svg)', backgroundSize: 'cover', backgroundPosition: 'center', zIndex: 2, mixBlendMode: 'multiply', opacity: 0.82, filter: 'saturate(1.25)' }} />
        {/* Couche 3 : très léger voile fuchsia + assombrissement en bas */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(230, 0, 126, 0.13) 0%, transparent 45%)', zIndex: 3 }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0, 0, 0, 0.18) 0%, transparent 40%)', zIndex: 4 }} />
        <div className="hero-animation-block" style={{ position: 'relative', zIndex: 10 }}>
          <h1 style={{ color: 'white', fontSize: 'clamp(2.5rem, 7vw, 4.375rem)', fontWeight: 700, margin: 0, lineHeight: 1.0, textTransform: 'none' }}>Cartes cadeaux</h1>
          <p style={{ color: 'white', fontSize: 'clamp(1.44rem, 2.62vw, 1.88rem)', fontWeight: 400, marginTop: '15px', lineHeight: 1.2, opacity: 0.9, textTransform: 'none' }}>Faites plaisir ou faites-vous plaisir&nbsp;!</p>
        </div>
      </section>


      <section id="boutique" style={{ backgroundColor: '#FFFFFF', padding: '100px 4vw' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '60px' }}>
            <h2 style={{ fontSize: '3rem', fontWeight: 700, color: '#312783', marginBottom: '15px' }}>Choisissez votre bon cadeau</h2>
            <p style={{ color: '#1D1D1B', fontSize: '1.125rem', fontWeight: 400 }}>Sélectionnez l'offre de votre choix pour la personnaliser.</p>
          </div>

          {/* 💡 BANDEAU DE RÉASSURANCE BONS CADEAUX */}
          <div className="max-w-7xl mx-auto mb-12 rounded-[10px] p-6 shadow-sm backdrop-blur-sm" style={{ backgroundColor: 'rgba(49,39,131,0.04)', border: '1px solid rgba(49,39,131,0.1)' }}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">

              <div className="flex items-start gap-4">
                <div className="flex items-center justify-center shrink-0" style={{ color: '#312783' }}><Mail size={28} strokeWidth={1.5} /></div>
                <div>
                  <h4 style={{ color: '#312783', fontSize: '1.25rem', fontWeight: 700, marginBottom: '4px' }}>Code & PDF immédiats</h4>
                  <p style={{ color: '#1D1D1B', fontSize: '1.125rem', fontWeight: 400, lineHeight: '26px' }}>
                    Dès le paiement validé, vous recevrez par email un joli bon cadeau au format PDF contenant un code unique à offrir.
                  </p>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-3" style={{ marginBottom: '10px' }}>
                  <div style={{ color: '#312783' }}><Gift size={24} strokeWidth={1.5} /></div>
                  <h4 style={{ color: '#312783', fontSize: '1.25rem', fontWeight: 700 }}>J'ai déjà un bon cadeau</h4>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    placeholder="Ex: FLUIDE-1234"
                    value={redemptionCode}
                    onChange={e => { setRedemptionCode(e.target.value.toUpperCase()); setRedemptionError(''); }}
                    onKeyDown={e => e.key === 'Enter' && handleRedeemCode()}
                    style={{ flex: '1 1 140px', border: '2px solid rgba(49,39,131,0.2)', borderRadius: '8px', padding: '8px 12px', fontWeight: 700, fontSize: '0.875rem', outline: 'none', textTransform: 'uppercase', color: '#312783', backgroundColor: 'white' }}
                  />
                  <button
                    onClick={handleRedeemCode}
                    disabled={isRedeeming || !redemptionCode.trim()}
                    style={{ padding: '8px 16px', borderRadius: '8px', backgroundColor: redemptionCode.trim() ? '#312783' : 'rgba(49,39,131,0.3)', color: 'white', fontWeight: 700, fontSize: '0.875rem', cursor: redemptionCode.trim() ? 'pointer' : 'default', border: 'none', whiteSpace: 'nowrap' }}
                  >
                    {isRedeeming ? '…' : 'Utiliser'}
                  </button>
                </div>
                {redemptionError && <p style={{ color: '#ef4444', fontSize: '0.75rem', fontWeight: 600, marginTop: '4px' }}>{redemptionError}</p>}
              </div>

              <div className="flex items-start gap-4">
                <div className="flex items-center justify-center shrink-0" style={{ color: '#312783' }}><Package size={28} strokeWidth={1.5} /></div>
                <div>
                  <h4 style={{ color: '#312783', fontSize: '1.25rem', fontWeight: 700, marginBottom: '4px' }}>Envoi postal optionnel</h4>
                  <p style={{ color: '#1D1D1B', fontSize: '1.125rem', fontWeight: 400, lineHeight: '26px' }}>
                    Envie de marquer le coup ? Vous pourrez choisir de faire envoyer une belle carte glacée par courrier lors de l'étape de paiement.
                  </p>
                </div>
              </div>

            </div>
          </div>

          {isLoading ? (
            /* ☠️ SKELETON — même structure que les vraies cartes */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-[#F3F3F3] rounded-[16px] p-8 flex flex-col justify-between animate-pulse">
                  {/* Fausse image */}
                  <div className="w-full h-40 md:h-52 bg-slate-200/60 rounded-[10px] mb-6"></div>
                  <div>
                    {/* Faux titre */}
                    <div className="h-8 bg-slate-200/80 rounded-xl w-3/4 mb-4"></div>
                    {/* Faux tags */}
                    <div className="flex gap-2 mb-6">
                      <div className="h-6 bg-slate-100 rounded-lg w-28"></div>
                      <div className="h-6 bg-slate-100 rounded-lg w-20"></div>
                    </div>
                    {/* Fausse description */}
                    <div className="h-3 bg-slate-100 rounded-lg w-full mb-2"></div>
                    <div className="h-3 bg-slate-100 rounded-lg w-5/6 mb-2"></div>
                    <div className="h-3 bg-slate-100 rounded-lg w-4/6 mb-6"></div>
                  </div>
                  {/* Faux prix et bouton */}
                  <div className="mt-4 pt-6 border-t border-slate-100 flex items-center justify-between">
                    <div className="h-10 bg-slate-200/80 rounded-xl w-20"></div>
                    <div className="h-12 bg-slate-200/50 rounded-[10px] w-36"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : templates.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '50px 0', backgroundColor: '#F3F3F3', borderRadius: '20px' }}><p style={{ color: '#1D1D1B', fontWeight: 900 }}>Aucune offre n'est disponible.</p></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {templates.map((tpl) => (
                <div key={tpl.id} className={`card-template bg-[#F3F3F3] rounded-[10px] p-8 border flex flex-col justify-between ${selectedTemplate?.id === tpl.id ? 'border-[#E6007E]' : 'border-transparent'}`}>
                  {tpl.image_url && <div className="w-full h-40 md:h-52 bg-cover bg-center rounded-[10px] mb-6 shadow-sm border border-slate-100" style={{ backgroundImage: `url(${tpl.image_url})` }} />}
                  <div>
                    <div className="flex justify-between items-start mb-3 gap-2">
                      <h3 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#312783' }}>{tpl.title}</h3>
                      {tpl.show_popup && tpl.popup_content && (
                        <span className="relative group">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setInfoTemplate(tpl);
                            }}
                            className="w-8 h-8 shrink-0 rounded-full bg-transparent flex items-center justify-center transition-all border cursor-pointer" style={{ color: '#009FE3', borderColor: '#009FE3' }}
                            onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(0,159,227,0.1)'; }}
                            onMouseLeave={e => { e.currentTarget.style.backgroundColor = ''; }}
                          >
                            <span className="font-georgia font-serif italic font-bold text-lg leading-none" style={{ fontFamily: 'Georgia, serif' }}>i</span>
                          </button>
                          <span className="pointer-events-none absolute bottom-full right-0 mb-2 whitespace-nowrap rounded px-2 py-1 text-xs font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100" style={{ backgroundColor: '#312783' }}>Plus d'informations sur ce bon</span>
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-5 gap-y-1 mb-6">
                      <span style={{ color: '#E6007E', fontSize: '1.125rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Clock size={18} strokeWidth={1.5} />Valable {tpl.validity_months} mois</span>
                      {tpl.flight_name ? <span style={{ color: '#E6007E', fontSize: '1.125rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px' }}><MapPin size={18} strokeWidth={1.5} />{tpl.flight_name}</span> : <span style={{ color: '#E6007E', fontSize: '1.125rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Wallet size={18} strokeWidth={1.5} />Avoir libre</span>}
                    </div>
                    <p style={{ color: '#1D1D1B', fontSize: '1.125rem', fontWeight: 400, lineHeight: 1.625, marginBottom: '0.25rem' }}>{tpl.description}</p>
                  </div>
                  <div className="mt-2 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <div style={{ fontSize: '2rem', fontWeight: 700, color: '#E6007E' }}>{tpl.price_cents / 100}€</div>
                    <button
                      onClick={() => { setSelectedTemplate(tpl); setSelectedComplements([]); setUrlFlightName(null); scrollToForm(); }}
                      className="btn-choisir cursor-pointer px-6 py-4 rounded-[5px] text-white"
                      style={{ fontSize: '1.125rem', fontWeight: 700, ...(selectedTemplate?.id === tpl.id ? { backgroundColor: '#312783' } : {}) }}
                    >
                      {selectedTemplate?.id === tpl.id ? '✓ Choisi' : 'Choisir ce bon'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {(selectedTemplate || directFlightId) && (
            <div id="achat-form" style={{ marginTop: '60px', backgroundColor: 'white', borderRadius: '10px', padding: '40px', boxShadow: 'none', border: '1px solid #e2e8f0', scrollMarginTop: '100px' }}>
              <h3 style={{ fontSize: '2rem', fontWeight: 700, color: '#312783', marginBottom: '10px' }}>Personnalisez votre bon</h3>
              <p style={{ color: '#E6007E', fontSize: '1.5rem', fontWeight: 900, marginBottom: '30px' }}>
                {directFlightId
                  ? `Bon ${directFlightName || 'vol'} - ${directFlightPrice ? directFlightPrice / 100 : '?'}€`
                  : `${urlFlightName ? `Bon ${urlFlightName}` : selectedTemplate!.title} - ${selectedTemplate!.price_cents / 100}€`}
              </p>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '30px' }}>
                <div>
                  <label htmlFor="gc-buyer-name" style={{ display: 'block', fontSize: '1rem', fontWeight: 700, color: '#1D1D1B', marginBottom: '8px' }}>Qui offre ? (acheteur)</label>
                  <input id="gc-buyer-name" type="text" placeholder="Ex: Jean Dupont" value={buyer.name} onChange={e => setBuyer({...buyer, name: e.target.value})} style={inputStyle} />
                </div>
                <div>
                  <label htmlFor="gc-buyer-email" style={{ display: 'block', fontSize: '1rem', fontWeight: 700, color: '#1D1D1B', marginBottom: '8px' }}>Votre email (réception du bon)</label>
                  <input id="gc-buyer-email" type="email" placeholder="jean@email.com" value={buyer.email} onChange={e => setBuyer({...buyer, email: e.target.value})} style={inputStyle} />
                </div>
                <div>
                  <label htmlFor="gc-buyer-phone" style={{ display: 'block', fontSize: '1rem', fontWeight: 700, color: '#1D1D1B', marginBottom: '8px' }}>Votre téléphone</label>
                  <input id="gc-buyer-phone" type="tel" placeholder="06 12 34 56 78" value={buyer.phone} onChange={e => setBuyer({...buyer, phone: e.target.value})} style={inputStyle} />
                </div>
              </div>
              {/* 🎯 NOUVEAU : Les Options additionnelles */}
              {complements.length > 0 && (
                <div className="mb-8 p-6 bg-slate-50 border-2 border-slate-100 rounded-[10px] transition-all" style={{ borderRadius: '10px' }}>
                  <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#312783', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}><Sparkles size={16} strokeWidth={1.5} />Ajouter des options au bon cadeau</h4>
                  <div className="flex flex-col gap-3">
                    {complements.map(comp => {
                      const isSelected = selectedComplements.some(c => c.id === comp.id);
                      return (
                        <label key={comp.id} className={`flex items-center gap-4 p-4 border-2 cursor-pointer transition-all ${isSelected ? 'shadow-md' : 'border-slate-200 bg-white'}`} style={{ borderRadius: '10px', ...(isSelected ? { borderColor: '#312783', backgroundColor: 'rgba(49,39,131,0.05)' } : {}) }}>
                          <input type="checkbox" className="w-5 h-5 accent-sky-500" checked={isSelected} onChange={(e) => {
                            if (e.target.checked) setSelectedComplements([...selectedComplements, comp]);
                            else setSelectedComplements(selectedComplements.filter(c => c.id !== comp.id));
                          }} />
                          <div className="flex-1">
                            <span style={{ fontSize: '1rem', fontWeight: 700, color: '#1D1D1B', display: 'block', marginBottom: '2px' }}>{comp.name}</span>
                            {comp.description && <span style={{ fontSize: '0.875rem', fontWeight: 400, color: '#64748b' }}>{comp.description}</span>}
                          </div>
                          <span style={{ fontSize: '1.125rem', fontWeight: 700, color: '#312783' }}>+{comp.price_cents / 100}€</span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* 🎯 LA NOUVELLE OPTION POSTALE ! */}
              {shippingSettings.enabled && (
                <div className="mb-8 p-6 rounded-[10px] transition-all" style={{ backgroundColor: '#E8F5FC', border: '2px solid #B8DFF0' }}>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" className="w-5 h-5 accent-[#009FE3]" checked={wantsShipping} onChange={e => setWantsShipping(e.target.checked)} />
                    <span style={{ fontSize: '1.125rem', fontWeight: 700, color: '#009FE3', display: 'inline-flex', alignItems: 'center', gap: '8px' }}><Package size={20} strokeWidth={1.5} />Recevoir une carte imprimée par courrier (+{shippingSettings.price}€)</span>
                  </label>
                  
                  {wantsShipping && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                      <div className="md:col-span-2">
                        <input type="text" placeholder="Adresse postale (N° et Voie)" value={address.street} onChange={e => setAddress({...address, street: e.target.value})} style={inputStyle} />
                      </div>
                      <div>
                        <input type="text" placeholder="Code Postal" value={address.zip} onChange={e => setAddress({...address, zip: e.target.value})} style={inputStyle} />
                      </div>
                      <div>
                        <input type="text" placeholder="Ville" value={address.city} onChange={e => setAddress({...address, city: e.target.value})} style={inputStyle} />
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                <button onClick={handleCheckout} disabled={!isFormValid || isCheckingOut} className="btn-page-action" style={{ flex: 1, textAlign: 'center', opacity: (!isFormValid || isCheckingOut) ? 0.5 : 1, cursor: (!isFormValid || isCheckingOut) ? 'not-allowed' : 'pointer' }}>
                  {isCheckingOut ? 'Redirection Stripe...' : `Payer ${totalPrice}€ de façon sécurisée`}
                </button>
              </div>
              <p style={{ textAlign: 'center', color: '#1D1D1B', fontSize: '0.9rem', marginTop: '20px' }}>Le bon cadeau au format PDF vous sera de toute façon envoyé par email immédiatement après validation du paiement.</p>
              <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem', marginTop: '10px' }}>
                En finalisant votre commande, vous acceptez nos <a href="https://www.fluide-parapente.fr/cgv/" target="_blank" rel="noopener" style={{ color: '#312783', textDecoration: 'underline' }}>CGV</a> et notre <a href="/politique-confidentialite" target="_blank" rel="noopener" style={{ color: '#312783', textDecoration: 'underline' }}>politique de confidentialité</a>.
              </p>
            </div>
          )}
        </div>
      </section>
      {/* 🎯 POPUP D'INFORMATION SUR LE BON CADEAU */}
      {infoTemplate && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in" onClick={() => setInfoTemplate(null)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="info-template-dialog-title"
            className="bg-white shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh] animate-in zoom-in-95"
            style={{ borderRadius: '10px' }}
            onClick={e => e.stopPropagation()}
          >
            
            <div className="p-6 md:p-8 pb-4 shrink-0 flex justify-between items-start border-b border-slate-100">
              <h3 id="info-template-dialog-title" className="text-2xl font-black text-slate-900 pr-4">À propos de ce bon</h3>
              <button 
                onClick={(e) => { e.stopPropagation(); setInfoTemplate(null); }} 
                className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-rose-100 hover:text-rose-500 transition-colors shrink-0 cursor-pointer active:scale-95"
                aria-label="Fermer"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar relative">
              <div className="relative prose prose-sm max-w-none text-slate-600 whitespace-pre-wrap font-medium leading-relaxed bg-slate-50 p-6 md:p-8 rounded-[10px] border border-slate-100 overflow-hidden shadow-inner">
                {infoTemplate.image_url && (
                  <div 
                    className="absolute inset-0 bg-cover bg-center opacity-10 pointer-events-none" 
                    style={{ backgroundImage: `url(${infoTemplate.image_url})` }} 
                  />
                )}
                <div className="relative z-10 text-base">
                  {infoTemplate.popup_content && infoTemplate.popup_content.split(/(\*\*.*?\*\*)/g).map((part: string, i: number) => 
                    part.startsWith('**') && part.endsWith('**') 
                      ? <strong key={i} className="font-black text-slate-900">{part.slice(2, -2)}</strong> 
                      : part
                  )}
                </div>
              </div>
              
              <button
                onClick={(e) => { e.stopPropagation(); setInfoTemplate(null); }}
                className="mt-8 w-full text-white py-4 transition-colors shadow-md shrink-0 active:scale-[0.98]"
                style={{ borderRadius: '5px', fontWeight: 700, fontSize: '1.125rem', backgroundColor: '#E6007E' }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#312783')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#E6007E')}
              >
                J'ai compris
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}