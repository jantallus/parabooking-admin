"use client";
import { useEffect, useState, useLayoutEffect, useRef } from 'react';

const PHONE = '0677285102';
const WHATSAPP = 'https://wa.me/33677285102';
const API = process.env.NEXT_PUBLIC_API_URL || 'https://api.parabooking.app';

interface FlightType { id: number; name: string; price_cents: number; season?: string; }

const currentSeason = (): string => {
  const m = new Date().getMonth(); // 0-11, même logique que la page /booking
  return (m >= 8 || m <= 3) ? 'WINTER' : 'SUMMER';
};

const emptyForm = () => ({
  flight_type: '',
  nb_passengers: 1,
  weight_info: '',
  availability_start: '',
  availability_end: '',
  name: '',
  phone: '',
  email: '',
  notes: '',
  cgv: false,
});

export default function BackToTop() {
  const [visible, setVisible] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [phoneMenuOpen, setPhoneMenuOpen] = useState(false);
  const [flightTypes, setFlightTypes] = useState<FlightType[]>([]);
  const [form, setForm] = useState(emptyForm());
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 800);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useLayoutEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Charger les types de vol quand la modale s'ouvre
  useEffect(() => {
    if (!formOpen || flightTypes.length > 0) return;
    fetch(`${API}/api/public/fluide/flight-types`)
      .then(r => r.ok ? r.json() : [])
      .then(setFlightTypes)
      .catch(() => {});
  }, [formOpen, flightTypes.length]);

  // Fermer sur Escape
  useEffect(() => {
    if (!formOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeForm(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [formOpen]);

  const openForm = () => { setForm(emptyForm()); setSent(false); setError(''); setFormOpen(true); };
  const closeForm = () => setFormOpen(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.cgv) { setError('Veuillez accepter les CGV pour continuer.'); return; }
    if (!form.name && !form.phone && !form.email) { setError('Merci de renseigner au moins votre nom, téléphone ou email.'); return; }
    setSending(true);
    setError('');
    try {
      const body = {
        name: form.name || undefined,
        phone: form.phone || undefined,
        email: form.email || undefined,
        flight_type: form.flight_type || undefined,
        nb_passengers: form.nb_passengers,
        weight_info: form.weight_info || undefined,
        availability_start: form.availability_start || undefined,
        availability_end: form.availability_end || form.availability_start || undefined,
        notes: form.notes || undefined,
      };
      const res = await fetch(`${API}/api/public/fluide/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Une erreur est survenue. Veuillez réessayer.');
      } else {
        setSent(true);
      }
    } catch {
      setError('Impossible d\'envoyer la demande. Vérifiez votre connexion.');
    } finally {
      setSending(false);
    }
  };

  const set = (k: string, v: string | number | boolean) => setForm(f => ({ ...f, [k]: v }));

  const btn = (id: string, alwaysVisible = false): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    backgroundColor: hovered === id ? '#312783' : '#E6007E',
    width: '40px', height: '40px', borderRadius: '100%', cursor: 'pointer',
    opacity: alwaysVisible || visible ? 1 : 0,
    visibility: alwaysVisible || visible ? 'visible' : 'hidden',
    transition: 'background-color 0.3s, opacity 0.5s, visibility 0.5s',
    border: 'none', textDecoration: 'none', flexShrink: 0,
  });

  return (
    <>
      {/* Pile de boutons flottants */}
      <div style={{ position: 'fixed', bottom: '40px', right: '20px', zIndex: 1000, display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center' }}>

        {/* Téléphone (mobile) — popup au tap */}
        {!isDesktop && (
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setPhoneMenuOpen(o => !o)}
              style={btn('tel', true)}
              onPointerEnter={() => setHovered('tel')} onPointerLeave={() => setHovered(null)}
              aria-label="Contact"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.62 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>
              </svg>
            </button>
            {phoneMenuOpen && (
              <>
                {/* Overlay invisible pour fermer */}
                <div onClick={() => setPhoneMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 999 }} />
                <div style={{ position: 'absolute', bottom: '50px', right: 0, backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 8px 30px rgba(0,0,0,0.18)', overflow: 'hidden', zIndex: 1001, minWidth: '180px' }}>
                  <a href={`tel:${PHONE}`} onClick={() => setPhoneMenuOpen(false)}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '13px 16px', color: '#1e293b', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 600, borderBottom: '1px solid #f1f5f9' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E6007E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.62 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                    Appeler
                  </a>
                  <a href={`sms:${PHONE}`} onClick={() => setPhoneMenuOpen(false)}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '13px 16px', color: '#1e293b', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 600, borderBottom: '1px solid #f1f5f9' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E6007E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                    Envoyer un SMS
                  </a>
                  <a href={WHATSAPP} target="_blank" rel="noopener noreferrer" onClick={() => setPhoneMenuOpen(false)}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '13px 16px', color: '#1e293b', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 600 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>
                    WhatsApp
                  </a>
                </div>
              </>
            )}
          </div>
        )}

        {/* WhatsApp (desktop uniquement) — au-dessus du formulaire */}
        {isDesktop && (
          <a href={WHATSAPP} target="_blank" rel="noopener noreferrer" style={btn('wa', true)}
            onPointerEnter={() => setHovered('wa')} onPointerLeave={() => setHovered(null)}
            aria-label="WhatsApp">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
            </svg>
          </a>
        )}

        {/* Bouton demande de vol — toujours visible */}
        <button onClick={openForm} style={btn('form', true)}
          onPointerEnter={() => setHovered('form')} onPointerLeave={() => setHovered(null)}
          aria-label="Être rappelé">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="8" y1="13" x2="16" y2="13"/>
            <line x1="8" y1="17" x2="13" y2="17"/>
          </svg>
        </button>

        {/* Retour en haut — visible après scroll */}
        <span onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          onPointerEnter={() => setHovered('top')} onPointerLeave={() => setHovered(null)}
          style={{ ...btn('top'), position: 'relative' }}>
          <img src="/backtotop.svg" alt="Retour en haut" style={{ width: '17px', height: '17px', position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />
        </span>
      </div>

      {/* Modale formulaire */}
      {formOpen && (
        <div
          onClick={e => { if (e.target === e.currentTarget) closeForm(); }}
          style={{ position: 'fixed', inset: 0, zIndex: 2000, backgroundColor: 'rgba(49,39,131,0.45)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
        >
          <div ref={modalRef} style={{ backgroundColor: 'white', borderRadius: '16px', width: '100%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>

            {/* En-tête */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 20px 0' }}>
              <div>
                <p style={{ margin: 0, fontSize: '0.65rem', fontWeight: 700, color: '#E6007E', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Fluide Parapente</p>
                <h2 style={{ margin: '2px 0 0', fontSize: '1.15rem', fontWeight: 800, color: '#312783' }}>Être rappelé</h2>
                <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: '#64748b', lineHeight: 1.4 }}>Vous préférez qu'on s'occupe de tout&nbsp;? Laissez-nous vos disponibilités et on vous contacte sous 24h.</p>
              </div>
              <button onClick={closeForm} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '4px', lineHeight: 1 }} aria-label="Fermer">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>

            {sent ? (
              <div style={{ padding: '32px 20px 24px', textAlign: 'center' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <p style={{ fontWeight: 800, fontSize: '1.05rem', color: '#312783', margin: '0 0 8px' }}>Demande envoyée !</p>
                <p style={{ color: '#64748b', fontSize: '0.9rem', margin: '0 0 24px', lineHeight: 1.5 }}>Votre demande a bien été reçue. Nous vous contacterons dans les 24h pour confirmer votre créneau.</p>
                <button onClick={closeForm} style={{ backgroundColor: '#E6007E', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 24px', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}>Fermer</button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ padding: '16px 20px 24px' }}>

                {/* Type de vol */}
                <div style={{ marginBottom: '14px' }}>
                  <label style={labelStyle}>Type de vol</label>
                  <select value={form.flight_type} onChange={e => set('flight_type', e.target.value)} style={inputStyle}>
                    <option value="">— Choisir un vol —</option>
                    {(() => {
                      const saison = currentSeason();
                      const labels: Record<string, string> = { WINTER: '❄️ Hiver', SUMMER: '☀️ Été' };
                      const ordre = saison === 'WINTER' ? ['WINTER', 'SUMMER'] : ['SUMMER', 'WINTER'];
                      return ordre.map(s => {
                        const vols = flightTypes.filter(ft => {
                          const season = ft.season ?? 'ALL';
                          if (season === 'ALL') return s === ordre[0]; // toute l'année → dans le 1er groupe
                          return season === s;
                        });
                        if (!vols.length) return null;
                        return (
                          <optgroup key={s} label={labels[s]}>
                            {vols.map(ft => (
                              <option key={ft.id} value={ft.name}>{ft.name} — {ft.price_cents / 100}€</option>
                            ))}
                          </optgroup>
                        );
                      });
                    })()}
                  </select>
                </div>

                {/* Nb passagers + poids */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
                  <div>
                    <label style={labelStyle}>Nombre de passagers</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button type="button" onClick={() => set('nb_passengers', Math.max(1, form.nb_passengers - 1))} style={stepperBtn}>−</button>
                      <span style={{ minWidth: '24px', textAlign: 'center', fontWeight: 700, color: '#312783' }}>{form.nb_passengers}</span>
                      <button type="button" onClick={() => set('nb_passengers', Math.min(8, form.nb_passengers + 1))} style={stepperBtn}>+</button>
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>Poids {form.nb_passengers > 1 ? '(ex: 65 / 70 kg)' : '(kg)'}</label>
                    <input type="text" value={form.weight_info} onChange={e => set('weight_info', e.target.value)} placeholder={form.nb_passengers > 1 ? '65 / 70 / 45' : '65'} style={inputStyle} />
                  </div>
                </div>

                {/* Période de séjour */}
                <div style={{ marginBottom: '14px' }}>
                  <label style={labelStyle}>Période de séjour</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: '6px' }}>
                    <input type="date" value={form.availability_start} onChange={e => set('availability_start', e.target.value)} style={inputStyle} />
                    <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600 }}>→</span>
                    <input type="date" value={form.availability_end} min={form.availability_start || undefined} onChange={e => set('availability_end', e.target.value)} style={inputStyle} />
                  </div>
                </div>

                {/* Nom */}
                <div style={{ marginBottom: '14px' }}>
                  <label style={labelStyle}>Nom complet</label>
                  <input type="text" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Prénom Nom" style={inputStyle} />
                </div>

                {/* Téléphone + Email */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
                  <div>
                    <label style={labelStyle}>Téléphone</label>
                    <input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="06 77 28 51 02" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Email</label>
                    <input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="vous@email.fr" style={inputStyle} />
                  </div>
                </div>

                {/* Message */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={labelStyle}>Message (facultatif)</label>
                  <textarea value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Questions, préférences d'horaire…" rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
                </div>

                {/* CGV */}
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', marginBottom: '16px' }}>
                  <input type="checkbox" checked={form.cgv} onChange={e => set('cgv', e.target.checked)} style={{ marginTop: '2px', accentColor: '#E6007E', flexShrink: 0 }} />
                  <span style={{ fontSize: '0.78rem', color: '#64748b', lineHeight: 1.4 }}>
                    J'ai lu et j'accepte les{' '}
                    <a href="https://www.fluide-parapente.fr/cgv/" target="_blank" rel="noopener" style={{ color: '#312783', fontWeight: 700 }}>CGV</a>
                    {' '}et je confirme être en bonne condition physique.
                  </span>
                </label>

                {error && <p style={{ color: '#ef4444', fontSize: '0.8rem', marginBottom: '12px', fontWeight: 600 }}>{error}</p>}

                {/* Bouton + rappel paiement */}
                <button type="submit" disabled={sending} style={{ width: '100%', backgroundColor: sending ? '#c966a3' : '#E6007E', color: 'white', border: 'none', borderRadius: '8px', padding: '13px', fontWeight: 800, fontSize: '0.95rem', cursor: sending ? 'not-allowed' : 'pointer', transition: 'background-color 0.2s' }}>
                  {sending ? 'Envoi en cours…' : 'Envoyer la demande'}
                </button>

                <p style={{ textAlign: 'center', fontSize: '0.72rem', color: '#94a3b8', marginTop: '10px', marginBottom: 0 }}>
                  Paiement sur place : Espèces · Chèques-Vacances · ANCV Connect · Chèque
                </p>
                <p style={{ textAlign: 'center', fontSize: '0.72rem', marginTop: '8px', marginBottom: 0 }}>
                  Vous voulez choisir votre créneau vous-même&nbsp;?{' '}
                  <a href="/booking" style={{ color: '#312783', fontWeight: 700, textDecoration: 'underline' }}>Réserver en ligne →</a>
                </p>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#64748b',
  textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '5px',
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', border: '1.5px solid #e2e8f0', borderRadius: '8px',
  fontSize: '0.875rem', color: '#1e293b', outline: 'none', boxSizing: 'border-box',
  backgroundColor: '#f8fafc',
};

const stepperBtn: React.CSSProperties = {
  width: '28px', height: '28px', borderRadius: '6px', border: '1.5px solid #e2e8f0',
  backgroundColor: 'white', cursor: 'pointer', fontWeight: 700, fontSize: '1rem',
  color: '#312783', display: 'flex', alignItems: 'center', justifyContent: 'center',
};
