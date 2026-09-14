"use client";
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/components/ui/ToastProvider';

interface StandbyClient {
  id: number;
  name: string | null;
  phone: string | null;
  email: string | null;
  nb_passengers: number;
  flight_type: string | null;
  weight_info: string | null;
  availability_text: string | null;
  availability_start: string | null;
  availability_end: string | null;
  notes: string | null;
  pilot_name: string | null;
  booked_date: string | null;
  booked_time: string | null;
  slot_id: number | null;
  status: 'pending' | 'scheduled' | 'done';
  processing_by: string | null;
  created_at: string;
}

const emptyClient = (): Omit<StandbyClient, 'id' | 'created_at' | 'status'> => ({
  name: '', phone: '', email: '', nb_passengers: 1, flight_type: '',
  weight_info: '', availability_text: '', availability_start: null, availability_end: null,
  notes: '', pilot_name: null, booked_date: null, booked_time: null, slot_id: null, processing_by: null,
});

const cap = (s: string) =>
  s.trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');

// Extrait les paires Label:Valeur d'un message de formulaire concaténé
function extractFormFields(text: string): Record<string, string> {
  const LABELS = [
    'Nom du passager', 'Nom passager', 'Prénom du passager', 'Prénom passager',
    'Poids du passager', 'Poids passager', 'Poids',
    'Type de vol', 'TypeVol', 'Type vol',
    'Date de début', 'Date debut', 'Date de debut', 'Date début', 'Date de fin', 'Date fin',
    'Téléphone', 'Telephone', 'Tél', 'Tel',
    'Email', 'E-mail',
    'Adresse', 'Message', 'Remarques',
    'Nom',
  ];
  const escaped = LABELS.map(l => l.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&'));
  const re = new RegExp(`(${escaped.join('|')})\\s*[:\\-]\\s*`, 'gi');

  const fields: Record<string, string> = {};
  let lastKey = '';
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (lastKey && m.index > lastIndex) {
      fields[lastKey] = text.slice(lastIndex, m.index).trim();
    }
    lastKey = m[1].toLowerCase().trim();
    lastIndex = m.index + m[0].length;
  }
  if (lastKey && lastIndex < text.length) {
    fields[lastKey] = text.slice(lastIndex).trim();
  }
  return fields;
}

function parseDate(s: string): string | null {
  if (!s) return null;
  // ISO YYYY-MM-DD
  const iso = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  // JJ/MM/AAAA
  const dmy4 = s.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmy4) return `${dmy4[3]}-${dmy4[2].padStart(2,'0')}-${dmy4[1].padStart(2,'0')}`;
  // JJ/MM
  const dmy = s.match(/(\d{1,2})[\/\-](\d{1,2})/);
  if (dmy) return `${new Date().getFullYear()}-${dmy[2].padStart(2,'0')}-${dmy[1].padStart(2,'0')}`;
  return null;
}

function parseStandbyMessage(text: string) {
  // ── Extraction structurée en priorité (formulaire Label:Valeur) ──
  const fields = extractFormFields(text);
  const isStructured = Object.keys(fields).length >= 2;

  // Téléphone : champ structuré en priorité (capte les numéros suisses, belges, etc.)
  const phoneFromField = (fields['téléphone'] || fields['telephone'] || fields['tél'] || fields['tel'] || '').trim();
  const phoneM = phoneFromField ? null : text.match(/(?:\+\d{1,3}\s?|\d{2,4}\s?)[\d\s.\-]{6,20}/);
  const phoneRaw = phoneFromField || (phoneM ? phoneM[0] : '');
  const phone = phoneRaw.replace(/[\s.\-]/g, '').replace(/^0033/, '+33');

  // Email : depuis champ structuré (correctement borné par le label suivant) ou regex fallback
  const emailFromField = (fields['email'] || fields['e-mail'] || '').trim();
  const emailM = emailFromField ? null : text.match(/[\w.+\-]+@[\w.\-]+\.[a-zA-Z]{2,6}(?![a-zA-Z])/);
  const email = emailFromField || (emailM ? emailM[0] : '');

  // Nom contact : texte avant le premier label connu (le réservant)
  let name = '';
  const contactName = text.split(/téléphone|telephone|tél\b|email|nom\s+du\s+passager/i)[0].trim();
  const contactWords = contactName.split(/\s+/).filter(w => /^[A-ZÀ-ÿa-zà-ÿ''\-]+$/.test(w) && w.length > 1);
  if (contactWords.length >= 2) {
    name = cap(contactWords.slice(0, 3).join(' '));
  }

  // Nom passager (depuis champ structuré, s'il diffère du contact)
  const passengerName = fields['nom du passager'] || fields['nom passager'] || fields['prénom du passager'] || fields['prénom passager'] || '';

  // Si pas de contact détecté, utiliser le nom passager
  if (!name && passengerName) name = cap(passengerName.split(/\s+/).slice(0, 3).join(' '));
  // Si contact = passager (même texte), garder le contact
  // Si les deux sont différents, le nom affiché = contact, le passager va dans les notes

  // Nb passagers
  const nbM = !isStructured
    ? (text.match(/(\d+)\s*(?:personne|passager|pax|adulte|place)s?/i)
      || text.match(/(?:pour|réserver pour)\s+(\d+)/i))
    : null;
  const nb_passengers = nbM ? Math.min(parseInt(nbM[1]), 20) : 1;

  // Type de vol
  const flightRaw = fields['type de vol'] || fields['typevol'] || fields['type vol'] || text;
  const flightTypes: [RegExp, string][] = [
    [/performance|perfo/i, 'Performance'],
    [/prestige/i, 'Prestige'],
    [/découverte|decouverte/i, 'Découverte'],
    [/plaisir|loisir/i, 'Plaisir'],
    [/bi.*péda|peda|pédagogique/i, 'Bi pédagogique'],
    [/bi.*merle|merle/i, 'Bi Merle'],
    [/bi.*loup|loup/i, 'Bi Loup'],
    [/bi.*cret|cret/i, 'Bi Crêt'],
  ];
  let flight_type = '';
  for (const [re, label] of flightTypes) {
    if (re.test(flightRaw)) { flight_type = label; break; }
  }

  // Poids — depuis champ structuré en priorité
  const weightRaw = fields['poids du passager'] || fields['poids passager'] || fields['poids'] || '';
  let weight_info = '';
  if (weightRaw) {
    const wNum = weightRaw.match(/\d+/);
    weight_info = wNum ? wNum[0] + ' kg' : '';
  } else {
    const weightMatches = [...text.matchAll(/(\d{2,3})\s*(?:kg|kilos?)\b/gi)];
    weight_info = weightMatches.map(m => m[1] + ' kg').join(', ');
  }

  // Dates de disponibilité
  const monthNames: Record<string, number> = {
    jan: 1, fév: 2, fev: 2, mar: 3, avr: 4, mai: 5, juin: 6,
    juil: 7, jul: 7, aoû: 8, aou: 8, sep: 9, oct: 10, nov: 11, déc: 12, dec: 12,
  };
  let availability_start: string | null = null;
  let availability_end: string | null = null;

  // Champs structurés en priorité
  const startRaw = fields['date de début'] || fields['date debut'] || fields['date de debut'] || fields['date début'] || '';
  const endRaw = fields['date de fin'] || fields['date fin'] || '';
  if (startRaw) availability_start = parseDate(startRaw);
  if (endRaw) availability_end = parseDate(endRaw);
  if (availability_start && !availability_end) availability_end = availability_start;

  // Fallback : recherche libre dans le texte
  if (!availability_start) {
    // ISO date dans le texte
    const isoM = text.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (isoM) {
      availability_start = `${isoM[1]}-${isoM[2]}-${isoM[3]}`;
      availability_end = availability_start;
    } else {
      // Plage JJ/MM - JJ/MM
      const dateRangeM = text.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{4}))?\s*(?:au|[-–])\s*(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{4}))?/i);
      if (dateRangeM) {
        const y = new Date().getFullYear();
        availability_start = `${dateRangeM[3] || y}-${dateRangeM[2].padStart(2,'0')}-${dateRangeM[1].padStart(2,'0')}`;
        availability_end = `${dateRangeM[6] || y}-${dateRangeM[5].padStart(2,'0')}-${dateRangeM[4].padStart(2,'0')}`;
      } else {
        // "X au Y mois"
        const rangeMonthM = text.match(/(\d{1,2})\s+au\s+(\d{1,2})\s*\/?\s*([\wéèêîûôàùâ]{3,})/i);
        if (rangeMonthM) {
          const mon = rangeMonthM[3].toLowerCase().slice(0, 3);
          const mNum = monthNames[mon];
          if (mNum) {
            const y = new Date().getFullYear();
            const mm = String(mNum).padStart(2, '0');
            availability_start = `${y}-${mm}-${rangeMonthM[1].padStart(2, '0')}`;
            availability_end = `${y}-${mm}-${rangeMonthM[2].padStart(2, '0')}`;
          }
        } else {
          // Date unique JJ/MM
          const singleM = text.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{4}))?/);
          if (singleM) {
            const y = singleM[3] || new Date().getFullYear().toString();
            availability_start = `${y}-${singleM[2].padStart(2,'0')}-${singleM[1].padStart(2,'0')}`;
            availability_end = availability_start;
          }
        }
      }
    }
  }

  // Nom : fallback regex si extraction structurée n'a rien trouvé
  if (!name) {
    const introM = text.match(/(?:je m['']appelle|c'est|je suis|mon nom est)\s+([A-ZÀ-ÿa-zà-ÿ][A-ZÀ-ÿa-zà-ÿ '\-]{2,40})/i);
    if (introM) name = cap(introM[1]);
    else {
      const capsM = text.match(/\b([A-ZÉÈÊÎÛÔÀÙÂ]{2,20})\s+([A-ZÀ-ÿa-zà-ÿ][a-zà-ÿ]{1,20})/);
      if (capsM) name = cap(capsM[2] + ' ' + capsM[1]);
    }
  }

  // Nom passager normalisé (différent du contact)
  const passenger_name = passengerName
    ? cap(passengerName.split(/\s+/).slice(0, 3).join(' '))
    : '';
  const passengerDiffersFromContact = passenger_name && passenger_name !== name;

  // Notes : message brut + passager si différent du contact
  let notes = text.slice(0, 500).trim();
  if (passengerDiffersFromContact) {
    notes = `Passager : ${passenger_name}\n` + notes;
  }

  return { name, phone, email, nb_passengers, flight_type, weight_info, availability_start, availability_end, notes, passenger_name: passengerDiffersFromContact ? passenger_name : '' };
}

const STATUS_LABELS: Record<StandbyClient['status'], string> = {
  pending: 'En attente',
  scheduled: 'Programmé',
  done: 'Effectué',
};

// Les colonnes DATE de pg arrivent déjà comme "YYYY-MM-DD" (setTypeParser dans db.js).
// On tronque à 10 chars au cas où la valeur serait un ISO datetime.
function toInputDate(s: string | null): string | null {
  if (!s) return null;
  return s.slice(0, 10);
}

function fmtDate(d: string | null) {
  if (!d) return '';
  const s = d.slice(0, 10); // "YYYY-MM-DD"
  const [y, m, day] = s.split('-');
  if (!y || !m || !day) return s;
  return `${day}/${m}/${y.slice(2)}`; // "DD/MM/YY"
}

// Retourne le samedi qui débute la semaine (sam→ven) contenant la date
function getWeekSat(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const d = new Date(dateStr.slice(0, 10) + 'T00:00:00');
  if (isNaN(d.getTime())) return null;
  const back = (d.getDay() + 1) % 7; // 0 si sam, 6 si ven
  d.setDate(d.getDate() - back);
  return d;
}

function fmtWeekHeader(sat: Date): string {
  const fri = new Date(sat);
  fri.setDate(fri.getDate() + 6);
  const mo = ['jan','fév','mar','avr','mai','juin','juil','aoû','sep','oct','nov','déc'];
  const fmt = (d: Date) => `${d.getDate()} ${mo[d.getMonth()]}`;
  return `Sam ${fmt(sat)} — Ven ${fmt(fri)}`;
}

function getRefSat(c: StandbyClient): Date | null {
  if (c.status === 'scheduled' && c.booked_date) return getWeekSat(c.booked_date);
  return getWeekSat(c.availability_start);
}

function isMultiWeek(c: StandbyClient): boolean {
  if (!c.availability_start || !c.availability_end) return false;
  if (c.availability_start.slice(0,10) === c.availability_end.slice(0,10)) return false;
  const s = getWeekSat(c.availability_start);
  const e = getWeekSat(c.availability_end);
  return !!s && !!e && s.getTime() !== e.getTime();
}

function findDuplicateIds(clients: StandbyClient[]): Set<number> {
  const seen = new Map<string, number[]>();
  for (const c of clients) {
    const name = (c.name || '').toLowerCase().trim();
    const phone = (c.phone || '').replace(/\s/g, '');
    if (name && phone) {
      const key = `${name}|${phone}`;
      const arr = seen.get(key) ?? [];
      arr.push(c.id);
      seen.set(key, arr);
    }
  }
  const ids = new Set<number>();
  for (const arr of seen.values()) if (arr.length > 1) arr.forEach(id => ids.add(id));
  return ids;
}

function sortActive(clients: StandbyClient[]): StandbyClient[] {
  return [...clients].sort((a, b) => {
    const wa = getRefSat(a), wb = getRefSat(b);
    if (!wa && !wb) {
      if (a.status !== b.status) return a.status === 'pending' ? -1 : 1;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    }
    if (!wa) return 1;
    if (!wb) return -1;
    const wDiff = wa.getTime() - wb.getTime();
    if (wDiff !== 0) return wDiff;
    if (a.status !== b.status) return a.status === 'pending' ? -1 : 1;
    if (a.status === 'pending')
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    if (a.booked_date && b.booked_date) return a.booked_date.localeCompare(b.booked_date);
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
}

export default function StandbyPage() {
  const [clients, setClients] = useState<StandbyClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editClient, setEditClient] = useState<StandbyClient | null>(null);
  const [form, setForm] = useState(emptyClient());
  const [saving, setSaving] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [parsed, setParsed] = useState<ReturnType<typeof parseStandbyMessage> | null>(null);
  const [scheduleModal, setScheduleModal] = useState<StandbyClient | null>(null);
  const [schedForm, setSchedForm] = useState({ pilot_name: '', booked_date: '', booked_time: '' });
  const [showArchive, setShowArchive] = useState(false);
  const [currentUserName, setCurrentUserName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const isAravisContext = pathname?.startsWith('/aravis');

  useEffect(() => {
    try {
      const userData = localStorage.getItem('user');
      if (userData) {
        const parsed = JSON.parse(userData);
        const name = parsed.first_name || parsed.firstName || parsed.email?.split('@')[0] || '';
        setCurrentUserName(name ? name.charAt(0).toUpperCase() + name.slice(1) : '');
      }
    } catch { /* ignore */ }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/standby');
      if (res.ok) setClients(await res.json());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditClient(null);
    setForm(emptyClient());
    setImportOpen(false);
    setImportText('');
    setParsed(null);
    setModalOpen(true);
  };

  const openEdit = (c: StandbyClient) => {
    setEditClient(c);
    setForm({ name: c.name||'', phone: c.phone||'', email: c.email||'', nb_passengers: c.nb_passengers,
      flight_type: c.flight_type||'', weight_info: c.weight_info||'', availability_text: c.availability_text||'',
      availability_start: toInputDate(c.availability_start),
      availability_end: toInputDate(c.availability_end),
      notes: c.notes||'', pilot_name: c.pilot_name,
      booked_date: toInputDate(c.booked_date),
      booked_time: c.booked_time, slot_id: c.slot_id, processing_by: c.processing_by });
    setImportOpen(false);
    setParsed(null);
    setModalOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const body = { ...form, status: editClient?.status || 'pending' };
      const res = editClient
        ? await apiFetch(`/api/standby/${editClient.id}`, { method: 'PUT', body: JSON.stringify(body) })
        : await apiFetch('/api/standby', { method: 'POST', body: JSON.stringify(body) });
      if (res.ok) {
        toast.success(editClient ? 'Fiche mise à jour' : 'Client ajouté en standby');
        setModalOpen(false);
        load();
      } else { toast.error('Erreur lors de la sauvegarde'); }
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Supprimer cette fiche ?')) return;
    const res = await apiFetch(`/api/standby/${id}`, { method: 'DELETE' });
    if (res.ok) { toast.success('Supprimé'); load(); }
  };

  const handleStatusChange = async (c: StandbyClient, status: StandbyClient['status']) => {
    const res = await apiFetch(`/api/standby/${c.id}`, { method: 'PUT', body: JSON.stringify({ ...c, status, processing_by: null }) });
    if (res.ok) { toast.success('Statut mis à jour'); load(); }
  };

  const handleProcessing = async (c: StandbyClient) => {
    const isMe = c.processing_by === currentUserName;
    const newValue = isMe ? null : currentUserName;
    const res = await apiFetch(`/api/standby/${c.id}`, { method: 'PATCH', body: JSON.stringify({ processing_by: newValue }) });
    if (res.ok) load();
  };

  const applyParsed = () => {
    if (!parsed) return;
    setForm(f => ({
      ...f,
      name: parsed.name || f.name,
      phone: parsed.phone || f.phone,
      email: parsed.email || f.email,
      nb_passengers: parsed.nb_passengers > 1 ? parsed.nb_passengers : f.nb_passengers,
      flight_type: parsed.flight_type || f.flight_type,
      weight_info: parsed.weight_info || f.weight_info,
      availability_start: parsed.availability_start || f.availability_start,
      availability_end: parsed.availability_end || f.availability_end,
      notes: parsed.notes || f.notes,
    }));
    setImportOpen(false);
    setParsed(null);
    setImportText('');
  };

  const openSchedule = (c: StandbyClient) => {
    setScheduleModal(c);
    setSchedForm({ pilot_name: c.pilot_name||'', booked_date: toInputDate(c.booked_date)||'', booked_time: c.booked_time||'' });
  };

  const saveSchedule = async () => {
    if (!scheduleModal) return;
    const updated = { ...scheduleModal, ...schedForm, status: 'scheduled' as const };
    const res = await apiFetch(`/api/standby/${scheduleModal.id}`, { method: 'PUT', body: JSON.stringify(updated) });
    if (res.ok) { toast.success('Créneau enregistré — ligne passée en orange'); setScheduleModal(null); load(); }
  };

  const active = useMemo(() => clients.filter(c => c.status !== 'done'), [clients]);
  const sortedActive = useMemo(() => sortActive(active), [active]);
  const duplicateIds = useMemo(() => findDuplicateIds(active), [active]);
  const weekGroups = useMemo(() => {
    const groups: { weekKey: string; weekLabel: string; entries: StandbyClient[] }[] = [];
    for (const c of sortedActive) {
      const sat = getRefSat(c);
      const weekKey = sat ? sat.toISOString().slice(0, 10) : '__no_date__';
      const weekLabel = sat ? fmtWeekHeader(sat) : 'Sans date définie';
      const last = groups[groups.length - 1];
      if (!last || last.weekKey !== weekKey) groups.push({ weekKey, weekLabel, entries: [c] });
      else last.entries.push(c);
    }
    return groups;
  }, [sortedActive]);
  const sortedArchived = useMemo(() =>
    [...clients.filter(c => c.status === 'done')].sort((a, b) => {
      const aRef = a.booked_date || a.created_at || '';
      const bRef = b.booked_date || b.created_at || '';
      return bRef.localeCompare(aRef);
    }),
  [clients]);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return null;
    return clients.filter(c => [c.name, c.phone, c.email, c.flight_type, c.notes, c.availability_text, c.pilot_name]
      .some(f => f?.toLowerCase().includes(q)));
  }, [clients, searchQuery]);


  const rowBg = (c: StandbyClient, isMultiW = false, isDup = false) => {
    const bg = c.status === 'done' ? 'bg-emerald-50'
      : c.status === 'scheduled' ? 'bg-orange-100'
      : c.processing_by ? 'bg-amber-50'
      : 'bg-white';
    if (isDup && isMultiW) return `${bg} border-l-4 border-l-purple-500`;
    if (isDup)    return `${bg} border-l-4 border-l-rose-500`;
    if (isMultiW) return `${bg} border-l-4 border-l-indigo-400`;
    if (c.status === 'done')      return `${bg} border-l-4 border-l-emerald-400`;
    if (c.status === 'scheduled') return `${bg} border-l-4 border-l-orange-500`;
    if (c.processing_by)          return `${bg} border-l-4 border-l-amber-400`;
    return `${bg} border-l-4 border-l-slate-200`;
  };

  const statusDot = (s: StandbyClient['status']) => {
    if (s === 'done') return 'bg-emerald-400';
    if (s === 'scheduled') return 'bg-orange-400';
    return 'bg-slate-300';
  };

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Liste d&apos;attente</h1>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-[10px] text-slate-400">
            <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-slate-200 inline-block border-l-2 border-l-slate-400" /> En attente</span>
            <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-amber-100 inline-block border-l-2 border-l-amber-400" /> En traitement</span>
            <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-orange-100 inline-block border-l-2 border-l-orange-500" /> Programmé</span>
            <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-50 inline-block border-l-2 border-l-emerald-400" /> Effectué</span>
            <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-white inline-block border-l-2 border-l-indigo-400" /> Pluri-semaines</span>
            <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-white inline-block border-l-2 border-l-rose-500" /> Doublon possible</span>
          </div>
        </div>
        <div className="flex gap-2 items-center">
          <div className="flex items-center gap-2 bg-white border-2 border-slate-200 rounded-2xl px-3 py-2 focus-within:border-sky-400 transition-colors shadow-sm">
            <span className="text-slate-400 text-sm">🔍</span>
            <input
              type="search"
              placeholder="Nom, tél, email, type de vol..."
              className="text-sm font-medium text-slate-700 placeholder-slate-300 outline-none bg-transparent w-44 sm:w-56"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="text-slate-300 hover:text-slate-500 text-xs font-black">✕</button>
            )}
          </div>
          <button onClick={openCreate} className="bg-slate-900 text-white px-5 py-3 rounded-2xl font-black text-sm hover:bg-sky-600 transition-colors whitespace-nowrap">
            + Ajouter
          </button>
        </div>
      </div>

      {/* Résultats de recherche */}
      {searchResults !== null && (
        <div className="overflow-x-auto rounded-3xl shadow-sm border border-sky-100 bg-sky-50/30">
          <div className="px-4 py-2 border-b border-sky-100 flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-sky-500 tracking-widest">
              🔍 {searchResults.length} résultat{searchResults.length !== 1 ? 's' : ''} pour &laquo;{searchQuery}&raquo;
            </span>
            <button onClick={() => setSearchQuery('')} className="text-[10px] text-slate-400 hover:text-slate-600 font-black uppercase">Effacer</button>
          </div>
          {searchResults.length === 0 ? (
            <p className="text-center py-8 text-slate-400 text-sm">Aucune demande ne correspond à cette recherche.</p>
          ) : (
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="bg-white/60 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                  <th className="text-left p-3 pl-4">Statut</th>
                  <th className="text-left p-3">Contact</th>
                  <th className="text-left p-3">Pax</th>
                  <th className="text-left p-3">Vol</th>
                  <th className="text-left p-3">Disponibilité</th>
                  <th className="text-left p-3">Programmé</th>
                  <th className="text-left p-3">Notes</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-sky-100">
                {searchResults.map(c => {
                  const isMultiW = isMultiWeek(c);
                  const isDup = duplicateIds.has(c.id);
                  return (
                    <tr key={c.id} className={`${rowBg(c, isMultiW, isDup)} transition-colors`}>
                      <td className="p-3 pl-4">
                        <div className="space-y-1">
                          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-lg ${c.status === 'done' ? 'text-emerald-600 bg-emerald-50' : c.status === 'scheduled' ? 'text-orange-600 bg-orange-50' : 'text-slate-500 bg-slate-100'}`}>
                            {c.status === 'done' ? '✓ Effectué' : c.status === 'scheduled' ? 'Programmé' : 'En attente'}
                          </span>
                          {c.processing_by && <p className="text-[9px] text-amber-600 font-black">⚙️ {c.processing_by}</p>}
                        </div>
                      </td>
                      <td className="p-3">
                        <p className="font-bold text-slate-800 truncate max-w-[140px]">{c.name || '—'}</p>
                        {c.phone && <p className="text-xs text-slate-400">{c.phone}</p>}
                        {c.email && <p className="text-xs text-slate-400 truncate max-w-[140px]">{c.email}</p>}
                        <div className="flex gap-1.5 mt-1">
                          {c.phone && <a href={`tel:${c.phone}`} className="w-5 h-5 rounded-full bg-emerald-50 flex items-center justify-center text-[10px]">📞</a>}
                          {c.phone && <a href={`sms:${c.phone}`} className="w-5 h-5 rounded-full bg-sky-50 flex items-center justify-center text-[10px]">💬</a>}
                          {c.email && <a href={`mailto:${c.email}`} className="w-5 h-5 rounded-full bg-violet-50 flex items-center justify-center text-[10px]">📧</a>}
                        </div>
                      </td>
                      <td className="p-3 font-bold text-slate-700">
                        {c.nb_passengers > 1 ? <span className="bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full text-xs font-black">{c.nb_passengers} pers.</span> : '1'}
                        {c.weight_info && <p className="text-[10px] text-slate-400 mt-0.5">{c.weight_info}</p>}
                      </td>
                      <td className="p-3 text-xs font-bold text-slate-700">{c.flight_type || '—'}</td>
                      <td className="p-3">
                        {c.availability_start && <p className="text-xs font-bold text-slate-700">{fmtDate(c.availability_start)}{c.availability_end && c.availability_end !== c.availability_start ? ` → ${fmtDate(c.availability_end)}` : ''}</p>}
                        {c.availability_text && <p className="text-[10px] text-slate-400 truncate max-w-[120px]">{c.availability_text}</p>}
                      </td>
                      <td className="p-3">
                        {c.booked_date ? <p className="text-xs font-bold text-orange-700">{fmtDate(c.booked_date)} {c.booked_time}</p> : <span className="text-slate-300">—</span>}
                        {c.pilot_name && <p className="text-[10px] text-slate-400">{c.pilot_name}</p>}
                      </td>
                      <td className="p-3 max-w-[160px]"><p className="text-[10px] text-slate-400 line-clamp-2">{c.notes}</p></td>
                      <td className="p-3">
                        <div className="flex gap-1">
                          <button onClick={() => openEdit(c)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition-colors">✏️</button>
                          <button onClick={() => handleDelete(c.id)} className="p-1.5 hover:bg-rose-50 rounded-lg text-slate-400 hover:text-rose-500 transition-colors">🗑️</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Tableau actif */}
      {searchResults === null && loading ? (
        <div className="text-center py-12 text-slate-400 animate-pulse">Chargement...</div>
      ) : searchResults === null && active.length === 0 ? (
        <div className="text-center py-16 text-slate-300">
          <p className="text-4xl mb-3">🪂</p>
          <p className="font-bold text-lg">Aucun client en attente</p>
          <p className="text-sm">Ajoutez un contact avec le bouton ci-dessus</p>
        </div>
      ) : searchResults === null && (
        <div className="overflow-x-auto rounded-3xl shadow-sm border border-slate-100">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                <th className="text-left p-3 pl-4">Statut</th>
                <th className="text-left p-3">Contact</th>
                <th className="text-left p-3">Pax</th>
                <th className="text-left p-3">Vol</th>
                <th className="text-left p-3">Disponibilité</th>
                <th className="text-left p-3">Programmé</th>
                <th className="text-left p-3">Notes</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {weekGroups.map(group => (
                <React.Fragment key={group.weekKey}>
                  <tr className="bg-slate-100/80">
                    <td colSpan={8} className="px-4 py-1.5">
                      <span className="text-[9px] font-black uppercase text-slate-500 tracking-widest">{group.weekLabel}</span>
                      <span className="ml-2 text-[9px] text-slate-400">{group.entries.length} demande{group.entries.length > 1 ? 's' : ''}</span>
                    </td>
                  </tr>
                  {group.entries.map(c => {
                    const isMultiW = isMultiWeek(c);
                    const isDup = duplicateIds.has(c.id);
                    return (
                  <tr key={c.id} className={`${rowBg(c, isMultiW, isDup)} transition-colors`}>
                  <td className="p-3 pl-4">
                    <div className="space-y-1.5">
                      {(isMultiW || isDup) && (
                        <div className="flex gap-1 flex-wrap mb-0.5">
                          {isMultiW && <span className="text-[8px] font-black text-indigo-500 bg-indigo-50 border border-indigo-200 rounded px-1 py-0.5 whitespace-nowrap">↔ pluri-sem.</span>}
                          {isDup && <span className="text-[8px] font-black text-rose-500 bg-rose-50 border border-rose-200 rounded px-1 py-0.5">⚠ doublon</span>}
                        </div>
                      )}
                      <select
                        value={c.status}
                        onChange={e => handleStatusChange(c, e.target.value as StandbyClient['status'])}
                        className="text-[10px] font-black uppercase rounded-lg px-2 py-1 border border-slate-200 bg-white cursor-pointer focus:outline-none"
                      >
                        <option value="pending">En attente</option>
                        <option value="scheduled">Programmé</option>
                        <option value="done">Effectué ✓</option>
                      </select>
                      {c.status === 'pending' && (
                        c.processing_by ? (
                          <div className="space-y-1">
                            <span className="block text-[9px] font-black uppercase text-amber-600 bg-amber-100 rounded-lg px-2 py-1 leading-tight">
                              ⚙️ {c.processing_by === currentUserName ? 'Vous traitez' : `En traitement (${c.processing_by})`}
                            </span>
                            {c.processing_by === currentUserName && (
                              <button
                                onClick={() => handleProcessing(c)}
                                className="text-[9px] font-black text-slate-400 hover:text-slate-600 uppercase px-2 py-0.5"
                              >
                                Annuler
                              </button>
                            )}
                          </div>
                        ) : (
                          <button
                            onClick={() => handleProcessing(c)}
                            className="block text-[9px] font-black uppercase text-sky-600 bg-sky-50 hover:bg-sky-100 rounded-lg px-2 py-1 transition-colors whitespace-nowrap"
                          >
                            ▶ Traiter
                          </button>
                        )
                      )}
                    </div>
                  </td>
                  <td className="p-3">
                    <p className="font-bold text-slate-800 truncate max-w-[140px]">{c.name || <span className="text-slate-300 italic">—</span>}</p>
                    {c.phone && <p className="text-xs text-slate-400">{c.phone}</p>}
                    {c.email && <p className="text-xs text-slate-400 truncate max-w-[140px]">{c.email}</p>}
                    <div className="flex gap-1.5 mt-1.5">
                      {c.phone && (
                        <a href={`tel:${c.phone}`} title="Appeler" className="w-6 h-6 rounded-full bg-emerald-50 hover:bg-emerald-100 flex items-center justify-center text-xs transition-colors" aria-label="Appeler">📞</a>
                      )}
                      {c.phone && (
                        <a href={`sms:${c.phone}`} title="SMS" className="w-6 h-6 rounded-full bg-sky-50 hover:bg-sky-100 flex items-center justify-center text-xs transition-colors" aria-label="SMS">💬</a>
                      )}
                      {c.email && (
                        <a href={`mailto:${c.email}`} title="Email" className="w-6 h-6 rounded-full bg-violet-50 hover:bg-violet-100 flex items-center justify-center text-xs transition-colors" aria-label="Email">📧</a>
                      )}
                    </div>
                  </td>
                  <td className="p-3 font-bold text-slate-700">
                    {c.nb_passengers > 1 ? <span className="bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full text-xs font-black">{c.nb_passengers} pers.</span> : '1'}
                    {c.weight_info && <p className="text-[10px] text-slate-400 mt-0.5">{c.weight_info}</p>}
                  </td>
                  <td className="p-3">
                    <span className="text-xs font-bold text-slate-700">{c.flight_type || <span className="text-slate-300">—</span>}</span>
                  </td>
                  <td className="p-3">
                    {(c.availability_start || c.availability_text) ? (
                      <div>
                        {c.availability_start && (
                          <p className="text-xs font-bold text-slate-700">
                            {fmtDate(c.availability_start)}
                            {c.availability_end && c.availability_end !== c.availability_start && ` → ${fmtDate(c.availability_end)}`}
                          </p>
                        )}
                        {c.availability_text && <p className="text-[10px] text-slate-400 truncate max-w-[120px]">{c.availability_text}</p>}
                      </div>
                    ) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="p-3">
                    {c.status === 'scheduled' && (c.booked_date || c.pilot_name) ? (
                      <div>
                        <p className="text-xs font-bold text-orange-700">{fmtDate(c.booked_date)} {c.booked_time}</p>
                        {c.pilot_name && <p className="text-[10px] text-slate-400">{c.pilot_name}</p>}
                      </div>
                    ) : (
                      <button onClick={() => openSchedule(c)} className="text-[10px] font-black text-sky-500 hover:text-sky-700 uppercase tracking-wide flex items-center gap-1 whitespace-nowrap">
                        📅 Caler un créneau
                      </button>
                    )}
                  </td>
                  <td className="p-3 max-w-[160px]">
                    <p className="text-[10px] text-slate-400 line-clamp-2">{c.notes}</p>
                  </td>
                  <td className="p-3">
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(c)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition-colors" title="Modifier">✏️</button>
                      <button onClick={() => handleDelete(c.id)} className="p-1.5 hover:bg-rose-50 rounded-lg text-slate-400 hover:text-rose-500 transition-colors" title="Supprimer">🗑️</button>
                    </div>
                  </td>
                </tr>
                    );
                  })}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Archive */}
      {sortedArchived.length > 0 && (
        <div>
          <button onClick={() => setShowArchive(a => !a)} className="flex items-center gap-2 text-[11px] font-black uppercase text-slate-400 hover:text-slate-700 tracking-widest transition-colors">
            <span>{showArchive ? '▼' : '▶'}</span> Archive — effectués ({sortedArchived.length})
          </button>
          {showArchive && (
            <div className="mt-3">
              {/* Table */}
              <div className="overflow-x-auto rounded-3xl border border-emerald-100">
                <table className="w-full text-sm min-w-[600px]">
                  <tbody className="divide-y divide-emerald-50">
                    {sortedArchived.map(c => (
                      <tr key={c.id} className="bg-emerald-50/60">
                        <td className="p-3 pl-4 w-24">
                          <span className="text-[10px] font-black text-emerald-600 uppercase">✓ Effectué</span>
                          {c.booked_date && <p className="text-[10px] text-slate-400 mt-0.5">{fmtDate(c.booked_date)}{c.booked_time ? ` · ${c.booked_time}` : ''}</p>}
                        </td>
                        <td className="p-3">
                          <p className="font-bold text-slate-700">{c.name}</p>
                          {c.phone && <p className="text-xs text-slate-400">{c.phone}</p>}
                          <div className="flex gap-1.5 mt-1">
                            {c.phone && <a href={`tel:${c.phone}`} className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center text-[10px]">📞</a>}
                            {c.phone && <a href={`sms:${c.phone}`} className="w-5 h-5 rounded-full bg-sky-100 flex items-center justify-center text-[10px]">💬</a>}
                            {c.email && <a href={`mailto:${c.email}`} className="w-5 h-5 rounded-full bg-violet-100 flex items-center justify-center text-[10px]">📧</a>}
                          </div>
                        </td>
                        <td className="p-3">
                          <span className="text-xs font-bold text-slate-600">{c.flight_type || <span className="text-slate-300">—</span>}</span>
                        </td>
                        <td className="p-3">
                          {c.pilot_name
                            ? <span className="text-[11px] font-black text-emerald-700 bg-emerald-100 rounded-lg px-2 py-1 whitespace-nowrap">🧑‍✈️ {c.pilot_name}</span>
                            : <span className="text-slate-300 text-xs">—</span>
                          }
                        </td>
                        <td className="p-3">
                          <div className="flex gap-1">
                            <button onClick={() => handleStatusChange(c, 'pending')} className="text-[10px] text-slate-400 hover:text-slate-700 px-2 py-1 rounded-lg hover:bg-white transition-colors">↩ Remettre</button>
                            <button onClick={() => handleDelete(c.id)} className="p-1.5 hover:bg-rose-50 rounded-lg text-slate-300 hover:text-rose-400 transition-colors">🗑️</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal création / édition */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg my-8">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h2 className="font-black text-lg">{editClient ? 'Modifier la fiche' : 'Nouveau contact standby'}</h2>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-700 text-xl font-black">✕</button>
            </div>

            <div className="p-6 space-y-4">
              {/* Import */}
              <div>
                <button
                  onClick={() => { setImportOpen(o => !o); setParsed(null); setImportText(''); }}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-2xl bg-sky-50 border border-sky-100 text-[11px] font-black uppercase text-sky-500 hover:bg-sky-100 transition-colors"
                >
                  <span>✨ Importer depuis un message</span>
                  <span>{importOpen ? '▲' : '▼'}</span>
                </button>
                {importOpen && (
                  <div className="mt-3 space-y-2">
                    <textarea
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-3 text-sm font-medium text-slate-700 resize-none focus:outline-none focus:border-sky-200"
                      rows={6}
                      placeholder="Collez ici un email, SMS ou message WhatsApp..."
                      value={importText}
                      onChange={e => { setImportText(e.target.value); setParsed(null); }}
                    />
                    <button
                      onClick={() => { if (importText.trim()) setParsed(parseStandbyMessage(importText)); }}
                      disabled={!importText.trim()}
                      className="w-full py-2.5 rounded-xl text-[11px] font-black uppercase text-white bg-sky-500 hover:bg-sky-600 transition-colors disabled:opacity-40"
                    >
                      Analyser le message
                    </button>
                    {parsed && (
                      <div className="bg-sky-50 border border-sky-100 rounded-2xl p-4 space-y-1.5">
                        <p className="text-[10px] font-black uppercase text-sky-500 mb-2">Résultat détecté</p>
                        {parsed.name && <p className="text-xs"><span className="text-[9px] font-black text-slate-400 uppercase">Contact </span>{parsed.name}</p>}
                        {parsed.passenger_name && <p className="text-xs"><span className="text-[9px] font-black text-slate-400 uppercase">Passager </span>{parsed.passenger_name}</p>}
                        {parsed.phone && <p className="text-xs"><span className="text-[9px] font-black text-slate-400 uppercase">Tél </span>{parsed.phone}</p>}
                        {parsed.email && <p className="text-xs"><span className="text-[9px] font-black text-slate-400 uppercase">Email </span>{parsed.email}</p>}
                        {parsed.nb_passengers > 1 && <p className="text-xs"><span className="text-[9px] font-black text-slate-400 uppercase">Passagers </span>{parsed.nb_passengers}</p>}
                        {parsed.flight_type && <p className="text-xs"><span className="text-[9px] font-black text-slate-400 uppercase">Vol </span>{parsed.flight_type}</p>}
                        {parsed.weight_info && <p className="text-xs"><span className="text-[9px] font-black text-slate-400 uppercase">Poids </span>{parsed.weight_info}</p>}
                        {parsed.availability_start && <p className="text-xs"><span className="text-[9px] font-black text-slate-400 uppercase">Dispo </span>{fmtDate(parsed.availability_start)}{parsed.availability_end !== parsed.availability_start && ` → ${fmtDate(parsed.availability_end)}`}</p>}
                        <button onClick={applyParsed} className="w-full mt-2 py-2 rounded-xl text-[11px] font-black uppercase text-white bg-pink-500 hover:bg-pink-600 transition-colors">
                          Remplir le formulaire
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Nom complet</label>
                  <input className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-3 font-bold text-sm mt-1" value={form.name||''} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="Prénom Nom" />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Téléphone</label>
                  <input className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-3 font-bold text-sm mt-1" value={form.phone||''} onChange={e => setForm(f => ({...f, phone: e.target.value}))} placeholder="06 12 34 56 78" />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Email</label>
                  <input className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-3 font-bold text-sm mt-1" value={form.email||''} onChange={e => setForm(f => ({...f, email: e.target.value}))} placeholder="email@..." type="email" />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Nb passagers</label>
                  <input className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-3 font-bold text-sm mt-1" value={form.nb_passengers} onChange={e => setForm(f => ({...f, nb_passengers: parseInt(e.target.value)||1}))} type="number" min={1} max={20} />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Type de vol</label>
                  <input className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-3 font-bold text-sm mt-1" value={form.flight_type||''} onChange={e => setForm(f => ({...f, flight_type: e.target.value}))} placeholder="Plaisir, Performance..." />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Poids</label>
                  <input className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-3 font-bold text-sm mt-1" value={form.weight_info||''} onChange={e => setForm(f => ({...f, weight_info: e.target.value}))} placeholder="75 kg, 60 kg..." />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Dispo du</label>
                  <input className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-3 font-bold text-sm mt-1" value={form.availability_start||''} onChange={e => setForm(f => ({...f, availability_start: e.target.value||null}))} type="date" />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Dispo au</label>
                  <input className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-3 font-bold text-sm mt-1" value={form.availability_end||''} onChange={e => setForm(f => ({...f, availability_end: e.target.value||null}))} type="date" />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Message / Notes</label>
                  <textarea className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-3 font-medium text-sm mt-1 resize-none" rows={4} value={form.notes||''} onChange={e => setForm(f => ({...f, notes: e.target.value}))} placeholder="Infos complémentaires, message original..." />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setModalOpen(false)} className="flex-1 py-3 rounded-2xl border border-slate-200 text-sm font-bold text-slate-500 hover:bg-slate-50 transition-colors">Annuler</button>
                <button onClick={handleSave} disabled={saving} className="flex-1 py-3 rounded-2xl bg-slate-900 text-white text-sm font-black hover:bg-sky-600 transition-colors disabled:opacity-50">
                  {saving ? 'Sauvegarde...' : editClient ? 'Enregistrer' : 'Ajouter'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal créneau */}
      {scheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center">
              <h2 className="font-black">📅 Caler un créneau</h2>
              <button onClick={() => setScheduleModal(null)} className="text-slate-400 hover:text-slate-700 font-black">✕</button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-sm font-bold text-slate-600">{scheduleModal.name}</p>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Pilote</label>
                <input className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-3 font-bold text-sm mt-1" value={schedForm.pilot_name} onChange={e => setSchedForm(s => ({...s, pilot_name: e.target.value}))} placeholder="Nom du pilote" />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Date</label>
                <input className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-3 font-bold text-sm mt-1" value={schedForm.booked_date} onChange={e => setSchedForm(s => ({...s, booked_date: e.target.value}))} type="date" />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Heure</label>
                <input className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-3 font-bold text-sm mt-1" value={schedForm.booked_time} onChange={e => setSchedForm(s => ({...s, booked_time: e.target.value}))} placeholder="11:05" />
              </div>
              <button
                onClick={() => {
                  if (!scheduleModal) return;
                  const prefill = {
                    standby_id: scheduleModal.id,
                    name: scheduleModal.name || '',
                    phone: scheduleModal.phone || '',
                    email: scheduleModal.email || '',
                    flight_type: scheduleModal.flight_type || '',
                    weight_info: scheduleModal.weight_info || '',
                    nb_passengers: scheduleModal.nb_passengers || 1,
                  };
                  try { localStorage.setItem('standby_prefill', JSON.stringify(prefill)); } catch { /* ignore */ }
                  const date = schedForm.booked_date || toInputDate(scheduleModal.availability_start) || '';
                  const planningBase = isAravisContext ? '/aravis/planning' : '/fluide/planning';
                  router.push(`${planningBase}${date ? `?date=${date}` : ''}`);
                }}
                className="w-full py-3 rounded-2xl bg-slate-800 text-white text-sm font-black hover:bg-slate-700 transition-colors"
              >
                📅 Ouvrir le calendrier
              </button>
              <div className="flex gap-3">
                <button onClick={() => setScheduleModal(null)} className="flex-1 py-3 rounded-2xl border border-slate-200 text-sm font-bold text-slate-500 hover:bg-slate-50 transition-colors">Annuler</button>
                <button onClick={saveSchedule} className="flex-1 py-3 rounded-2xl bg-orange-500 text-white text-sm font-black hover:bg-orange-600 transition-colors">Enregistrer</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
