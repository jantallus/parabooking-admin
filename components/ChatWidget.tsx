'use client';

import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { X, Send } from 'lucide-react';

const FLUIDE_PRIMARY   = '#312783';
const FLUIDE_SECONDARY = '#E6007E';

interface RappelData {
  name: string;
  email: string;
  phone: string;
  flight_type?: string;
  nb_passengers?: number;
  weight_info?: string;
  availability_start?: string | null;
  availability_end?: string | null;
  notes?: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  suggestions?: string[];
  rappel?: RappelData | null;
  showContact?: boolean;
  showReviews?: boolean;
}

function renderMessage(text: string, isUser: boolean): React.ReactNode {
  const linkColor = isUser ? '#a5b4fc' : FLUIDE_PRIMARY;
  const parts = text.split(/(\[.*?\]\(https?:\/\/[^)]+\)|\*\*.*?\*\*|https?:\/\/[^\s]+)/g);
  return parts.map((token, i) => {
    const mdLink = token.match(/^\[(.*?)\]\((https?:\/\/[^)]+)\)$/);
    if (mdLink) {
      const isBookingCTA = mdLink[2].includes('/booking?');
      if (isBookingCTA) return (
        <a key={i} href={mdLink[2]} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginTop: '8px', padding: '10px 18px', background: FLUIDE_SECONDARY, color: '#fff', borderRadius: '20px', textDecoration: 'none', fontWeight: 700, fontSize: '13.5px' }}>
          {mdLink[1]}
        </a>
      );
      return <a key={i} href={mdLink[2]} target="_blank" rel="noopener noreferrer" style={{ color: linkColor, textDecoration: 'underline' }}>{mdLink[1]}</a>;
    }
    const bold = token.match(/^\*\*(.*?)\*\*$/);
    if (bold) {
      if (/^https?:\/\//.test(bold[1])) return <a key={i} href={bold[1]} target="_blank" rel="noopener noreferrer" style={{ color: linkColor, textDecoration: 'underline', fontWeight: 600 }}>{bold[1]}</a>;
      return <strong key={i}>{bold[1]}</strong>;
    }
    if (/^https?:\/\//.test(token)) return <a key={i} href={token} target="_blank" rel="noopener noreferrer" style={{ color: linkColor, textDecoration: 'underline' }}>{token}</a>;
    return <span key={i}>{token}</span>;
  });
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [bottomOffset, setBottomOffset] = useState(24);
  const [rappelSent, setRappelSent] = useState(false);
  const [rappelSending, setRappelSending] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [phoneMenuOpen, setPhoneMenuOpen] = useState(false);
  const [mobileHeight, setMobileHeight] = useState(0);
  const [viewportTop, setViewportTop] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLDivElement>(null);
  const historyPushedRef = useRef(false);

  useLayoutEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Ajuste la hauteur mobile et remonte la fenêtre desktop quand le clavier apparaît
  useEffect(() => {
    if (!open) { setBottomOffset(24); setMobileHeight(0); setViewportTop(0); return; }
    const vv = window.visualViewport;
    if (!vv) return;
    const applyViewport = () => {
      const offset = window.innerHeight - vv.height - vv.offsetTop;
      setBottomOffset(Math.max(24, offset + 8));
      setMobileHeight(vv.height);
      setViewportTop(vv.offsetTop);
    };
    const update = () => {
      applyViewport();
      // Relire 400ms après pour rattraper la barre autofill Chrome qui apparaît en décalé
      setTimeout(applyViewport, 400);
      setTimeout(() => {
        if (messagesRef.current) messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
      }, 50);
    };
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    update();
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, [open]);

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{
        role: 'assistant',
        content: 'Bonjour ! Une question sur nos vols parapente à La Clusaz ? Je suis là pour vous aider.',
      }]);
    }
    if (open && !isMobile) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open, isMobile]);

  // Bouton retour ferme le chat sur mobile
  useEffect(() => {
    if (!isMobile) return;
    if (open) {
      history.pushState({ chatbot: true }, '');
      historyPushedRef.current = true;
      const onPop = () => {
        historyPushedRef.current = false;
        setOpen(false);
      };
      window.addEventListener('popstate', onPop);
      return () => window.removeEventListener('popstate', onPop);
    } else if (historyPushedRef.current) {
      historyPushedRef.current = false;
      history.back();
    }
  }, [open, isMobile]);

  useEffect(() => {
    if (messagesRef.current) messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
  }, [messages, loading]);

  async function sendRappel(data: RappelData) {
    if (rappelSending || rappelSent) return;
    setRappelSending(true);
    try {
      const res = await fetch('/api/rappel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        setRappelSent(true);
        setMessages(prev => [...prev, { role: 'assistant', content: 'Votre demande a bien été envoyée ! Nous vous recontactons très prochainement. 😊' }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Une erreur est survenue lors de l\'envoi. Appelez-nous au +33 6 77 28 51 02.' }]);
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Une erreur est survenue. Appelez-nous au +33 6 77 28 51 02.' }]);
    } finally {
      setRappelSending(false);
    }
  }

  async function sendSuggestion(text: string) {
    if (loading) return;
    const newMessages: Message[] = [...messages, { role: 'user', content: text }];
    setMessages(newMessages);
    setLoading(true);
    try {
      const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: newMessages }) });
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply ?? 'Désolé, une erreur est survenue.', suggestions: data.suggestions ?? [], rappel: data.rappel ?? null, showContact: data.showContact ?? false, showReviews: data.showReviews ?? false }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Désolé, une erreur est survenue. Appelez-nous au +33 6 77 28 51 02.', suggestions: [] }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    if (mobileInputRef.current) mobileInputRef.current.textContent = '';

    const newMessages: Message[] = [...messages, { role: 'user', content: text }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply ?? 'Désolé, une erreur est survenue.', suggestions: data.suggestions ?? [], rappel: data.rappel ?? null, showContact: data.showContact ?? false, showReviews: data.showReviews ?? false }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Désolé, une erreur est survenue. Appelez-nous au +33 6 77 28 51 02.' }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  return (
    <>
      {/* Bulle flottante */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Ouvrir le chat"
          style={{
            position: 'fixed',
            bottom: '20px',
            left: '20px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            zIndex: 9999,
            filter: 'drop-shadow(0 3px 10px rgba(49,39,131,0.35))',
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width={isMobile ? 54 : 46} height={isMobile ? 54 : 46} viewBox="0 0 682.66669 682.66669" aria-hidden="true">
            <g transform="matrix(1.3333333,0,0,-1.3333333,0,682.66667)">
              <g transform="translate(256,492)">
                <path d="m 0,0 c -130.339,0 -236,-105.661 -236,-236 0,-45.885 13.109,-88.702 35.766,-124.937 L -236,-472 l 111.063,35.766 C -88.702,-458.891 -45.885,-472 0,-472 c 130.339,0 236,105.661 236,236 C 236,-105.661 130.339,0 0,0 Z" style={{fill:FLUIDE_PRIMARY,stroke:'none'}}/>
              </g>
              <g transform="translate(281,256)">
                <path d="m 0,0 c 0,-13.807 -11.193,-25 -25,-25 -13.807,0 -25,11.193 -25,25 0,13.807 11.193,25 25,25 C -11.193,25 0,13.807 0,0" style={{fill:'#ffffff',stroke:'none'}}/>
              </g>
              <g transform="translate(381,256)">
                <path d="m 0,0 c 0,-13.807 -11.193,-25 -25,-25 -13.807,0 -25,11.193 -25,25 0,13.807 11.193,25 25,25 C -11.193,25 0,13.807 0,0" style={{fill:'#ffffff',stroke:'none'}}/>
              </g>
              <g transform="translate(181,256)">
                <path d="m 0,0 c 0,-13.807 -11.193,-25 -25,-25 -13.807,0 -25,11.193 -25,25 0,13.807 11.193,25 25,25 C -11.193,25 0,13.807 0,0" style={{fill:'#ffffff',stroke:'none'}}/>
              </g>
            </g>
          </svg>
        </button>
      )}

      {/* Fenêtre de chat */}
      {open && (
        <div
          style={isMobile ? {
            position: 'fixed',
            inset: 0,
            background: '#fff',
            borderRadius: 0,
            display: 'flex',
            flexDirection: 'column',
            zIndex: 9999,
            overflow: 'hidden',
            overscrollBehavior: 'contain',
          } : {
            position: 'fixed',
            bottom: `${bottomOffset}px`,
            left: '24px',
            width: '360px',
            maxWidth: 'calc(100vw - 32px)',
            height: '480px',
            maxHeight: `calc(100vh - ${bottomOffset + 16}px)`,
            background: '#fff',
            borderRadius: '16px',
            boxShadow: '0 8px 32px rgba(49,39,131,0.18)',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 9999,
            overflow: 'hidden',
          }}
        >
          {/* En-tête */}
          <div style={{ background: FLUIDE_PRIMARY, color: '#fff', padding: isMobile ? '16px 20px' : '14px 16px', paddingTop: isMobile ? 'max(16px, env(safe-area-inset-top))' : '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <svg width={isMobile ? 30 : 24} height={isMobile ? 30 : 24} viewBox="-4 -2 32 34" fill="none" aria-hidden="true">
                  <g transform="rotate(-45, 12, 14.5)">
                    <path d="M24.1375 15.0092C24.4736 14.673 24.4736 14.12 24.1375 13.7839L14.5955 4.24185C14.2593 3.90571 13.7063 3.90571 13.3702 4.24185C13.034 4.57799 13.034 5.13099 13.3702 5.46713L21.4321 13.5291L0.970973 13.5291C0.493871 13.5291 0.103516 13.9194 0.103516 14.3965C0.103516 14.8736 0.493871 15.264 0.970973 15.264L21.4321 15.264L13.3702 23.3259C13.034 23.662 13.034 24.215 13.3702 24.5512C13.7063 24.8873 14.2593 24.8873 14.5955 24.5512L24.1375 15.0092Z" fill={FLUIDE_SECONDARY}/>
                  </g>
                </svg>
              <div>
                <div style={{ fontWeight: 700, fontSize: isMobile ? '16px' : '14px' }}>Fluide Parapente</div>
                <div style={{ fontSize: isMobile ? '12px' : '11px', opacity: 0.7 }}>Répond en quelques secondes</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {/* Icône téléphone discrète */}
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setPhoneMenuOpen(o => !o)}
                  aria-label="Téléphone"
                  style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', opacity: 0.65, padding: '6px', display: 'flex', borderRadius: '50%', transition: 'opacity 0.15s' }}
                  onPointerEnter={e => (e.currentTarget.style.opacity = '1')}
                  onPointerLeave={e => (e.currentTarget.style.opacity = '0.65')}
                >
                  <svg width={isMobile ? 18 : 16} height={isMobile ? 18 : 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.62 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>
                  </svg>
                </button>
                {phoneMenuOpen && (
                  <>
                    <div onClick={() => setPhoneMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 10000 }} />
                    <div style={{ position: 'absolute', top: '38px', right: 0, backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 8px 30px rgba(0,0,0,0.18)', overflow: 'hidden', zIndex: 10001, minWidth: isMobile ? '180px' : '210px' }}>
                      {isMobile ? (
                        <>
                          <a href="tel:+33677285102" onClick={() => setPhoneMenuOpen(false)}
                            style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '13px 16px', color: '#1e293b', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 600, borderBottom: '1px solid #f1f5f9' }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={FLUIDE_SECONDARY} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.62 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                            Appeler
                          </a>
                          <a href="sms:+33677285102" onClick={() => setPhoneMenuOpen(false)}
                            style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '13px 16px', color: '#1e293b', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 600 }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={FLUIDE_SECONDARY} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                            Envoyer un SMS
                          </a>
                        </>
                      ) : (
                        <a href="tel:+33677285102" onClick={() => setPhoneMenuOpen(false)}
                          style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '13px 16px', color: '#1e293b', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 700 }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={FLUIDE_SECONDARY} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.62 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                          06 77 28 51 02
                        </a>
                      )}
                    </div>
                  </>
                )}
              </div>
              <button onClick={() => setOpen(false)} aria-label="Fermer" style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', opacity: 0.8, padding: '6px', display: 'flex', borderRadius: '50%' }}>
                <X size={isMobile ? 22 : 18} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div ref={messagesRef} style={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'contain', padding: isMobile ? '20px 16px' : '16px', paddingBottom: isMobile ? '90px' : '16px', display: 'flex', flexDirection: 'column', gap: isMobile ? '14px' : '10px' }}>
            {messages.map((msg, i) => {
              const isLast = i === messages.length - 1;
              const showSuggestions = isLast && !loading && msg.role === 'assistant' && msg.suggestions && msg.suggestions.length > 0;
              return (
                <div key={i}>
                  <div style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                    <div style={{
                      maxWidth: isMobile ? '85%' : '80%',
                      padding: isMobile ? '12px 15px' : '10px 13px',
                      borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                      background: msg.role === 'user' ? FLUIDE_PRIMARY : '#f1f5f9',
                      color: msg.role === 'user' ? '#fff' : '#1e293b',
                      fontSize: isMobile ? '15px' : '13.5px',
                      lineHeight: '1.55',
                      whiteSpace: 'pre-wrap',
                    }}>
                      {renderMessage(msg.content, msg.role === 'user')}
                    </div>
                  </div>
                  {showSuggestions && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px', paddingLeft: '2px' }}>
                      {msg.suggestions!.map((s, si) => (
                        <button key={si} onClick={() => sendSuggestion(s)} style={{ padding: isMobile ? '9px 16px' : '6px 12px', borderRadius: '18px', border: `1.5px solid ${FLUIDE_PRIMARY}`, background: 'white', color: FLUIDE_PRIMARY, fontSize: isMobile ? '14px' : '12.5px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }} onMouseEnter={e => { e.currentTarget.style.background = FLUIDE_PRIMARY; e.currentTarget.style.color = '#fff'; }} onMouseLeave={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.color = FLUIDE_PRIMARY; }}>
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                  {isLast && !loading && msg.role === 'assistant' && msg.rappel && !rappelSent && (
                    <div style={{ marginTop: '10px', paddingLeft: '2px' }}>
                      <button
                        onClick={() => sendRappel(msg.rappel!)}
                        disabled={rappelSending}
                        style={{ padding: '10px 18px', borderRadius: '20px', background: rappelSending ? '#94a3b8' : FLUIDE_SECONDARY, color: '#fff', border: 'none', fontSize: '13.5px', fontWeight: 700, cursor: rappelSending ? 'default' : 'pointer' }}
                      >
                        {rappelSending ? 'Envoi...' : 'Confirmer ma demande →'}
                      </button>
                    </div>
                  )}
                  {isLast && !loading && msg.role === 'assistant' && msg.showContact && (
                    <div style={{ display: 'flex', gap: '10px', marginTop: '10px', paddingLeft: '2px' }}>
                      {isMobile ? (
                        <>
                          <a href="tel:+33677285102" aria-label="Appeler" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '42px', height: '42px', borderRadius: '50%', background: FLUIDE_PRIMARY, color: '#fff', textDecoration: 'none', flexShrink: 0 }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.62 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                          </a>
                          <a href="sms:+33677285102" aria-label="SMS" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '42px', height: '42px', borderRadius: '50%', background: FLUIDE_PRIMARY, color: '#fff', textDecoration: 'none', flexShrink: 0 }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                          </a>
                          <a href="https://wa.me/33677285102" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '42px', height: '42px', borderRadius: '50%', background: '#25D366', textDecoration: 'none', flexShrink: 0 }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>
                          </a>
                        </>
                      ) : (
                        <>
                          <a href="mailto:contact@fluide-parapente.fr" aria-label="Email" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '42px', height: '42px', borderRadius: '50%', background: FLUIDE_PRIMARY, color: '#fff', textDecoration: 'none', flexShrink: 0 }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                          </a>
                          <a href="https://wa.me/33677285102" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '42px', height: '42px', borderRadius: '50%', background: '#25D366', textDecoration: 'none', flexShrink: 0 }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>
                          </a>
                        </>
                      )}
                    </div>
                  )}
                  {isLast && !loading && msg.role === 'assistant' && msg.showReviews && (
                    <div style={{ marginTop: '10px', paddingLeft: '2px' }}>
                      <a href="https://share.google/h1Nu7CC7MVmdlz283" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '9px 14px', borderRadius: '20px', border: '1.5px solid #dadce0', background: '#fff', textDecoration: 'none', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                        </svg>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#3c4043', fontFamily: 'sans-serif' }}>Avis clients</span>
                        <span style={{ display: 'flex', gap: '1px' }}>
                          {[0,1,2,3,4].map(s => <svg key={s} width="13" height="13" viewBox="0 0 24 24" fill="#F9AB00"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>)}
                        </span>
                      </a>
                    </div>
                  )}
                </div>
              );
            })}
            {loading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{ padding: '10px 13px', borderRadius: '14px 14px 14px 2px', background: '#f1f5f9', display: 'flex', gap: '4px', alignItems: 'center' }}>
                  {[0, 1, 2].map(i => (
                    <span key={i} style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#94a3b8', display: 'inline-block', animation: `bounce 1s ${i * 0.15}s infinite` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Saisie (desktop uniquement dans ce container) */}
          {!isMobile && (() => {
            const lastAssistant = ([...messages].reverse().find(m => m.role === 'assistant')?.content ?? '').toLowerCase().replace(/\*+/g, '');
            const asksEmail = /email\s*\?/.test(lastAssistant);
            const asksTel = /t[eé]l[eé]phone\s*\?|t[eé]l\s*\?/.test(lastAssistant);
            const asksName = !asksEmail && !asksTel && /pr[eé]nom|votre\s*nom\s*\?/.test(lastAssistant);
            const inputType = asksEmail ? 'email' : asksTel ? 'tel' : 'text';
            const autoComplete = asksEmail ? 'email' : asksTel ? 'tel' : asksName ? 'name' : 'off';
            return (
          <div style={{ padding: '12px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '8px', flexShrink: 0, background: '#fff' }}>
            <input
              key={inputType}
              ref={inputRef}
              type={inputType}
              autoComplete={autoComplete}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
              placeholder="Votre question…"
              disabled={loading}
              style={{ flex: 1, padding: '9px 13px', border: '1px solid #e2e8f0', borderRadius: '24px', fontSize: '13.5px', outline: 'none', background: '#f8fafc' }}
            />
            <button onClick={send} disabled={!input.trim() || loading} aria-label="Envoyer"
              style={{ width: '38px', height: '38px', borderRadius: '50%', background: input.trim() && !loading ? FLUIDE_SECONDARY : '#e2e8f0', color: input.trim() && !loading ? '#fff' : '#94a3b8', border: 'none', cursor: input.trim() && !loading ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background 0.15s' }}>
              <Send size={16} />
            </button>
          </div>
            );
          })()}
        </div>
      )}

      {/* Saisie mobile — contentEditable évite la barre autofill Chrome */}
      {open && isMobile && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 10000, background: '#fff', borderTop: '1px solid #e2e8f0', padding: '12px 16px', paddingBottom: 'max(12px, env(safe-area-inset-bottom))', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div
            ref={mobileInputRef}
            contentEditable
            suppressContentEditableWarning
            role="textbox"
            aria-label="Votre question"
            data-placeholder="Votre question…"
            onInput={e => setInput(e.currentTarget.textContent ?? '')}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            style={{ flex: 1, padding: '12px 16px', border: '1px solid #e2e8f0', borderRadius: '24px', fontSize: '16px', outline: 'none', background: '#f8fafc', minHeight: '46px', maxHeight: '120px', overflowY: 'auto', lineHeight: '1.4', wordBreak: 'break-word', display: 'flex', alignItems: 'center' }}
          />
          <button onClick={send} disabled={!input.trim() || loading} aria-label="Envoyer"
            style={{ width: '46px', height: '46px', borderRadius: '50%', background: input.trim() && !loading ? FLUIDE_SECONDARY : '#e2e8f0', color: input.trim() && !loading ? '#fff' : '#94a3b8', border: 'none', cursor: input.trim() && !loading ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background 0.15s' }}>
            <Send size={20} />
          </button>
        </div>
      )}

      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-4px); }
        }
        [contenteditable][data-placeholder]:empty::before {
          content: attr(data-placeholder);
          color: #94a3b8;
          pointer-events: none;
        }
      `}</style>
    </>
  );
}
