"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/components/ui/ToastProvider';
import { Pencil, Trash2, Plus, RefreshCw, X, Check } from 'lucide-react';

interface BookingFields {
  name: boolean;
  phone: boolean;
  email: boolean;
  flight_type: boolean;
  weight: boolean;
  notes: boolean;
}

interface PartnerFlightTypeConfig {
  flight_type_id: number;
  base_price_cents: number | null;
}

interface FlightTypeOption {
  id: number;
  name: string;
  price_cents: number;
  season?: string;
  is_active?: boolean;
}

interface Monitor {
  id: string;
  title: string;
}

interface Partner {
  id: number;
  name: string;
  code: string;
  color_code: string;
  booking_fields: BookingFields;
  is_active: boolean;
  commission_type: 'none' | 'percentage' | 'fixed';
  commission_value: number;
  facturable: boolean;
  default_encaisseur_id: string | null;
  allowed_flight_types: PartnerFlightTypeConfig[];
}

const COLORS = [
  { hex: '#6366f1', label: 'Indigo' },
  { hex: '#0ea5e9', label: 'Ciel' },
  { hex: '#10b981', label: 'Émeraude' },
  { hex: '#f59e0b', label: 'Ambre' },
  { hex: '#f43f5e', label: 'Rose' },
  { hex: '#a855f7', label: 'Violet' },
  { hex: '#f97316', label: 'Orange' },
  { hex: '#14b8a6', label: 'Sarcelle' },
  { hex: '#d946ef', label: 'Fuchsia' },
  { hex: '#64748b', label: 'Ardoise' },
];

const FIELD_LABELS: { key: keyof BookingFields; label: string; desc: string }[] = [
  { key: 'name',        label: 'Nom du client',    desc: 'Prénom + nom' },
  { key: 'phone',       label: 'Téléphone',         desc: 'Numéro mobile' },
  { key: 'email',       label: 'Email',             desc: 'Adresse email' },
  { key: 'flight_type', label: 'Type de vol',       desc: 'Prestation choisie' },
  { key: 'weight',      label: 'Poids',             desc: 'Poids du passager' },
  { key: 'notes',       label: 'Notes',             desc: 'Message libre' },
];

const FULL_FIELDS: BookingFields = { name: true, phone: true, email: true, flight_type: true, weight: true, notes: true };
const MINIMAL_FIELDS: BookingFields = { name: false, phone: false, email: false, flight_type: false, weight: false, notes: false };

function getMode(fields: BookingFields): 'minimal' | 'full' | 'custom' {
  const vals = Object.values(fields);
  if (vals.every(v => !v)) return 'minimal';
  if (vals.every(v => v)) return 'full';
  return 'custom';
}

function generateCode(name: string): string {
  return name.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'PARTNER';
}

const emptyPartner = (): Omit<Partner, 'id'> => ({
  name: '', code: '', color_code: '#6366f1',
  booking_fields: { name: true, phone: true, email: true, flight_type: true, weight: false, notes: false },
  is_active: true,
  commission_type: 'none',
  commission_value: 0,
  facturable: true,
  default_encaisseur_id: null,
  allowed_flight_types: [],
});

export default function PartenairesPage() {
  const { toast, confirm } = useToast();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [flightTypes, setFlightTypes] = useState<FlightTypeOption[]>([]);
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Partner | null>(null);
  const [form, setForm] = useState(emptyPartner());
  const [mode, setMode] = useState<'minimal' | 'full' | 'custom'>('full');
  const [saving, setSaving] = useState(false);
  // allowedFlightPrices: flight_type_id → price override string (empty = use catalog)
  const [allowedFlightPrices, setAllowedFlightPrices] = useState<Record<number, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [partnersRes, ftRes, monRes] = await Promise.all([
        apiFetch('/api/partners'),
        apiFetch('/api/flight-types'),
        apiFetch('/api/monitors-admin'),
      ]);
      if (partnersRes.ok) setPartners(await partnersRes.json());
      if (ftRes.ok) {
        const data = await ftRes.json();
        setFlightTypes(Array.isArray(data) ? data.filter((f: FlightTypeOption) => f.is_active !== false) : []);
      }
      if (monRes.ok) {
        const data = await monRes.json();
        setMonitors(Array.isArray(data) ? data.map((m: { id: string; first_name: string; last_name?: string }) => ({ id: m.id, title: `${m.first_name}${m.last_name ? ' ' + m.last_name : ''}` })) : []);
      }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    const p = emptyPartner();
    setForm(p);
    setMode(getMode(p.booking_fields));
    setAllowedFlightPrices({});
    setShowModal(true);
  };

  const openEdit = (p: Partner) => {
    setEditing(p);
    setForm({ name: p.name, code: p.code, color_code: p.color_code, booking_fields: { ...p.booking_fields }, is_active: p.is_active, commission_type: p.commission_type || 'none', commission_value: p.commission_value ?? 0, facturable: p.facturable ?? true, default_encaisseur_id: p.default_encaisseur_id ?? null, allowed_flight_types: p.allowed_flight_types || [] });
    setMode(getMode(p.booking_fields));
    const prices: Record<number, string> = {};
    (p.allowed_flight_types || []).forEach(ft => {
      prices[ft.flight_type_id] = ft.base_price_cents != null ? (ft.base_price_cents / 100).toFixed(2) : '';
    });
    setAllowedFlightPrices(prices);
    setShowModal(true);
  };

  const handleModeChange = (m: 'minimal' | 'full' | 'custom') => {
    setMode(m);
    if (m === 'minimal') setForm(f => ({ ...f, booking_fields: { ...MINIMAL_FIELDS } }));
    else if (m === 'full') setForm(f => ({ ...f, booking_fields: { ...FULL_FIELDS } }));
  };

  const toggleField = (key: keyof BookingFields) => {
    setForm(f => {
      const next = { ...f.booking_fields, [key]: !f.booking_fields[key] };
      return { ...f, booking_fields: next };
    });
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.code.trim()) { toast.error('Nom et code requis'); return; }
    setSaving(true);
    const allowedFtIds = Object.keys(allowedFlightPrices).map(Number);
    const allowed_flight_types = allowedFtIds.map(id => ({
      flight_type_id: id,
      base_price_cents: allowedFlightPrices[id] ? Math.round(parseFloat(allowedFlightPrices[id]) * 100) : null,
    }));
    try {
      const method = editing ? 'PUT' : 'POST';
      const url = editing ? `/api/partners/${editing.id}` : '/api/partners';
      const res = await apiFetch(url, { method, body: JSON.stringify({ ...form, allowed_flight_types }) });
      if (res.ok) {
        toast.success(editing ? 'Partenaire mis à jour' : 'Partenaire créé');
        setShowModal(false);
        load();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Erreur');
      }
    } finally { setSaving(false); }
  };

  const handleDelete = async (p: Partner) => {
    if (!await confirm(`Supprimer le partenaire "${p.name}" ?`)) return;
    await apiFetch(`/api/partners/${p.id}`, { method: 'DELETE' });
    load();
  };

  const fieldSummary = (fields: BookingFields) => {
    const m = getMode(fields);
    if (m === 'minimal') return 'Code seul → client anonyme';
    if (m === 'full') return 'Formulaire complet';
    return FIELD_LABELS.filter(f => fields[f.key]).map(f => f.label).join(', ');
  };

  return (
    <div className="p-4 md:p-8 bg-slate-50 min-h-screen font-sans">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <p className="text-indigo-500 font-black uppercase text-xs tracking-widest mb-1">Accès & Intégrations</p>
          <h1 className="text-3xl md:text-4xl font-black uppercase italic tracking-tighter text-slate-900">
            Par<span className="text-indigo-500">tenaires</span>
          </h1>
        </div>
        <button onClick={openCreate} className="w-full md:w-auto flex items-center justify-center gap-2 bg-indigo-600 text-white px-8 py-3 rounded-2xl font-black uppercase italic shadow-xl hover:scale-105 transition-transform">
          <Plus size={16} /> Nouveau Partenaire
        </button>
      </header>

      {loading ? (
        <div className="text-center py-16 text-slate-400 font-bold animate-pulse">Chargement...</div>
      ) : partners.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-[40px] border border-slate-100 shadow-sm">
          <p className="text-5xl mb-4">🤝</p>
          <p className="font-black text-slate-400 italic">Aucun partenaire configuré.</p>
          <p className="text-xs text-slate-400 mt-2">Créez un partenaire pour définir son accès et son formulaire de réservation.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {partners.map(p => (
            <div key={p.id} className={`bg-white rounded-[28px] border shadow-sm overflow-hidden flex flex-col md:flex-row ${p.is_active ? 'border-slate-100' : 'border-slate-100 opacity-60'}`}>
              {/* Bande couleur */}
              <div className="w-full md:w-2 shrink-0 h-2 md:h-auto" style={{ backgroundColor: p.color_code }} />

              <div className="flex flex-col md:flex-row items-start md:items-center gap-4 flex-1 p-5">
                {/* Couleur + Nom */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-xl shrink-0 border-2 border-white shadow" style={{ backgroundColor: p.color_code }} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-slate-900 text-lg leading-tight">{p.name}</span>
                      {!p.is_active && <span className="text-[9px] font-black uppercase bg-slate-100 text-slate-400 px-2 py-0.5 rounded-md">Inactif</span>}
                    </div>
                    <code className="text-xs font-black text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-md mt-0.5 inline-block">{p.code}</code>
                  </div>
                </div>

                {/* Résumé champs */}
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Formulaire</p>
                  <p className="text-xs font-bold text-slate-600 truncate">{fieldSummary(p.booking_fields)}</p>
                </div>

                {/* Facturable */}
                <div className="shrink-0 text-center">
                  <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Encaissement</p>
                  <p className="text-xs font-bold">
                    {p.facturable
                      ? <span className="text-orange-600">📄 À facturer{p.default_encaisseur_id ? ` · ${monitors.find(m => m.id === p.default_encaisseur_id?.toString())?.title?.split(' ')[0] ?? ''}` : ''}</span>
                      : <span className="text-emerald-600">💳 Direct client</span>}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => openEdit(p)} className="p-2.5 text-indigo-500 hover:bg-indigo-50 rounded-xl border border-indigo-100 transition-colors">
                    <Pencil size={15} />
                  </button>
                  <button onClick={() => handleDelete(p)} className="p-2.5 text-rose-500 hover:bg-rose-50 rounded-xl border border-rose-100 transition-colors">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal création/édition */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <h2 className="font-black text-lg uppercase italic">{editing ? 'Modifier le partenaire' : 'Nouveau partenaire'}</h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-100 rounded-xl"><X size={18} /></button>
            </div>

            <div className="p-6 space-y-6">
              {/* Nom */}
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-2">Nom du partenaire</label>
                <input
                  type="text"
                  className="w-full border-2 border-slate-200 rounded-2xl p-4 font-bold outline-none focus:border-indigo-400 text-slate-800"
                  placeholder="Ex : Hôtel Beauregard"
                  value={form.name}
                  onChange={e => {
                    const name = e.target.value;
                    setForm(f => ({ ...f, name, code: !editing ? generateCode(name) : f.code }));
                  }}
                />
              </div>

              {/* Code */}
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-2">Code d'accès</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="flex-1 border-2 border-slate-200 rounded-2xl p-4 font-black uppercase tracking-widest outline-none focus:border-indigo-400 text-indigo-600"
                    placeholder="MONCODE"
                    value={form.code}
                    onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') }))}
                  />
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, code: generateCode(f.name) }))}
                    className="p-4 bg-slate-100 hover:bg-slate-200 rounded-2xl text-slate-500 transition-colors"
                    title="Regénérer"
                  >
                    <RefreshCw size={16} />
                  </button>
                </div>
              </div>

              {/* Couleur */}
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-3">Couleur dans le calendrier</label>
                <div className="flex flex-wrap gap-2">
                  {COLORS.map(c => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, color_code: c.hex }))}
                      title={c.label}
                      className="relative w-9 h-9 rounded-xl transition-transform hover:scale-110"
                      style={{ backgroundColor: c.hex }}
                    >
                      {form.color_code === c.hex && (
                        <Check size={16} className="absolute inset-0 m-auto text-white" strokeWidth={3} />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mode formulaire */}
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-3">Formulaire de réservation</label>
                <div className="space-y-2">
                  {[
                    { id: 'minimal', label: 'Code seul', desc: 'Le client apparaît comme "Client [Partenaire]" sans autre info' },
                    { id: 'full',    label: 'Complet',   desc: 'Tous les champs sont demandés' },
                    { id: 'custom',  label: 'Personnalisé', desc: 'Choisir champ par champ' },
                  ].map(opt => (
                    <label key={opt.id} className={`flex items-start gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-colors ${mode === opt.id ? 'border-indigo-400 bg-indigo-50' : 'border-slate-100 hover:border-slate-200'}`}>
                      <input type="radio" name="mode" className="mt-1 accent-indigo-600" checked={mode === opt.id} onChange={() => handleModeChange(opt.id as 'minimal' | 'full' | 'custom')} />
                      <div>
                        <span className="font-black text-sm text-slate-800">{opt.label}</span>
                        <p className="text-[11px] text-slate-400 font-medium mt-0.5">{opt.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>

                {mode === 'custom' && (
                  <div className="mt-4 space-y-2 pl-2">
                    {FIELD_LABELS.map(f => (
                      <label key={f.key} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-indigo-50 transition-colors">
                        <div>
                          <span className="font-bold text-sm text-slate-700">{f.label}</span>
                          <span className="text-[10px] text-slate-400 ml-2">{f.desc}</span>
                        </div>
                        <div
                          onClick={() => toggleField(f.key)}
                          className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${form.booking_fields[f.key] ? 'bg-indigo-500' : 'bg-slate-200'}`}
                        >
                          <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.booking_fields[f.key] ? 'translate-x-5' : 'translate-x-0.5'}`} />
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>


              {/* Prestations accessibles */}
              <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100 space-y-3">
                <p className="text-[10px] font-black uppercase text-indigo-600 tracking-widest">✈️ Prestations accessibles</p>
                <p className="text-[11px] text-slate-500">Laissez tout décoché pour autoriser toutes les prestations. Cochez pour restreindre, et saisissez un prix de base si différent du tarif catalogue.</p>
                <div className="space-y-2">
                  {flightTypes.map(ft => {
                    const checked = ft.id in allowedFlightPrices;
                    return (
                      <div key={ft.id} className="flex items-center gap-3 p-2 bg-white rounded-xl border border-indigo-100">
                        <input
                          type="checkbox"
                          id={`ft-${ft.id}`}
                          checked={checked}
                          onChange={e => {
                            if (e.target.checked) {
                              setAllowedFlightPrices(p => ({ ...p, [ft.id]: '' }));
                            } else {
                              setAllowedFlightPrices(p => { const n = { ...p }; delete n[ft.id]; return n; });
                            }
                          }}
                          className="accent-indigo-600 w-4 h-4 shrink-0 cursor-pointer"
                        />
                        <label htmlFor={`ft-${ft.id}`} className="flex-1 cursor-pointer min-w-0">
                          <span className="font-bold text-sm text-slate-700 block truncate">{ft.name}</span>
                          <span className="text-[10px] text-slate-400">Tarif catalogue : {(ft.price_cents / 100).toFixed(2)} €</span>
                        </label>
                        {checked && (
                          <div className="shrink-0 flex items-center gap-1">
                            <input
                              type="number"
                              min={0}
                              step={0.01}
                              placeholder={(ft.price_cents / 100).toFixed(2)}
                              value={allowedFlightPrices[ft.id] ?? ''}
                              onChange={e => setAllowedFlightPrices(p => ({ ...p, [ft.id]: e.target.value }))}
                              className="w-24 border border-indigo-200 rounded-lg px-2 py-1 text-sm font-bold text-center bg-indigo-50 focus:outline-none focus:border-indigo-400"
                            />
                            <span className="text-xs text-slate-400">€</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Facturable */}
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <div
                    onClick={() => setForm(f => ({ ...f, facturable: !f.facturable, default_encaisseur_id: f.facturable ? null : f.default_encaisseur_id }))}
                    className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${form.facturable ? 'bg-orange-400' : 'bg-emerald-500'}`}
                  >
                    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.facturable ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </div>
                  <div>
                    <p className="font-bold text-sm text-slate-700">Partenaire à facturer</p>
                    <p className="text-[11px] text-slate-400">
                      {form.facturable
                        ? 'Le partenaire règle les vols — on lui envoie une facture'
                        : 'Les clients paient directement — on saisit le mode de paiement'}
                    </p>
                  </div>
                </label>
                {form.facturable && monitors.length > 0 && (
                  <div className="ml-14">
                    <label className="text-[10px] font-black uppercase text-slate-400 block mb-1.5">Facturé par (défaut)</label>
                    <select
                      value={form.default_encaisseur_id?.toString() ?? ''}
                      onChange={e => setForm(f => ({ ...f, default_encaisseur_id: e.target.value || null }))}
                      className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-bold"
                    >
                      <option value="">— Non défini —</option>
                      {monitors.map(m => (
                        <option key={m.id} value={m.id}>{m.title}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Actif */}
              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
                  className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${form.is_active ? 'bg-emerald-500' : 'bg-slate-200'}`}
                >
                  <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.is_active ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </div>
                <span className="font-bold text-sm text-slate-700">Partenaire actif</span>
              </label>
            </div>

            <div className="flex gap-3 p-6 pt-0">
              <button onClick={() => setShowModal(false)} className="flex-1 py-3 rounded-2xl border-2 border-slate-200 font-black text-sm text-slate-500 hover:bg-slate-50 transition-colors">
                Annuler
              </button>
              <button onClick={handleSave} disabled={saving} className="flex-1 py-3 rounded-2xl bg-indigo-600 font-black text-sm text-white hover:bg-indigo-700 transition-colors disabled:opacity-50">
                {saving ? 'Enregistrement...' : (editing ? 'Mettre à jour' : 'Créer')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
