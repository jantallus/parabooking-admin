"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/components/ui/ToastProvider';
import type { Slot, CurrentUser, FlightType, Monitor, SlotDefinition, Partner } from '@/lib/types';

type FormData = {
  title: string; flight_type_id: string; weightChecked: boolean;
  phone: string; email: string; notes: string; booking_options: string; client_message: string;
};

/** Mise à jour d'un slot envoyée à l'API et appliquée en local */
type SlotUpdate = { id: number; data: Record<string, unknown> };

/** Groupe horaire pour la répartition multi-passagers */
type TimeGroup = { time: string; count: number; capacity: number; slots: Slot[] };

interface Props {
  selectedEvent: Slot & { isOutOfSeason?: boolean };
  currentUser: CurrentUser | null;
  slotDuration: number;
  appointments: Slot[];
  setAppointments: React.Dispatch<React.SetStateAction<Slot[]>>;
  flightTypes: FlightType[];
  monitors: Monitor[];
  slotDefs: SlotDefinition[];
  loadAppointments: () => Promise<void>;
  onClose: () => void;
}

const IS_CLIENT_SLOT = (slot: Slot) =>
  slot.status === 'booked' && slot.title &&
  !['NOTE', '☕ PAUSE', 'NON DISPO'].some((t: string) => slot.title?.includes(t)) &&
  !slot.title?.includes('❌');

const IS_PAUSE_SLOT = (slot: Slot) =>
  !!(slot.title?.toUpperCase().includes('PAUSE') || slot.title?.includes('☕'));

export default function EditSlotModal({
  selectedEvent, currentUser, slotDuration,
  appointments, setAppointments, flightTypes, monitors, slotDefs,
  loadAppointments, onClose,
}: Props) {
  const { toast, confirm } = useToast();
  const pathname = usePathname();
  const isAravisContext = pathname?.startsWith('/aravis');
  // ── State modal ────────────────────────────────────────────────────────────
  const [formData, setFormData] = useState<FormData>({
    title: '', flight_type_id: '', weightChecked: false, phone: '', email: '', notes: '', booking_options: '', client_message: '',
  });
  const [activeTab, setActiveTab] = useState<'client' | 'client2' | 'note' | 'move'>('client');
  const [blockType, setBlockType] = useState<'none' | 'all' | 'specific'>('none');
  const [selectedMonitors, setSelectedMonitors] = useState<string[]>([]);
  const [blockUntilMs, setBlockUntilMs] = useState<number>(0);
  const [groupSize, setGroupSize] = useState(1);
  const [groupLocked, setGroupLocked] = useState(false);
  const [showGroupSelector, setShowGroupSelector] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [manualCounts, setManualCounts] = useState<Record<string, number>>({});
  const [isManual, setIsManual] = useState(false);
  const [moveConfig, setMoveConfig] = useState({ date: '', time: '', monitorId: 'random' });
  const [moveGroup, setMoveGroup] = useState(false);
  const [movePax, setMovePax] = useState<'both' | 'pax1' | 'pax2'>('both');
  const [pasteZoneOpen, setPasteZoneOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [parsed, setParsed] = useState<{ names: string[]; phone: string; email: string; weights: string[] } | null>(null);
  const [passengerWeights, setPassengerWeights] = useState<string[]>(['']);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState('');
  const [paymentType, setPaymentType] = useState('');
  const [encaisseurId, setEncaisseurId] = useState('');
  const [paymentScope, setPaymentScope] = useState<'slot' | 'time' | 'pilot' | 'group'>('slot');
  const [fullMonitors, setFullMonitors] = useState<Array<{ id: string; first_name: string; receives_online_payments: boolean }>>([]);
  const [availableComplements, setAvailableComplements] = useState<{ id: number; name: string; price_cents: number }[]>([]);
  const [selectedComplementIds, setSelectedComplementIds] = useState<number[]>([]);
  const [flightPriceOverride, setFlightPriceOverride] = useState('');
  const [complementPriceOverride, setComplementPriceOverride] = useState('');
  const [cbNetAmount, setCbNetAmount] = useState('');
  const [secondBooking, setSecondBooking] = useState<{ title: string; phone: string; weight: string; payment_type: string; encaisseur_id: string }>({ title: '', phone: '', weight: '', payment_type: '', encaisseur_id: '' });
  const [standbyPrefill, setStandbyPrefill] = useState<{ standby_id: number; name: string; phone: string; email: string; flight_type: string; weight_info: string; nb_passengers: number } | null>(null);
  const standbyIdRef = React.useRef<number | null>(null);

  // ── Fetch partenaires + moniteurs complets ────────────────────────────────────
  useEffect(() => {
    apiFetch('/api/partners').then(r => r.ok ? r.json() : []).then((data: Partner[]) => {
      setPartners(data);
      if (isAravisContext) {
        const aravisPartner = data.find((p: Partner) => p.name?.toLowerCase().includes('aravis') || p.code?.toLowerCase().includes('aravis'));
        if (aravisPartner) setSelectedPartnerId(aravisPartner.id.toString());
      }
    }).catch(() => {});
    apiFetch('/api/complements').then(r => r.ok ? r.json() : []).then((data: { id: number; name: string; price_cents: number }[]) => { if (Array.isArray(data)) setAvailableComplements(data); }).catch(() => {});
    if (currentUser?.role === 'admin' || currentUser?.role === 'aravis') {
      apiFetch('/api/users')
        .then(r => r.ok ? r.json() : [])
        .then((data: Array<{ id: string; first_name: string; is_active_monitor: boolean; receives_online_payments: boolean }>) =>
          setFullMonitors(data.filter(u => u.is_active_monitor))
        )
        .catch(() => {});
    }
  }, [currentUser]);

  // ── Standby prefill : lu depuis localStorage quand un créneau disponible s'ouvre ──
  useEffect(() => {
    if (selectedEvent?.status !== 'available') { setStandbyPrefill(null); return; }
    try {
      const raw = localStorage.getItem('standby_prefill');
      if (raw) {
        localStorage.removeItem('standby_prefill');
        const parsed = JSON.parse(raw);
        setStandbyPrefill(parsed);
        standbyIdRef.current = parsed.standby_id ?? null;
      } else {
        setStandbyPrefill(null);
        standbyIdRef.current = null;
      }
    } catch { setStandbyPrefill(null); standbyIdRef.current = null; }
  }, [selectedEvent]);

  // ── Parsing message collé ─────────────────────────────────────────────────
  const parseMessage = () => {
    const text = pasteText;

    const emailMatch = text.match(/[\w.+\-]+@[\w.\-]+\.[a-zA-Z]{2,}/);
    const phoneMatch = text.match(/(?:\+33\s?|0033\s?|0)[1-9](?:[\s.\-]?\d{2}){4}/);
    const phone = phoneMatch ? phoneMatch[0].replace(/[\s.\-]/g, '').replace(/^0033/, '+33') : '';
    const email = emailMatch ? emailMatch[0] : '';

    // Si le texte contient des poids, on les utilise comme séparateurs de personnes
    // Ex: "Louise Carlier 40kg\nJustine Godard 56kg" → ["Louise Carlier", "Justine Godard"]
    const weightSplit = text.replace(phoneMatch?.[0] ?? '\x00', '').split(/\d+\s*(?:kg|kgs?|kilos?)\b/gi);
    const namesByWeight: string[] = [];
    if (weightSplit.length > 1) {
      const cap2 = (s: string) => s.trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
      weightSplit.forEach(seg => {
        // Prendre seulement la dernière ligne du segment (le nom est juste avant le poids)
        // Évite d'inclure le texte d'introduction du premier segment
        const lines = seg.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        const lastLine = lines.length > 0 ? lines[lines.length - 1] : seg.trim();
        const words = lastLine.split(/\s+/).filter(w => /^[A-ZÀ-ÿa-zà-ÿ][A-ZÀ-ÿa-zà-ÿ'\-]+$/.test(w));
        if (words.length >= 1 && words.length <= 4) namesByWeight.push(cap2(words.join(' ')));
      });
    }

    // Texte nettoyé : retire téléphone, email, poids, nombres isolés
    const clean = text
      .replace(phoneMatch?.[0] ?? '\x00', ' ')
      .replace(emailMatch?.[0] ?? '\x00', ' ')
      .replace(/\d+\s*(?:kg|kgs?|kilos?)\b/gi, ' ')
      .replace(/\b\d+\b/g, ' ')
      .replace(/\s+/g, ' ').trim();

    const W = "[A-ZÀ-ÿa-zà-ÿ][A-ZÀ-ÿa-zà-ÿ'\\-]{1,25}";
    const FN = `${W}(?:\\s+${W}){0,2}`;
    const cap = (s: string) => s.trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    const found: string[] = [];
    let m: RegExpExecArray | null;

    // Priorité absolue : format "Prénom Nom Xkg" par ligne → on court-circuite les autres stratégies
    // pour éviter que "pour les vols de samedi" soit capturé comme un faux nom de groupe
    if (namesByWeight.length >= 2) {
      namesByWeight.forEach(n => found.push(n));
    }

    // 1. Étiquettes explicites : "Nom : Dupont", "Prénom : Jean"
    if (found.length === 0) {
      const labelRe = new RegExp(`(?:nom|prénom|prenom|contact|client)\\s*[:\\-]\\s*(${FN})`, 'gi');
      while ((m = labelRe.exec(clean)) !== null) found.push(cap(m[1]));
    }

    // 2. Formules françaises : "je m'appelle X", "c'est X", "je suis X"
    if (found.length === 0) {
      const introRe = new RegExp(`(?:je\\s+m['']appelle|c['']est|je\\s+suis|mon\\s+nom\\s+est|je\\s+me\\s+nomme)\\s+(${FN})`, 'gi');
      while ((m = introRe.exec(clean)) !== null) found.push(cap(m[1]));
    }

    // 3. "pour/avec X, Y et Z"
    if (found.length === 0) {
      const groupRe = /(?:pour|avec|réserver\s+pour|réservation\s+(?:de\s+)?)\s*((?:[A-ZÀ-ÿa-z][A-ZÀ-ÿa-zà-ÿ'\-]*(?:\s+[A-ZÀ-ÿa-z][A-ZÀ-ÿa-zà-ÿ'\-]*)?)(?:\s*,\s*[A-ZÀ-ÿa-z][A-ZÀ-ÿa-zà-ÿ'\-]*(?:\s+[A-ZÀ-ÿa-z][A-ZÀ-ÿa-zà-ÿ'\-]*)*)*(?:\s+et\s+[A-ZÀ-ÿa-z][A-ZÀ-ÿa-zà-ÿ'\-]*(?:\s+[A-ZÀ-ÿa-z][A-ZÀ-ÿa-zà-ÿ'\-]*)*)?)/gi;
      while ((m = groupRe.exec(clean)) !== null) {
        m[1].split(/,|\s+et\s+/i).map(p => cap(p.trim())).filter(p => p.length > 1).forEach(p => found.push(p));
      }
    }

    // 4. Lignes courtes purement nominales (1-4 mots, que des lettres)
    if (found.length === 0) {
      const skipLine = /\b(bonjour|bonsoir|salut|merci|voudrais|voulais|réserver|souhaite|cordialement|bonne|cher|chère|madame|monsieur|bjr|cdt|objet|sujet|re|fw)\b/i;
      clean.split('\n').map(l => l.trim()).filter(l => l.length > 1 && l.length < 45 && !l.includes('@') && !/\d/.test(l)).forEach(line => {
        const words = line.replace(/[.,!?;:]+$/, '').split(/\s+/);
        if (words.length >= 1 && words.length <= 4 && words.every(w => /^[A-ZÀ-ÿa-zà-ÿ][A-ZÀ-ÿa-zà-ÿ'\-]*$/.test(w)) && !skipLine.test(line))
          found.push(cap(line));
      });
    }

    // 5. Format liste compact avec poids comme séparateurs (priorité)
    if (found.length === 0 && namesByWeight.length > 0) {
      namesByWeight.forEach(n => found.push(n));
    }

    // 5b. Format liste sans poids : regroupe par paires (max 2 mots) puis mots seuls capitalisés
    if (found.length === 0) {
      const tokens = clean.split(/\s+/).filter(w => /^[A-ZÀ-ÿa-zà-ÿ][A-ZÀ-ÿa-zà-ÿ'\-]*$/.test(w));
      const skipToken = /^(bonjour|bonsoir|salut|merci|oui|non|et|ou|le|la|les|de|du|des|un|une|vol|vols|pour|avec|re|fw|bjr|cdt|ok|bsr|bonne|cher|chère)$/i;
      let i = 0;
      while (i < tokens.length) {
        if (skipToken.test(tokens[i])) { i++; continue; }
        // Groupe de 2 mots max (Nom Prénom)
        if (i + 1 < tokens.length && /^[A-ZÀ-Ÿ]/.test(tokens[i + 1]) && !skipToken.test(tokens[i + 1])) {
          found.push(cap(tokens[i] + ' ' + tokens[i + 1]));
          i += 2;
        } else if (/^[A-ZÀ-Ÿ]/.test(tokens[i])) {
          found.push(cap(tokens[i]));
          i++;
        } else { i++; }
      }
    }

    // 6. Filet : séquences de 2+ mots en majuscule initiale dans le texte complet
    if (found.length === 0) {
      const properRe = /\b([A-ZÀ-Ÿ][a-zA-ZÀ-ÿà-ÿ'\-]{1,}(?:\s+[A-ZÀ-Ÿ][a-zA-ZÀ-ÿà-ÿ'\-]{1,}){1,2})\b/g;
      const skipPair = /^(Bonjour|Bonsoir|Merci|Cordialement|Bonne|Madame|Monsieur|Bien|Cher|Chère|Objet|Re)\b/i;
      while ((m = properRe.exec(clean)) !== null) {
        if (!skipPair.test(m[1])) found.push(cap(m[1]));
      }
    }

    const names = [...new Set(found)].slice(0, 6);
    const weights = [...text.matchAll(/(\d+)\s*(?:kg|kgs?|kilos?)\b/gi)].map(m => m[1]);
    setParsed({ names, phone, email, weights });
  };

  const applyParsed = () => {
    if (!parsed) return;
    const title = parsed.names.join(', ') || formData.title;
    setFormData(f => ({
      ...f,
      title: title || f.title,
      phone: parsed.phone || f.phone,
      email: parsed.email || f.email,
    }));
    if (parsed.weights.length > 0) {
      setPassengerWeights(prev => Array.from({ length: Math.max(prev.length, parsed.weights.length) }, (_, i) => parsed.weights[i] || prev[i] || ''));
    }
    setPasteZoneOpen(false);
    setPasteText('');
    setParsed(null);
  };

  // ── Init depuis selectedEvent ──────────────────────────────────────────────
  useEffect(() => {
    if (!selectedEvent) return;
    const realTitle = selectedEvent.title;
    setFormData({
      title: realTitle === 'NOTE' ? '' : (realTitle || ''),
      flight_type_id: selectedEvent.flight_type_id?.toString() ?? '',
      weightChecked: selectedEvent.weight_checked || false,
      phone: selectedEvent.phone || '',
      email: selectedEvent.email || '',
      notes: selectedEvent.notes || '',
      booking_options: selectedEvent.booking_options || '',
      client_message: selectedEvent.client_message || '',
    });
    const start = new Date(selectedEvent.start as Date | string);
    const dStr = start.toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' });
    const tStr = start.toLocaleTimeString('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', hour12: false });
    setMoveConfig({ date: dStr, time: tStr, monitorId: selectedEvent.monitor_id || 'random' });
    setActiveTab(currentUser?.role === 'admin' || currentUser?.role === 'aravis' ? 'client' : 'note');
    setBlockType('none');
    setSelectedMonitors([]);
    setBlockUntilMs(selectedEvent.end_time ? new Date(selectedEvent.end_time).getTime() : 0);
    // Détecter la taille du groupe existant via les titres "(Chef de groupe)"
    const rawTitle = selectedEvent.title || '';
    const parenthetical = rawTitle.match(/\(([^)]+)\)$/);
    const leaderName = (parenthetical && !parenthetical[1].toLowerCase().startsWith('client '))
      ? parenthetical[1]
      : null;
    let detectedGroupSize = 1;
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    const sameDaySlots = appointments.filter(a => {
      if (a.status !== 'booked') return false;
      return new Date(a.start_time).toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' }) === dStr;
    });
    if (leaderName) {
      const esc = leaderName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const members = sameDaySlots.filter(a => a.title === leaderName || new RegExp(`\\(${esc}\\)$`).test(a.title || ''));
      if (members.length > 0) detectedGroupSize = members.length;
    } else if (rawTitle && selectedEvent.status === 'booked') {
      const esc = rawTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const followers = sameDaySlots.filter(a => new RegExp(`\\(${esc}\\)$`).test(a.title || ''));
      if (followers.length > 0) detectedGroupSize = followers.length + 1;
    }
    setGroupSize(detectedGroupSize);
    setGroupLocked(detectedGroupSize > 1);
    setShowGroupSelector(detectedGroupSize >= 3);
    setIsEditing(selectedEvent.status !== 'booked');
    setPassengerWeights([selectedEvent.weight?.toString() || '']);
    const sb = selectedEvent.second_booking;
    setSecondBooking(sb ? { title: sb.title || '', phone: sb.phone || '', weight: sb.weight?.toString() || '', payment_type: sb.payment_type || '', encaisseur_id: sb.encaisseur_id || '' } : { title: '', phone: '', weight: '', payment_type: '', encaisseur_id: '' });
    setManualCounts({});
    const pd = selectedEvent.status === 'booked' ? selectedEvent.payment_data : null;
    setSelectedPartnerId(pd?.partner_id?.toString() ?? '');
    let inferredType = pd?.payment_type || '';
    if (!inferredType && pd) {
      if (pd.online) inferredType = 'online';
      else if (pd.cb) inferredType = 'cb';
      else if (pd.especes) inferredType = 'esp';
      else if (pd.cheque) inferredType = 'chq';
      else if (pd.ancv) inferredType = 'ancv';
      else if (pd.voucher && pd.code_type === 'gift_card') inferredType = 'bon_cadeau';
    }
    setPaymentType(inferredType === 'np' ? '' : inferredType);
    let inferredEncaisseur = pd?.encaisseur_id?.toString() || '';
    if (!inferredEncaisseur && inferredType === 'esp') {
      inferredEncaisseur = selectedEvent.monitor_id?.toString() || '';
    }
    setEncaisseurId(inferredEncaisseur);
    setIsManual(false);
    setMoveGroup(false);
    setPaymentScope('slot');
    setSelectedComplementIds(Array.isArray(pd?.selected_complements) ? (pd.selected_complements as { id: number }[]).map(c => Number(c.id)) : []);
    setFlightPriceOverride(pd?.price_override_cents != null ? (Number(pd.price_override_cents) / 100).toFixed(2) : '');
    setComplementPriceOverride(pd?.complement_total_cents ? (Number(pd.complement_total_cents) / 100).toFixed(2) : '');
    setCbNetAmount(pd?.cb_net_cents != null ? (Number(pd.cb_net_cents) / 100).toFixed(2) : '');
  }, [selectedEvent, currentUser]);

  // Auto-fill encaisseur for online/bon_cadeau once fullMonitors loads — runs
  // in a separate effect so fullMonitors changes never reset user selections.
  useEffect(() => {
    if (!selectedEvent || fullMonitors.length === 0 || selectedEvent.status !== 'booked') return;
    const pd = selectedEvent.payment_data;
    let inferredType = pd?.payment_type || '';
    if (!inferredType && pd) {
      if (pd.online) inferredType = 'online';
      else if (pd.voucher && pd.code_type === 'gift_card') inferredType = 'bon_cadeau';
    }
    if (inferredType === 'online' || inferredType === 'bon_cadeau') {
      const caisse = fullMonitors.find(m => m.receives_online_payments);
      if (caisse) setEncaisseurId(caisse.id.toString());
    }
  }, [selectedEvent, fullMonitors]);

  // Sync taille du tableau de poids avec le nombre de passagers
  // Pour un groupe verrouillé, on édite un seul créneau — pas besoin d'inputs multiples
  useEffect(() => {
    if (groupLocked) return;
    setPassengerWeights(prev => {
      const next = [...prev];
      while (next.length < groupSize) next.push('');
      return next.slice(0, groupSize);
    });
  }, [groupSize, groupLocked]);

  // ── useMemos ───────────────────────────────────────────────────────────────
  const groupRootSlots = useMemo(() => {
    if (!selectedEvent || selectedEvent.status !== 'booked' || selectedEvent.title?.startsWith('↪️ Suite')) return [];
    const phone = selectedEvent.phone;
    const baseTitle = selectedEvent.title?.replace(/\s*\(\d+\/\d+\)$/, '').trim();
    if (!phone && !baseTitle) return [selectedEvent];
    const dStr = new Date(selectedEvent.start as Date | string).toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' });
    const rootSlots = appointments.filter(a => {
      if (a.status !== 'booked' || a.title?.startsWith('↪️ Suite')) return false;
      if (new Date(a.start_time).toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' }) !== dStr) return false;
      if (phone && a.phone === phone) return true;
      if (!phone && baseTitle && a.title?.replace(/\s*\(\d+\/\d+\)$/, '').trim() === baseTitle) return true;
      return false;
    });
    if (!rootSlots.some(s => s.id === selectedEvent.id)) rootSlots.push(selectedEvent);
    return rootSlots;
  }, [appointments, selectedEvent]);

  const currentBookingSlotIds = useMemo(() => {
    if (!selectedEvent) return [];
    const flight = flightTypes.find(f => f.id?.toString() === selectedEvent.flight_type_id?.toString());
    const flightDur = flight?.duration_minutes || flight?.duration || 0;
    const slotsNeeded = (flight?.allow_multi_slots && slotDuration > 0 && flightDur > slotDuration) ? Math.ceil(flightDur / slotDuration) : 1;
    const startMs = new Date(selectedEvent.start as Date | string).getTime();
    const ids = [selectedEvent.id];
    for (let i = 1; i < slotsNeeded; i++) {
      const ms = startMs + i * slotDuration * 60000;
      const slot = appointments.find(a => a.monitor_id?.toString() === selectedEvent.monitor_id?.toString() && new Date(a.start_time).getTime() === ms && a.title?.startsWith('↪️ Suite'));
      if (slot) ids.push(slot.id);
    }
    return ids;
  }, [selectedEvent, flightTypes, slotDuration, appointments]);

  const upcomingBlockingSlots = useMemo(() => {
    if (!selectedEvent) return [];
    const startMs = new Date(selectedEvent.start as Date | string).getTime();
    const sDate = new Date(selectedEvent.start as Date | string).toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' });
    return appointments
      .filter(a =>
        a.monitor_id?.toString() === selectedEvent.monitor_id?.toString() &&
        new Date(a.start_time).toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' }) === sDate &&
        new Date(a.start_time).getTime() >= startMs
      )
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  }, [appointments, selectedEvent]);

  const availableTargetSlots = useMemo(() => {
    return appointments.filter(a => {
      if (a.status !== 'available' && !currentBookingSlotIds.includes(a.id)) return false;

      const d = new Date(a.start_time);
      if (d.toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' }) !== moveConfig.date) return false;
      if (moveConfig.monitorId !== 'random' && a.monitor_id?.toString() !== moveConfig.monitorId) return false;
      if (formData.flight_type_id) {
        const flight = flightTypes.find(f => f.id?.toString() === formData.flight_type_id?.toString());
        if (flight) {
          const flightDur = flight.duration_minutes || flight.duration || 0;
          const slotsNeeded = (flight.allow_multi_slots && slotDuration > 0 && flightDur > slotDuration) ? Math.ceil(flightDur / slotDuration) : 1;
          if (slotsNeeded > 1) {
            const startMs = new Date(a.start_time).getTime();
            for (let i = 1; i < slotsNeeded; i++) {
              const nextSlot = appointments.find(appt => appt.monitor_id?.toString() === a.monitor_id?.toString() && new Date(appt.start_time).getTime() === startMs + i * slotDuration * 60000 && (appt.status === 'available' || currentBookingSlotIds.includes(appt.id)));
              if (!nextSlot) return false;
            }
          } else {
            const dur = Math.round((new Date(a.end_time).getTime() - d.getTime()) / 60000);
            if (flightDur > dur) return false;
          }
          const slotTimeStr = d.toLocaleTimeString('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', hour12: false });
          const allowedSlots = Array.isArray(flight.allowed_time_slots) ? flight.allowed_time_slots : [];
          if (allowedSlots.length > 0 && !allowedSlots.includes(slotTimeStr)) return false;
        }
      }
      return true;
    });
  }, [appointments, currentBookingSlotIds, moveConfig, formData.flight_type_id, flightTypes, slotDuration]);

  const availableTimes = useMemo(() =>
    Array.from(new Set(availableTargetSlots.map(a =>
      new Date(a.start_time).toLocaleTimeString('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', hour12: false })
    ))).sort(), [availableTargetSlots]);

  useEffect(() => {
    if (moveConfig.time && !availableTimes.includes(moveConfig.time)) {
      setMoveConfig(prev => ({ ...prev, time: '' }));
    }
  }, [availableTimes]);

  const isShortFlightType = useMemo(() => {
    if (!formData.flight_type_id) return false;
    const ft = flightTypes.find(f => f.id?.toString() === formData.flight_type_id.toString());
    if (!ft) return false;
    // Vol avec plusieurs passagers par créneau (ex: Aiglon) → toujours Pax 1 / Pax 2
    if ((ft.passengers_per_slot || 1) > 1) return true;
    // Legacy : contexte Aravis + durée courte (2 vols tiennent dans 1 créneau)
    if (!isAravisContext || !slotDuration) return false;
    const dur = ft.duration_minutes || 0;
    return dur > 0 && dur * 2 <= slotDuration;
  }, [isAravisContext, slotDuration, formData.flight_type_id, flightTypes]);

  const paxPerSlot = useMemo(() => {
    const ft = flightTypes.find(f => f.id?.toString() === (selectedEvent?.flight_type_id ?? formData.flight_type_id)?.toString());
    return ft?.passengers_per_slot || 1;
  }, [flightTypes, selectedEvent?.flight_type_id, formData.flight_type_id]);

  const groupTotalPax = useMemo(() => groupRootSlots.length * paxPerSlot, [groupRootSlots.length, paxPerSlot]);

  const smartFlightOptions = useMemo(() => {
    const dateStr = selectedEvent?.start ? new Date(selectedEvent.start as Date | string).toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' }) : '';
    const planSchedules: Record<string, Set<string>> = {};
    slotDefs.forEach(d => {
      const pName = d.plan_name || 'Standard';
      if (!planSchedules[pName]) planSchedules[pName] = new Set();
      const t = typeof d.start_time === 'string' ? d.start_time.substring(0, 5) : '';
      if (t) planSchedules[pName].add(t);
    });
    const dayTimesArray = appointments.filter(a =>
      new Date(a.start_time).toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' }) === dateStr
    ).map(a => new Date(a.start_time).toLocaleTimeString('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', hour12: false }));
    let inferredPlan = 'Standard'; let maxMatches = -1;
    for (const [pName, pSet] of Object.entries(planSchedules)) {
      let matches = 0;
      dayTimesArray.forEach(t => { if (pSet.has(t)) matches++; });
      if (matches > maxMatches) { maxMatches = matches; inferredPlan = pName; }
    }
    const activePlanTimes = planSchedules[inferredPlan] || new Set();
    const selectedPartnerForFlight = selectedPartnerId ? partners.find(p => p.id.toString() === selectedPartnerId) : null;
    const isAravisPartner = !!(selectedPartnerForFlight?.name?.toLowerCase().includes('aravis') || selectedPartnerForFlight?.code?.toLowerCase().includes('aravis'));
    const partnerAllowedIds = selectedPartnerForFlight?.allowed_flight_types?.length
      ? new Set(selectedPartnerForFlight.allowed_flight_types.map(ft => ft.flight_type_id))
      : null;
    const existingFtId = selectedEvent?.flight_type_id?.toString();
    return flightTypes.filter(f => {
      // Toujours inclure le vol déjà réservé sur ce créneau (mode édition)
      if (existingFtId && f.id.toString() === existingFtId) return true;
      const ftTenant = f.tenant || 'fluide';
      const effectiveAravisContext = isAravisContext || isAravisPartner;
      if (effectiveAravisContext && ftTenant !== 'aravis') return false;
      if (!effectiveAravisContext && ftTenant === 'aravis') return false;
      if (partnerAllowedIds && !partnerAllowedIds.has(f.id)) return false;
      const allowed = Array.isArray(f.allowed_time_slots) ? f.allowed_time_slots : [];
      return allowed.length === 0 || allowed.some((t: string) => activePlanTimes.has(t));
    });
  }, [selectedEvent, slotDefs, appointments, flightTypes, selectedPartnerId, partners, isAravisContext]);

  const availableTimeGroups = useMemo(() => {
    if (!selectedEvent || !formData.flight_type_id) return [];
    const flight = flightTypes.find(f => f.id.toString() === formData.flight_type_id.toString());
    const flightDur = flight?.duration_minutes || flight?.duration || 0;
    const slotsNeeded = (flight?.allow_multi_slots && slotDuration > 0 && flightDur > slotDuration) ? Math.ceil(flightDur / slotDuration) : 1;
    const startMs = new Date(selectedEvent.start as Date | string).getTime();
    const dayStr = new Date(selectedEvent.start as Date | string).toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' });
    const allDayAvailable = appointments.filter(a =>
      a.status === 'available' &&
      new Date(a.start_time).toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' }) === dayStr &&
      new Date(a.start_time).getTime() >= startMs
    );
    const validStartSlots: Slot[] = [];
    allDayAvailable.forEach(slot => {
      const sTime = new Date(slot.start_time).getTime();
      let canDoFlight = true;
      for (let i = 0; i < slotsNeeded; i++) {
        if (!allDayAvailable.find(x => x.monitor_id === slot.monitor_id && new Date(x.start_time).getTime() === sTime + i * slotDuration * 60000)) { canDoFlight = false; break; }
      }
      if (canDoFlight) validStartSlots.push(slot);
    });
    const groups: Record<string, Slot[]> = {};
    validStartSlots.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()).forEach(slot => {
      const timeStr = new Date(slot.start_time).toLocaleTimeString('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', hour12: false });
      if (!groups[timeStr]) groups[timeStr] = [];
      groups[timeStr].push(slot);
    });
    const paxPerSlot = flight?.passengers_per_slot || 1;
    return Object.keys(groups).map(time => ({ time, capacity: groups[time].length * paxPerSlot, slots: groups[time] })).sort((a, b) => a.time.localeCompare(b.time));
  }, [selectedEvent, formData.flight_type_id, appointments, flightTypes, slotDuration]);

  const displayDistribution = useMemo(() => {
    const flight = flightTypes.find(f => f.id.toString() === formData.flight_type_id?.toString());
    const paxPerSlot = flight?.passengers_per_slot || 1;
    let remaining = groupSize;
    const result: TimeGroup[] = [];
    let canFit = true;
    if (!isManual) {
      // Pre-place existing booked slots from the current group (not locked)
      const preByTime: Record<string, Slot[]> = {};
      if (!groupLocked) {
        groupRootSlots.forEach(s => {
          const t = new Date(s.start_time).toLocaleTimeString('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', hour12: false });
          if (!preByTime[t]) preByTime[t] = [];
          preByTime[t].push(s);
        });
      }
      // Merge existing + available into a unified sorted time list
      const allTimes = [...new Set([...Object.keys(preByTime), ...availableTimeGroups.map(g => g.time)])].sort();
      for (const time of allTimes) {
        if (remaining <= 0) break;
        const existingSlots = preByTime[time] ?? [];
        const availGroup = availableTimeGroups.find(g => g.time === time);
        const availSlots = availGroup?.slots ?? [];
        const combinedSlots = [...existingSlots, ...availSlots];
        const take = Math.min(remaining, combinedSlots.length * paxPerSlot);
        if (take > 0) {
          result.push({ time, capacity: combinedSlots.length * paxPerSlot, slots: combinedSlots, count: take });
          remaining -= take;
        }
      }
      if (remaining > 0) canFit = false;
      const usedTimes = new Set(result.map(r => r.time));
      const nextGroup = availableTimeGroups.find(g => !usedTimes.has(g.time));
      if (remaining <= 0 && nextGroup) result.push({ ...nextGroup, count: 0 });
    } else {
      let lastNonZeroIndex = -1;
      for (let i = 0; i < availableTimeGroups.length; i++) {
        if ((manualCounts[availableTimeGroups[i].time] || 0) > 0) lastNonZeroIndex = i;
      }
      const showUpTo = Math.min(lastNonZeroIndex + 1, availableTimeGroups.length - 1);
      for (let i = 0; i <= Math.max(0, showUpTo); i++) {
        const group = availableTimeGroups[i];
        result.push({ ...group, count: manualCounts[group.time] || 0 });
      }
    }
    const slotsToUse: Slot[] = [];
    result.forEach(r => {
      for (let i = 0; i < r.count; i++) {
        slotsToUse.push(r.slots[Math.min(Math.floor(i / paxPerSlot), r.slots.length - 1)]);
      }
    });
    return { items: result, canFit, slotsToUse, paxPerSlot };
  }, [availableTimeGroups, groupSize, manualCounts, isManual, groupRootSlots, groupLocked, flightTypes, formData.flight_type_id]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleMainChange = (delta: number) => { setGroupSize(prev => Math.max(1, prev + delta)); setIsManual(false); };

  const handlePaymentTypeChange = (type: string) => {
    setPaymentType(type);
    if (type === 'esp') {
      setEncaisseurId(selectedEvent?.monitor_id?.toString() || '');
    } else if (type === 'online' || type === 'bon_cadeau') {
      // Stripe / bon cadeau Fluide : toujours CB via Stripe, encaisseur auto
      const caisse = fullMonitors.find(m => m.receives_online_payments);
      setEncaisseurId(caisse ? caisse.id.toString() : '');
    } else {
      // CB, ANCV, ANCV Connect, CHQ, NP : sélection manuelle
      setEncaisseurId('');
    }
  };

  const handleSubChange = (time: string, delta: number) => {
    setManualCounts(prev => {
      const newCounts = { ...prev };
      if (!isManual) displayDistribution.items.forEach(item => { newCounts[item.time] = item.count; });
      const capacity = availableTimeGroups.find(g => g.time === time)?.capacity || 0;
      newCounts[time] = Math.max(0, Math.min(capacity, (newCounts[time] || 0) + delta));
      setGroupSize(Object.values(newCounts).reduce((a, b) => a + b, 0));
      setIsManual(true);
      return newCounts;
    });
  };

  const applyAll = async (updatesToApply: SlotUpdate[]) => {
    setAppointments(prev => prev.map(slot => {
      const update = updatesToApply.find(u => u.id === slot.id);
      return update ? { ...slot, ...update.data } : slot;
    }));
    onClose();
    try {
      const responses = await Promise.all(updatesToApply.map(u => apiFetch(`/api/slots/${u.id}`, { method: 'PATCH', body: JSON.stringify(u.data) })));
      const failed = responses.filter(r => !r.ok);
      if (failed.length > 0) {
        toast.error('❌ Erreur lors de la sauvegarde. Veuillez réessayer.');
        console.error('PATCH échoué pour', failed.length, 'slot(s)');
      }

      // Auto-passage "programmé" si le créneau vient d'une demande
      const standbyId = standbyIdRef.current;
      const firstBooking = updatesToApply.find(u => u.data.status === 'booked');
      if (standbyId && firstBooking) {
        standbyIdRef.current = null;
        const linkedSlot = appointments.find(a => a.id === firstBooking.id);
        const startRaw = linkedSlot?.start_time || (linkedSlot as Slot & { start?: string | Date })?.start;
        const bookedDate = startRaw ? new Date(startRaw).toISOString().split('T')[0] : null;
        const bookedTime = startRaw ? new Date(startRaw).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' }) : null;
        apiFetch(`/api/standby/${standbyId}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'scheduled', slot_id: firstBooking.id, booked_date: bookedDate, booked_time: bookedTime }),
        }).then(r => { if (!r.ok) console.error('[standby] PATCH échoué', r.status); })
          .catch(e => console.error('[standby] PATCH erreur réseau', e));
      }

      // Met à jour l'état avec les données confirmées par le serveur (RETURNING *).
      // Évite qu'un rechargement complet ne restaure d'anciennes notes (trait ambre).
      const serverSlots = await Promise.all(responses.map(r => r.ok ? r.json().catch(() => null) : null));
      const confirmed = serverSlots.filter(Boolean) as Slot[];
      if (confirmed.length > 0) {
        setAppointments(prev => prev.map(slot => {
          const srv = confirmed.find(s => s.id === slot.id);
          return srv ? { ...slot, ...srv } : slot;
        }));
      }
      if (failed.length > 0) await loadAppointments();
    } catch { toast.error('❌ Erreur réseau lors de la sauvegarde.'); }
  };

  const handleSaveNote = async () => {
    if (!selectedEvent) return;
    let slotsNeeded = 1;
    let targetMonitors: string[] = [];
    let slotsToUpdate: Slot[] = [];

    if (activeTab === 'note') {
      const isNonBlockingNote = !formData.title?.includes('NON DISPO');
      targetMonitors = blockType === 'all' ? monitors.map(m => m.id.toString()) : blockType === 'specific' ? selectedMonitors : [selectedEvent.monitor_id?.toString()];
      const startMs = new Date(selectedEvent.start as Date | string).getTime();
      slotsToUpdate = appointments.filter(a => targetMonitors.includes(a.monitor_id?.toString()) && new Date(a.start_time).getTime() >= startMs && new Date(a.start_time).getTime() < blockUntilMs && !IS_PAUSE_SLOT(a));
      if (!isNonBlockingNote) {
        if (slotsToUpdate.some(slot => IS_CLIENT_SLOT(slot))) { toast.error('❌ Impossible de bloquer : Un ou plusieurs clients sont déjà réservés.'); return; }
      }
      const updatesToApply: SlotUpdate[] = [];
      slotsToUpdate.forEach(slot => {
        const noteTitle = isNonBlockingNote ? (formData.notes.trim() ? 'NOTE' : '') : 'NON DISPO';
        let payload: Record<string, unknown> = { title: noteTitle, notes: formData.notes, status: isNonBlockingNote ? 'available' : 'booked' };
        if (isNonBlockingNote) {
          if (IS_CLIENT_SLOT(slot)) {
            payload = { ...payload, title: slot.title, status: slot.status, flight_type_id: slot.flight_type_id, phone: slot.phone, email: slot.email, weightChecked: slot.weight_checked || slot.weightChecked, booking_options: slot.booking_options, client_message: slot.client_message, weight: slot.weight };
          } else {
            payload = { ...payload, flight_type_id: null, phone: '', email: '', weightChecked: false, booking_options: '', client_message: '' };
          }
        } else {
          payload = { ...payload, flight_type_id: null, phone: '', email: '', weightChecked: false, booking_options: '', client_message: '' };
        }
        updatesToApply.push({ id: slot.id, data: payload });
      });
      return applyAll(updatesToApply);
    }

    const selectedPartner = partners.find(p => p.id.toString() === selectedPartnerId);
    const pf = selectedPartner?.booking_fields;
    const effectiveTitle = (selectedPartner && pf?.name === false && !formData.title.trim())
      ? `Client ${selectedPartner.name}`
      : formData.title;
    const partnerPaymentData = selectedPartner
      ? { partner: true, partner_id: selectedPartner.id, partner_name: selectedPartner.name, code: selectedPartner.code, partner_color: selectedPartner.color_code }
      : {};
    const existingPd = selectedEvent?.status === 'booked'
      ? ((selectedEvent.payment_data || {}) as Record<string, unknown>)
      : {};
    const finalPaymentData: Record<string, unknown> = {
      ...existingPd,
      ...partnerPaymentData,
    };
    if (paymentType) {
      finalPaymentData.payment_type = paymentType;
      if (paymentType !== 'np' && paymentType !== 'a_facturer' && encaisseurId) {
        finalPaymentData.encaisseur_id = encaisseurId;
      } else if (paymentType === 'np' || paymentType === 'a_facturer') {
        delete finalPaymentData.encaisseur_id;
      }
    } else {
      // Paiement vidé (— Non renseigné —) : effacer payment_type et encaisseur_id hérités
      delete finalPaymentData.payment_type;
      delete finalPaymentData.encaisseur_id;
    }
    if (paymentType === 'a_facturer' && selectedPartner) {
      const flight = flightTypes.find(f => f.id.toString() === formData.flight_type_id?.toString());
      const partnerFtConfig = selectedPartner.allowed_flight_types?.find(ft => ft.flight_type_id === flight?.id);
      const priceCents = partnerFtConfig?.base_price_cents != null ? partnerFtConfig.base_price_cents : (flight?.price_cents ?? 0);
      let invoiceCents = priceCents;
      if (selectedPartner.commission_type === 'percentage') {
        invoiceCents = Math.round(priceCents * (1 - (selectedPartner.commission_value ?? 0) / 100));
      } else if (selectedPartner.commission_type === 'fixed') {
        invoiceCents = Math.max(0, priceCents - Math.round((selectedPartner.commission_value ?? 0) * 100));
      }
      finalPaymentData.invoice_amount_cents = invoiceCents;
    }

    // Compléments et prix (uniquement pour les réservations non-Stripe)
    const isStripePd = existingPd.online === true;
    if (!isStripePd) {
      if (selectedComplementIds.length > 0) {
        const comps = selectedComplementIds.map(id => availableComplements.find(c => c.id === id)).filter(Boolean) as { id: number; name: string; price_cents: number }[];
        finalPaymentData.selected_complements = comps.map(c => ({ id: c.id, name: c.name, price_cents: c.price_cents }));
        const autoTotal = comps.reduce((s, c) => s + c.price_cents, 0);
        finalPaymentData.complement_total_cents = complementPriceOverride ? Math.round(parseFloat(complementPriceOverride) * 100) : autoTotal;
      } else {
        delete finalPaymentData.selected_complements;
        delete finalPaymentData.complement_total_cents;
      }
      const selectedFlightObj = flightTypes.find(f => f.id.toString() === formData.flight_type_id);
      const catalogPriceCents = selectedFlightObj?.price_cents ?? 0;
      if (flightPriceOverride) {
        const overrideCents = Math.round(parseFloat(flightPriceOverride) * 100);
        if (overrideCents !== catalogPriceCents) finalPaymentData.price_override_cents = overrideCents;
        else delete finalPaymentData.price_override_cents;
      } else {
        delete finalPaymentData.price_override_cents;
      }
      if (paymentType === 'cb' && cbNetAmount) {
        finalPaymentData.cb_net_cents = Math.round(parseFloat(cbNetAmount) * 100);
      } else {
        delete finalPaymentData.cb_net_cents;
      }
    }

    const complementNames = !isStripePd
      ? selectedComplementIds.map(id => availableComplements.find(c => c.id === id)?.name).filter(Boolean).join(', ')
      : formData.booking_options;
    const effectiveFormData = { ...formData, booking_options: complementNames || '' };

    if (!pf || pf.name !== false) {
      if (!effectiveTitle?.trim()) { toast.error('❌ Le nom du contact est obligatoire pour une réservation.'); return; }
    }
    if (!formData.flight_type_id) { toast.error('❌ Veuillez choisir un type de vol.'); return; }
    if (!pf || pf.phone !== false) {
      if (!formData.phone?.trim()) { toast.error('❌ Le numéro de téléphone est obligatoire.'); return; }
    }
    const selectedFlight = flightTypes.find(f => f.id.toString() === formData.flight_type_id.toString());
    const flightDuration = selectedFlight?.duration_minutes || selectedFlight?.duration || 0;
    slotsNeeded = (selectedFlight?.allow_multi_slots && slotDuration > 0 && flightDuration > slotDuration) ? Math.ceil(flightDuration / slotDuration) : 1;

    const updatesToApply: SlotUpdate[] = [];
    if ((groupSize > 1 || isManual || groupRootSlots.length > 1) && !groupLocked) {
      if (!displayDistribution.canFit || displayDistribution.slotsToUse.length === 0) { toast.error('❌ Pas assez de créneaux disponibles ou aucune place sélectionnée.'); return; }
      displayDistribution.slotsToUse.forEach((baseSlot, index) => {
        const namesList = effectiveTitle.split(',').map((n: string) => n.trim()).filter((n: string) => n);
        let passengerTitle = '';
        if (namesList.length === groupSize + 1) { const booker = namesList[0]; passengerTitle = `${namesList[index + 1]} (${booker})`; }
        else if (namesList.length > 0) { const booker = namesList[0]; passengerTitle = index === 0 ? booker : (namesList[index] ? `${namesList[index]} (${booker})` : `Passager ${index + 1} (${booker})`); }
        else { passengerTitle = groupSize > 1 ? `Passager ${index + 1}` : (effectiveTitle || ''); }
        // If this slot was already added (passengers_per_slot > 1), add as second_booking instead
        const existingIdx = updatesToApply.findIndex(u => u.id === baseSlot.id && u.data.status === 'booked');
        if (existingIdx >= 0) {
          (updatesToApply[existingIdx].data as Record<string, unknown>).second_booking = { title: passengerTitle, phone: '', weight: passengerWeights[index] ? parseInt(passengerWeights[index]) : null, payment_type: null, encaisseur_id: null };
          return;
        }
        const isExistingBooked = groupRootSlots.some(s => s.id === baseSlot.id);
        let slotPaymentData: Record<string, unknown>;
        if (isExistingBooked) {
          slotPaymentData = { ...finalPaymentData };
        } else {
          // Nouveau slot : ne pas hériter des champs Stripe/paiement du slot existant
          slotPaymentData = { ...finalPaymentData };
          ['online', 'cb', 'especes', 'cheque', 'ancv', 'ancv_connect', 'voucher', 'code', 'code_type', 'stripe_session_id', 'stripe_fee_cents', 'stripe_net_cents', 'google_synced'].forEach(f => delete slotPaymentData[f]);
        }
        updatesToApply.push({ id: baseSlot.id, data: { ...effectiveFormData, title: passengerTitle, status: 'booked', weight: passengerWeights[index] ? parseInt(passengerWeights[index]) : null, weightChecked: !!passengerWeights[index], payment_data: slotPaymentData } });
        if (slotsNeeded > 1) {
          const baseStartMs = new Date(baseSlot.start_time).getTime();
          for (let i = 1; i < slotsNeeded; i++) {
            const nextMs = baseStartMs + i * slotDuration * 60000;
            const nextSlot = appointments.find(a => a.monitor_id?.toString() === baseSlot.monitor_id?.toString() && new Date(a.start_time).getTime() === nextMs && a.status === 'available');
            if (nextSlot) updatesToApply.push({ id: nextSlot.id, data: { title: `↪️ Suite ${passengerTitle}`, flight_type_id: formData.flight_type_id, status: 'booked', notes: 'Extension auto' } });
          }
        }
      });
    } else if (slotsNeeded > 1) {
      updatesToApply.push({ id: selectedEvent.id, data: { ...effectiveFormData, title: effectiveTitle, status: 'booked', weight: passengerWeights[0] ? parseInt(passengerWeights[0]) : null, weightChecked: !!passengerWeights[0], payment_data: finalPaymentData } });
      const startMs = new Date(selectedEvent.start as Date | string).getTime();
      for (let i = 1; i < slotsNeeded; i++) {
        const nextMs = startMs + i * slotDuration * 60000;
        const nextSlot = appointments.find(a => a.monitor_id?.toString() === selectedEvent.monitor_id?.toString() && new Date(a.start_time).getTime() === nextMs && a.status === 'available');
        if (nextSlot) updatesToApply.push({ id: nextSlot.id, data: { title: `↪️ Suite ${effectiveTitle || 'Vol'}`, flight_type_id: formData.flight_type_id, status: 'booked', notes: 'Extension auto' } });
      }
    } else {
      const secondBookingData = isShortFlightType ? { second_booking: secondBooking.title.trim() ? { title: secondBooking.title.trim(), phone: secondBooking.phone.trim() || null, weight: secondBooking.weight ? parseInt(secondBooking.weight) : null, payment_type: secondBooking.payment_type || null, encaisseur_id: secondBooking.encaisseur_id || null } : null } : { second_booking: null };
      updatesToApply.push({ id: selectedEvent.id, data: { ...effectiveFormData, title: effectiveTitle, status: effectiveTitle.trim() ? 'booked' : 'available', weight: passengerWeights[0] ? parseInt(passengerWeights[0]) : null, weightChecked: !!passengerWeights[0], payment_data: finalPaymentData, ...secondBookingData } });
    }

    applyAll(updatesToApply);

    // Appliquer le payment_data aux autres slots du groupe via /quick (ne touche pas aux autres champs)
    if (groupLocked && groupRootSlots.length > 1 && paymentScope !== 'slot') {
      const currentStartMs = new Date(selectedEvent.start as Date | string).getTime();
      const currentMonitorId = selectedEvent.monitor_id?.toString();
      const otherSlots = groupRootSlots.filter(s => s.id !== selectedEvent.id);
      const scopedSlots = otherSlots.filter(s => {
        if (paymentScope === 'group') return true;
        if (paymentScope === 'time') return new Date(s.start_time).getTime() === currentStartMs;
        if (paymentScope === 'pilot') return s.monitor_id?.toString() === currentMonitorId;
        return false;
      });
      if (scopedSlots.length > 0) {
        Promise.all(scopedSlots.map(slot => {
          const slotExistingPd = (slot.payment_data || {}) as Record<string, unknown>;
          const slotPd: Record<string, unknown> = { ...slotExistingPd, ...partnerPaymentData };
          if (paymentType) {
            slotPd.payment_type = paymentType;
            if (paymentType !== 'np' && paymentType !== 'a_facturer' && encaisseurId) {
              slotPd.encaisseur_id = encaisseurId;
            } else if (paymentType === 'np' || paymentType === 'a_facturer') {
              delete slotPd.encaisseur_id;
            }
          } else {
            delete slotPd.payment_type;
            delete slotPd.encaisseur_id;
          }
          // Propager prix override et compléments
          if ('price_override_cents' in finalPaymentData) slotPd.price_override_cents = finalPaymentData.price_override_cents;
          else delete slotPd.price_override_cents;
          if (finalPaymentData.complement_total_cents != null) slotPd.complement_total_cents = finalPaymentData.complement_total_cents;
          if (Array.isArray(finalPaymentData.selected_complements)) slotPd.selected_complements = finalPaymentData.selected_complements;
          const slotBookingOptions = complementNames || undefined;
          return apiFetch(`/api/slots/${slot.id}/quick`, { method: 'PATCH', body: JSON.stringify({ payment_data: slotPd, ...(slotBookingOptions !== undefined ? { booking_options: slotBookingOptions } : {}) }) });
        })).then(() => loadAppointments()).catch(() => {});
      }
    }
  };

  const handleRelease = async () => {
    const isNoteOnly = selectedEvent?.status === 'available' && selectedEvent?.title === 'NOTE';
    const isBlockedWithNote = !!(selectedEvent?.title?.toUpperCase().includes('NON DISPO') && selectedEvent?.notes);
    const confirmMsg = isNoteOnly
      ? '🗑️ Voulez-vous vraiment effacer cette note ?'
      : isBlockedWithNote
        ? '🗑️ Action irréversible. Libérer ce créneau ?\n\n(La note associée sera effacée.)'
        : '🗑️ Action irréversible. Libérer ce créneau ?\n\n(Les notes éventuelles seront conservées)';
    if (!selectedEvent || !await confirm(confirmMsg)) return;
    const flight = flightTypes.find(f => f.id.toString() === formData.flight_type_id?.toString());
    const flightDur = flight?.duration_minutes || flight?.duration || 0;
    const slotsNeeded = (flight?.allow_multi_slots && slotDuration > 0 && flightDur > slotDuration) ? Math.ceil(flightDur / slotDuration) : 1;
    const startMs = new Date(selectedEvent.start as Date | string).getTime();
    const updatesToApply: SlotUpdate[] = [];
    for (let i = 0; i < slotsNeeded; i++) {
      const ms = startMs + i * slotDuration * 60000;
      const slotToFree = appointments.find(a => a.monitor_id?.toString() === selectedEvent.monitor_id?.toString() && new Date(a.start_time).getTime() === ms && (i === 0 || a.title?.startsWith('↪️ Suite')));
      if (slotToFree) {
        let newTitle = ''; let newNotes = '';
        if (IS_CLIENT_SLOT(slotToFree) && i === 0 && slotToFree.notes && slotToFree.notes !== 'Extension auto') { newTitle = 'NOTE'; newNotes = slotToFree.notes; }
        updatesToApply.push({ id: slotToFree.id, data: { title: newTitle, flight_type_id: null, weight: null, notes: newNotes, status: 'available', phone: '', email: '', weightChecked: false, booking_options: '', client_message: '', second_booking: null } });
      }
    }
    applyAll(updatesToApply);
  };

  const handleReleaseGroup = async () => {
    if (!selectedEvent || !await confirm(`🧹 Action irréversible. Libérer les ${groupTotalPax} passagers de ce groupe ?`)) return;
    const flight = flightTypes.find(f => f.id.toString() === formData.flight_type_id?.toString());
    const flightDur = flight?.duration_minutes || flight?.duration || 0;
    const slotsNeeded = (flight?.allow_multi_slots && slotDuration > 0 && flightDur > slotDuration) ? Math.ceil(flightDur / slotDuration) : 1;
    const updatesToApply: SlotUpdate[] = [];
    groupRootSlots.forEach(baseSlot => {
      const startMs = new Date(baseSlot.start_time).getTime();
      for (let i = 0; i < slotsNeeded; i++) {
        const ms = startMs + i * slotDuration * 60000;
        const slotToFree = appointments.find(a => a.monitor_id?.toString() === baseSlot.monitor_id?.toString() && new Date(a.start_time).getTime() === ms && (i === 0 || a.title?.startsWith('↪️ Suite')));
        if (slotToFree) updatesToApply.push({ id: slotToFree.id, data: { title: '', flight_type_id: null, weight: null, notes: '', status: 'available', phone: '', email: '', weightChecked: false, booking_options: '', client_message: '', second_booking: null } });
      }
    });
    applyAll(updatesToApply);
  };

  const handleBulkRelease = async () => {
    if (!selectedEvent) return;
    const isPlural = blockType === 'all' || (blockType === 'specific' && selectedMonitors.length > 1) || (upcomingBlockingSlots.length > 0 && blockUntilMs > new Date(upcomingBlockingSlots[0].end_time).getTime());
    const isBlockedSingle = !isPlural && !!(selectedEvent?.title?.toUpperCase().includes('NON DISPO'));
    const confirmMsg = isPlural
      ? '🧹 Voulez-vous vraiment effacer les notes et blocages sur TOUTE la sélection ?\n\n(Les réservations clients existantes seront conservées).'
      : isBlockedSingle
        ? (selectedEvent?.notes ? '🗑️ Action irréversible. Libérer ce créneau ?\n\n(La note associée sera effacée.)' : '🗑️ Action irréversible. Libérer ce créneau ?')
        : '🗑️ Voulez-vous vraiment effacer la note / le blocage de ce créneau ?\n\n(Si un client est présent, il sera conservé).';
    if (!await confirm(confirmMsg)) return;
    const targetMonitors = blockType === 'all' ? monitors.map(m => m.id.toString()) : blockType === 'specific' ? selectedMonitors : [selectedEvent.monitor_id?.toString()];
    const startMs = new Date(selectedEvent.start as Date | string).getTime();
    const slotsToUpdate = appointments.filter(a => targetMonitors.includes(a.monitor_id?.toString()) && new Date(a.start_time).getTime() >= startMs && new Date(a.start_time).getTime() < blockUntilMs && !IS_PAUSE_SLOT(a));
    const updatesToApply: SlotUpdate[] = [];
    slotsToUpdate.forEach(slot => {
      if (IS_CLIENT_SLOT(slot)) {
        updatesToApply.push({ id: slot.id, data: { title: slot.title, status: slot.status, notes: '', flight_type_id: slot.flight_type_id, phone: slot.phone, email: slot.email, weightChecked: slot.weight_checked || slot.weightChecked, booking_options: slot.booking_options, client_message: slot.client_message, weight: slot.weight } });
      } else {
        updatesToApply.push({ id: slot.id, data: { title: '', flight_type_id: null, weight: null, notes: '', status: 'available', phone: '', email: '', weightChecked: false, booking_options: '', client_message: '', second_booking: null } });
      }
    });
    applyAll(updatesToApply);
  };

  const handleReleaseKeepNote = async () => {
    if (!selectedEvent || !await confirm('🔓 Libérer ce créneau en conservant la note ?')) return;
    applyAll([{ id: selectedEvent.id, data: { title: formData.notes ? 'NOTE' : '', notes: formData.notes || '', status: 'available', phone: '', email: '', flight_type_id: null, weight: null, weightChecked: false, booking_options: '', client_message: '', second_booking: null } }]);
  };

  const handleClearNote = async () => {
    if (!selectedEvent || !await confirm('📝 Effacer la note ? Le créneau restera bloqué.')) return;
    applyAll([{ id: selectedEvent.id, data: { title: selectedEvent.title, notes: '', status: 'booked' } }]);
  };

  const handleReleasePax2 = async () => {
    if (!selectedEvent || !await confirm('🗑️ Libérer le 2ème passager de ce créneau ?')) return;
    const ev = selectedEvent;
    applyAll([{ id: ev.id, data: { title: ev.title, weight: ev.weight, flight_type_id: ev.flight_type_id, notes: ev.notes, status: ev.status, phone: ev.phone, email: ev.email, weightChecked: ev.weight_checked, booking_options: ev.booking_options, client_message: ev.client_message, payment_data: ev.payment_data, second_booking: null } }]);
  };

  const handleReleasePax1 = async () => {
    const sb = selectedEvent?.second_booking;
    if (!selectedEvent) return;
    if (sb?.title) {
      if (!await confirm('🗑️ Libérer le 1er passager ? Le 2ème passager prendra sa place.')) return;
      const ev = selectedEvent;
      const pax2PaymentData = ev.payment_data
        ? { ...ev.payment_data, ...(sb.payment_type ? { payment_type: sb.payment_type, encaisseur_id: sb.encaisseur_id } : {}) }
        : (sb.payment_type ? { payment_type: sb.payment_type, encaisseur_id: sb.encaisseur_id } : null);
      applyAll([{ id: ev.id, data: { title: sb.title, weight: sb.weight ?? null, flight_type_id: ev.flight_type_id, notes: ev.notes, status: 'booked', phone: sb.phone || '', email: ev.email || '', weightChecked: !!sb.weight, booking_options: ev.booking_options, client_message: ev.client_message, payment_data: pax2PaymentData, second_booking: null } }]);
    } else {
      handleRelease();
    }
  };

  const handleMove = async () => {
    if (!moveConfig.time || !selectedEvent) return;
    const flight = flightTypes.find(f => f.id.toString() === formData.flight_type_id?.toString());
    const flightDur = flight?.duration_minutes || flight?.duration || 0;
    const slotsNeeded = (flight?.allow_multi_slots && slotDuration > 0 && flightDur > slotDuration) ? Math.ceil(flightDur / slotDuration) : 1;
    const updatesToApply: SlotUpdate[] = [];

    if (moveGroup && groupRootSlots.length > 1) {
      const slotsToFree: number[] = [];
      groupRootSlots.forEach(baseSlot => {
        slotsToFree.push(baseSlot.id);
        if (slotsNeeded > 1) {
          const bMs = new Date(baseSlot.start_time).getTime();
          for (let i = 1; i < slotsNeeded; i++) {
            const nSlot = appointments.find(a => a.monitor_id === baseSlot.monitor_id && new Date(a.start_time).getTime() === bMs + i * slotDuration * 60000);
            if (nSlot) slotsToFree.push(nSlot.id);
          }
        }
      });
      const [targetHour, targetMin] = moveConfig.time.split(':').map(Number);
      const targetTimeMs = (targetHour * 60 + targetMin) * 60000;
      const allDayAvailable = appointments.filter(a => {
        if (a.status !== 'available' && !slotsToFree.includes(a.id)) return false;
        const d = new Date(a.start_time);
        if (d.toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' }) !== moveConfig.date) return false;
        if ((d.getHours() * 60 + d.getMinutes()) * 60000 < targetTimeMs) return false;
        if (!moveGroup && moveConfig.monitorId !== 'random' && a.monitor_id?.toString() !== moveConfig.monitorId) return false;
        return true;
      });
      const validStartSlots: Slot[] = [];
      allDayAvailable.forEach(slot => {
        const sTime = new Date(slot.start_time).getTime();
        let canDoFlight = true;
        for (let i = 0; i < slotsNeeded; i++) {
          if (!allDayAvailable.find(x => x.monitor_id === slot.monitor_id && new Date(x.start_time).getTime() === sTime + i * slotDuration * 60000)) { canDoFlight = false; break; }
        }
        if (canDoFlight) validStartSlots.push(slot);
      });
      validStartSlots.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
      let remaining = groupRootSlots.length;
      const assignedSlots: Slot[] = [];
      for (const slot of validStartSlots) {
        if (remaining === 0) break;
        const sTime = new Date(slot.start_time).getTime();
        if (!assignedSlots.some(a => a.monitor_id === slot.monitor_id && Math.abs(new Date(a.start_time).getTime() - sTime) < slotsNeeded * slotDuration * 60000)) { assignedSlots.push(slot); remaining--; }
      }
      if (remaining > 0) { toast.error(`❌ Impossible : Pas assez de créneaux simultanés pour placer les ${groupTotalPax} passagers à partir de ${moveConfig.time}.`); return; }
      if (assignedSlots.length === groupRootSlots.length && assignedSlots.every((s, i) => s.id === groupRootSlots[i].id)) { toast.info('ℹ️ Le groupe est déjà assigné exactement à ces mêmes créneaux et pilotes.'); return; }
      slotsToFree.forEach(id => updatesToApply.push({ id, data: { status: 'available', title: '', phone: '', email: '', flight_type_id: null, second_booking: null } }));
      groupRootSlots.forEach((oldSlot, g) => {
        const newBaseSlot = assignedSlots[g];
        const passengerTitle = oldSlot.title || formData.title;
        updatesToApply.push({ id: newBaseSlot.id, data: { ...formData, title: passengerTitle, status: 'booked', notes: oldSlot.notes, payment_data: oldSlot.payment_data, second_booking: oldSlot.second_booking ?? null } });
        if (slotsNeeded > 1) {
          const baseStartMs = new Date(newBaseSlot.start_time).getTime();
          for (let i = 1; i < slotsNeeded; i++) {
            const nextSlot = allDayAvailable.find(a => a.monitor_id?.toString() === newBaseSlot.monitor_id?.toString() && new Date(a.start_time).getTime() === baseStartMs + i * slotDuration * 60000);
            if (nextSlot) updatesToApply.push({ id: nextSlot.id, data: { title: `↪️ Suite ${passengerTitle}`, flight_type_id: formData.flight_type_id, status: 'booked', notes: 'Extension auto' } });
          }
        }
      });
    } else if (isShortFlightType && movePax !== 'both') {
      // ── Déplacement pax-spécifique (aiglon) ──
      const [targetHour, targetMin] = moveConfig.time.split(':').map(Number);
      const targetTimeMs = (targetHour * 60 + targetMin) * 60000;
      const paxTargetSlot = appointments.find(a => {
        if (a.status !== 'available') return false;
        if (a.id === selectedEvent.id) return false;
        const d = new Date(a.start_time);
        return d.toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' }) === moveConfig.date && (d.getHours() * 60 + d.getMinutes()) * 60000 === targetTimeMs && (moveConfig.monitorId === 'random' || a.monitor_id?.toString() === moveConfig.monitorId);
      });
      if (!paxTargetSlot) { toast.error("❌ Le créneau cible n'est pas disponible."); return; }
      const ev = selectedEvent;
      const sb = ev.second_booking;
      if (movePax === 'pax2') {
        if (!sb?.title) { toast.error('❌ Aucun 2ème passager à déplacer.'); return; }
        updatesToApply.push({ id: paxTargetSlot.id, data: { title: sb.title, phone: sb.phone || '', weight: sb.weight ?? null, flight_type_id: ev.flight_type_id, email: '', notes: null, weightChecked: !!sb.weight, booking_options: null, client_message: null, payment_data: sb.payment_type ? { payment_type: sb.payment_type, encaisseur_id: sb.encaisseur_id } : null, status: 'booked', second_booking: null } });
        updatesToApply.push({ id: ev.id, data: { title: ev.title, weight: ev.weight, flight_type_id: ev.flight_type_id, notes: ev.notes, status: ev.status, phone: ev.phone, email: ev.email, weightChecked: ev.weight_checked, booking_options: ev.booking_options, client_message: ev.client_message, payment_data: ev.payment_data, second_booking: null } });
      } else {
        // movePax === 'pax1'
        updatesToApply.push({ id: paxTargetSlot.id, data: { title: ev.title, phone: ev.phone || '', weight: ev.weight ?? null, flight_type_id: ev.flight_type_id, email: ev.email || '', notes: ev.notes, weightChecked: ev.weight_checked, booking_options: ev.booking_options, client_message: ev.client_message, payment_data: ev.payment_data, status: 'booked', second_booking: null } });
        if (sb?.title) {
          const movePax1PayData = ev.payment_data
            ? { ...ev.payment_data, ...(sb.payment_type ? { payment_type: sb.payment_type, encaisseur_id: sb.encaisseur_id } : {}) }
            : (sb.payment_type ? { payment_type: sb.payment_type, encaisseur_id: sb.encaisseur_id } : null);
          updatesToApply.push({ id: ev.id, data: { title: sb.title, phone: sb.phone || '', weight: sb.weight ?? null, flight_type_id: ev.flight_type_id, notes: ev.notes, status: 'booked', email: ev.email || '', weightChecked: !!sb.weight, booking_options: ev.booking_options, client_message: ev.client_message, payment_data: movePax1PayData, second_booking: null } });
        } else {
          updatesToApply.push({ id: ev.id, data: { title: '', flight_type_id: null, weight: null, notes: ev.notes, status: 'available', phone: '', email: '', weightChecked: false, booking_options: '', client_message: '', second_booking: null } });
        }
      }
    } else {
      const [targetHour, targetMin] = moveConfig.time.split(':').map(Number);
      const targetTimeMs = (targetHour * 60 + targetMin) * 60000;
      const targetSlot = availableTargetSlots.find(a => {
        const d = new Date(a.start_time);
        return d.toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' }) === moveConfig.date && (d.getHours() * 60 + d.getMinutes()) * 60000 === targetTimeMs && (moveConfig.monitorId === 'random' || a.monitor_id?.toString() === moveConfig.monitorId);
      });
      if (!targetSlot) { toast.error("❌ Le créneau cible n'est plus disponible."); return; }
      if (targetSlot.id === selectedEvent.id) { toast.info('ℹ️ Le créneau est déjà à cet emplacement avec ce pilote.'); return; }
      currentBookingSlotIds.forEach(id => updatesToApply.push({ id, data: { status: 'available', title: '', phone: '', email: '', flight_type_id: null } }));
      const newStartMs = new Date(targetSlot.start_time).getTime();
      for (let i = 0; i < slotsNeeded; i++) {
        const ms = newStartMs + i * slotDuration * 60000;
        const slotToBook = appointments.find(a => a.monitor_id?.toString() === targetSlot.monitor_id?.toString() && new Date(a.start_time).getTime() === ms);
        if (slotToBook) updatesToApply.push({ id: slotToBook.id, data: { ...formData, title: i === 0 ? formData.title : `↪️ Suite ${formData.title || 'Vol'}`, status: 'booked', notes: i === 0 ? formData.notes : 'Extension auto', payment_data: selectedEvent.payment_data } });
      }
    }
    applyAll(updatesToApply);
  };

  // ── Booleans dérivés ───────────────────────────────────────────────────────
  const isEventBlocked = !!(selectedEvent?.title?.includes('☕') || selectedEvent?.title?.toUpperCase().includes('PAUSE') || selectedEvent?.title?.includes('❌') || selectedEvent?.title?.toUpperCase().includes('NON DISPO'));
  const isOutOfSeason = false;
  const isClientLocked = isEventBlocked || isOutOfSeason;
  const isClientSlotLocal = IS_CLIENT_SLOT(selectedEvent || {});
  const isAdminBlockLocal = !!(selectedEvent?.title?.includes('(Admin)'));
  const isLockedForMe = currentUser?.role === 'permanent' && (isClientSlotLocal || isAdminBlockLocal);

  // ── JSX ────────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-[40px] p-8 max-w-sm w-full shadow-2xl max-h-[95vh] overflow-y-auto custom-scrollbar">
        <h2 className="text-xl font-black uppercase italic mb-3 text-slate-900">Gestion du Créneau</h2>

        {selectedEvent && IS_CLIENT_SLOT(selectedEvent) && (() => {
          const flight = flightTypes.find(f => f.id?.toString() === selectedEvent?.flight_type_id?.toString());
          const pd = selectedEvent?.payment_data;
          const isLegacyPaid = pd && (pd.cb || pd.especes || pd.cheque || pd.ancv || pd.online || pd.voucher);
          const isUnpaid = !pd?.payment_type && !isLegacyPaid;
          const isNP = pd?.payment_type === 'np';
          const needsCollection = isUnpaid || isNP;
          const pax1Weight = selectedEvent?.weight;
          const pax2Weight = selectedEvent?.second_booking?.weight;
          const weightLine = (() => {
            if (isShortFlightType) {
              const parts = [];
              if (pax1Weight) parts.push(`Pax1 : ${pax1Weight} kg`);
              if (pax2Weight) parts.push(`Pax2 : ${pax2Weight} kg`);
              return parts.length > 0 ? parts.join(' · ') : null;
            }
            return pax1Weight ? `${pax1Weight} kg` : null;
          })();
          return (
            <div className="mb-4 bg-slate-50 rounded-2xl px-4 py-2.5 border border-slate-100 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-black text-slate-800 text-sm truncate max-w-[55%]">{(() => {
                  const t = selectedEvent?.title || '';
                  const bn = selectedEvent?.billing_name || '';
                  if (!bn || !t) return t;
                  const firstWord = t.split(/[\s,(]/)[0].toLowerCase();
                  const bnFirst = bn.split(/\s/)[0].toLowerCase();
                  return (firstWord === bnFirst && bn.length > t.length) ? bn : t;
                })()}</span>
                {flight && (
                  <span className={`text-xs font-black px-2.5 py-1 rounded-xl ${needsCollection ? 'bg-amber-100 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                    {needsCollection ? `À enc. ${(flight.price_cents / 100).toFixed(0)} €` : `${(flight.price_cents / 100).toFixed(0)} €`}
                  </span>
                )}
              </div>
              {weightLine && <p className="text-[10px] font-bold text-slate-400">⚖️ {weightLine}</p>}
            </div>
          );
        })()}

        <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-xl">
          {(currentUser?.role === 'admin' || currentUser?.role === 'aravis') && !isShortFlightType && (
            <button onClick={() => setActiveTab('client')} className={`flex-1 py-2 rounded-lg font-black text-[9px] uppercase ${activeTab === 'client' ? 'bg-white text-sky-500 shadow-sm' : 'text-slate-400'}`}>👤 Client</button>
          )}
          {(currentUser?.role === 'admin' || currentUser?.role === 'aravis') && isShortFlightType && !showGroupSelector && (
            <>
              <button onClick={() => setActiveTab('client')} className={`flex-1 py-2 rounded-lg font-black text-[9px] uppercase ${activeTab === 'client' ? 'bg-white text-sky-500 shadow-sm' : 'text-slate-400'}`}>👤 Pax 1</button>
              <button onClick={() => setActiveTab('client2')} className={`flex-1 py-2 rounded-lg font-black text-[9px] uppercase ${activeTab === 'client2' ? 'bg-white text-sky-500 shadow-sm' : 'text-slate-400'}`}>👤 Pax 2</button>
            </>
          )}
          {(currentUser?.role === 'admin' || currentUser?.role === 'aravis') && isShortFlightType && showGroupSelector && (
            <div className="flex-1 py-2 px-3 rounded-lg font-black text-[9px] uppercase bg-white text-sky-500 shadow-sm text-center">👥 {groupSize} pax</div>
          )}
          <button onClick={() => setActiveTab('note')} className={`flex-1 py-2 rounded-lg font-black text-[9px] uppercase ${activeTab === 'note' ? 'bg-white text-amber-500 shadow-sm' : 'text-slate-400'}`}>📝 Note</button>
          {(currentUser?.role === 'admin' || currentUser?.role === 'aravis') && selectedEvent?.status !== 'available' && !isClientLocked && (
            <button onClick={() => setActiveTab('move')} className={`flex-1 py-2 rounded-lg font-black text-[9px] uppercase ${activeTab === 'move' ? 'bg-white text-emerald-500 shadow-sm' : 'text-slate-400'}`}>🔄 Déplacer</button>
          )}
        </div>

        <div className="space-y-4">
          {/* ── Tab Client ── */}
          {activeTab === 'client' && (
            isEventBlocked ? (
              <div className="text-center py-8 bg-slate-50 rounded-3xl border-2 border-slate-100">
                <span className="text-4xl block mb-2">🔒</span>
                <p className="font-black text-slate-900 uppercase tracking-widest text-sm mb-2">Créneau Verrouillé</p>
                <p className="text-xs text-slate-500 px-4 font-medium mb-6">Ce créneau est bloqué ou en pause. Pour y ajouter un client, libérez-le d'abord.</p>
                <div className={`flex gap-2 ${selectedEvent?.notes ? 'flex-col sm:flex-row' : ''} justify-center flex-wrap`}>
                  <button onClick={handleRelease} className="bg-rose-100 text-rose-500 px-6 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-rose-500 hover:text-white transition-all shadow-sm">{selectedEvent?.notes ? '🗑️ Libérer + effacer note' : '🗑️ Libérer ce créneau'}</button>
                  {selectedEvent?.notes && <button onClick={handleReleaseKeepNote} className="bg-emerald-50 text-emerald-600 px-6 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-emerald-500 hover:text-white transition-all shadow-sm">🔓 Libérer + garder note</button>}
                  {selectedEvent?.notes && selectedEvent?.title?.toUpperCase().includes('NON DISPO') && <button onClick={handleClearNote} className="bg-amber-50 text-amber-600 px-6 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-amber-500 hover:text-white transition-all shadow-sm">📝 Effacer la note</button>}
                </div>
              </div>
            ) : isOutOfSeason ? (
              <div className="text-center py-8 bg-slate-50 rounded-3xl border-2 border-slate-100">
                <span className="text-4xl block mb-2">❄️</span>
                <p className="font-black text-slate-900 uppercase tracking-widest text-sm mb-2">Hors Saison</p>
                <p className="text-xs text-slate-500 px-4 font-medium mb-6">Ce créneau est en dehors de vos périodes d'ouverture.</p>
                <button onClick={handleRelease} className="bg-slate-200 text-slate-500 px-6 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-rose-500 hover:text-white transition-all shadow-sm">🗑️ {(selectedEvent?.title || selectedEvent?.notes) ? 'Effacer la note' : 'Supprimer le créneau'}</button>
              </div>
            ) : !isEditing && selectedEvent?.status === 'booked' ? (
              /* ── Fiche lecture (mode consultation) ── */
              (() => {
                const ev = selectedEvent!;
                const pd = ev.payment_data;
                const partner = partners.find(p => p.id.toString() === (pd?.partner_id?.toString() ?? ''));
                const flight = flightTypes.find(f => f.id?.toString() === ev.flight_type_id?.toString());
                const payTypeLabel: Record<string, string> = { esp: 'Espèces', cb: 'CB', chq: 'Chèque', ancv: 'ANCV', ancv_connect: 'ANCV Connect', bon_cadeau: 'Bon cadeau', online: 'En ligne', a_facturer: 'À facturer', np: 'Non payé' };
                const encaisseurIdStr = pd?.encaisseur_id?.toString() ?? '';
                const encaisseurFull = encaisseurIdStr ? fullMonitors.find(m => m.id?.toString() === encaisseurIdStr) : null;
                const encaisseurFallback = encaisseurIdStr ? monitors.find(m => m.id === encaisseurIdStr) : null;
                const encaisseurName = encaisseurFull?.first_name ?? encaisseurFallback?.title ?? null;
                const displayTitle = (() => {
                  const t = ev.title || ''; const bn = ev.billing_name || '';
                  if (!bn || !t) return t;
                  return t.split(/[\s,(]/)[0].toLowerCase() === bn.split(/\s/)[0].toLowerCase() && bn.length > t.length ? bn : t;
                })();
                const row = (label: string, value: React.ReactNode) => (
                  <div key={label}>
                    <p className="text-[9px] font-black uppercase text-slate-400 mb-0.5">{label}</p>
                    <p className="text-sm font-bold text-slate-800">{value}</p>
                  </div>
                );
                return (
                  <div className="space-y-3">
                    <div className="bg-slate-50 rounded-2xl p-4 border-2 border-slate-100 space-y-3">
                      {displayTitle && row('Passager(s)', displayTitle)}
                      {ev.second_booking?.title && (() => {
                        const sb = ev.second_booking!;
                        const payTypeLabel: Record<string, string> = { esp: 'Espèces', cb: 'CB', chq: 'Chèque', ancv: 'ANCV', ancv_connect: 'ANCV Connect', np: 'Non payé' };
                        const sbEncaisseur = sb.encaisseur_id ? (fullMonitors.find(m => m.id?.toString() === sb.encaisseur_id)?.first_name ?? monitors.find(m => m.id === sb.encaisseur_id)?.title ?? null) : null;
                        const sbPayStr = sb.payment_type ? `${payTypeLabel[sb.payment_type] ?? sb.payment_type}${sbEncaisseur ? ` · ✓ ${sbEncaisseur}` : ''}` : null;
                        return row('2ème Passager', `${sb.title}${sb.weight ? ` · ${sb.weight} kg` : ''}${sb.phone ? ` · ${sb.phone}` : ''}${sbPayStr ? ` — ${sbPayStr}` : ''}`);
                      })()}
                      {partner && (
                        <div>
                          <p className="text-[9px] font-black uppercase text-slate-400 mb-0.5">Partenaire</p>
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: partner.color_code }} />
                            <p className="text-sm font-bold text-slate-800">{partner.name}</p>
                          </div>
                        </div>
                      )}
                      {flight && row('Vol', `${flight.name} · ${(flight.price_cents / 100).toFixed(0)} €`)}
                      {groupSize > 1 && row('Groupe', `${groupSize} passagers`)}
                      {ev.weight && row('Poids', `${ev.weight} kg`)}
                    </div>
                    {(pd?.payment_type || pd?.online) && (
                      <div className="bg-slate-50 rounded-2xl p-4 border-2 border-slate-100 space-y-2">
                        <p className="text-[9px] font-black uppercase text-slate-400">Encaissement</p>
                        <p className="text-sm font-bold text-slate-800">
                          {pd?.online && !pd?.code ? 'En ligne (Stripe)' : pd?.code_type === 'gift_card' && pd?.code ? `🎁 Bon cadeau ${pd.code}` : (payTypeLabel[pd?.payment_type ?? ''] ?? pd?.payment_type)}
                          {encaisseurName && ` · ✓ ${encaisseurName}`}
                        </p>
                      </div>
                    )}
                    {(ev.phone || ev.email) && (
                      <div className="bg-slate-50 rounded-2xl p-4 border-2 border-slate-100 space-y-3">
                        {ev.phone && (
                          <div className="space-y-1">
                            <p className="text-xs font-black uppercase text-slate-400">Téléphone</p>
                            <p className="text-sm font-bold text-slate-700 mb-2">{ev.phone}</p>
                            <div className="flex gap-2">
                              <a href={`tel:${ev.phone.replace(/\s+/g, '')}`} className="flex-1 flex items-center justify-center text-[14px] bg-emerald-100 text-emerald-700 py-2 rounded-xl hover:bg-emerald-200 transition-colors shadow-sm">📞</a>
                              <a href={`sms:${ev.phone.replace(/\s+/g, '')}`} className="flex-1 flex items-center justify-center gap-1 text-[10px] bg-emerald-100 text-emerald-700 py-2 rounded-xl font-black uppercase hover:bg-emerald-200 transition-colors shadow-sm">💬 SMS</a>
                            </div>
                          </div>
                        )}
                        {ev.email && (
                          <div className="space-y-1">
                            <p className="text-xs font-black uppercase text-slate-400">Email</p>
                            <p className="text-sm font-bold text-slate-700 mb-2">{ev.email}</p>
                            <a href={`mailto:${ev.email}`} className="w-full flex items-center justify-center gap-2 text-[10px] bg-sky-100 text-sky-700 py-2 rounded-xl font-black uppercase hover:bg-sky-200 transition-colors shadow-sm">✉️ Écrire</a>
                          </div>
                        )}
                      </div>
                    )}
                    {ev.booking_options && (
                      <div className="bg-sky-50 rounded-2xl p-3 border border-sky-100 flex items-center gap-3">
                        <span className="text-lg">📸</span>
                        <p className="text-sm font-bold text-sky-900">{ev.booking_options}</p>
                      </div>
                    )}
                    {ev.client_message && (
                      <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100 flex items-start gap-3">
                        <span className="text-lg">💬</span>
                        <p className="text-sm text-slate-700 italic">"{ev.client_message}"</p>
                      </div>
                    )}
                  </div>
                );
              })()
            ) : (
              <>
                {/* ── Bannière standby prefill ── */}
                {standbyPrefill && (
                  <div className="mb-2 bg-orange-50 border border-orange-200 rounded-2xl p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase text-orange-500 tracking-wider">📋 Liste d&apos;attente</p>
                      <p className="text-sm font-bold text-orange-800 truncate">{standbyPrefill.name}</p>
                      {standbyPrefill.phone && <p className="text-[11px] text-orange-600">{standbyPrefill.phone}</p>}
                    </div>
                    <button
                      onClick={() => {
                        // Pré-remplir le formulaire
                        setFormData(f => ({
                          ...f,
                          title: standbyPrefill.name || f.title,
                          phone: standbyPrefill.phone || f.phone,
                          email: standbyPrefill.email || f.email,
                        }));
                        // Poids
                        if (standbyPrefill.weight_info) {
                          const wNum = standbyPrefill.weight_info.match(/\d+/);
                          if (wNum) setPassengerWeights([wNum[0]]);
                        }
                        // Type de vol
                        if (standbyPrefill.flight_type) {
                          const match = flightTypes.find((ft: { id: number; name: string }) =>
                            ft.name.toLowerCase().includes(standbyPrefill.flight_type.toLowerCase()) ||
                            standbyPrefill.flight_type.toLowerCase().includes(ft.name.toLowerCase())
                          );
                          if (match) setFormData(f => ({ ...f, title: standbyPrefill.name || f.title, phone: standbyPrefill.phone || f.phone, email: standbyPrefill.email || f.email, flight_type_id: match.id.toString() }));
                        }
                        // Nombre de passagers
                        if (standbyPrefill.nb_passengers > 1) setGroupSize(standbyPrefill.nb_passengers);
                        // Effacer le prefill
                        try { localStorage.removeItem('standby_prefill'); } catch { /* ignore */ }
                        setStandbyPrefill(null);
                      }}
                      className="shrink-0 px-3 py-2 rounded-xl bg-orange-500 text-white text-[11px] font-black hover:bg-orange-600 transition-colors whitespace-nowrap"
                    >
                      Pré-remplir
                    </button>
                  </div>
                )}

                {/* ── Zone de collage message ── */}
                <div className="mb-2">
                  <button
                    onClick={() => { setPasteZoneOpen(o => !o); setParsed(null); }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 border border-slate-100 text-[10px] font-black uppercase text-slate-400 hover:bg-slate-100 transition-colors"
                  >
                    <span>✨ Importer depuis un message</span>
                    <span>{pasteZoneOpen ? '▲' : '▼'}</span>
                  </button>
                  {pasteZoneOpen && (
                    <div className="mt-2 space-y-2">
                      <textarea
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-3 text-sm font-medium text-slate-700 resize-none focus:outline-none focus:border-sky-200"
                        rows={5}
                        placeholder={"Collez ici un message, un email, un SMS...\nEx : Bonjour, je m'appelle Jean Dupont, je voudrais réserver pour moi et ma femme Marie. Tel: 06 12 34 56 78, jean@mail.com"}
                        value={pasteText}
                        onChange={e => { setPasteText(e.target.value); setParsed(null); }}
                      />
                      <button
                        onClick={parseMessage}
                        disabled={!pasteText.trim()}
                        className="w-full py-2 rounded-xl text-[11px] font-black uppercase text-white transition-colors disabled:opacity-40"
                        style={{ backgroundColor: '#009FE3' }}
                      >
                        Analyser le message
                      </button>
                      {parsed && (
                        <div className="bg-sky-50 border border-sky-100 rounded-2xl p-3 space-y-1.5">
                          <p className="text-[10px] font-black uppercase text-sky-400 mb-2">Résultat détecté</p>
                          {parsed.names.length > 0 ? (
                            <p className="text-xs text-slate-700"><span className="font-black text-slate-400 uppercase text-[9px]">Noms </span>{parsed.names.join(', ')}</p>
                          ) : (
                            <p className="text-[10px] text-slate-400 italic">Aucun nom détecté — à saisir manuellement</p>
                          )}
                          {parsed.phone && <p className="text-xs text-slate-700"><span className="font-black text-slate-400 uppercase text-[9px]">Tél </span>{parsed.phone}</p>}
                          {parsed.email && <p className="text-xs text-slate-700"><span className="font-black text-slate-400 uppercase text-[9px]">Email </span>{parsed.email}</p>}
                          <button
                            onClick={applyParsed}
                            className="w-full mt-1 py-1.5 rounded-xl text-[11px] font-black uppercase text-white"
                            style={{ backgroundColor: '#E6007E' }}
                          >
                            {parsed.names.length <= 1 ? 'Remplir le formulaire' : '1 passager · Remplir le formulaire'}
                          </button>
                          {parsed.names.length >= 2 && (
                            <button
                              onClick={() => {
                                applyParsed();
                                setGroupSize(parsed.names.length);
                              }}
                              className="w-full py-1.5 rounded-xl text-[11px] font-black uppercase text-white bg-emerald-500 hover:bg-emerald-600 transition-colors"
                            >
                              ✈️ {parsed.names.length} passagers · Créer {parsed.names.length} créneaux
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="mb-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Nom du contact et passagers</label>
                  {(() => {
                    const selP = partners.find(p => p.id.toString() === selectedPartnerId);
                    const nameOptional = selP && selP.booking_fields?.name === false;
                    return <input className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-bold text-sm" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} placeholder={nameOptional ? `Nom (optionnel) — par défaut : Client ${selP!.name}` : 'Ex: Clara Dupont  ou  Julien, Sophie, Marc...'} />;
                  })()}
                  <span className="text-[9px] text-slate-400 ml-2 mt-1 block leading-tight">
                    💡 <b>Prénom Nom</b> pour un passager · séparés par virgules pour un groupe<br />
                    <i>Ex (3 places) : "léo, Alex, Paul, Léa" ➔ léo ne vole pas, Alex, Paul et Léa volent.</i>
                  </span>
                </div>
                {partners.length > 0 && !isAravisContext && (
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Partenaire</label>
                    <div className="relative">
                      <select
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-bold pl-10"
                        value={selectedPartnerId}
                        onChange={e => setSelectedPartnerId(e.target.value)}
                      >
                        <option value="">— Aucun partenaire —</option>
                        {partners.map(p => (
                          <option key={p.id} value={p.id.toString()}>{p.name} ({p.code})</option>
                        ))}
                      </select>
                      {selectedPartnerId && (() => {
                        const p = partners.find(x => x.id.toString() === selectedPartnerId);
                        return p ? <span className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border border-slate-200 shadow-sm pointer-events-none" style={{ backgroundColor: p.color_code }} /> : null;
                      })()}
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Type de Vol</label>
                  <select className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-bold" value={formData.flight_type_id} onChange={e => setFormData({ ...formData, flight_type_id: e.target.value })}>
                    <option value="">Choisir un vol...</option>
                    {smartFlightOptions.map(f => {
                      const flightDuration = f.duration_minutes || f.duration || 0;
                      const slotsNeededOption = (f.allow_multi_slots && slotDuration > 0 && flightDuration > slotDuration) ? Math.ceil(flightDuration / slotDuration) : 1;
                      let canFit = true; let reason = '';
                      if (f.allow_multi_slots && slotsNeededOption > 1) {
                        const startMs = new Date((selectedEvent?.start ?? selectedEvent?.start_time) as Date | string).getTime();
                        for (let i = 1; i < slotsNeededOption; i++) {
                          if (!appointments.find(a => a.monitor_id?.toString() === selectedEvent?.monitor_id?.toString() && new Date(a.start_time).getTime() === startMs + i * slotDuration * 60000 && a.status === 'available')) { canFit = false; reason = `(Bloqué : nécessite ${slotsNeededOption} créneaux)`; break; }
                        }
                      } else if (!f.allow_multi_slots && flightDuration > slotDuration) { canFit = false; reason = `(Trop long : ${flightDuration} min)`; }
                      const slotTimeStr = selectedEvent?.start ? new Date(selectedEvent.start as Date | string).toLocaleTimeString('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', hour12: false }) : '';
                      const allowedSlots = Array.isArray(f.allowed_time_slots) ? f.allowed_time_slots : [];
                      const isAllowedTime = allowedSlots.length === 0 || allowedSlots.includes(slotTimeStr);
                      const isDisabled = !canFit || !isAllowedTime;
                      if (!isAllowedTime && canFit) reason = `(Interdit à ${slotTimeStr})`;
                      const partnerFt = selectedPartnerId ? partners.find(p => p.id.toString() === selectedPartnerId)?.allowed_flight_types?.find(ft => ft.flight_type_id === f.id) : null;
                      const displayPrice = partnerFt?.base_price_cents != null ? partnerFt.base_price_cents : (f.price_cents ?? 0);
                      return <option key={f.id?.toString()} value={f.id} disabled={isDisabled} className={isDisabled ? 'text-slate-300 bg-slate-100' : 'text-slate-900'}>{f.name} - {displayPrice / 100}€ {reason}</option>;
                    })}
                  </select>
                </div>


                {formData.flight_type_id && (
                  <div className="bg-white p-4 rounded-2xl border-2 border-slate-100 mt-4 shadow-sm">
                    {isShortFlightType && !showGroupSelector && !groupLocked ? (
                      <button onClick={() => { setShowGroupSelector(true); setGroupSize(3); setActiveTab('client'); }} className="w-full text-xs font-bold text-sky-600 hover:text-sky-800 bg-sky-50 hover:bg-sky-100 py-2.5 rounded-xl border border-sky-200 transition-all">
                        👥 Groupe (+de 2 pax)
                      </button>
                    ) : (
                      <>
                    <label className="text-[10px] font-black uppercase text-slate-400 block mb-3">Taille du groupe (Total)</label>
                    {groupLocked ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-4 opacity-50 select-none pointer-events-none">
                          <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 font-black text-xl flex items-center justify-center">-</div>
                          <span className="text-2xl font-black text-slate-400 w-8 text-center">{groupSize}</span>
                          <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 font-black text-xl flex items-center justify-center">+</div>
                          <span className="text-sm font-bold text-slate-400 ml-2">{groupSize} passager{groupSize > 1 ? 's' : ''} dans ce groupe</span>
                        </div>
                        <button onClick={() => { setGroupLocked(false); setGroupSize(isShortFlightType ? 3 : 1); }} className="w-full text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 py-2 rounded-lg border border-indigo-100 transition-all">
                          + Ajouter des passagers
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-4">
                        <button onClick={() => { if (isShortFlightType && groupSize <= 3) { setShowGroupSelector(false); setGroupSize(1); } else { handleMainChange(-1); } }} className="w-10 h-10 rounded-full bg-slate-100 text-slate-600 font-black text-xl hover:bg-slate-200 transition-colors flex items-center justify-center">-</button>
                        <span className="text-2xl font-black text-slate-900 w-8 text-center">{groupSize}</span>
                        <button onClick={() => handleMainChange(1)} className="w-10 h-10 rounded-full bg-slate-100 text-slate-600 font-black text-xl hover:bg-slate-200 transition-colors flex items-center justify-center">+</button>
                        <span className="text-sm font-bold text-slate-500 ml-2">
                          {groupRootSlots.length > 0
                            ? <>à ajouter <span className="text-slate-400 font-normal">({groupRootSlots.length} déjà inscrit{groupRootSlots.length > 1 ? 's' : ''})</span></>
                            : 'Passager(s) au total'}
                        </span>
                      </div>
                    )}
                      </>
                    )}
                    {!groupLocked && (groupSize > 1 || isManual || groupRootSlots.length > 1) && displayDistribution && (
                      <div className={`mt-4 p-3 rounded-xl border-2 transition-all ${displayDistribution.canFit ? (isManual ? 'bg-indigo-50 border-indigo-200' : 'bg-emerald-50 border-emerald-200') : 'bg-rose-50 border-rose-200'}`}>
                        {displayDistribution.canFit ? (
                          <>
                            <div className="flex items-center justify-between mb-3">
                              <span className={`uppercase tracking-wider text-[10px] font-black ${isManual ? 'text-indigo-800' : 'text-emerald-800'} opacity-70`}>{isManual ? '⚙️ Répartition Manuelle :' : '✅ Répartition Automatique :'}</span>
                              {isManual && (<button onClick={() => { setIsManual(false); setGroupSize(groupSize); }} className="text-[9px] uppercase font-bold text-indigo-500 hover:text-indigo-700 bg-white px-2 py-1 rounded-md border border-indigo-100 transition-all shadow-sm">↻ Remettre en auto</button>)}
                            </div>
                            <ul className="list-none space-y-2">
                              {displayDistribution.items.map((d, i) => (
                                <li key={i} className="flex items-center justify-between bg-white/60 p-2 rounded-lg">
                                  <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5 shadow-sm">
                                      <button onClick={() => handleSubChange(d.time, -1)} disabled={d.count === 0} className={`w-6 h-6 flex items-center justify-center rounded-md font-bold transition-colors ${d.count === 0 ? 'text-slate-300' : 'bg-slate-50 text-slate-600 hover:bg-slate-200'}`}>-</button>
                                      <span className={`w-4 text-center font-black text-sm ${d.count > 0 ? 'text-slate-800' : 'text-slate-400'}`}>{d.count}</span>
                                      <button onClick={() => handleSubChange(d.time, 1)} disabled={d.count >= d.capacity} className={`w-6 h-6 flex items-center justify-center rounded-md font-bold transition-colors ${d.count >= d.capacity ? 'text-slate-300' : 'bg-slate-50 text-slate-600 hover:bg-slate-200'}`}>+</button>
                                    </div>
                                    <span className="text-sm font-medium text-slate-700">à <strong>{d.time}</strong></span>
                                  </div>
                                  <span className="text-[10px] font-bold text-slate-400 uppercase">({d.capacity} max)</span>
                                </li>
                              ))}
                            </ul>
                          </>
                        ) : (
                          <span className="flex items-center gap-2 text-rose-800 text-xs font-bold"><span className="text-xl">❌</span> Capacité insuffisante pour {groupSize} passager(s).</span>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  {passengerWeights.map((w, i) => {
                    const namesList = formData.title.split(',').map((n: string) => n.trim()).filter((n: string) => n);
                    const label = namesList[i] || (passengerWeights.length > 1 ? `Passager ${i + 1}` : 'Passager');
                    return (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-500 font-medium w-28 shrink-0 truncate">{label}</span>
                        <div className="relative flex-1">
                          <input
                            type="number"
                            min={1}
                            max={200}
                            placeholder="Poids (kg) — optionnel"
                            value={w}
                            onChange={e => setPassengerWeights(prev => prev.map((v, j) => j === i ? e.target.value : v))}
                            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                          />
                          {w && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-medium pointer-events-none">kg</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    {formData.phone ? (
                      <div className="flex gap-2 w-full">
                        <a href={`tel:${formData.phone.replace(/\s+/g, '')}`} className="flex-1 flex items-center justify-center text-[14px] bg-emerald-100 text-emerald-700 py-2 rounded-xl hover:bg-emerald-200 transition-colors shadow-sm">📞</a>
                        <a href={`sms:${formData.phone.replace(/\s+/g, '')}`} className="flex-1 flex items-center justify-center gap-1 text-[10px] bg-emerald-100 text-emerald-700 py-2 rounded-xl font-black uppercase hover:bg-emerald-200 transition-colors shadow-sm">💬 SMS</a>
                      </div>
                    ) : (
                      <div className="w-full flex items-center justify-center gap-2 text-[10px] bg-slate-100 text-slate-400 py-2 rounded-xl font-black uppercase">📞 Téléphone <span className="text-rose-500 -ml-1">*</span></div>
                    )}
                    <input type="tel" className="w-full bg-slate-50 border-2 border-slate-100 focus:border-emerald-300 outline-none rounded-2xl p-3 font-bold text-sm transition-colors text-center" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} placeholder="06 12 34 56 78" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {formData.email ? (
                      <a href={`mailto:${formData.email}`} className="w-full flex items-center justify-center gap-2 text-[10px] bg-sky-100 text-sky-700 py-2 rounded-xl font-black uppercase hover:bg-sky-200 transition-colors shadow-sm">✉️ Écrire</a>
                    ) : (
                      <div className="w-full flex items-center justify-center gap-2 text-[10px] bg-slate-100 text-slate-400 py-2 rounded-xl font-black uppercase">✉️ Écrire</div>
                    )}
                    <input type="email" className="w-full bg-slate-50 border-2 border-slate-100 focus:border-sky-300 outline-none rounded-2xl p-3 font-bold text-sm transition-colors text-center" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="Email (Optionnel)" />
                  </div>
                </div>

                {(currentUser?.role === 'admin' || currentUser?.role === 'aravis') && (
                  <div className="bg-slate-50 p-4 rounded-2xl border-2 border-slate-100 space-y-3">
                    <label className="text-[10px] font-black uppercase text-slate-400 block">Encaissement</label>
                    {(() => {
                      const pd = selectedEvent?.payment_data;
                      const isStripePaid = pd?.online === true;
                      const isGiftCard = pd?.code_type === 'gift_card' && !!pd?.code;

                      // Bon cadeau (avec ou sans complément Stripe)
                      if (isGiftCard) {
                        return (
                          <div className="space-y-2">
                            <div className="bg-pink-50 border border-pink-200 rounded-xl p-3">
                              <p className="text-[9px] font-black uppercase text-pink-500 mb-1">🎁 Bon cadeau utilisé</p>
                              <p className="text-sm font-black text-pink-800 font-mono tracking-widest">{pd!.code}</p>
                              {pd!.voucher ? <p className="text-[10px] text-pink-600 mt-0.5">Valeur : {(pd!.voucher / 100).toFixed(0)} €</p> : null}
                            </div>
                            {pd?.online && (
                              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3">
                                <p className="text-[9px] font-black uppercase text-indigo-500">+ Complément CB en ligne (Stripe)</p>
                                {pd.cb ? <p className="text-xs font-bold text-indigo-700">{(pd.cb / 100).toFixed(0)} €</p> : null}
                              </div>
                            )}
                          </div>
                        );
                      }

                      // Paiement Stripe pur (aucun bon cadeau)
                      if (isStripePaid) {
                        return (
                          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 flex items-center gap-3">
                            <span className="text-xl">🌐</span>
                            <div>
                              <p className="text-[9px] font-black uppercase text-indigo-500">Paiement en ligne</p>
                              <p className="text-sm font-bold text-indigo-800">CB via Stripe — encaissé automatiquement</p>
                              {pd?.cb ? <p className="text-[10px] text-indigo-600 mt-0.5">{(pd.cb / 100).toFixed(0)} €</p> : null}
                            </div>
                          </div>
                        );
                      }

                      // Sélecteur manuel (paiements sur place ou à renseigner)
                      return (
                        <>
                          <select
                            value={paymentType}
                            onChange={e => handlePaymentTypeChange(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-bold"
                          >
                            <option value="">— Non renseigné (NP) —</option>
                            {(() => {
                              const partner = partners.find(p => p.id.toString() === selectedPartnerId);
                              if (selectedPartnerId && partner?.facturable !== false) {
                                return <option value="a_facturer">À facturer au partenaire</option>;
                              }
                              return (
                                <>
                                  <option value="esp">Espèces</option>
                                  <option value="cb">CB</option>
                                  <option value="ancv">ANCV</option>
                                  <option value="ancv_connect">ANCV Connect</option>
                                  <option value="chq">Chèque</option>
                                </>
                              );
                            })()}
                          </select>

                          {paymentType && paymentType !== 'np' && paymentType !== 'a_facturer' && (
                            <div>
                              <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Encaissé par</label>
                              {(paymentType === 'online' || paymentType === 'bon_cadeau') ? (
                                <div className="bg-white border border-slate-200 rounded-xl p-3 text-sm font-bold text-slate-600 flex items-center justify-between">
                                  <span>{monitors.find(m => m.id.toString() === encaisseurId)?.title || 'Paiement en ligne'}</span>
                                  <span className="text-[9px] text-slate-400 font-normal">automatique</span>
                                </div>
                              ) : (
                                <select
                                  value={encaisseurId}
                                  onChange={e => setEncaisseurId(e.target.value)}
                                  className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-bold"
                                >
                                  <option value="">— Choisir —</option>
                                  {monitors.map(m => (
                                    <option key={m.id} value={m.id.toString()}>{m.title}</option>
                                  ))}
                                </select>
                              )}
                            </div>
                          )}

                          {/* ── Compléments (Photos, Vidéos…) ── */}
                          {availableComplements.length > 0 && !flightTypes.find(f => f.id?.toString() === formData.flight_type_id?.toString())?.media_included && (
                            <div>
                              <label className="text-[10px] font-black uppercase text-slate-400 block mb-2">Options (Photos, Vidéos…)</label>
                              <div className="space-y-1.5">
                                {availableComplements.map(c => (
                                  <label key={c.id} className="flex items-center gap-3 p-2 bg-white rounded-xl border border-slate-100 cursor-pointer hover:bg-slate-50">
                                    <input type="checkbox" className="accent-amber-500 w-4 h-4" checked={selectedComplementIds.includes(c.id)} onChange={e => setSelectedComplementIds(prev => e.target.checked ? [...prev, c.id] : prev.filter(x => x !== c.id))} />
                                    <span className="flex-1 text-sm font-bold text-slate-700">{c.name}</span>
                                    <span className="text-[11px] font-bold text-slate-400">{(c.price_cents / 100).toFixed(0)} €</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* ── Prix (modifiable) ── */}
                          {formData.flight_type_id && (() => {
                            const selFlight = flightTypes.find(f => f.id.toString() === formData.flight_type_id);
                            const partnerDisp = selectedPartnerId ? partners.find(p => p.id.toString() === selectedPartnerId) : null;
                            const partnerFtDisp = partnerDisp?.allowed_flight_types?.find(ft => ft.flight_type_id === selFlight?.id) ?? null;
                            const baseCents = partnerFtDisp?.base_price_cents != null ? partnerFtDisp.base_price_cents : (selFlight?.price_cents ?? 0);
                            let catalogCents = baseCents;
                            if (partnerDisp?.commission_type === 'percentage') {
                              catalogCents = Math.round(baseCents * (1 - (partnerDisp.commission_value ?? 0) / 100));
                            } else if (partnerDisp?.commission_type === 'fixed') {
                              catalogCents = Math.max(0, baseCents - Math.round((partnerDisp.commission_value ?? 0) * 100));
                            }
                            const autoCompTotal = selectedComplementIds.reduce((s, id) => { const c = availableComplements.find(x => x.id === id); return s + (c?.price_cents ?? 0); }, 0);
                            const flightCents = flightPriceOverride ? Math.round(parseFloat(flightPriceOverride) * 100) : catalogCents;
                            const compCents = complementPriceOverride ? Math.round(parseFloat(complementPriceOverride) * 100) : autoCompTotal;
                            const totalCents = flightCents + compCents;
                            const isCustom = !!(flightPriceOverride || complementPriceOverride);
                            return (
                              <div className="bg-white rounded-xl border border-slate-100 p-3 space-y-2">
                                <label className="text-[10px] font-black uppercase text-slate-400 block">Prix à encaisser</label>
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] font-bold text-slate-500 w-16 shrink-0">Vol</span>
                                  <input type="number" min={0} step={0.5} placeholder={(catalogCents / 100).toFixed(0)} value={flightPriceOverride} onChange={e => setFlightPriceOverride(e.target.value)} className="no-spinner min-w-0 flex-1 border border-slate-200 rounded-lg px-2 py-1.5 text-sm font-bold text-right" />
                                  <span className="text-[11px] text-slate-400 shrink-0">€</span>
                                  {flightPriceOverride && <button onClick={() => setFlightPriceOverride('')} className="shrink-0 text-slate-300 hover:text-rose-400 text-sm font-bold">↺</button>}
                                </div>
                                {(autoCompTotal > 0 || complementPriceOverride) && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-[11px] font-bold text-slate-500 w-16 shrink-0">Options</span>
                                    <input type="number" min={0} step={0.5} placeholder={(autoCompTotal / 100).toFixed(0)} value={complementPriceOverride} onChange={e => setComplementPriceOverride(e.target.value)} className="no-spinner min-w-0 flex-1 border border-slate-200 rounded-lg px-2 py-1.5 text-sm font-bold text-right" />
                                    <span className="text-[11px] text-slate-400 shrink-0">€</span>
                                    {complementPriceOverride && <button onClick={() => setComplementPriceOverride('')} className="shrink-0 text-slate-300 hover:text-rose-400 text-sm font-bold">↺</button>}
                                  </div>
                                )}
                                <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                                  <span className="text-[10px] font-black uppercase text-slate-400">Total</span>
                                  <span className={`text-lg font-black ${isCustom ? 'text-amber-600' : 'text-slate-900'}`}>{(totalCents / 100).toFixed(2)} €</span>
                                </div>
                                {paymentType === 'cb' && (
                                  <div className="flex items-center gap-2 pt-2 border-t border-dashed border-slate-100">
                                    <span className="text-[11px] font-bold text-slate-500 w-16 shrink-0 leading-tight">Perçu net<br/><span className="text-slate-400 font-normal">après CB</span></span>
                                    <input
                                      type="number"
                                      min={0}
                                      step={0.01}
                                      placeholder={(totalCents / 100).toFixed(2)}
                                      value={cbNetAmount}
                                      onChange={e => setCbNetAmount(e.target.value)}
                                      className="no-spinner min-w-0 flex-1 border border-slate-200 rounded-lg px-2 py-1.5 text-sm font-bold text-right"
                                    />
                                    <span className="text-[11px] text-slate-400 shrink-0">€</span>
                                    {cbNetAmount && <button onClick={() => setCbNetAmount('')} className="shrink-0 text-slate-300 hover:text-rose-400 text-sm font-bold">↺</button>}
                                  </div>
                                )}
                              </div>
                            );
                          })()}

                          {paymentType === 'a_facturer' && (() => {
                            const partner = partners.find(p => p.id.toString() === selectedPartnerId);
                            const flight = flightTypes.find(f => f.id.toString() === formData.flight_type_id);
                            const partnerFtInv = partner?.allowed_flight_types?.find(ft => ft.flight_type_id === flight?.id);
                            const priceCents = partnerFtInv?.base_price_cents != null ? partnerFtInv.base_price_cents : (flight?.price_cents ?? 0);
                            let invoiceCents = priceCents;
                            if (partner?.commission_type === 'percentage') {
                              invoiceCents = Math.round(priceCents * (1 - (partner.commission_value ?? 0) / 100));
                            } else if (partner?.commission_type === 'fixed') {
                              invoiceCents = Math.max(0, priceCents - Math.round((partner.commission_value ?? 0) * 100));
                            }
                            return (
                              <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 space-y-1">
                                <p className="text-[9px] font-black uppercase text-orange-500">Montant à facturer</p>
                                <p className="text-lg font-black text-orange-800">{(invoiceCents / 100).toFixed(2)} €</p>
                                {partner?.commission_type !== 'none' && (
                                  <p className="text-[10px] text-orange-600">
                                    {(priceCents / 100).toFixed(2)} € − {partner?.commission_type === 'percentage' ? `${partner.commission_value} %` : `${partner?.commission_value} €`} commission
                                  </p>
                                )}
                              </div>
                            );
                          })()}

                          {groupLocked && groupRootSlots.length > 1 && (
                            <div className="pt-1">
                              <label className="text-[10px] font-black uppercase text-slate-400 block mb-1.5">Appliquer l&apos;encaissement à</label>
                              <div className="grid grid-cols-2 gap-1.5">
                                {([
                                  { value: 'slot', label: 'Ce vol' },
                                  { value: 'time', label: 'Ce créneau horaire' },
                                  { value: 'pilot', label: 'Ce pilote' },
                                  { value: 'group', label: 'Tout le groupe' },
                                ] as const).map(opt => (
                                  <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => setPaymentScope(opt.value)}
                                    className={`py-2 px-3 rounded-xl text-[10px] font-black uppercase text-left transition-colors border ${paymentScope === opt.value ? 'bg-sky-500 text-white border-sky-500' : 'bg-white text-slate-500 border-slate-200 hover:border-sky-300'}`}
                                  >
                                    {paymentScope === opt.value && '✓ '}{opt.label}
                                    {opt.value === 'group' && ` (${groupRootSlots.length})`}
                                    {opt.value === 'pilot' && ` (${groupRootSlots.filter(s => s.monitor_id?.toString() === selectedEvent?.monitor_id?.toString()).length})`}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}

                {(formData.booking_options || formData.client_message) && (
                  <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
                    {formData.booking_options && (<div className="bg-sky-50 p-3 rounded-2xl border border-sky-100 flex items-start gap-3"><span className="text-xl mt-1">📸</span><div><p className="text-[10px] font-black uppercase text-sky-500 mb-0.5">Options choisies</p><p className="font-bold text-sky-900 text-sm leading-tight">{formData.booking_options}</p></div></div>)}
                    {formData.client_message && (<div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex items-start gap-3"><span className="text-xl mt-1">💬</span><div><p className="text-[10px] font-black uppercase text-slate-400 mb-0.5">Message du client</p><p className="font-medium text-slate-700 text-sm italic leading-tight">"{formData.client_message}"</p></div></div>)}
                  </div>
                )}
              </>
            )
          )}

          {/* ── Tab Pax 2 ── */}
          {activeTab === 'client2' && (
            !isEditing && selectedEvent?.status === 'booked' ? (
              /* ── Fiche lecture Pax 2 ── */
              (() => {
                const sb = selectedEvent!.second_booking;
                const payTypeLabel: Record<string, string> = { esp: 'Espèces', cb: 'CB', chq: 'Chèque', ancv: 'ANCV', ancv_connect: 'ANCV Connect', np: 'Non payé' };
                const sbEncaisseurIdStr = sb?.encaisseur_id ?? '';
                const sbEncaisseurFull = sbEncaisseurIdStr ? fullMonitors.find(m => m.id?.toString() === sbEncaisseurIdStr) : null;
                const sbEncaisseurFallback = sbEncaisseurIdStr ? monitors.find(m => m.id === sbEncaisseurIdStr) : null;
                const sbEncaisseurName = sbEncaisseurFull?.first_name ?? sbEncaisseurFallback?.title ?? null;
                const row2 = (label: string, value: React.ReactNode) => (
                  <div key={label}>
                    <p className="text-[9px] font-black uppercase text-slate-400 mb-0.5">{label}</p>
                    <p className="text-sm font-bold text-slate-800">{value}</p>
                  </div>
                );
                if (!sb?.title) {
                  return (
                    <div className="text-center py-8 bg-slate-50 rounded-3xl border-2 border-slate-100">
                      <span className="text-4xl block mb-2">👤</span>
                      <p className="font-black text-slate-900 uppercase tracking-widest text-sm mb-1">Aucun 2ème passager</p>
                      <p className="text-xs text-slate-500 px-4 font-medium">Cliquez sur &quot;Modifier la fiche&quot; pour en ajouter un.</p>
                    </div>
                  );
                }
                return (
                  <div className="space-y-3">
                    <div className="bg-slate-50 rounded-2xl p-4 border-2 border-slate-100 space-y-3">
                      {row2('Passager', sb.title)}
                      {sb.weight && row2('Poids', `${sb.weight} kg`)}
                    </div>
                    {sb.payment_type && (
                      <div className="bg-slate-50 rounded-2xl p-4 border-2 border-slate-100 space-y-2">
                        <p className="text-[9px] font-black uppercase text-slate-400">Encaissement</p>
                        <p className="text-sm font-bold text-slate-800">
                          {payTypeLabel[sb.payment_type] ?? sb.payment_type}
                          {sbEncaisseurName && ` · ✓ ${sbEncaisseurName}`}
                        </p>
                      </div>
                    )}
                    {sb.phone && (
                      <div className="bg-slate-50 rounded-2xl p-4 border-2 border-slate-100 space-y-2">
                        <p className="text-xs font-black uppercase text-slate-400">Téléphone</p>
                        <p className="text-sm font-bold text-slate-700 mb-2">{sb.phone}</p>
                        <div className="flex gap-2">
                          <a href={`tel:${sb.phone.replace(/\s+/g, '')}`} className="flex-1 flex items-center justify-center text-[14px] bg-emerald-100 text-emerald-700 py-2 rounded-xl hover:bg-emerald-200 transition-colors shadow-sm">📞</a>
                          <a href={`sms:${sb.phone.replace(/\s+/g, '')}`} className="flex-1 flex items-center justify-center gap-1 text-[10px] bg-emerald-100 text-emerald-700 py-2 rounded-xl font-black uppercase hover:bg-emerald-200 transition-colors shadow-sm">💬 SMS</a>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()
            ) : (
              /* ── Formulaire Pax 2 ── */
              <div className="space-y-4">
                <div className="bg-sky-50 rounded-2xl p-4 space-y-2 border-2 border-sky-100">
                  <label className="text-[10px] font-black uppercase text-sky-600 block mb-1">2ème Passager (créneau partagé)</label>
                  <input
                    className="w-full bg-white border-2 border-slate-100 rounded-xl p-3 font-bold text-sm"
                    value={secondBooking.title}
                    onChange={e => setSecondBooking(p => ({ ...p, title: e.target.value }))}
                    placeholder="Nom du 2ème passager (laisser vide si aucun)"
                  />
                  <div className="flex gap-2">
                    <input
                      className="min-w-0 flex-1 bg-white border-2 border-slate-100 rounded-xl p-3 font-bold text-sm"
                      value={secondBooking.phone}
                      onChange={e => setSecondBooking(p => ({ ...p, phone: e.target.value }))}
                      placeholder="Téléphone"
                    />
                    <input
                      className="w-20 flex-shrink-0 bg-white border-2 border-slate-100 rounded-xl p-3 font-bold text-sm"
                      value={secondBooking.weight}
                      onChange={e => setSecondBooking(p => ({ ...p, weight: e.target.value }))}
                      placeholder="kg"
                      type="number"
                      min="20" max="130"
                    />
                  </div>
                  {secondBooking.title.trim() && (
                    <div className="pt-2 space-y-2 border-t border-sky-200">
                      <label className="text-[10px] font-black uppercase text-sky-600 block">Encaissement 2ème passager</label>
                      <select
                        value={secondBooking.payment_type}
                        onChange={e => setSecondBooking(p => ({ ...p, payment_type: e.target.value, encaisseur_id: '' }))}
                        className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-bold"
                      >
                        <option value="">— Non renseigné —</option>
                        <option value="esp">Espèces</option>
                        <option value="cb">CB</option>
                        <option value="ancv">ANCV</option>
                        <option value="ancv_connect">ANCV Connect</option>
                        <option value="chq">Chèque</option>
                        <option value="np">Non payé</option>
                      </select>
                      {secondBooking.payment_type && secondBooking.payment_type !== 'np' && (
                        <select
                          value={secondBooking.encaisseur_id}
                          onChange={e => setSecondBooking(p => ({ ...p, encaisseur_id: e.target.value }))}
                          className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-bold"
                        >
                          <option value="">— Encaissé par —</option>
                          {fullMonitors.map(m => <option key={m.id} value={m.id}>{m.first_name}</option>)}
                        </select>
                      )}
                    </div>
                  )}
                  {secondBooking.title && (
                    <button onClick={() => setSecondBooking({ title: '', phone: '', weight: '', payment_type: '', encaisseur_id: '' })} className="text-rose-400 text-[10px] font-black uppercase hover:text-rose-600">🗑️ Effacer le 2ème passager</button>
                  )}
                </div>
              </div>
            )
          )}

          {/* ── Tab Note ── */}
          {activeTab === 'note' && (
            isLockedForMe ? (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center mt-4 shadow-inner">
                <span className="text-3xl block mb-2">🔒</span>
                <p className="text-slate-700 font-bold text-[11px] uppercase tracking-widest">{isAdminBlockLocal ? 'Verrouillé par la direction' : 'Réservation Client'}</p>
                <p className="text-slate-500 text-[10px] mt-2 font-medium">Vous ne pouvez pas modifier ce créneau.</p>
              </div>
            ) : (
              <>
                {!isClientSlotLocal && !selectedEvent?.title?.includes('NON DISPO') && (
                  <div className="flex gap-2 mb-4">
                    <button disabled={isOutOfSeason} onClick={() => setFormData({ ...formData, title: 'NOTE' })} className={`flex-1 p-2 rounded-xl border-2 font-black text-[10px] uppercase transition-all ${isOutOfSeason ? 'opacity-50 cursor-not-allowed' : (formData.title !== 'NON DISPO' ? 'bg-amber-100 border-amber-400 text-amber-800 shadow-inner' : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-amber-200')}`}>📝 Note simple (Reste libre)</button>
                    <button disabled={isOutOfSeason} onClick={() => setFormData({ ...formData, title: 'NON DISPO' })} className={`flex-1 p-2 rounded-xl border-2 font-black text-[10px] uppercase transition-all ${isOutOfSeason ? 'opacity-50 cursor-not-allowed' : (formData.title === 'NON DISPO' ? 'bg-rose-100 border-rose-400 text-rose-800 shadow-inner' : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-rose-200')}`}>❌ Bloquer (Non dispo)</button>
                  </div>
                )}
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Note interne au pilote</label>
                  <textarea className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-bold h-24" value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} placeholder="Infos météo, retard..." />
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border-2 border-slate-100">
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-2">Cible (Qui ?)</label>
                  <select className={`w-full bg-white border border-slate-200 rounded-xl p-2 text-xs font-bold transition-all mb-4 ${isOutOfSeason || (currentUser?.role !== 'admin' && currentUser?.role !== 'aravis') ? 'bg-slate-100 text-slate-400 cursor-not-allowed opacity-60' : ''}`} value={blockType} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setBlockType(e.target.value as 'none' | 'all' | 'specific')} disabled={isOutOfSeason || (currentUser?.role !== 'admin' && currentUser?.role !== 'aravis')}>
                    <option value="none">Ce pilote uniquement</option>
                    {(currentUser?.role === 'admin' || currentUser?.role === 'aravis') && (<><option value="all">🚫 TOUS les pilotes</option><option value="specific">👥 Certains pilotes</option></>)}
                  </select>
                  {blockType === 'specific' && !isOutOfSeason && (currentUser?.role === 'admin' || currentUser?.role === 'aravis') && (
                    <div className="mb-4 grid grid-cols-2 gap-2">
                      {monitors.map(m => (
                        <label key={m.id} className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-100 text-[10px] font-bold cursor-pointer hover:bg-slate-50">
                          <input type="checkbox" className="accent-amber-500" checked={selectedMonitors.includes(m.id.toString())} onChange={e => { const id = m.id.toString(); setSelectedMonitors(prev => e.target.checked ? [...prev, id] : prev.filter(x => x !== id)); }} />
                          {m.title}
                        </label>
                      ))}
                    </div>
                  )}
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-2">Durée (Jusqu'à quand ?)</label>
                  {selectedEvent && (
                    <select className={`w-full bg-white border border-slate-200 rounded-xl p-2 text-xs font-bold transition-all ${isOutOfSeason ? 'bg-slate-100 text-slate-400 cursor-not-allowed opacity-60' : ''}`} value={blockUntilMs} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setBlockUntilMs(Number(e.target.value))} disabled={isOutOfSeason}>
                      {upcomingBlockingSlots.map((slot, index) => {
                        const end = new Date(slot.end_time);
                        const timeStr = end.toLocaleTimeString('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', hour12: false });
                        let label = `Jusqu'à ${timeStr}`;
                        if (index === 0) label = `Ce créneau uniquement (Jusqu'à ${timeStr})`;
                        else if (index === upcomingBlockingSlots.length - 1) label = `Toute la fin de journée (Jusqu'à ${timeStr})`;
                        return <option key={slot.id} value={end.getTime()}>{label}</option>;
                      })}
                    </select>
                  )}
                </div>
              </>
            )
          )}

          {/* ── Boutons save/release ── */}
          {(activeTab === 'client' || activeTab === 'client2' || activeTab === 'note') && (
            <div className="pt-4 space-y-3 border-t border-slate-100">
              {(activeTab === 'client' || activeTab === 'client2') && !isEditing && selectedEvent?.status === 'booked' && !isClientLocked ? (
                <button onClick={() => setIsEditing(true)} className="w-full bg-slate-800 text-white py-4 rounded-3xl font-black uppercase italic shadow-xl hover:bg-slate-700 transition-colors">✏️ Modifier la fiche</button>
              ) : !(activeTab === 'client' && isClientLocked) && !isLockedForMe && (
                <>
                  {(activeTab === 'client' || activeTab === 'client2') && isEditing && selectedEvent?.status === 'booked' && (
                    <button onClick={() => setIsEditing(false)} className="w-full bg-slate-100 text-slate-500 py-2.5 rounded-2xl font-black uppercase text-xs hover:bg-slate-200 transition-colors">↩ Annuler les modifications</button>
                  )}
                  <button onClick={handleSaveNote} className="w-full bg-sky-500 text-white py-4 rounded-3xl font-black uppercase italic shadow-xl hover:bg-sky-600 transition-colors">Enregistrer la modification</button>
                  {activeTab !== 'client2' && (selectedEvent?.title || selectedEvent?.notes || selectedEvent?.status !== 'available') && (
                    activeTab === 'note' ? (
                      <div className="pt-2">
                        {(() => {
                          const isPlural = blockType === 'all' || (blockType === 'specific' && selectedMonitors.length > 1) || (upcomingBlockingSlots.length > 0 && blockUntilMs > new Date(upcomingBlockingSlots[0].end_time).getTime());
                          const isBlock = ['NON DISPO', '☕ PAUSE'].some(t => selectedEvent?.title?.includes(t)) || selectedEvent?.title?.includes('❌');
                          const hasNote = !!(selectedEvent?.notes || formData.notes);
                          const showKeepNote = isBlock && !isPlural && hasNote;
                          const btnText = !isBlock ? (isPlural ? '🧹 Effacer les notes sélectionnées' : '🗑️ Effacer la note') : (isPlural ? '🧹 Libérer les créneaux sélectionnés' : showKeepNote ? '🗑️ Libérer + effacer note' : '🗑️ Libérer le créneau');
                          return (
                            <div className={showKeepNote ? 'flex gap-2' : ''}>
                              <button onClick={handleBulkRelease} className={`${showKeepNote ? 'flex-1' : 'w-full'} font-black uppercase italic tracking-widest transition-all rounded-xl py-3 shadow-sm ${isPlural ? 'bg-rose-50 text-rose-600 hover:bg-rose-500 hover:text-white text-[10px]' : 'bg-white text-rose-500 border border-rose-200 hover:bg-rose-50 text-[10px]'}`}>{btnText}</button>
                              {showKeepNote && <button onClick={handleReleaseKeepNote} className="flex-1 font-black uppercase italic tracking-widest transition-all rounded-xl py-3 shadow-sm bg-white text-emerald-600 border border-emerald-200 hover:bg-emerald-50 text-[10px]">🔓 Libérer + garder note</button>}
                            </div>
                          );
                        })()}
                      </div>
                    ) : isShortFlightType ? (
                      <div className="space-y-2 pt-2">
                        <p className="text-[9px] font-black uppercase text-slate-400 text-center">Libérer</p>
                        <div className="flex gap-2">
                          <button onClick={handleReleasePax1} className="flex-1 text-rose-500 font-black uppercase italic text-[9px] tracking-widest hover:text-rose-600 hover:bg-rose-50 border border-rose-100 rounded-xl transition-colors py-2 shadow-sm">🗑️ Pax 1</button>
                          <button onClick={handleReleasePax2} className="flex-1 text-rose-500 font-black uppercase italic text-[9px] tracking-widest hover:text-rose-600 hover:bg-rose-50 border border-rose-100 rounded-xl transition-colors py-2 shadow-sm">🗑️ Pax 2</button>
                          <button onClick={handleRelease} className="flex-1 text-rose-500 font-black uppercase italic text-[9px] tracking-widest hover:text-rose-600 hover:bg-rose-50 border border-rose-100 rounded-xl transition-colors py-2 shadow-sm">🗑️ Les 2</button>
                        </div>
                        {groupRootSlots.length > 1 && (
                          <button onClick={handleReleaseGroup} className="w-full bg-rose-50 border border-rose-200 text-rose-600 rounded-xl font-black uppercase italic text-[9px] tracking-widest hover:bg-rose-500 hover:text-white transition-colors py-2 shadow-sm">🧹 Libérer groupe ({groupTotalPax})</button>
                        )}
                      </div>
                    ) : (
                      <div className="flex gap-2 pt-2">
                        {(() => {
                          const isNoteOnly = selectedEvent?.status === 'available' && selectedEvent?.title === 'NOTE';
                          const hasNote = !!selectedEvent?.notes && selectedEvent?.notes !== 'Extension auto';
                          const isBlockedSlot = !!(selectedEvent?.title?.toUpperCase().includes('NON DISPO'));
                          const showKeepNote = isBlockedSlot && hasNote;
                          return (
                            <>
                              <button onClick={handleRelease} className="flex-1 text-rose-500 font-black uppercase italic text-[9px] tracking-widest hover:text-rose-600 hover:bg-rose-50 border border-rose-100 rounded-xl transition-colors py-2 shadow-sm">{isNoteOnly ? '🗑️ Effacer la note' : (showKeepNote ? '🗑️ Libérer + effacer note' : '🗑️ Libérer ce créneau')}</button>
                              {showKeepNote && <button onClick={handleClearNote} className="flex-1 font-black uppercase italic text-[9px] tracking-widest transition-all rounded-xl py-2 shadow-sm bg-amber-50 text-amber-600 border border-amber-200 hover:bg-amber-500 hover:text-white">📝 Effacer la note</button>}
                              {showKeepNote && <button onClick={handleReleaseKeepNote} className="flex-1 font-black uppercase italic text-[9px] tracking-widest transition-all rounded-xl py-2 shadow-sm bg-white text-emerald-600 border border-emerald-200 hover:bg-emerald-50">🔓 Libérer + garder note</button>}
                              {groupRootSlots.length > 1 && (<button onClick={handleReleaseGroup} className="flex-1 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl font-black uppercase italic text-[9px] tracking-widest hover:bg-rose-500 hover:text-white transition-colors py-2 shadow-sm">🧹 Libérer groupe ({groupTotalPax})</button>)}
                            </>
                          );
                        })()}
                      </div>
                    )
                  )}
                </>
              )}
              <button onClick={onClose} className="w-full text-slate-400 font-bold uppercase text-[10px] hover:text-slate-600 pt-2">{(!isEditing && selectedEvent?.status === 'booked') ? 'Fermer' : 'Fermer sans sauvegarder'}</button>
            </div>
          )}

          {/* ── Tab Move ── */}
          {activeTab === 'move' && (
            isClientLocked ? (
              <div className="text-center py-8 bg-slate-50 rounded-3xl border-2 border-slate-100 mt-4">
                <span className="text-4xl block mb-2">🔒</span>
                <p className="font-black text-slate-900 uppercase tracking-widest text-sm mb-2">Déplacement bloqué</p>
                <p className="text-xs text-slate-500 px-4 font-medium mb-6">Vous ne pouvez pas déplacer un créneau bloqué ou en pause.</p>
              </div>
            ) : (
              <>
                {isShortFlightType && (
                  <div className="mb-4 bg-sky-50 rounded-2xl p-3 border border-sky-100 space-y-2">
                    <label className="text-[10px] font-black uppercase text-sky-600 block">Quel passager déplacer ?</label>
                    <div className="flex gap-2">
                      {(['both', 'pax1', 'pax2'] as const).map(opt => (
                        <button key={opt} onClick={() => setMovePax(opt)} className={`flex-1 py-2 rounded-xl font-black text-[9px] uppercase transition-all ${movePax === opt ? 'bg-sky-500 text-white shadow-sm' : 'bg-white border border-sky-200 text-sky-600 hover:bg-sky-50'}`}>
                          {opt === 'both' ? 'Les 2' : opt === 'pax1' ? 'Pax 1' : 'Pax 2'}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {groupRootSlots.length > 1 && (
                  <div className="mb-4 bg-emerald-50 p-3 rounded-2xl border border-emerald-100 flex items-center gap-3">
                    <input type="checkbox" className="w-5 h-5 accent-emerald-500 cursor-pointer" checked={moveGroup} onChange={e => setMoveGroup(e.target.checked)} />
                    <label className="text-xs font-bold text-emerald-900 cursor-pointer select-none" onClick={() => setMoveGroup(!moveGroup)}>Déplacer TOUT le groupe ({groupTotalPax} passagers)</label>
                  </div>
                )}
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Date ciblée</label>
                  <input type="date" className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-bold" value={moveConfig.date} onChange={e => setMoveConfig({ ...moveConfig, date: e.target.value })} />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Créneau disponible</label>
                  <select className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-bold" value={moveConfig.time} onChange={e => setMoveConfig({ ...moveConfig, time: e.target.value })}>
                    <option value="">Choisir une heure...</option>
                    {availableTimes.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                {!moveGroup && (<div>
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Pilote</label>
                  <select className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-bold" value={moveConfig.monitorId} onChange={e => setMoveConfig({ ...moveConfig, monitorId: e.target.value })}>
                    <option value="random">🎲 Aléatoire (Peu importe)</option>
                    {monitors.map(m => {
                      let isBusy = false;
                      if (moveConfig.date && moveConfig.time) {
                        const flight = flightTypes.find(f => f.id?.toString() === formData.flight_type_id?.toString());
                        const flightDur = flight?.duration_minutes || flight?.duration || 0;
                        const slotsNeeded2 = (flight?.allow_multi_slots && slotDuration > 0 && flightDur > slotDuration) ? Math.ceil(flightDur / slotDuration) : 1;
                        const targetSlot = appointments.find(a => {
                          if (a.monitor_id?.toString() !== m.id.toString()) return false;
                          const d = new Date(a.start_time);
                          return d.toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' }) === moveConfig.date && d.toLocaleTimeString('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', hour12: false }) === moveConfig.time;
                        });
                        if (!targetSlot) isBusy = true;
                        else if (targetSlot.status !== 'available' && !currentBookingSlotIds.includes(targetSlot.id)) isBusy = true;
                        else if (slotsNeeded2 > 1) {
                          const startMs = new Date(targetSlot.start_time).getTime();
                          for (let i = 1; i < slotsNeeded2; i++) {
                            if (!appointments.find(a => a.monitor_id?.toString() === m.id.toString() && new Date(a.start_time).getTime() === startMs + i * slotDuration * 60000 && (a.status === 'available' || currentBookingSlotIds.includes(a.id)))) { isBusy = true; break; }
                          }
                        }
                      }
                      return <option key={m.id} value={m.id} disabled={isBusy} className={isBusy ? 'text-slate-300 bg-slate-100' : 'text-slate-900'}>{m.title} {isBusy ? '(Occupé)' : ''}</option>;
                    })}
                  </select>
                </div>)}
                <div className="pt-4 space-y-3">
                  <button onClick={handleMove} disabled={!moveConfig.time} className={`w-full py-4 rounded-3xl font-black uppercase italic shadow-xl transition-all ${!moveConfig.time ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-emerald-500 text-white hover:bg-emerald-600'}`}>Transférer le créneau</button>
                  <button onClick={onClose} className="w-full text-slate-300 font-bold uppercase text-[10px]">Annuler</button>
                </div>
              </>
            )
          )}
        </div>
      </div>
    </div>
  );
}
