'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Phone, X } from 'lucide-react';

const PHONE_TEL = '+33677285102';
const PHONE_DISPLAY = '+33(0)6 77 28 51 02';

// Mobile : le lien tel: ouvre l'appli téléphone. Ordinateur (souris) : popup avec le numéro.
export default function PhoneContactButton({ size = 32 }: { size?: number }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      e.preventDefault();
      setOpen(true);
    }
  };

  return (
    <>
      <a
        href={`tel:${PHONE_TEL}`}
        onClick={handleClick}
        aria-label="Réserver par téléphone"
        className="inline-flex items-center justify-center rounded-full shrink-0 transition-transform hover:scale-105"
        style={{ background: '#E6007E', width: size, height: size }}
      >
        <Phone size={Math.round(size * 0.5)} color="white" strokeWidth={2.25} />
      </a>

      {open && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="phone-contact-title"
            className="relative w-full max-w-sm rounded-[10px] bg-white p-6 shadow-xl text-center flex flex-col items-center gap-3"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setOpen(false)}
              aria-label="Fermer"
              className="absolute top-3 right-3 text-slate-400 hover:text-slate-600"
            >
              <X size={18} />
            </button>
            <span className="inline-flex items-center justify-center rounded-full" style={{ background: 'rgba(230,0,126,0.1)', width: 44, height: 44 }}>
              <Phone size={20} color="#E6007E" strokeWidth={2.25} />
            </span>
            <h3 id="phone-contact-title" className="text-lg font-black" style={{ color: '#312783' }}>Réservation</h3>
            <p className="text-sm leading-relaxed text-slate-600">
              La réservation pour ce créneau n&apos;est pas disponible sur Internet. Pour réserver contactez-nous au :
            </p>
            <p className="text-xl font-black select-all" style={{ color: '#E6007E' }}>{PHONE_DISPLAY}</p>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
