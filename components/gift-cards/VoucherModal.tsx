"use client";
import React, { useState, useEffect } from 'react';
import type { GiftCard, FlightType, Complement } from '@/lib/types';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/components/ui/ToastProvider';

interface Monitor { id: string; first_name: string; }

const EMPTY_VOUCHER = {
  type: 'gift_card',
  custom_code: '',
  buyer_name: '',
  beneficiary_name: '',
  gift_value: '',
  flight_type_id: '',
  monitor_id: '',
  discount_type: 'fixed',
  discount_value: '',
  discount_scope: 'both',
  max_uses: '1',
  is_unlimited: false,
  valid_from: '',
  valid_until: '',
  is_partner: false,
  partner_billing_type: 'fixed',
  partner_amount: '',
};

interface Props {
  cardToEdit: GiftCard | null;
  flights: FlightType[];
  complements: Complement[];
  onClose: () => void;
  onSaved: () => void;
}

export function VoucherModal({ cardToEdit, flights, complements, onClose, onSaved }: Props) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'gift_card' | 'promo'>('gift_card');
  const [giftCardMode, setGiftCardMode] = useState<'prestation' | 'value'>('prestation');
  const [selectedPrestation, setSelectedPrestation] = useState('');
  const [newVoucher, setNewVoucher] = useState({ ...EMPTY_VOUCHER });
  const [monitors, setMonitors] = useState<Monitor[]>([]);

  useEffect(() => {
    apiFetch('/api/monitors').then(r => r.ok ? r.json() : []).then(setMonitors).catch(() => {});
  }, []);

  useEffect(() => {
    if (!cardToEdit) {
      setActiveTab('gift_card');
      setGiftCardMode('prestation');
      setSelectedPrestation('');
      setNewVoucher({ ...EMPTY_VOUCHER });
      return;
    }
    const card = cardToEdit;
    setActiveTab(card.type as 'gift_card' | 'promo');
    setNewVoucher({
      type: card.type,
      custom_code: card.code,
      buyer_name: card.buyer_name || '',
      beneficiary_name: card.beneficiary_name || '',
      gift_value: card.price_paid_cents ? (card.price_paid_cents / 100).toString() : '',
      flight_type_id: card.flight_type_id?.toString() || '',
      monitor_id: card.monitor_id || '',
      discount_type: card.discount_type || 'fixed',
      discount_value: card.discount_value ? card.discount_value.toString() : '',
      discount_scope: card.discount_scope || 'both',
      max_uses: card.max_uses ? card.max_uses.toString() : '',
      is_unlimited: card.max_uses === null,
      valid_from: card.valid_from ? card.valid_from.split('T')[0] : '',
      valid_until: card.valid_until ? card.valid_until.split('T')[0] : '',
      is_partner: card.is_partner || false,
      partner_billing_type: card.partner_billing_type || 'fixed',
      partner_amount: card.partner_amount_cents ? (card.partner_amount_cents / 100).toString() : '',
    });
    if (card.type === 'gift_card') {
      if (card.flight_type_id) {
        setGiftCardMode('prestation');
        setSelectedPrestation(`flight|${card.flight_type_id}`);
      } else {
        setGiftCardMode('value');
        setSelectedPrestation('');
      }
    }
  }, [cardToEdit]);

  const handleCreate = async () => {
    let payload: Record<string, unknown> = { type: activeTab, custom_code: newVoucher.custom_code.trim() };

    if (activeTab === 'gift_card') {
      if (!newVoucher.gift_value || !newVoucher.buyer_name) {
        toast.warning("Veuillez renseigner le nom de l'acheteur et le montant du bon.");
        return;
      }
      let finalNotes = 'Avoir libre';
      if (giftCardMode === 'prestation') {
        if (selectedPrestation.startsWith('flight|')) {
          const f = flights.find(fl => fl.id.toString() === selectedPrestation.split('|')[1]);
          finalNotes = f ? `Vol : ${f.name}` : finalNotes;
        } else if (selectedPrestation.startsWith('comp|')) {
          const c = complements.find(co => co.id.toString() === selectedPrestation.split('|')[1]);
          finalNotes = c ? `Option : ${c.name}` : finalNotes;
        }
      }
      payload = {
        ...payload,
        flight_type_id: (giftCardMode === 'prestation' && selectedPrestation.startsWith('flight|')) ? (newVoucher.flight_type_id ? Number(newVoucher.flight_type_id) : null) : null,
        buyer_name: newVoucher.buyer_name,
        beneficiary_name: '',
        price_paid_cents: Math.round(parseFloat(newVoucher.gift_value) * 100),
        notes: finalNotes,
        max_uses: 1,
        discount_scope: 'both',
        is_partner: false,
        partner_billing_type: 'fixed',
        partner_amount_cents: null,
        monitor_id: newVoucher.monitor_id || null,
      };
    } else {
      if (!newVoucher.discount_value) {
        toast.warning('Veuillez indiquer la valeur de la réduction.');
        return;
      }
      if (newVoucher.discount_type === 'percentage' && parseFloat(newVoucher.discount_value) > 100) {
        toast.warning('Une réduction en pourcentage ne peut pas dépasser 100 % !');
        return;
      }
      payload = {
        ...payload,
        flight_type_id: newVoucher.flight_type_id ? Number(newVoucher.flight_type_id) : null,
        discount_type: newVoucher.discount_type,
        discount_value: parseFloat(newVoucher.discount_value),
        discount_scope: newVoucher.discount_scope,
        max_uses: newVoucher.is_unlimited ? null : parseInt(newVoucher.max_uses) || 1,
        valid_from: newVoucher.valid_from || null,
        valid_until: newVoucher.valid_until || null,
        is_partner: newVoucher.is_partner,
        partner_billing_type: newVoucher.partner_billing_type,
        partner_amount_cents: newVoucher.partner_amount ? Math.round(parseFloat(newVoucher.partner_amount) * 100) : null,
        notes: newVoucher.flight_type_id ? 'Promo spécifique' : 'Promo globale',
      };
    }

    const res = await apiFetch(
      cardToEdit ? `/api/gift-cards/${cardToEdit.id}` : '/api/gift-cards',
      { method: cardToEdit ? 'PUT' : 'POST', body: JSON.stringify(payload) }
    );

    if (res.ok) {
      onSaved();
      onClose();
    } else {
      const errorMsg = await res.json();
      toast.error('Erreur : ' + (errorMsg.error || 'Le code personnalisé est peut-être déjà pris.'));
    }
  };

  const v = newVoucher;
  const set = (patch: Partial<typeof EMPTY_VOUCHER>) => setNewVoucher(prev => ({ ...prev, ...patch }));

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-[40px] p-6 md:p-8 max-w-lg w-full shadow-2xl overflow-y-auto max-h-[90vh]">

        <div className="flex flex-col sm:flex-row gap-2 bg-slate-100 p-1 rounded-2xl mb-8">
          <button onClick={() => setActiveTab('gift_card')} className={`flex-1 py-3 rounded-xl font-black uppercase text-[10px] md:text-xs transition-all ${activeTab === 'gift_card' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
            🎁 Bon Cadeau
          </button>
          <button onClick={() => setActiveTab('promo')} className={`flex-1 py-3 rounded-xl font-black uppercase text-[10px] md:text-xs transition-all ${activeTab === 'promo' ? 'bg-white text-amber-500 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
            ✂️ Code Promo
          </button>
        </div>

        <div className="space-y-6">
          <div>
            <label className="text-[10px] font-black uppercase text-slate-400 ml-4 flex justify-between">Code <span>({cardToEdit ? 'Non modifiable' : 'Optionnel'})</span></label>
            <input
              type="text"
              disabled={!!cardToEdit}
              placeholder="Ex: NOEL2024 (Vide = Auto)"
              className={`w-full border-2 border-slate-100 rounded-2xl p-4 font-bold outline-none uppercase ${cardToEdit ? 'bg-slate-200 text-slate-500 cursor-not-allowed' : 'bg-slate-50 focus:border-indigo-500'}`}
              value={v.custom_code}
              onChange={e => set({ custom_code: e.target.value.toUpperCase() })}
            />
          </div>

          {activeTab === 'gift_card' && (
            <>
              <div className="flex flex-col sm:flex-row gap-2 bg-slate-100 p-1 rounded-2xl mb-6">
                <button onClick={() => setGiftCardMode('prestation')} className={`flex-1 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${giftCardMode === 'prestation' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                  🎯 Prestation
                </button>
                <button onClick={() => setGiftCardMode('value')} className={`flex-1 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${giftCardMode === 'value' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                  💶 Avoir Libre
                </button>
              </div>

              {giftCardMode === 'prestation' ? (
                <div className="mb-4">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-4">Prestation offerte</label>
                  <select
                    className="w-full border-2 border-slate-100 rounded-2xl p-4 font-bold bg-slate-50 outline-none focus:border-indigo-500"
                    value={selectedPrestation}
                    onChange={e => {
                      const val = e.target.value;
                      setSelectedPrestation(val);
                      if (val.startsWith('flight|')) {
                        const f = flights.find(fl => fl.id.toString() === val.split('|')[1]);
                        set({ flight_type_id: val.split('|')[1], gift_value: f ? (f.price_cents / 100).toString() : '' });
                      } else if (val.startsWith('comp|')) {
                        const c = complements.find(co => co.id.toString() === val.split('|')[1]);
                        set({ flight_type_id: '', gift_value: c ? (c.price_cents / 100).toString() : '' });
                      } else {
                        set({ flight_type_id: '', gift_value: '' });
                      }
                    }}
                  >
                    <option value="">-- Choisir l'offre --</option>
                    <optgroup label="🪂 Les Vols">
                      {flights.map(f => <option key={`f-${f.id}`} value={`flight|${f.id}`}>{f.name} ({f.price_cents / 100}€)</option>)}
                    </optgroup>
                    <optgroup label="📸 Les Options">
                      {complements.map(c => <option key={`c-${c.id}`} value={`comp|${c.id}`}>{c.name} ({c.price_cents / 100}€)</option>)}
                    </optgroup>
                  </select>
                </div>
              ) : (
                <div className="mb-4">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-4">Valeur de l'avoir (€)</label>
                  <input type="number" placeholder="Ex: 90" className="w-full border-2 border-slate-100 rounded-2xl p-4 font-bold bg-slate-50 outline-none focus:border-indigo-500 text-indigo-600 text-xl" value={v.gift_value} onChange={e => set({ gift_value: e.target.value })} />
                </div>
              )}

              <div className="mt-4">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-4">Acheteur</label>
                <input type="text" placeholder="Nom de la personne qui offre" className="w-full border-2 border-slate-100 rounded-2xl p-4 font-bold bg-slate-50 outline-none" value={v.buyer_name} onChange={e => set({ buyer_name: e.target.value })} />
              </div>

              <div className="mt-4">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-4">Pilote attributaire <span className="normal-case text-slate-300">(encaissement automatique à l'utilisation)</span></label>
                <select
                  className="w-full border-2 border-slate-100 rounded-2xl p-4 font-bold bg-slate-50 outline-none focus:border-indigo-500"
                  value={v.monitor_id}
                  onChange={e => set({ monitor_id: e.target.value })}
                >
                  <option value="">— Aucun pilote attribué —</option>
                  {monitors.map(m => <option key={m.id} value={m.id}>{m.first_name}</option>)}
                </select>
              </div>
            </>
          )}

          {activeTab === 'promo' && (
            <>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 ml-4">Prestation applicable</label>
                <select className="w-full border-2 border-slate-100 rounded-2xl p-4 font-bold bg-amber-50 outline-none text-amber-900" value={v.flight_type_id} onChange={e => set({ flight_type_id: e.target.value })}>
                  <option value="">✅ Valable sur TOUTES les prestations</option>
                  {flights.map(f => <option key={f.id} value={f.id}>Uniquement : {f.name}</option>)}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 ml-4">La réduction s'applique sur :</label>
                <select className="w-full border-2 border-slate-100 rounded-2xl p-4 font-bold bg-white outline-none" value={v.discount_scope} onChange={e => set({ discount_scope: e.target.value })}>
                  <option value="both">🌟 Le Vol ET les Options (Totalité)</option>
                  <option value="flight">🪂 Le Vol uniquement</option>
                  <option value="complements">📸 Les Options uniquement</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-4">Type de réduction</label>
                  <select className="w-full border-2 border-slate-100 rounded-2xl p-4 font-bold bg-slate-50 outline-none" value={v.discount_type} onChange={e => set({ discount_type: e.target.value })}>
                    <option value="fixed">Montant fixe (€)</option>
                    <option value="percentage">Pourcentage (%)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-4">Valeur</label>
                  <input type="number" placeholder={v.discount_type === 'fixed' ? 'Ex: 15' : 'Ex: 20'} className="w-full border-2 border-slate-100 rounded-2xl p-4 font-bold bg-slate-50 outline-none" value={v.discount_value} onChange={e => set({ discount_value: e.target.value })} />
                </div>
              </div>

              <div className="p-4 bg-slate-100 rounded-2xl space-y-4 border border-slate-200">
                <p className="text-xs font-black uppercase text-slate-500">Limites d'utilisation</p>
                <div>
                  <label className="flex items-center gap-3 cursor-pointer mb-2">
                    <input type="checkbox" className="w-4 h-4 accent-amber-500" checked={v.is_unlimited} onChange={e => set({ is_unlimited: e.target.checked })} />
                    <span className="font-bold text-slate-700 text-sm">Utilisations illimitées</span>
                  </label>
                  {!v.is_unlimited && (
                    <input type="number" placeholder="Nombre d'utilisations (ex: 1)" className="w-full border-2 border-slate-200 rounded-xl p-3 font-bold bg-white outline-none" value={v.max_uses} onChange={e => set({ max_uses: e.target.value })} />
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-200 pt-4">
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Valable à partir du</label>
                    <input type="date" className="w-full border-2 border-slate-200 rounded-xl p-3 font-bold bg-white outline-none" value={v.valid_from} onChange={e => set({ valid_from: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Jusqu'au</label>
                    <input type="date" className="w-full border-2 border-slate-200 rounded-xl p-3 font-bold bg-white outline-none" value={v.valid_until} onChange={e => set({ valid_until: e.target.value })} />
                  </div>
                </div>
              </div>

              <div className="p-4 bg-amber-50 rounded-2xl space-y-4 border border-amber-100 mt-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 accent-amber-500" checked={v.is_partner} onChange={e => set({ is_partner: e.target.checked })} />
                  <span className="font-bold text-amber-900 text-sm">🤝 C'est un code Partenaire</span>
                </label>
                {v.is_partner && (
                  <div className="pt-3 border-t border-amber-200/50 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black uppercase text-amber-700 ml-2">Calcul de la commission</label>
                      <select className="w-full border-2 border-amber-200/50 rounded-xl p-3 font-bold bg-white outline-none focus:border-amber-400" value={v.partner_billing_type} onChange={e => set({ partner_billing_type: e.target.value })}>
                        <option value="fixed">Montant net fixe (€)</option>
                        <option value="percentage">Pourcentage (%)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase text-amber-700 ml-2">Commission du partenaire</label>
                      <input type="number" placeholder={v.partner_billing_type === 'percentage' ? 'Ex: 12 (pour 12%)' : 'Ex: 50'} className="w-full border-2 border-amber-200/50 rounded-xl p-3 font-bold bg-white outline-none focus:border-amber-400" value={v.partner_amount} onChange={e => set({ partner_amount: e.target.value })} />
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          <button onClick={handleCreate} className={`w-full text-white py-4 md:py-5 rounded-3xl font-black uppercase italic shadow-xl transition-all ${activeTab === 'gift_card' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-amber-500 hover:bg-amber-600'}`}>
            {cardToEdit ? 'Enregistrer les modifications' : 'Générer le code'}
          </button>
          <button onClick={onClose} className="w-full text-slate-400 font-bold uppercase text-[10px] tracking-widest hover:text-slate-600 pb-2">
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
