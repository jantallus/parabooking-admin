'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Send } from 'lucide-react';

const FLUIDE_PRIMARY   = '#312783';
const FLUIDE_SECONDARY = '#E6007E';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

function renderMessage(text: string, isUser: boolean): React.ReactNode {
  const linkColor = isUser ? '#a5b4fc' : FLUIDE_PRIMARY;
  const parts = text.split(/(\[.*?\]\(https?:\/\/[^)]+\)|\*\*.*?\*\*|https?:\/\/[^\s]+)/g);
  return parts.map((token, i) => {
    const mdLink = token.match(/^\[(.*?)\]\((https?:\/\/[^)]+)\)$/);
    if (mdLink) return <a key={i} href={mdLink[2]} target="_blank" rel="noopener noreferrer" style={{ color: linkColor, textDecoration: 'underline' }}>{mdLink[1]}</a>;
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
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Remonte la fenêtre quand le clavier mobile apparaît
  useEffect(() => {
    if (!open) { setBottomOffset(24); return; }
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const offset = window.innerHeight - vv.height - vv.offsetTop;
      setBottomOffset(Math.max(24, offset + 8));
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
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');

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
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply ?? 'Désolé, une erreur est survenue.' }]);
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
          <svg xmlns="http://www.w3.org/2000/svg" width="46" height="46" viewBox="0 0 682.66669 682.66669" aria-hidden="true">
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
          style={{
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
          <div style={{ background: FLUIDE_PRIMARY, color: '#fff', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <svg width="24" height="24" viewBox="-4 -2 32 34" fill="none" aria-hidden="true">
                  <g transform="rotate(-45, 12, 14.5)">
                    <path d="M24.1375 15.0092C24.4736 14.673 24.4736 14.12 24.1375 13.7839L14.5955 4.24185C14.2593 3.90571 13.7063 3.90571 13.3702 4.24185C13.034 4.57799 13.034 5.13099 13.3702 5.46713L21.4321 13.5291L0.970973 13.5291C0.493871 13.5291 0.103516 13.9194 0.103516 14.3965C0.103516 14.8736 0.493871 15.264 0.970973 15.264L21.4321 15.264L13.3702 23.3259C13.034 23.662 13.034 24.215 13.3702 24.5512C13.7063 24.8873 14.2593 24.8873 14.5955 24.5512L24.1375 15.0092Z" fill={FLUIDE_SECONDARY}/>
                  </g>
                </svg>
              <div>
                <div style={{ fontWeight: 600, fontSize: '14px' }}>Fluide Parapente</div>
                <div style={{ fontSize: '11px', opacity: 0.7 }}>Répond en quelques secondes</div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Fermer" style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', opacity: 0.7, padding: '4px', display: 'flex' }}>
              <X size={18} />
            </button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {messages.map((msg, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '80%',
                  padding: '10px 13px',
                  borderRadius: msg.role === 'user' ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                  background: msg.role === 'user' ? FLUIDE_PRIMARY : '#f1f5f9',
                  color: msg.role === 'user' ? '#fff' : '#1e293b',
                  fontSize: '13.5px',
                  lineHeight: '1.5',
                  whiteSpace: 'pre-wrap',
                }}>
                  {renderMessage(msg.content, msg.role === 'user')}
                </div>
              </div>
            ))}
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

          {/* Saisie */}
          <div style={{ padding: '12px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '8px', flexShrink: 0 }}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
              placeholder="Votre question…"
              disabled={loading}
              style={{
                flex: 1,
                padding: '9px 13px',
                border: '1px solid #e2e8f0',
                borderRadius: '20px',
                fontSize: '13.5px',
                outline: 'none',
                background: '#f8fafc',
              }}
            />
            <button
              onClick={send}
              disabled={!input.trim() || loading}
              aria-label="Envoyer"
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                background: input.trim() && !loading ? FLUIDE_SECONDARY : '#e2e8f0',
                color: input.trim() && !loading ? '#fff' : '#94a3b8',
                border: 'none',
                cursor: input.trim() && !loading ? 'pointer' : 'default',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                transition: 'background 0.15s',
              }}
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-4px); }
        }
      `}</style>
    </>
  );
}
