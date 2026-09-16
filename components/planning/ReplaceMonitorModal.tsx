"use client";
import React, { useState, useMemo } from 'react';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/components/ui/ToastProvider';
import type { Monitor, Slot } from '@/lib/types';

interface Props {
  monitor: { id: string; title: string };
  monitors: Monitor[];
  viewRange: { start: Date; end: Date } | null;
  appointments: Slot[];
  availablePlans: string[];
  onClose: () => void;
  onSuccess: () => Promise<void>;
}

export default function ReplaceMonitorModal({ monitor, monitors, viewRange, appointments, availablePlans, onClose, onSuccess }: Props) {
  const { toast, confirm } = useToast();

  const toLocalDate = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const defaultStart = viewRange?.start ? toLocalDate(viewRange.start) : '';
  const defaultEnd = (() => {
    if (!viewRange?.end) return '';
    const d = new Date(viewRange.end);
    d.setDate(d.getDate() - 1);
    return toLocalDate(d);
  })();

  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [replacementId, setReplacementId] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(availablePlans[0] || 'Standard');

  const otherMonitors = monitors.filter(m => m.id !== monitor.id);

  const isNonDispo = (s: Slot) => !!(s.title?.toUpperCase().includes('NON DISPO') || s.title?.includes('❌'));
  const isPause = (s: Slot) => !!(s.title?.includes('☕') || s.title?.toUpperCase().includes('PAUSE'));
  const isRealBooking = (s: Slot) => s.status === 'booked' && !isNonDispo(s) && !isPause(s);

  const monitorASlots = useMemo(() =>
    appointments.filter(a =>
      String(a.monitor_id) === monitor.id &&
      a.start_time.slice(0, 10) >= startDate &&
      a.start_time.slice(0, 10) <= endDate
    ), [appointments, monitor.id, startDate, endDate]);

  const monitorBSlots = useMemo(() =>
    replacementId ? appointments.filter(a =>
      String(a.monitor_id) === replacementId &&
      a.start_time.slice(0, 10) >= startDate &&
      a.start_time.slice(0, 10) <= endDate
    ) : [],
    [appointments, replacementId, startDate, endDate]);

  const aBooked = monitorASlots.filter(isRealBooking).length;
  const aAvailable = monitorASlots.filter(s => s.status === 'available').length;
  const aBlocked = monitorASlots.filter(isNonDispo).length;

  const bBooked = monitorBSlots.filter(isRealBooking).length;
  const bBlocked = monitorBSlots.filter(isNonDispo).length;
  const bHasNoSlots = monitorBSlots.length === 0;

  const replacement = monitors.find(m => m.id === replacementId);

  const handleTransfer = async () => {
    if (!replacementId) return;
    const total = monitorASlots.length;
    if (total === 0) { toast.warning('Aucun créneau à transférer pour cette période.'); return; }
    const ok = await confirm(`Transférer ${total} créneau(x) de ${monitor.title} à ${replacement?.title} ?`);
    if (!ok) return;
    setIsTransferring(true);
    try {
      const res = await apiFetch('/api/replace-monitor', {
        method: 'POST',
        body: JSON.stringify({ fromMonitorId: monitor.id, toMonitorId: replacementId, startDate, endDate }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.skipped > 0) {
          toast.warning(`✅ ${data.count} créneau(x) transféré(s) à ${replacement?.title} — ⚠️ ${data.skipped} réservation(s) non transférée(s) : ${replacement?.title} avait déjà des réservations à ces horaires`);
        } else {
          toast.success(`✅ ${data.count} créneau(x) transféré(s) à ${replacement?.title}`);
        }
        await onSuccess();
        onClose();
      } else {
        toast.error(data.error || 'Erreur lors du transfert');
      }
    } catch { toast.error('Erreur de connexion'); }
    finally { setIsTransferring(false); }
  };

  const handleGenerate = async () => {
    if (!replacementId) return;
    setIsGenerating(true);
    try {
      const res = await apiFetch('/api/generate-slots', {
        method: 'POST',
        body: JSON.stringify({
          startDate, endDate,
          plan_name: selectedPlan,
          monitor_ids: [replacementId],
          daysToApply: [0, 1, 2, 3, 4, 5, 6],
          ignoreUnavailability: true,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`✅ ${data.count} créneaux générés pour ${replacement?.title}`);
        await onSuccess();
      } else {
        toast.error(data.error || 'Erreur lors de la génération');
      }
    } catch { toast.error('Erreur de connexion'); }
    finally { setIsGenerating(false); }
  };

  const handleGenerateForSelf = async () => {
    setIsGenerating(true);
    try {
      const res = await apiFetch('/api/generate-slots', {
        method: 'POST',
        body: JSON.stringify({
          startDate, endDate,
          plan_name: selectedPlan,
          monitor_ids: [monitor.id],
          daysToApply: [0, 1, 2, 3, 4, 5, 6],
          ignoreUnavailability: true,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`✅ ${data.count} créneaux générés pour ${monitor.title}`);
        await onSuccess();
        onClose();
      } else {
        toast.error(data.error || 'Erreur lors de la génération');
      }
    } catch { toast.error('Erreur de connexion'); }
    finally { setIsGenerating(false); }
  };

  const hasNoSlots = monitorASlots.length === 0;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-[40px] p-6 md:p-8 max-w-sm w-full shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">

        <h2 className="text-xl font-black uppercase italic mb-1">{hasNoSlots ? 'Générer' : 'Remplacer'}</h2>
        <p className="text-sm font-bold text-slate-500 mb-5">{monitor.title}</p>

        {/* Période */}
        <div className="flex gap-3 mb-5">
          <div className="flex-1">
            <label className="text-[8px] font-black uppercase text-slate-400 ml-1">Du</label>
            <input type="date" className="w-full border border-slate-200 rounded-xl p-2 text-[11px] font-bold" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div className="flex-1">
            <label className="text-[8px] font-black uppercase text-slate-400 ml-1">Au</label>
            <input type="date" className="w-full border border-slate-200 rounded-xl p-2 text-[11px] font-bold" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
        </div>

        {hasNoSlots ? (
          /* Aucun créneau — proposer uniquement la génération */
          <>
            <div className="bg-sky-50 border border-sky-200 rounded-2xl p-4 mb-4">
              <p className="font-black text-[11px] text-sky-700 mb-1">📅 Aucun créneau sur cette période</p>
              <p className="text-[10px] text-sky-500 mb-3">Générer des créneaux pour {monitor.title} selon un modèle :</p>
              {availablePlans.length > 0 && (
                <select className="w-full border border-sky-200 rounded-xl p-2 text-[10px] font-bold mb-3 bg-white"
                  value={selectedPlan} onChange={e => setSelectedPlan(e.target.value)}>
                  {availablePlans.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              )}
              <button disabled={isGenerating} onClick={handleGenerateForSelf}
                className={`w-full py-3 rounded-2xl font-black text-[11px] uppercase shadow-md transition-all ${isGenerating ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-sky-500 text-white hover:bg-sky-600 hover:scale-[1.02]'}`}>
                {isGenerating ? '⏳ Génération...' : '📅 Générer les créneaux'}
              </button>
            </div>
            <button onClick={onClose} className="w-full text-slate-300 font-bold uppercase text-[10px]">Annuler</button>
          </>
        ) : (
          /* A des créneaux — flow de remplacement */
          <>
            <div className="bg-slate-50 rounded-2xl p-3 mb-4 space-y-1">
              <p className="font-black uppercase text-slate-400 text-[8px] mb-1.5">{monitor.title} sur cette période</p>
              {aBooked > 0 && <p className="text-[11px] font-bold text-slate-700">✈️ {aBooked} réservation{aBooked > 1 ? 's' : ''}</p>}
              {aAvailable > 0 && <p className="text-[11px] text-slate-500">🟢 {aAvailable} créneau{aAvailable > 1 ? 'x' : ''} libre{aAvailable > 1 ? 's' : ''}</p>}
              {aBlocked > 0 && <p className="text-[11px] text-slate-400">🔒 {aBlocked} bloqué{aBlocked > 1 ? 's' : ''}</p>}
            </div>

            <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-2 ml-1">Remplacé par</p>
            <div className="space-y-1 max-h-40 overflow-y-auto pr-1 mb-4 custom-scrollbar">
              {otherMonitors.map(m => (
                <button key={m.id} onClick={() => setReplacementId(m.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-2xl text-left transition-colors ${replacementId === m.id ? 'bg-slate-900 text-white' : 'bg-slate-50 hover:bg-slate-100 text-slate-700'}`}>
                  <span className="text-sm font-bold flex-1">{m.title}</span>
                  {replacementId === m.id && <span className="text-[10px] opacity-60">✓</span>}
                </button>
              ))}
            </div>

            {replacementId && replacement && (
              <div className="mb-5 space-y-2">
                {bBooked > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3">
                    <p className="font-black text-[11px] text-amber-600">⚠️ {replacement.title} a déjà {bBooked} réservation{bBooked > 1 ? 's' : ''}</p>
                    <p className="text-[10px] text-amber-500 mt-0.5">Ces réservations resteront sur {replacement.title} après le transfert (pas de double-réservation possible).</p>
                  </div>
                )}
                {bBlocked > 0 && (
                  <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3">
                    <p className="font-black text-[11px] text-rose-600">🚫 {replacement.title} a {bBlocked} créneau{bBlocked > 1 ? 'x' : ''} bloqué{bBlocked > 1 ? 's' : ''}</p>
                    <p className="text-[10px] text-rose-400 mt-0.5">Ces créneaux resteront bloqués après le transfert.</p>
                  </div>
                )}
                {bHasNoSlots && (
                  <div className="bg-sky-50 border border-sky-200 rounded-2xl p-3">
                    <p className="font-black text-[11px] text-sky-600">📅 Aucun créneau pour {replacement.title} sur cette période</p>
                    <p className="text-[10px] text-sky-500 mt-1 mb-3">Générer des créneaux sur le même modèle avant de transférer.</p>
                    {availablePlans.length > 1 && (
                      <select className="w-full border border-sky-200 rounded-xl p-2 text-[10px] font-bold mb-2 bg-white"
                        value={selectedPlan} onChange={e => setSelectedPlan(e.target.value)}>
                        {availablePlans.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    )}
                    <button disabled={isGenerating} onClick={handleGenerate}
                      className={`w-full py-2.5 rounded-2xl font-black text-[10px] uppercase transition-all ${isGenerating ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-sky-500 text-white hover:bg-sky-600'}`}>
                      {isGenerating ? '⏳ Génération...' : `📅 Générer pour ${replacement.title}`}
                    </button>
                  </div>
                )}
              </div>
            )}

            <button
              disabled={!replacementId || isTransferring}
              onClick={handleTransfer}
              className={`w-full py-4 rounded-3xl font-black uppercase italic shadow-xl transition-all mb-3 ${(!replacementId || isTransferring) ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-slate-900 text-white hover:scale-105'}`}>
              {isTransferring ? '⏳ Transfert en cours...' : '🔄 Transférer les créneaux'}
            </button>
            <button onClick={onClose} className="w-full text-slate-300 font-bold uppercase text-[10px]">Annuler</button>
          </>
        )}
      </div>
    </div>
  );
}
