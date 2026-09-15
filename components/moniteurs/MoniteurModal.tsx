"use client";
import React, { useState, useEffect } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/components/ui/ToastProvider';
import type { User, CurrentUser, Availability } from '@/lib/types';

const EMPTY_USER = {
  first_name: '', email: '', phone: '', password: '', role: 'monitor', is_active_monitor: true,
  google_sync_enabled: false,
  receives_online_payments: false,
  commission_type: 'none',
  commission_value: 0,
  available_start_date: '', available_end_date: '', daily_start_time: '', daily_end_time: '',
  notify_on_request: false,
  request_notification_sms: '',
};

interface Props {
  userToEdit: User | null;
  currentUser: CurrentUser | null;
  onClose: () => void;
  onSaved: () => void;
}

export function MoniteurModal({ userToEdit, currentUser, onClose, onSaved }: Props) {
  const { toast } = useToast();
  const [newUser, setNewUser] = useState({ ...EMPTY_USER });
  const [availabilities, setAvailabilities] = useState<Availability[]>([]);
  const [showPassword, setShowPassword] = useState(false);

  const isOwnProfile = !!(userToEdit && currentUser && userToEdit.id === currentUser.id);

  useEffect(() => {
    if (userToEdit) {
      setNewUser({
        first_name: userToEdit.first_name,
        email: userToEdit.email,
        phone: userToEdit.phone || '',
        password: '',
        role: userToEdit.role,
        is_active_monitor: userToEdit.is_active_monitor ?? true,
        google_sync_enabled: userToEdit.google_sync_enabled ?? false,
        receives_online_payments: userToEdit.receives_online_payments ?? false,
        commission_type: userToEdit.commission_type || 'none',
        commission_value: parseFloat(String(userToEdit.commission_value ?? 0)) || 0,
        available_start_date: '', available_end_date: '', daily_start_time: '', daily_end_time: '',
        notify_on_request: userToEdit.notify_on_request ?? false,
        request_notification_sms: userToEdit.request_notification_sms || '',
      });
      apiFetch(`/api/users/${userToEdit.id}/availabilities`)
        .then(res => res.ok ? res.json() : [])
        .then(data => setAvailabilities(data))
        .catch(() => setAvailabilities([]));
    } else {
      setNewUser({ ...EMPTY_USER });
      setAvailabilities([]);
    }
  }, [userToEdit]);

  const handleSave = async () => {
    if (!newUser.first_name || !newUser.email) {
      toast.warning("Veuillez remplir le nom et l'email.");
      return;
    }
    if (!userToEdit && !newUser.password) {
      toast.warning("Le mot de passe est obligatoire pour un nouveau compte.");
      return;
    }

    const url = userToEdit ? `/api/users/${userToEdit.id}` : '/api/users';
    const method = userToEdit ? 'PATCH' : 'POST';
    const payload: Record<string, unknown> = { ...newUser, status: 'Actif' };
    if (userToEdit && !payload.password) delete payload.password;

    const res = await apiFetch(url, { method, body: JSON.stringify(payload) });
    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error || "Erreur lors de l'enregistrement");
      return;
    }

    const userData = await res.json();
    const userId = userToEdit?.id || userData.id;

    const validAvailabilities = availabilities.filter(a => a.start_date && a.end_date);
    const avRes = await apiFetch(`/api/users/${userId}/availabilities`, {
      method: 'PUT',
      body: JSON.stringify({ availabilities: validAvailabilities }),
    });
    if (!avRes.ok) {
      const avErr = await avRes.json();
      toast.error(avErr.error || "Erreur lors de l'enregistrement des disponibilités");
      return;
    }

    onSaved();
    onClose();
  };

  const updateAvailability = (idx: number, field: string, value: string) => {
    setAvailabilities(prev => prev.map((a, i) => i === idx ? { ...a, [field]: value } : a));
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-[40px] p-6 md:p-8 max-w-md w-full shadow-2xl max-h-[95vh] overflow-y-auto custom-scrollbar">
        <h2 className="text-xl md:text-2xl font-black uppercase italic mb-6">
          {userToEdit ? "Modifier le Prestataire" : "Nouveau Prestataire"}
        </h2>
        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-black uppercase text-slate-400 ml-4">Prénom</label>
            <input type="text" className="w-full border-2 border-slate-100 rounded-2xl p-3 md:p-4 font-bold bg-slate-50 focus:border-orange-300 outline-none" value={newUser.first_name} onChange={e => setNewUser({ ...newUser, first_name: e.target.value })} />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase text-slate-400 ml-4">Email (Identifiant)</label>
            <input type="email" className="w-full border-2 border-slate-100 rounded-2xl p-3 md:p-4 font-bold bg-slate-50 focus:border-orange-300 outline-none" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase text-slate-400 ml-4">Téléphone</label>
            <input type="tel" placeholder="06 XX XX XX XX" className="w-full border-2 border-slate-100 rounded-2xl p-3 md:p-4 font-bold bg-slate-50 focus:border-orange-300 outline-none" value={newUser.phone} onChange={e => setNewUser({ ...newUser, phone: e.target.value })} />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase text-slate-400 ml-4 flex justify-between flex-wrap">
              Mot de passe
              {userToEdit && <span className="normal-case">(Laisser vide pour garder l'actuel)</span>}
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder={userToEdit ? "••••••••" : ""}
                className="w-full border-2 border-slate-100 rounded-2xl p-3 md:p-4 font-bold bg-slate-50 focus:border-orange-300 outline-none pr-12"
                value={newUser.password}
                onChange={e => setNewUser({ ...newUser, password: e.target.value })}
              />
              {isOwnProfile && (
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-orange-500 transition-colors rounded-xl hover:bg-orange-50"
                  title={showPassword ? "Masquer le mot de passe" : "Voir le mot de passe"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              )}
            </div>
          </div>

          <div className="bg-rose-50 p-4 rounded-3xl border border-rose-100 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center px-2 gap-2">
              <p className="text-[10px] font-black uppercase text-rose-500 tracking-widest">🚫 Périodes d'indisponibilité</p>
              <button onClick={() => setAvailabilities(prev => [...prev, { start_date: '', end_date: '', daily_start_time: null, daily_end_time: null }])} className="w-full sm:w-auto bg-rose-500 text-white text-[9px] font-black px-3 py-2 sm:py-1 rounded-lg shadow-sm hover:bg-rose-600 uppercase">
                + Ajouter
              </button>
            </div>

            {availabilities.map((a, idx) => (
              <div key={idx} className="bg-white p-3 rounded-2xl border border-rose-200 relative group/item">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="w-full">
                    <label className="text-[8px] font-black uppercase text-slate-400 ml-1">Du</label>
                    <input type="date" className="w-full border border-slate-100 rounded-lg p-2 text-[10px] font-bold" value={a.start_date} onChange={e => updateAvailability(idx, 'start_date', e.target.value)} />
                  </div>
                  <div className="w-full">
                    <label className="text-[8px] font-black uppercase text-slate-400 ml-1">Au</label>
                    <input type="date" className="w-full border border-slate-100 rounded-lg p-2 text-[10px] font-bold" value={a.end_date} onChange={e => updateAvailability(idx, 'end_date', e.target.value)} />
                  </div>
                </div>
                <button onClick={() => setAvailabilities(prev => prev.filter((_, i) => i !== idx))} className="absolute -top-2 -right-2 bg-rose-500 text-white w-6 h-6 sm:w-5 sm:h-5 rounded-full text-[10px] flex items-center justify-center shadow-md sm:opacity-0 group-hover/item:opacity-100 transition-opacity">✕</button>
              </div>
            ))}

            {availabilities.length === 0 && <p className="text-[10px] text-rose-300 italic text-center py-2">Aucune indisponibilité définie</p>}
          </div>

          {(currentUser?.role === 'admin' || currentUser?.role === 'aravis') && (
            <label className="flex items-center gap-3 p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl cursor-pointer hover:border-indigo-200 transition-colors">
              <input
                type="checkbox"
                className="w-5 h-5 accent-indigo-500"
                checked={newUser.google_sync_enabled}
                onChange={e => setNewUser({ ...newUser, google_sync_enabled: e.target.checked })}
              />
              <div>
                <p className="text-xs font-black uppercase text-slate-700">Synchronisation Google Agenda</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Importe les créneaux depuis Google Calendar via le Apps Script</p>
              </div>
            </label>
          )}

          {(currentUser?.role === 'admin' || currentUser?.role === 'aravis') && (
            <div className="bg-sky-50 p-4 rounded-3xl border border-sky-100 space-y-3">
              <p className="text-[10px] font-black uppercase text-sky-600 tracking-widest px-2">🔔 Notifications demandes de vol</p>
              <label className="flex items-center gap-3 p-3 bg-white border border-sky-200 rounded-2xl cursor-pointer hover:border-sky-400 transition-colors">
                <input
                  type="checkbox"
                  className="w-5 h-5 accent-sky-500"
                  checked={newUser.notify_on_request}
                  onChange={e => setNewUser({ ...newUser, notify_on_request: e.target.checked })}
                />
                <div>
                  <p className="text-xs font-black uppercase text-slate-700">Recevoir un SMS à chaque demande</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Envoie un SMS sur le téléphone de ce compte dès qu&apos;une demande de vol Aravis est soumise.</p>
                </div>
              </label>
              {newUser.notify_on_request && (
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-1 block mb-1">Message personnalisé <span className="font-normal normal-case">(optionnel — variables : [NOM] [TELE] [VOL] [DATE])</span></label>
                  <textarea
                    className="w-full border border-sky-200 rounded-2xl p-3 text-sm font-medium bg-white focus:border-sky-400 outline-none resize-none"
                    rows={3}
                    placeholder={`Nouvelle demande Aravis : [NOM] ([TELE]) — [VOL] le [DATE].`}
                    value={newUser.request_notification_sms}
                    onChange={e => setNewUser({ ...newUser, request_notification_sms: e.target.value })}
                  />
                </div>
              )}
            </div>
          )}

          {(currentUser?.role === 'admin' || currentUser?.role === 'aravis') && (
            <div className="bg-amber-50 p-4 rounded-3xl border border-amber-100 space-y-4">
              <p className="text-[10px] font-black uppercase text-amber-600 tracking-widest px-2">💰 Paiements en ligne</p>

              <label className="flex items-center gap-3 p-3 bg-white border border-amber-200 rounded-2xl cursor-pointer hover:border-amber-400 transition-colors">
                <input
                  type="checkbox"
                  className="w-5 h-5 accent-amber-500"
                  checked={newUser.receives_online_payments}
                  onChange={e => setNewUser({ ...newUser, receives_online_payments: e.target.checked })}
                />
                <div>
                  <p className="text-xs font-black uppercase text-slate-700">Reçoit les paiements en ligne</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Les paiements Stripe (réservations en ligne) sont attribués à ce prestataire. <span className="text-amber-500 font-bold">Un seul pilote possible — activer ici désactive automatiquement les autres.</span></p>
                </div>
              </label>

            </div>
          )}

          <div>
            <label className="text-[10px] font-black uppercase text-slate-400 ml-4">Accès & Rôle</label>
            <select className={`w-full border-2 border-slate-100 rounded-2xl p-3 md:p-4 font-bold outline-none text-sm md:text-base ${currentUser?.role !== 'admin' && currentUser?.role !== 'aravis' ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-slate-50 focus:border-orange-300'}`} value={newUser.role} disabled={currentUser?.role !== 'admin' && currentUser?.role !== 'aravis'} onChange={e => setNewUser({ ...newUser, role: e.target.value })}>
              <option value="monitor">🏃 Moniteur Journée (Pas d'accès logiciel)</option>
              <option value="permanent">🔑 Moniteur Permanent (Accès calendrier)</option>
              <option value="admin">🛡️ Administrateur (Accès total)</option>
            </select>
            {currentUser?.role !== 'admin' && currentUser?.role !== 'aravis' && <p className="text-[9px] text-slate-400 mt-1 ml-4 italic">Seul un administrateur peut modifier ce champ.</p>}
          </div>

          <div className="pt-4 space-y-3">
            <button onClick={handleSave} className="w-full bg-orange-500 text-white py-4 rounded-3xl font-black uppercase italic shadow-xl hover:bg-orange-600 transition-all text-sm md:text-base">
              {userToEdit ? "Enregistrer les modifications" : "Créer le compte"}
            </button>
            <button onClick={onClose} className="w-full text-slate-400 font-bold uppercase text-[10px] md:text-xs tracking-widest hover:text-slate-600 transition-colors pb-2 md:pb-0">Annuler</button>
          </div>
        </div>
      </div>
    </div>
  );
}
