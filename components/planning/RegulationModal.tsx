"use client";
import React, { useState, useMemo } from 'react';
import { apiFetch } from '@/lib/api';
import type { Monitor, Slot } from '@/lib/types';

interface CalendarEv {
  extendedProps: Slot & { price_cents?: number | null };
}

interface ApiMonitor {
  id: string;
  first_name: string;
  flights: { effective_price_euros: number; encaisseur_id: string | number | null }[];
}

interface Props {
  currentDate: string;
  calendarEvents: CalendarEv[];
  monitors: Monitor[];
  visibleMonitorIds: string[];
  onClose: () => void;
}

function fmt(cents: number) {
  return (cents / 100).toFixed(2).replace('.', ',') + ' €';
}

function computeTricount(items: { id: string; name: string; flightCents: number; collectedCents: number }[]) {
  const balances = items
    .map(m => ({ ...m, diff: m.collectedCents - m.flightCents }))
    .filter(b => Math.abs(b.diff) > 5);
  const debtors   = balances.filter(b => b.diff > 0).map(b => ({ ...b, rem: b.diff }));
  const creditors = balances.filter(b => b.diff < 0).map(b => ({ ...b, rem: -b.diff }));
  const transactions: { from: string; to: string; amount: number }[] = [];
  let di = 0, ci = 0;
  while (di < debtors.length && ci < creditors.length) {
    const amount = Math.min(debtors[di].rem, creditors[ci].rem);
    if (amount > 5) transactions.push({ from: debtors[di].name, to: creditors[ci].name, amount });
    debtors[di].rem -= amount; creditors[ci].rem -= amount;
    if (debtors[di].rem < 5) di++;
    if (creditors[ci].rem < 5) ci++;
  }
  return { balances, transactions };
}

function RegulationSection({ balances, transactions }: { balances: ReturnType<typeof computeTricount>['balances']; transactions: ReturnType<typeof computeTricount>['transactions'] }) {
  if (balances.length === 0) {
    return <p className="text-center text-emerald-600 font-bold text-sm py-4">✅ Tout est équilibré</p>;
  }
  return (
    <div className="space-y-3">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-[9px] uppercase text-slate-400 font-black border-b border-slate-100">
            <th className="py-1.5 text-left">Pilote</th>
            <th className="py-1.5 text-right">Réalisé</th>
            <th className="py-1.5 text-right">Encaissé</th>
            <th className="py-1.5 text-right">Balance</th>
          </tr>
        </thead>
        <tbody>
          {balances.map(b => (
            <tr key={b.id} className="border-b border-slate-50">
              <td className="py-1.5 font-black text-slate-800 uppercase text-[11px]">{b.name}</td>
              <td className="py-1.5 text-right text-slate-500 font-bold">{fmt(b.flightCents)}</td>
              <td className="py-1.5 text-right text-slate-500 font-bold">{fmt(b.collectedCents)}</td>
              <td className={`py-1.5 text-right font-black text-[11px] ${b.diff > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                {b.diff > 0 ? `+${fmt(b.diff)}` : `-${fmt(-b.diff)}`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {transactions.length > 0 ? (
        <div className="space-y-2 pt-1">
          <p className="text-[9px] font-black uppercase text-slate-400">Virements</p>
          {transactions.map((t, i) => (
            <div key={i} className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
              <span className="font-black text-rose-700 uppercase text-xs">{t.from}</span>
              <span className="text-slate-400 text-xs">→</span>
              <span className="font-black text-emerald-700 uppercase text-xs">{t.to}</span>
              <span className="ml-auto font-black text-slate-900 text-sm">{fmt(t.amount)}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-center text-emerald-600 font-bold text-sm">✅ Tout est équilibré — aucun virement</p>
      )}
    </div>
  );
}

export default function RegulationModal({ currentDate, calendarEvents, monitors, visibleMonitorIds, onClose }: Props) {
  const [from, setFrom] = useState(() => {
    const d = new Date(currentDate);
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [to, setTo] = useState(currentDate);
  const [pastData, setPastData] = useState<ApiMonitor[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const visibleSet = useMemo(() => new Set(visibleMonitorIds), [visibleMonitorIds]);

  // Moniteurs qui ont au moins une réservation le jour affiché
  const bookedOnDayIds = useMemo(() => {
    const ids = new Set<string>();
    for (const ev of calendarEvents) {
      const ep = ev.extendedProps;
      if (ep.status === 'booked' && ep.start_time.startsWith(currentDate)) {
        ids.add(ep.monitor_id?.toString() ?? '');
      }
    }
    ids.delete('');
    return ids;
  }, [calendarEvents, currentDate]);

  // Régulation du jour courant depuis les données déjà chargées
  const todayRegulation = useMemo(() => {
    const onlineCollectorId = (monitors as (typeof monitors[0] & { receives_online_payments?: boolean })[]).find(m => m.receives_online_payments)?.id ?? null;
    const flew: Record<string, number> = {};
    const collected: Record<string, number> = {};
    visibleMonitorIds.forEach(id => { flew[id] = 0; collected[id] = 0; });

    for (const ev of calendarEvents) {
      const ep = ev.extendedProps;
      if (ep.status !== 'booked') continue;
      if (!ep.start_time.startsWith(currentDate)) continue;
      const pd = ep.payment_data;
      if (!pd?.payment_type || pd.payment_type === 'np') continue;

      const monId = ep.monitor_id?.toString() ?? '';
      if (!visibleSet.has(monId)) continue;

      const totalCents = ep.price_cents ?? 0;
      const compCents = pd.complement_total_cents ? Number(pd.complement_total_cents) : 0;
      const flightCents = totalCents - compCents;

      flew[monId] = (flew[monId] ?? 0) + totalCents;

      // Résoudre l'encaisseur effectif
      const effectiveEncId = (pd.payment_type === 'online' && !pd.encaisseur_id)
        ? onlineCollectorId
        : (pd.encaisseur_id ? String(pd.encaisseur_id) : null);
      if (!effectiveEncId) continue;

      if (pd.complement_payment_type && pd.complement_encaisseur_id && compCents > 0) {
        if (effectiveEncId in collected) collected[effectiveEncId] += flightCents;
        const compEncId = String(pd.complement_encaisseur_id);
        if (compEncId in collected) collected[compEncId] += compCents;
      } else {
        if (effectiveEncId in collected) collected[effectiveEncId] += totalCents;
      }
    }

    const monitorName = (id: string) =>
      (monitors as { id: string; title: string }[]).find(m => m.id === id)?.title?.split(' ')[0] ?? id;

    const items = visibleMonitorIds
      .filter(id => (flew[id] ?? 0) > 0 || (collected[id] ?? 0) > 0)
      .map(id => ({ id, name: monitorName(id), flightCents: flew[id] ?? 0, collectedCents: collected[id] ?? 0 }));

    return items.length > 0 ? computeTricount(items) : null;
  }, [calendarEvents, currentDate, visibleMonitorIds, visibleSet, monitors]);

  const loadPast = async () => {
    setLoading(true); setError(''); setPastData(null);
    try {
      const res = await apiFetch(`/api/regularisation?from=${from}&to=${to}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      setPastData(json.monitors ?? []);
    } catch { setError('Impossible de charger les données.'); }
    finally { setLoading(false); }
  };

  const pastRegulation = useMemo(() => {
    if (!pastData) return null;
    const relevant = pastData.filter(m => m.flights.length > 0 && bookedOnDayIds.has(m.id));
    if (relevant.length === 0) return null;

    const flew: Record<string, number> = {};
    const collected: Record<string, number> = {};
    relevant.forEach(m => { flew[m.id] = 0; collected[m.id] = 0; });

    relevant.forEach(m => m.flights.forEach(f => {
      if (!f.encaisseur_id) return;
      flew[m.id] += Math.round(f.effective_price_euros * 100);
      const eid = String(f.encaisseur_id);
      if (eid in collected) collected[eid] += Math.round(f.effective_price_euros * 100);
    }));

    const items = relevant.map(m => ({
      id: m.id, name: m.first_name,
      flightCents: flew[m.id] ?? 0,
      collectedCents: collected[m.id] ?? 0,
    }));
    return computeTricount(items);
  }, [pastData]);

  const dateLabel = new Date(currentDate + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
      <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white rounded-t-[32px] px-6 pt-6 pb-4 border-b border-slate-100 flex items-center justify-between z-10">
          <h2 className="text-lg font-black uppercase italic tracking-tight text-slate-900">⚖️ Régulation</h2>
          <button onClick={onClose} className="text-slate-300 hover:text-slate-600 transition-colors text-xl font-bold">✕</button>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* Section 1 — Jour courant */}
          <div>
            <p className="text-[10px] font-black uppercase text-slate-400 mb-3 capitalize">{dateLabel}</p>
            {todayRegulation ? (
              <RegulationSection balances={todayRegulation.balances} transactions={todayRegulation.transactions} />
            ) : (
              <p className="text-sm text-slate-400 font-medium text-center py-3">Aucun encaissement renseigné ce jour.</p>
            )}
          </div>

          {/* Séparateur */}
          <div className="border-t-2 border-dashed border-slate-100" />

          {/* Section 2 — Période antérieure */}
          <div>
            <p className="text-[10px] font-black uppercase text-slate-400 mb-3">Période antérieure</p>
            <div className="space-y-2 mb-3">
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-[9px] font-black uppercase text-slate-400 block mb-1">Du</label>
                  <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold" />
                </div>
                <div className="flex-1">
                  <label className="text-[9px] font-black uppercase text-slate-400 block mb-1">Au</label>
                  <input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold" />
                </div>
              </div>
              <button onClick={loadPast} disabled={loading} className="w-full bg-slate-900 text-white py-2.5 rounded-xl font-black uppercase text-[10px] disabled:opacity-50">
                {loading ? 'Chargement…' : 'Calculer'}
              </button>
            </div>
            {error && <p className="text-rose-500 text-xs font-bold mb-2">{error}</p>}
            {pastRegulation && (
              <RegulationSection balances={pastRegulation.balances} transactions={pastRegulation.transactions} />
            )}
            {pastData && !pastRegulation && (
              <p className="text-sm text-slate-400 font-medium text-center py-3">Aucun vol sur cette période.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
