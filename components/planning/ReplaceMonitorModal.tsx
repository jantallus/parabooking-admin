"use client";
import React, { useState } from 'react';
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

type Action = 'generate' | 'delete';

export default function ReplaceMonitorModal({ monitor, monitors, viewRange, availablePlans, onClose, onSuccess }: Props) {
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
  const [action, setAction] = useState<Action>('generate');
  const [selectedPlan, setSelectedPlan] = useState(availablePlans[0] || 'Standard');
  const [selectedIds, setSelectedIds] = useState<string[]>([monitor.id]);
  const [isLoading, setIsLoading] = useState(false);

  const toggleMonitor = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleGenerate = async () => {
    if (!selectedIds.length) return;
    setIsLoading(true);
    try {
      const res = await apiFetch('/api/generate-slots', {
        method: 'POST',
        body: JSON.stringify({
          startDate, endDate,
          plan_name: selectedPlan,
          monitor_ids: selectedIds,
          daysToApply: [0, 1, 2, 3, 4, 5, 6],
          ignoreUnavailability: true,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`✅ ${data.count} créneaux générés`);
        await onSuccess();
        onClose();
      } else {
        toast.error(data.error || 'Erreur lors de la génération');
      }
    } catch { toast.error('Erreur de connexion'); }
    finally { setIsLoading(false); }
  };

  const handleDelete = async (force = false) => {
    if (!selectedIds.length) return;
    setIsLoading(true);
    try {
      const res = await apiFetch('/api/delete-slots', {
        method: 'POST',
        body: JSON.stringify({ startDate, endDate, monitor_ids: selectedIds, forceOverwrite: force }),
      });
      const data = await res.json();
      if (res.status === 409 && data.warning) {
        setIsLoading(false);
        const ok = await confirm(data.message);
        if (ok) await handleDelete(true);
        return;
      }
      if (res.ok) {
        toast.success(`✅ ${data.deleted} créneau(x) supprimé(s)`);
        await onSuccess();
        onClose();
      } else {
        toast.error(data.error || 'Erreur lors de la suppression');
      }
    } catch { toast.error('Erreur de connexion'); }
    finally { setIsLoading(false); }
  };

  const canSubmit = selectedIds.length > 0 && !!startDate && !!endDate && !isLoading;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-[40px] p-6 md:p-8 max-w-sm w-full shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">

        <h2 className="text-xl font-black uppercase italic mb-5">Gestion des créneaux</h2>

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

        {/* Sélecteur Générer / Supprimer */}
        <div className="flex gap-2 mb-5">
          <button onClick={() => setAction('generate')}
            className={`flex-1 py-2.5 rounded-2xl font-black text-[10px] uppercase transition-all ${action === 'generate' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>
            📅 Générer
          </button>
          <button onClick={() => setAction('delete')}
            className={`flex-1 py-2.5 rounded-2xl font-black text-[10px] uppercase transition-all ${action === 'delete' ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>
            🗑️ Supprimer
          </button>
        </div>

        {/* Plan (génération uniquement) */}
        {action === 'generate' && availablePlans.length > 0 && (
          <div className="mb-5">
            <label className="text-[8px] font-black uppercase text-slate-400 ml-1 mb-1 block">Modèle</label>
            <select className="w-full border border-slate-200 rounded-xl p-2 text-[11px] font-bold bg-white"
              value={selectedPlan} onChange={e => setSelectedPlan(e.target.value)}>
              {availablePlans.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        )}

        {/* Choix des pilotes */}
        <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-2 ml-1">Pilotes</p>
        <div className="space-y-1 max-h-48 overflow-y-auto pr-1 mb-5 custom-scrollbar">
          {monitors.map(m => (
            <button key={m.id} onClick={() => toggleMonitor(m.id)}
              className={`w-full flex items-center gap-3 p-3 rounded-2xl text-left transition-colors ${selectedIds.includes(m.id) ? 'bg-slate-900 text-white' : 'bg-slate-50 hover:bg-slate-100 text-slate-700'}`}>
              <span className="text-sm font-bold flex-1">{m.title}</span>
              {selectedIds.includes(m.id) && <span className="text-[10px] opacity-60">✓</span>}
            </button>
          ))}
        </div>

        {/* Bouton d'action */}
        {action === 'generate' ? (
          <button disabled={!canSubmit} onClick={handleGenerate}
            className={`w-full py-4 rounded-3xl font-black uppercase italic shadow-xl transition-all mb-3 ${!canSubmit ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-slate-900 text-white hover:scale-105'}`}>
            {isLoading ? '⏳ Génération...' : '📅 Lancer la génération'}
          </button>
        ) : (
          <button disabled={!canSubmit} onClick={() => handleDelete(false)}
            className={`w-full py-4 rounded-3xl font-black uppercase italic shadow-xl transition-all mb-3 ${!canSubmit ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-rose-600 text-white hover:scale-105'}`}>
            {isLoading ? '⏳ Suppression...' : '🗑️ Supprimer les créneaux'}
          </button>
        )}
        <button onClick={onClose} className="w-full text-slate-300 font-bold uppercase text-[10px]">Annuler</button>
      </div>
    </div>
  );
}
