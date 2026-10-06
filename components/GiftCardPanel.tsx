'use client';
import { useState, useEffect, useRef } from 'react'; // useState kept for buyer/shipping/complements
import type { Complement } from '@/lib/types';
import { useToast } from '@/components/ui/ToastProvider';
import { Sparkles, Package, X } from 'lucide-react';

interface GiftFlight {
  id: number;
  name: string;
  price_cents: number;
}

interface Props {
  flight: GiftFlight;
  qty: number;
  onQtyChange: (qty: number) => void;
  onClose: () => void;
}

export default function GiftCardPanel({ flight, qty, onQtyChange, onClose }: Props) {
  const { toast } = useToast();
  const panelRef = useRef<HTMLDivElement>(null);
  const [buyer, setBuyer] = useState({ name: '', email: '', phone: '' });
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  const [shippingSettings, setShippingSettings] = useState({ enabled: false, price: 0 });
  const [wantsShipping, setWantsShipping] = useState(false);
  const [address, setAddress] = useState({ street: '', zip: '', city: '' });
  const [complements, setComplements] = useState<Complement[]>([]);
  const [complementQuantities, setComplementQuantities] = useState<Record<number, number>>({});

  useEffect(() => {
    Promise.all([
      fetch('/api/proxy/public/site-settings').then(r => r.ok ? r.json() : null),
      fetch('/api/proxy/complements').then(r => r.ok ? r.json() : []),
    ]).then(([settings, comps]) => {
      if (settings) {
        setShippingSettings({
          enabled: settings.physical_gift_card_enabled === 'true',
          price: parseInt(settings.physical_gift_card_price) || 0,
        });
      }
      setComplements(Array.isArray(comps) ? comps : []);
    });
  }, []);

  useEffect(() => {
    if (panelRef.current) {
      const y = panelRef.current.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
    }
  }, []);

  const optionsTotal = complements.reduce((sum, c) => sum + (c.price_cents / 100) * (complementQuantities[c.id] ?? 0), 0);
  const basePrice = (flight.price_cents / 100) * qty;
  const totalPrice = basePrice + optionsTotal + (wantsShipping ? shippingSettings.price : 0);

  const isShippingValid = !wantsShipping || (address.street && address.zip && address.city);
  const isFormValid = buyer.name && buyer.email && buyer.phone && isShippingValid;

  const handleCheckout = async () => {
    if (!isFormValid) return;
    setIsCheckingOut(true);
    try {
      const shippingPayload = wantsShipping
        ? { enabled: true, address: `${address.street}, ${address.zip} ${address.city}` }
        : null;
      const selectedComplements = complements
        .filter(c => (complementQuantities[c.id] ?? 0) > 0)
        .map(c => ({ id: c.id, quantity: complementQuantities[c.id] }));

      const payload = {
        items: [{ flight_type_id: flight.id, quantity: qty }],
        buyer,
        physicalShipping: shippingPayload,
        selectedComplements,
      };

      const res = await fetch('/api/proxy/public/checkout-gift-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast.error('Erreur lors de la création du paiement.');
        setIsCheckingOut(false);
      }
    } catch {
      toast.error('Erreur de connexion au serveur de paiement.');
      setIsCheckingOut(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '15px',
    borderRadius: '10px',
    border: '2px solid #e2e8f0',
    fontSize: '1rem',
    fontWeight: 700,
    outline: 'none',
  };

  return (
    <div
      ref={panelRef}
      style={{
        marginTop: '32px',
        backgroundColor: 'white',
        borderRadius: '10px',
        padding: '32px 40px',
        border: '1px solid #e2e8f0',
        scrollMarginTop: '100px',
        position: 'relative',
      }}
    >
      <button
        onClick={onClose}
        style={{
          position: 'absolute',
          top: '16px',
          right: '16px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: '#94a3b8',
          display: 'flex',
          alignItems: 'center',
          padding: '4px',
        }}
        aria-label="Fermer"
      >
        <X size={20} />
      </button>

      <h3 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#312783', marginBottom: '20px' }}>
        Offrir ce vol en bon cadeau
      </h3>

      {/* Récap panier */}
      <div style={{ backgroundColor: '#F3F3F3', borderRadius: '10px', padding: '16px 20px', marginBottom: '30px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e2e8f0', backgroundColor: 'white' }}>
              <button
                type="button"
                onClick={() => onQtyChange(Math.max(1, qty - 1))}
                disabled={qty <= 1}
                style={{ width: '32px', height: '40px', fontSize: '1.25rem', fontWeight: 700, background: 'white', border: 'none', cursor: qty <= 1 ? 'not-allowed' : 'pointer', color: qty <= 1 ? '#cbd5e1' : '#E6007E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >−</button>
              <span style={{ minWidth: '24px', textAlign: 'center', fontWeight: 700, fontSize: '1rem', color: '#1D1D1B' }}>{qty}</span>
              <button
                type="button"
                onClick={() => onQtyChange(Math.min(10, qty + 1))}
                disabled={qty >= 10}
                style={{ width: '32px', height: '40px', fontSize: '1.25rem', fontWeight: 700, background: 'white', border: 'none', cursor: qty >= 10 ? 'not-allowed' : 'pointer', color: qty >= 10 ? '#cbd5e1' : '#E6007E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >+</button>
            </div>
            <span style={{ fontWeight: 700, color: '#1D1D1B' }}>Bon {flight.name}</span>
          </div>
          <span style={{ fontWeight: 700, color: '#E6007E', fontSize: '1.125rem', flexShrink: 0, marginLeft: '12px' }}>
            {(flight.price_cents / 100) * qty}€
          </span>
        </div>
      </div>

      {/* Formulaire acheteur */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '30px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '1rem', fontWeight: 700, color: '#1D1D1B', marginBottom: '8px' }}>Qui offre ? (acheteur)</label>
          <input type="text" placeholder="Ex: Jean Dupont" value={buyer.name} onChange={e => setBuyer({ ...buyer, name: e.target.value })} style={inputStyle} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '1rem', fontWeight: 700, color: '#1D1D1B', marginBottom: '8px' }}>Votre email (réception du bon)</label>
          <input type="email" placeholder="jean@email.com" value={buyer.email} onChange={e => setBuyer({ ...buyer, email: e.target.value })} style={inputStyle} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '1rem', fontWeight: 700, color: '#1D1D1B', marginBottom: '8px' }}>Votre téléphone</label>
          <input type="tel" placeholder="06 12 34 56 78" value={buyer.phone} onChange={e => setBuyer({ ...buyer, phone: e.target.value })} style={inputStyle} />
        </div>
      </div>

      {/* Options additionnelles */}
      {complements.length > 0 && (
        <div style={{ backgroundColor: '#f8fafc', border: '2px solid #e2e8f0', borderRadius: '10px', padding: '20px 24px', marginBottom: '20px' }}>
          <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#312783', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Sparkles size={16} strokeWidth={1.5} />Ajouter des options au bon cadeau
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {complements.map(comp => {
              const compQty = complementQuantities[comp.id] ?? 0;
              const isSelected = compQty > 0;
              const setCompQty = (n: number) =>
                setComplementQuantities(prev => ({ ...prev, [comp.id]: Math.max(0, Math.min(qty, n)) }));

              if (qty === 1) {
                return (
                  <label key={comp.id} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', cursor: 'pointer', borderRadius: '10px', border: `2px solid ${isSelected ? '#312783' : '#e2e8f0'}`, backgroundColor: 'white' }}>
                    <input type="checkbox" checked={isSelected} onChange={e => setCompQty(e.target.checked ? 1 : 0)} />
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: '1rem', fontWeight: 700, color: '#1D1D1B', display: 'block', marginBottom: '2px' }}>{comp.name}</span>
                      {comp.description && <span style={{ fontSize: '0.875rem', color: '#64748b' }}>{comp.description}</span>}
                    </div>
                    <span style={{ fontSize: '1.125rem', fontWeight: 700, color: '#312783' }}>+{comp.price_cents / 100}€</span>
                  </label>
                );
              }

              return (
                <div key={comp.id} style={{ borderRadius: '10px', border: `2px solid ${isSelected ? '#312783' : '#e2e8f0'}`, backgroundColor: 'white', padding: '12px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '1rem', fontWeight: 700, color: '#1D1D1B' }}>{comp.name}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                      <span style={{ fontSize: '1rem', fontWeight: 700, color: isSelected ? '#312783' : '#94a3b8' }}>
                        {isSelected ? `+${(comp.price_cents / 100) * compQty}€` : `+${comp.price_cents / 100}€`}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', border: '2px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                        <button type="button" onClick={() => setCompQty(compQty - 1)} disabled={compQty <= 0} style={{ width: '36px', height: '36px', fontSize: '1.25rem', fontWeight: 700, background: 'white', border: 'none', cursor: compQty <= 0 ? 'not-allowed' : 'pointer', color: compQty <= 0 ? '#cbd5e1' : '#312783', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                        <span style={{ minWidth: '28px', textAlign: 'center', fontSize: '1rem', fontWeight: 700, color: '#312783' }}>{compQty}</span>
                        <button type="button" onClick={() => setCompQty(compQty + 1)} disabled={compQty >= qty} style={{ width: '36px', height: '36px', fontSize: '1.25rem', fontWeight: 700, background: 'white', border: 'none', cursor: compQty >= qty ? 'not-allowed' : 'pointer', color: compQty >= qty ? '#cbd5e1' : '#312783', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                      </div>
                    </div>
                  </div>
                  {comp.description && <span style={{ fontSize: '0.875rem', color: '#64748b', display: 'block', marginTop: '4px' }}>{comp.description}</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Envoi postal */}
      {shippingSettings.enabled && (
        <div style={{ backgroundColor: 'white', border: `2px solid ${wantsShipping ? '#009FE3' : '#e2e8f0'}`, borderRadius: '10px', padding: '20px 24px', marginBottom: '20px' }}>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
            <input type="checkbox" style={{ marginTop: '2px' }} checked={wantsShipping} onChange={e => setWantsShipping(e.target.checked)} />
            <div>
              <span style={{ fontSize: '1.125rem', fontWeight: 700, color: '#009FE3', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <Package size={20} strokeWidth={1.5} style={{ flexShrink: 0 }} />
                Recevoir {qty > 1 ? `${qty} cartes imprimées` : 'une carte imprimée'} par courrier (+{shippingSettings.price}€)
              </span>
              {qty > 1 && <span style={{ fontSize: '0.9rem', color: '#64748b', display: 'block', marginTop: '2px' }}>Une par bon commandé</span>}
            </div>
          </label>
          {wantsShipping && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginTop: '20px' }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <input type="text" placeholder="Adresse postale (N° et Voie)" value={address.street} onChange={e => setAddress({ ...address, street: e.target.value })} style={inputStyle} />
              </div>
              <input type="text" placeholder="Code Postal" value={address.zip} onChange={e => setAddress({ ...address, zip: e.target.value })} style={inputStyle} />
              <input type="text" placeholder="Ville" value={address.city} onChange={e => setAddress({ ...address, city: e.target.value })} style={inputStyle} />
            </div>
          )}
        </div>
      )}

      {/* Bouton payer */}
      <button
        onClick={handleCheckout}
        disabled={!isFormValid || isCheckingOut}
        style={{
          width: '100%',
          padding: '14px 20px',
          borderRadius: '5px',
          backgroundColor: !isFormValid || isCheckingOut ? 'rgba(230,0,126,0.4)' : '#E6007E',
          color: 'white',
          fontWeight: 700,
          fontSize: '1.125rem',
          border: 'none',
          cursor: !isFormValid || isCheckingOut ? 'not-allowed' : 'pointer',
          transition: 'background-color 0.3s ease',
        }}
        onMouseEnter={e => { if (isFormValid && !isCheckingOut) e.currentTarget.style.backgroundColor = '#312783'; }}
        onMouseLeave={e => { if (isFormValid && !isCheckingOut) e.currentTarget.style.backgroundColor = '#E6007E'; }}
      >
        {isCheckingOut ? 'Redirection Stripe...' : `Payer ${totalPrice}€ de façon sécurisée`}
      </button>
      <p style={{ textAlign: 'center', color: '#64748b', fontSize: '0.875rem', marginTop: '16px' }}>
        Le bon cadeau au format PDF vous sera envoyé par email immédiatement après validation du paiement.
      </p>
    </div>
  );
}
