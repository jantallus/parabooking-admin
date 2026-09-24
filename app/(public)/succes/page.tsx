"use client";
import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useToast } from '@/components/ui/ToastProvider';
import { CheckCircle2, Gift, XCircle, Download } from 'lucide-react';

function SuccessContent() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const session_id = searchParams.get('session_id');
  
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'refunded'>('loading');

  // NOUVEAU : Mémoire pour le Bon Cadeau
  const [isGiftCard, setIsGiftCard] = useState(false);
  const [giftCode, setGiftCode] = useState('');

  useEffect(() => {
    if (!session_id) {
      setStatus('error');
      return;
    }

    const confirmBooking = async () => {
      try {
        const res = await fetch(`/api/proxy/public/confirm-booking`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id })
        });

        if (res.ok) {
          const data = await res.json();

          if (data.refunded) {
            setStatus('refunded');
          } else {
            if (data.is_gift_card) {
              setIsGiftCard(true);
              setGiftCode(data.code);
            }
            setStatus('success');
            // Conversion Google Ads via GTM
            if (typeof window !== 'undefined') {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const w = window as any;
              w.dataLayer = w.dataLayer || [];
              w.dataLayer.push({ event: 'purchase_confirmed', value: data.amount_total ? data.amount_total / 100 : 70, currency: 'EUR', transaction_id: session_id });
            }
          }
        } else {
          setStatus('error');
        }
      } catch (err) {
        console.error(err);
        setStatus('error');
      }
    };

    // Pour éviter de valider 2 fois si React recharge la page
    const timer = setTimeout(() => { confirmBooking(); }, 500);
    return () => clearTimeout(timer);
  }, [session_id]);

  // FONCTION DE TÉLÉCHARGEMENT INVISIBLE (Contourne le blocage de Chrome)
  const handleDownloadPDF = async () => {
    try {
      const res = await fetch(`/api/proxy/public/download-gift-card/${giftCode}`);
      
      if (!res.ok) throw new Error("Erreur de téléchargement");

      // On transforme la réponse en fichier (Blob)
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);

      // On crée un faux lien invisible pour forcer le téléchargement proprement
      const a = document.createElement('a');
      a.href = url;
      a.download = `Bon_Cadeau_${giftCode}.pdf`;
      document.body.appendChild(a);
      a.click(); // 👈 Clic magique invisible !

      // On nettoie derrière nous
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error("Le téléchargement a échoué. Veuillez réessayer.");
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex items-center justify-center p-4">
      <div className="max-w-xl w-full bg-white rounded-[20px] p-10 text-center border border-slate-100" style={{ boxShadow: '0 4px 24px rgba(49,39,131,0.08)' }}>

        {/* ÉCRAN 1 : CHARGEMENT */}
        {status === 'loading' && (
          <div className="animate-in fade-in duration-500">
            <div className="w-16 h-16 rounded-full border-4 border-slate-200 animate-spin mx-auto mb-6" style={{ borderTopColor: '#E6007E' }}></div>
            <h2 className="text-2xl font-black uppercase italic text-slate-900">Validation en cours...</h2>
            <p className="text-slate-500 mt-2 font-medium">Ne fermez pas cette page, nous accrochons vos suspentes !</p>
          </div>
        )}

        {/* ÉCRAN 2A : SUCCÈS VOL CLASSIQUE */}
        {status === 'success' && !isGiftCard && (
          <div className="animate-in zoom-in-95 duration-500">
            <div className="flex justify-center mb-6">
              <CheckCircle2 size={72} strokeWidth={1.5} style={{ color: '#E6007E' }} />
            </div>
            <h1 className="text-4xl md:text-5xl font-black uppercase italic mb-4 tracking-tight" style={{ color: '#E6007E' }}>
              Réservation Confirmée !
            </h1>
            <p className="text-lg text-slate-600 font-medium mb-8">
              Merci pour votre paiement. Vos créneaux sont officiellement réservés dans le planning de nos moniteurs. Vous allez recevoir un email de confirmation de Stripe très bientôt.
            </p>
            <div className="p-6 rounded-[10px] text-left mb-8" style={{ backgroundColor: 'rgba(49,39,131,0.04)', border: '1px solid rgba(49,39,131,0.1)' }}>
              <p className="font-bold text-slate-900 mb-2">📌 Prochaines étapes :</p>
              <ul className="text-sm text-slate-600 space-y-2">
                <li>• Habillez-vous chaudement (même en été).</li>
                <li>• Prenez des lunettes de soleil.</li>
                <li>• Soyez sur place 5 min avant l'heure de réservation.</li>
              </ul>
            </div>
            <button
              onClick={() => window.location.href = 'https://fluide-parapente.fr'}
              className="text-white px-8 py-4 rounded-[5px] font-black uppercase tracking-widest text-xs transition-colors"
              style={{ backgroundColor: '#E6007E' }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#312783')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#E6007E')}
            >
              Retour à l'accueil
            </button>
          </div>
        )}

        {/* ÉCRAN 2B : SUCCÈS BON CADEAU */}
        {status === 'success' && isGiftCard && (
          <div className="animate-in zoom-in-95 duration-500">
            <div className="flex justify-center mb-6">
              <Gift size={72} strokeWidth={1.5} style={{ color: '#E6007E' }} />
            </div>
            <h1 className="text-4xl md:text-5xl font-black uppercase italic mb-4 tracking-tight" style={{ color: '#E6007E' }}>
              Achat Réussi !
            </h1>
            <p className="text-lg text-slate-600 font-medium mb-8">
              Votre bon cadeau est prêt ! Vous pouvez noter ce code ou le transmettre directement à son heureux bénéficiaire.
            </p>

            <div className="p-8 rounded-[10px] text-center mb-8 relative overflow-hidden" style={{ backgroundColor: 'rgba(230,0,126,0.04)', border: '2px dashed rgba(230,0,126,0.3)' }}>
              <div className="absolute top-0 left-0 w-full h-1.5" style={{ background: 'linear-gradient(to right, #E6007E, #312783)' }}></div>
              <p className="font-black uppercase text-xs tracking-widest mb-3" style={{ color: '#E6007E' }}>Code d'activation unique</p>
              <p className="text-4xl font-black text-slate-900 tracking-wider font-mono">{giftCode}</p>
            </div>

            <button
              onClick={handleDownloadPDF}
              className="text-white px-8 py-4 rounded-[5px] font-black uppercase tracking-widest text-xs transition-colors mb-4 w-full inline-flex items-center justify-center gap-2"
              style={{ backgroundColor: '#312783' }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#E6007E')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#312783')}
            >
              <Download size={16} strokeWidth={2} /> Télécharger le Bon (PDF)
            </button>
            <br/>
            <button
              onClick={() => window.location.href = 'https://fluide-parapente.fr'}
              className="font-bold uppercase text-xs transition-colors"
              style={{ color: '#94a3b8' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#312783')}
              onMouseLeave={e => (e.currentTarget.style.color = '#94a3b8')}
            >
              Retour à l'accueil
            </button>
          </div>
        )}

        {/* ÉCRAN 3 : REMBOURSEMENT AUTOMATIQUE */}
        {status === 'refunded' && (
          <div className="animate-in zoom-in-95 duration-500">
            <div className="flex justify-center mb-6">
              <XCircle size={72} strokeWidth={1.5} style={{ color: '#f59e0b' }} />
            </div>
            <h1 className="text-4xl font-black uppercase italic mb-4" style={{ color: '#f59e0b' }}>Créneau indisponible</h1>
            <p className="text-slate-600 font-medium mb-4">
              Votre paiement a bien été reçu, mais le créneau que vous aviez choisi n'était malheureusement plus disponible au moment de l'enregistrement.
            </p>
            <p className="text-slate-600 font-medium mb-8">
              <strong>Vous avez été intégralement remboursé</strong> — le virement peut prendre 5 à 10 jours ouvrés selon votre banque. N'hésitez pas à nous appeler ou à réessayer avec un autre créneau.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => window.location.href = '/booking'}
                className="text-white px-8 py-4 rounded-[5px] font-black uppercase tracking-widest text-xs transition-colors"
                style={{ backgroundColor: '#E6007E' }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#312783')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#E6007E')}
              >
                Choisir un autre créneau
              </button>
            </div>
          </div>
        )}

        {/* ÉCRAN 4 : ERREUR */}
        {status === 'error' && (
          <div className="animate-in zoom-in-95 duration-500">
            <div className="flex justify-center mb-6">
              <XCircle size={72} strokeWidth={1.5} style={{ color: '#E6007E' }} />
            </div>
            <h1 className="text-4xl font-black uppercase italic mb-4" style={{ color: '#E6007E' }}>Oops !</h1>
            <p className="text-slate-600 font-medium mb-8">
              Le paiement semble avoir été annulé ou une erreur est survenue lors de l'enregistrement. Veuillez réessayer ou nous contacter par téléphone.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => window.location.href = 'https://fluide-parapente.fr'}
                className="text-white px-8 py-4 rounded-[5px] font-black uppercase tracking-widest text-xs transition-colors"
                style={{ backgroundColor: '#E6007E' }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#312783')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#E6007E')}
              >
                Réessayer une réservation
              </button>
              <button
                onClick={() => window.location.href = '/bons-cadeaux'}
                className="px-8 py-4 rounded-[5px] font-black uppercase tracking-widest text-xs transition-colors"
                style={{ backgroundColor: 'rgba(49,39,131,0.06)', color: '#312783' }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(49,39,131,0.12)')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'rgba(49,39,131,0.06)')}
              >
                Retour à la boutique
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default function PageSucces() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50"></div>}>
      <SuccessContent />
    </Suspense>
  );
}