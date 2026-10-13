'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Send } from 'lucide-react';

const FLUIDE_PRIMARY   = '#312783';
const FLUIDE_SECONDARY = '#E6007E';

function ParagliderIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* Voile */}
      <path d="M2 13 C2 5 24 5 24 13" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none" />
      {/* Suspentes */}
      <line x1="6.5"  y1="12.5" x2="13" y2="20" stroke="white" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="13"   y1="11"   x2="13" y2="20" stroke="white" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="19.5" y1="12.5" x2="13" y2="20" stroke="white" strokeWidth="1.4" strokeLinecap="round" />
      {/* Pilote */}
      <circle cx="13" cy="21.5" r="2" fill="white" />
    </svg>
  );
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
            bottom: '24px',
            left: '24px',
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: FLUIDE_PRIMARY,
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(49,39,131,0.35)',
            zIndex: 9999,
          }}
        >
          <ParagliderIcon />
        </button>
      )}

      {/* Fenêtre de chat */}
      {open && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            left: '24px',
            width: '360px',
            maxWidth: 'calc(100vw - 32px)',
            height: '480px',
            maxHeight: 'calc(100vh - 48px)',
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
              <ParagliderIcon />
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
                  {msg.content}
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
