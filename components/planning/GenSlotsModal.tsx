"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/components/ui/ToastProvider';
import type { Monitor } from '@/lib/types';

interface PilotStatus {
  id: string;
  name: string;
  hasUnavailability: boolean;
}

interface Props {
  availablePlans: string[];
  monitors: Monitor[];
  loadAppointments: () => Promise<void>;
  onClose: () => void;
}

export default function GenSlotsModal({ availablePlans, monitors, loadAppointments, onClose }: Props) {
  const { toast, confirm } = useToast();
  const [action, setAction] = useState<'generate' | 'delete'>('generate');
  const [genConfig, setGenConfig] = useState({
    startDate: '', endDate: '', daysToApply: [1, 2, 3, 4, 5, 6, 0], plan_name: 'Standard',
  });
  const [selectedPilotIds, setSelectedPilotIds] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [availCheck, setAvailCheck] = useState<{ pilots: PilotStatus[] } | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [blockedPilotIds, setBlockedPilotIds] = useState<string[]>([]);

  const activeMonitors = monitors.filter(m => m.is_active !== false);
  const inactiveMonitors = monitors.filter(m => m.is_active === false);

  // Initialise la sélection à tous les pilotes actifs au chargement
  useEffect(() => {
    if (monitors.length > 0 && selectedPilotIds.length === 0) {
      setSelectedPilotIds(activeMonitors.map(m => m.id));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monitors]);

  const checkAvailability = useCallback(async (startDate: string, endDate: string) => {
    if (!startDate || !endDate) { setAvailCheck(null); return; }
    setIsChecking(true);
    try {
      const res = await apiFetch('/api/pilots/check-availability', {
        method: 'POST',
        body: JSON.stringify({ startDate, endDate }),
      });
      if (res.ok) setAvailCheck(await res.json());
    } catch { /* silent */ }
    finally { setIsChecking(false); }
  }, []);

  useEffect(() => {
    checkAvailability(genConfig.startDate, genConfig.endDate);
  }, [genConfig.startDate, genConfig.endDate, checkAvailability]);

  const availStatusFor = (id: string): PilotStatus | undefined =>
    availCheck?.pilots.find(p => p.id === id);

  const sendGenerationRequest = async (force = false, generateForIds?: string[], blockedIds?: string[]) => {
    try {
      const ids = generateForIds ?? selectedPilotIds;
      const payload: Record<string, unknown> = {
        ...genConfig,
        forceOverwrite: force,
        monitor_ids: ids,
        blocked_pilot_ids: blockedIds ?? blockedPilotIds,
      };
      const res = await apiFetch('/api/generate-slots', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.status === 409 && data.planConflict) {
        toast.error(data.message);
        if (data.existingPlan) setGenConfig(prev => ({ ...prev, plan_name: data.existingPlan }));
        setIsGenerating(false);
        return;
      }
      if (res.status === 409 && data.warning) {
        const confirmed = await confirm(data.message);
        if (confirmed) return sendGenerationRequest(true, generateForIds, blockedIds);
        else { setIsGenerating(false); return; }
      }
      if (res.ok) {
        if (data.count === 0 && data.debug) {
          const { monitorsFound, defsFound } = data.debug;
          if (defsFound === 0) toast.warning('0 créneau généré — aucune rotation configurée dans ce profil');
          else if (monitorsFound === 0) toast.warning('0 créneau généré — aucun pilote actif trouvé');
          else toast.warning(`0 créneau généré — ${monitorsFound} pilote(s), ${defsFound} rotation(s) mais filtrés par disponibilités`);
          onClose();
          await loadAppointments();
        } else {
          toast.success(`✅ ${data.count} créneaux générés avec succès !`);
          onClose();
          await loadAppointments();
        }
      } else {
        toast.error('Erreur : ' + (data.error || 'Erreur inconnue'));
      }
    } catch {
      toast.error('Erreur de connexion au serveur.');
    }
  };

  const handleGenerate = async () => {
    if (!genConfig.startDate || !genConfig.endDate) { toast.warning('Veuillez sélectionner des dates.'); return; }
    if (selectedPilotIds.length === 0) { toast.warning('Sélectionnez au moins un pilote.'); return; }
    setIsGenerating(true);
    await sendGenerationRequest(false);
    setIsGenerating(false);
  };

  const sendDeleteRequest = async (force = false) => {
    try {
      const res = await apiFetch('/api/delete-slots', {
        method: 'POST',
        body: JSON.stringify({ startDate: genConfig.startDate, endDate: genConfig.endDate, monitor_ids: selectedPilotIds, forceOverwrite: force }),
      });
      const data = await res.json();
      if (res.status === 409 && data.warning) {
        const confirmed = await confirm(data.message);
        if (confirmed) return sendDeleteRequest(true);
        else { setIsDeleting(false); return; }
      }
      if (res.ok) {
        toast.success(`🗑️ ${data.deleted || 0} créneau(x) supprimé(s).`);
        onClose();
        await loadAppointments();
      } else {
        toast.error('Erreur : ' + (data.error || 'Erreur inconnue'));
      }
    } catch {
      toast.error('Erreur de connexion au serveur.');
    }
  };

  const handleDelete = async () => {
    if (!genConfig.startDate || !genConfig.endDate) { toast.warning('Veuillez sélectionner des dates.'); return; }
    setIsDeleting(true);
    await sendDeleteRequest(false);
    setIsDeleting(false);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-[40px] p-8 max-w-sm w-full shadow-2xl">

        <>
          <h2 className="text-xl font-black uppercase italic mb-6">Gestion des créneaux</h2>
          <div className="space-y-4">
            <input type="date" className="w-full border-2 border-slate-100 rounded-2xl p-4"
              onChange={e => setGenConfig({ ...genConfig, startDate: e.target.value })} />
            <input type="date" className="w-full border-2 border-slate-100 rounded-2xl p-4"
              onChange={e => setGenConfig({ ...genConfig, endDate: e.target.value })} />

            {/* Sélecteur Générer / Supprimer */}
            <div className="flex gap-2">
              <button onClick={() => setAction('generate')}
                className={`flex-1 py-2.5 rounded-2xl font-black text-[10px] uppercase transition-all ${action === 'generate' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>
                📅 Générer
              </button>
              <button onClick={() => setAction('delete')}
                className={`flex-1 py-2.5 rounded-2xl font-black text-[10px] uppercase transition-all ${action === 'delete' ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>
                🗑️ Supprimer
              </button>
            </div>

            {action === 'generate' && (
              <select className="w-full border-2 border-slate-100 rounded-2xl p-4 font-bold text-slate-700"
                value={genConfig.plan_name}
                onChange={e => setGenConfig({ ...genConfig, plan_name: e.target.value })}>
                <option value="" disabled>-- Choisir le Modèle --</option>
                {availablePlans.map(plan => <option key={plan} value={plan}>{plan}</option>)}
              </select>
            )}

            {/* Sélection des pilotes avec cases à cocher */}
            <div>
              <div className="flex items-center justify-between mb-2 px-1">
                <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Pilotes</p>
                <div className="flex gap-3">
                  <button onClick={() => setSelectedPilotIds(activeMonitors.map(m => m.id))}
                    className="text-[9px] font-bold text-slate-400 hover:text-slate-600 uppercase">Tous</button>
                  <button onClick={() => setSelectedPilotIds([])}
                    className="text-[9px] font-bold text-slate-400 hover:text-slate-600 uppercase">Aucun</button>
                </div>
              </div>
              <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                {activeMonitors.map(m => {
                  const status = availStatusFor(m.id);
                  const isSelected = selectedPilotIds.includes(m.id);
                  const hasUnavail = status?.hasUnavailability;
                  const isBlocked = blockedPilotIds.includes(m.id);
                  return (
                    <div key={m.id} className={`flex items-center gap-2 p-3 rounded-2xl transition-colors ${isSelected ? 'bg-slate-100' : 'bg-slate-50 opacity-50'}`}>
                      <label className="flex items-center gap-2 flex-1 cursor-pointer">
                        <input type="checkbox" className="w-4 h-4 accent-orange-500 shrink-0"
                          checked={isSelected}
                          onChange={e => {
                            if (e.target.checked) setSelectedPilotIds(prev => [...prev, m.id]);
                            else {
                              setSelectedPilotIds(prev => prev.filter(id => id !== m.id));
                              setBlockedPilotIds(prev => prev.filter(id => id !== m.id));
                            }
                          }} />
                        <span className="text-sm font-bold text-slate-700">{m.title}</span>
                      </label>
                      {genConfig.startDate && genConfig.endDate && !isChecking && hasUnavail && (
                        <span className="text-[9px] font-bold text-rose-400">jours bloqués</span>
                      )}
                      {isSelected && (
                        <button
                          onClick={() => setBlockedPilotIds(prev => isBlocked ? prev.filter(id => id !== m.id) : [...prev, m.id])}
                          className={`text-[9px] font-black px-2 py-1 rounded-lg transition-colors whitespace-nowrap ${isBlocked ? 'bg-slate-700 text-white' : 'bg-slate-200 text-slate-400 hover:bg-slate-300'}`}
                          title={isBlocked ? 'Créneaux bloqués — cliquer pour générer en disponible' : 'Cliquer pour générer en bloqué'}
                        >
                          {isBlocked ? '🔒 Bloqué' : '🔓'}
                        </button>
                      )}
                    </div>
                  );
                })}
                {inactiveMonitors.map(m => (
                  <div key={m.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl opacity-30">
                    <input type="checkbox" className="w-4 h-4 shrink-0" disabled />
                    <span className="text-sm font-bold text-slate-400 flex-1">{m.title}</span>
                    <span className="text-[9px] text-slate-400">inactif</span>
                  </div>
                ))}
              </div>
            </div>

            {action === 'generate' ? (
              <button disabled={isGenerating} onClick={handleGenerate}
                className={`w-full py-4 rounded-3xl font-black uppercase italic shadow-xl transition-all ${isGenerating ? 'bg-slate-400 text-slate-200 cursor-not-allowed' : 'bg-slate-900 text-white hover:scale-105'}`}>
                {isGenerating ? '⏳ Génération en cours...' : '🚀 Lancer la génération'}
              </button>
            ) : (
              <button disabled={isDeleting} onClick={handleDelete}
                className={`w-full py-4 rounded-3xl font-black uppercase italic shadow-xl transition-all ${isDeleting ? 'bg-slate-400 text-slate-200 cursor-not-allowed' : 'bg-rose-600 text-white hover:scale-105'}`}>
                {isDeleting ? '⏳ Suppression...' : '🗑️ Supprimer les créneaux'}
              </button>
            )}
            <button onClick={onClose} className="w-full text-slate-300 font-bold uppercase text-[10px]">Fermer</button>
          </div>
        </>
      </div>
    </div>
  );
}
