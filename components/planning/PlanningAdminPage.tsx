"use client";
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import FullCalendar from '@fullcalendar/react';
import resourceTimeGridPlugin from '@fullcalendar/resource-timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import frLocale from '@fullcalendar/core/locales/fr';
import scrollgridPlugin from '@fullcalendar/scrollgrid';
import { usePlanningData } from '@/hooks/usePlanningData';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import EditSlotModal from '@/components/planning/EditSlotModal';
import GenSlotsModal from '@/components/planning/GenSlotsModal';
import ReplaceMonitorModal from '@/components/planning/ReplaceMonitorModal';
import { useToast } from '@/components/ui/ToastProvider';
import { Wrench, CalendarDays } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import type { CurrentUser, Slot, FlightType } from '@/lib/types';
import type { EventClickArg, EventContentArg } from '@fullcalendar/core';

// Composant avec listener natif pour stopper la propagation AVANT FullCalendar
function NativeStopDiv({ style, onNativeClick, children }: {
  style: React.CSSProperties;
  onNativeClick: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const cbRef = useRef(onNativeClick);
  cbRef.current = onNativeClick;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handler = (e: Event) => { e.stopPropagation(); cbRef.current(); };
    const touchHandler = (e: TouchEvent) => { e.stopPropagation(); e.preventDefault(); cbRef.current(); };
    el.addEventListener('click', handler);
    el.addEventListener('touchend', touchHandler);
    return () => { el.removeEventListener('click', handler); el.removeEventListener('touchend', touchHandler); };
  }, []);
  return <div ref={ref} style={style}>{children}</div>;
}

// Un créneau "compte" pour la visibilité si c'est un vrai client OU un créneau vide (available).
// Les créneaux bloqués (NON DISPO, ❌, etc.) ne comptent pas.
const isCountableSlot = (a: { title?: string | null; status?: string }) => {
  if (a.status === 'available') return true; // créneau vide = moniteur dispo ce jour
  if (a.status !== 'booked') return false;
  const t = a.title || '';
  if (!t) return false;
  return !(
    t.toUpperCase().includes('NON DISPO') ||
    t.includes('❌') ||
    t.toUpperCase().includes('PAUSE') ||
    t.includes('☕') ||
    t.startsWith('↪️ Suite')
  );
};

export default function PlanningAdmin() {
  const { toast } = useToast();
  const dateRangeRef = useRef({ start: '', end: '' });
  const getDateRange = useCallback(() => dateRangeRef.current, []);

  const {
    appointments, setAppointments,
    monitors, flightTypes, slotDefs,
    availablePlans, timeBounds,
    isLoading,
    loadAppointments,
  } = usePlanningData(getDateRange);

  const currentUser = useCurrentUser();
  const [showGenModal, setShowGenModal] = useState(false);
  const [replaceMonitor, setReplaceMonitor] = useState<{ id: string; title: string } | null>(null);
  const [expandedPax2, setExpandedPax2] = useState<Set<number>>(new Set());
  const togglePax2 = useCallback((id: number) => {
    setExpandedPax2(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }, []);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<(Slot & { isOutOfSeason?: boolean }) | null>(null);
  const [slotDuration, setSlotDuration] = useState<number>(0);
  const calendarRef = useRef<FullCalendar>(null);
  const [currentDate, setCurrentDate] = useState(() => new Date().toISOString().split('T')[0]);
  const searchParams = useSearchParams();
  const dateParam = searchParams?.get('date');

  // Naviguer au jour demandé si on vient de la liste d'attente
  useEffect(() => {
    if (!dateParam) return;
    const timer = setTimeout(() => {
      try { calendarRef.current?.getApi().gotoDate(dateParam); } catch { /* ignore */ }
    }, 400);
    return () => clearTimeout(timer);
  }, [dateParam]);
  const [viewRange, setViewRange] = useState<{ start: Date; end: Date } | null>(null);


  const handleEventClick = useCallback((info: EventClickArg) => {
    if (currentUser?.role === 'monitor') return;
    if (currentUser?.role === 'permanent') {
      const monitorId = (info.event.extendedProps?.monitor_id ?? info.event.getResources()[0]?.id)?.toString();
      if (monitorId && monitorId !== currentUser?.id?.toString()) {
        toast.warning("Vous ne pouvez agir que sur votre propre colonne.");
        return;
      }
    }
    const event = info.event;
    const eventTitle = event.extendedProps.title as string | undefined;
    if (eventTitle?.includes('☕') || eventTitle?.toUpperCase().includes('PAUSE')) return;
    if (eventTitle?.startsWith('↪️ Suite')) {
      toast.warning("Pour modifier, déplacer ou supprimer ce vol, cliquez sur son premier créneau (celui contenant le nom du client).");
      return;
    }
    if (!event.start || !event.end) return;
    const start = new Date(event.start);
    const end = new Date(event.end);
    setSlotDuration(Math.round((end.getTime() - start.getTime()) / 60000));
    setSelectedEvent({
      id: parseInt(event.id),
      title: event.extendedProps.title,
      start: event.start,
      monitor_id: event.getResources()[0]?.id,
      ...event.extendedProps,
    } as Slot & { isOutOfSeason?: boolean });
    setShowEditModal(true);
  }, [currentUser, toast]);


  const calendarEvents = useMemo(() => {
    return appointments.map(a => {
      const flight = flightTypes?.find((f: FlightType) => f.id === a.flight_type_id);
      const partnerColor = (a.payment_data as { partner_color?: string } | null)?.partner_color;
      const isAravis = currentUser?.enseigne === 'aravis';
      const flightColor = partnerColor || (isAravis ? flight?.color_code : null) || '#d946ef';
      const isPause = a.title?.includes('☕') || a.title?.toUpperCase().includes('PAUSE');
      const isAlert = a.title?.includes('❌') || a.title?.toUpperCase().includes('NON DISPO');
      let displayTitle = a.title || (a.status === 'available' ? 'LIBRE' : '');
      if (a.phone) displayTitle += ' 📞';
      if (a.booking_options) displayTitle += ' 📸';
      if (a.client_message) displayTitle += ' 💬';
      if (a.notes && a.notes.trim() !== '') displayTitle += ' 📝';
      return {
        id: a.id != null ? `${a.id}` : Math.random().toString(),
        resourceId: a.monitor_id?.toString() || '',
        start: a.start_time,
        end: a.end_time,
        title: displayTitle,
        backgroundColor: isPause ? '#f1f5f9' : isAlert ? '#fee2e2' : (a.status === 'available' ? '#ffffff' : flightColor),
        textColor: a.status === 'available' ? '#cbd5e1' : isPause ? '#94a3b8' : isAlert ? '#ef4444' : '#ffffff',
        borderColor: a.status === 'available' ? '#e2e8f0' : isAlert ? '#fca5a5' : flightColor,
        classNames: [],
        interactive: !isPause,
        extendedProps: (() => {
          const fd = flight?.duration_minutes || 0;
          const slotMs = a.start_time && a.end_time ? new Date(a.end_time).getTime() - new Date(a.start_time).getTime() : 0;
          const slotMin = Math.round(slotMs / 60000);
          const isShortFlight = a.status === 'booked' && fd > 0 && fd * 2 <= slotMin;
          return { ...a, flight_name: flight?.name || null, price_cents: flight?.price_cents ? (a.payment_data?.price_override_cents ?? flight.price_cents) + (a.payment_data?.complement_total_cents ?? 0) : null, flight_duration: fd || null, isShortFlight };
        })(),
      };
    });
  }, [appointments, flightTypes, currentUser]);

  const [hiddenMonitorIds, setHiddenMonitorIds] = useState<Set<string>>(new Set());
  // Moniteurs sans créneaux que l'admin a choisi d'afficher manuellement
  const [extraShownIds, setExtraShownIds] = useState<Set<string>>(new Set());

  // Moniteurs qui ont au moins un créneau dans la plage affichée
  const monitorsWithSlots = useMemo(() => {
    if (!viewRange || appointments.length === 0) return monitors;
    const viewStart = viewRange.start.getTime();
    const viewEnd = viewRange.end.getTime();
    const idsWithSlots = new Set(
      appointments
        .filter(a => {
          const t = new Date(a.start_time).getTime();
          return t >= viewStart && t < viewEnd && isCountableSlot(a);
        })
        .map(a => a.monitor_id?.toString())
    );
    const filtered = monitors.filter(m => idsWithSlots.has(m.id.toString()));
    return filtered.length > 0 ? filtered : monitors;
  }, [monitors, appointments, viewRange]);

  // Moniteurs sans créneaux sur la période (cachés par défaut)
  const monitorsWithoutSlots = useMemo(() => {
    if (!viewRange || appointments.length === 0) return [];
    const withSlotIds = new Set(monitorsWithSlots.map(m => m.id.toString()));
    return monitors.filter(m => !withSlotIds.has(m.id.toString()));
  }, [monitors, monitorsWithSlots, viewRange, appointments.length]);

  // Réinitialiser les extras quand la plage change
  useEffect(() => { setExtraShownIds(new Set()); }, [viewRange]);

  // Moniteurs affichés (avec créneaux - masqués manuels + extras sans créneaux)
  const visibleMonitors = useMemo(
    () => [
      ...monitorsWithSlots.filter(m => !hiddenMonitorIds.has(m.id)),
      ...monitors.filter(m => extraShownIds.has(m.id.toString())),
    ],
    [monitorsWithSlots, hiddenMonitorIds, monitors, extraShownIds]
  );

  // Moniteurs présents dans la vue mais temporairement masqués
  const hiddenActiveMonitors = useMemo(
    () => monitorsWithSlots.filter(m => hiddenMonitorIds.has(m.id)),
    [monitorsWithSlots, hiddenMonitorIds]
  );

  // Couleur unique par groupe : on scanne les titres "(Chef de groupe)" pour construire la map
  const groupColors = useMemo(() => {
    const palette = ['#fb923c', '#a78bfa', '#34d399', '#60a5fa', '#f472b6', '#facc15'];
    const map = new Map<string, string>();
    let idx = 0;
    calendarEvents.forEach(ev => {
      const ep2 = ev.extendedProps as Slot & { isShortFlight?: boolean };
      if (ep2.status !== 'booked') return;
      const t = ep2.title || '';
      if (!t || t.toUpperCase().includes('NON DISPO') || t.includes('❌') || t.toUpperCase().includes('PAUSE') || t.includes('☕')) return;
      const m = t.match(/\(([^)]+)\)$/);
      if (m) {
        if (!map.has(m[1])) map.set(m[1], palette[idx++ % palette.length]);
      }
      // Aiglon group bookings — couleur par nom de client (namespace "grp:" pour éviter les conflits)
      if (ep2.second_booking?.is_group_booking) {
        const key = `grp:${t.split('(')[0].trim()}`;
        if (!map.has(key)) map.set(key, palette[idx++ % palette.length]);
      }
    });
    return map;
  }, [calendarEvents]);

  const renderEventContent = useCallback((arg: EventContentArg) => {
    const ep = arg.event.extendedProps as Slot & { isOutOfSeason?: boolean; flight_name?: string | null; price_cents?: number | null; flight_duration?: number | null };
    const isBooked = ep.status === 'booked' && !ep.title?.startsWith('↪️ Suite');

    if (!isBooked) {
      return (
        <div style={{ padding: '1px 3px', overflow: 'hidden', height: '100%', fontSize: '11px', lineHeight: '1.3' }}>
          {arg.timeText && <><strong>{arg.timeText}</strong>{' '}</>}{arg.event.title}
        </div>
      );
    }

    const pd = ep.payment_data;
    const isPartner = !!(pd?.partner);

    const displayName = (() => {
      const t = ep.title || '';
      const bn = ep.billing_name || '';
      if (!bn || !t) return t;
      const firstWord = t.split(/[\s,(]/)[0].toLowerCase();
      const bnFirst = bn.split(/\s/)[0].toLowerCase();
      return (firstWord === bnFirst && bn.length > t.length) ? bn : t;
    })();

    const partnerDisplayName = (() => {
      if (!isPartner || !pd?.partner_name) return displayName;
      const pn = (pd.partner_name as string).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const stripped = displayName
        .replace(new RegExp(`\\s*\\(Client\\s+${pn}\\)`, 'gi'), '')
        .replace(new RegExp(`^Client\\s+${pn}$`, 'gi'), '')
        .trim();
      return stripped || displayName;
    })();

    // Groupe : "(Chef)" dans le titre = membre secondaire ; nom seul dans groupColors = chef
    const rawTitle = ep.title || '';
    const groupMatch = rawTitle.match(/\(([^)]+)\)$/);
    const groupLeader = groupMatch
      ? groupMatch[1]
      : (groupColors.has(rawTitle.split('(')[0].trim()) ? rawTitle.split('(')[0].trim() : null);
    const groupColor = groupLeader ? (groupColors.get(groupLeader) ?? null) : null;

    // Supprime la parenthèse du chef dans l'affichage — la bordure colorée identifie le groupe
    const escapedLeader = groupLeader ? groupLeader.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '';
    const finalDisplayName = groupLeader
      ? partnerDisplayName.replace(new RegExp(`\\s*\\(${escapedLeader}\\)$`), '').trim() || partnerDisplayName
      : partnerDisplayName;

    const badges = [ep.phone && '📞', ep.booking_options && '📸', ep.client_message && '💬', ep.notes?.trim() && '📝'].filter(Boolean).join('');

    const isLegacyPaid = pd && (pd.cb || pd.especes || pd.cheque || pd.ancv || pd.online || pd.voucher);
    const isUnpaid = !pd?.payment_type && !isLegacyPaid;
    const isNP = pd?.payment_type === 'np';
    let priceStr: string | null = null;

    const MANUAL_TYPES = ['chq', 'cb', 'ancv', 'ancv_connect'];
    const encaisseurName = (pd?.encaisseur_id && pd?.payment_type && MANUAL_TYPES.includes(pd.payment_type))
      ? (monitors as { id: string; title: string }[]).find(m => m.id === String(pd!.encaisseur_id))?.title?.split(' ')[0] ?? null
      : null;

    const TYPE_SHORT: Record<string, string> = {
      esp: 'Esp', cb: 'CB', ancv: 'ANCV', ancv_connect: 'ANCV+',
      chq: 'Chq', a_facturer: 'Fact.',
    };
    const isGiftCard = pd?.code_type === 'gift_card' && !!pd?.code;
    if (ep.price_cents) {
      const euros = (ep.price_cents / 100).toFixed(0);
      if (isUnpaid || isNP) priceStr = `À enc. ${euros} €`;
      else if (isGiftCard) priceStr = `🎁 ${pd!.code}${pd?.online ? ' + Stripe' : ''}`;
      else if (pd?.payment_type === 'online' || pd?.online) priceStr = `${euros} € · Stripe`;
      else if (pd?.payment_type && TYPE_SHORT[pd.payment_type]) priceStr = `${TYPE_SHORT[pd.payment_type]} · ${euros} €`;
      else priceStr = `${euros} €`;
    }

    const infoLine = [ep.flight_name, ep.weight ? `${ep.weight} kg` : null].filter(Boolean).join(' · ');
    const payLine = [priceStr, encaisseurName ? `✓ ${encaisseurName}` : null].filter(Boolean).join(' · ');

    const subSpan = (text: string) => (
      <span style={{ fontSize: '9px', lineHeight: '1.2', opacity: 0.85, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {text}
      </span>
    );

    // ── Détection vol court (aiglon) — calculé dans calendarEvents ──
    const isShortFlight = !!(ep as Slot & { isShortFlight?: boolean }).isShortFlight;
    const aiglonGroupColor = ep.second_booking?.is_group_booking
      ? (groupColors.get(`grp:${rawTitle.split('(')[0].trim()}`) ?? '#a78bfa')
      : null;
    const effectiveBorderColor = groupColor ?? aiglonGroupColor;

    // ── Vue splitée Aiglon sans Pax 2 ──
    if (isShortFlight && !ep.second_booking?.title) {
      return (
        <div style={{ position: 'relative', height: '100%', overflow: 'hidden', borderLeft: effectiveBorderColor ? `4px solid ${effectiveBorderColor}` : undefined }}>
          {/* Fond blanc sur le 1/3 droit */}
          <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: '33%', background: 'white', zIndex: 1 }} />
          {/* Séparateur */}
          <div style={{ position: 'absolute', top: 2, bottom: 2, right: '33%', width: '1px', background: 'rgba(255,255,255,0.5)', zIndex: 2 }} />
          {/* Contenu Pax 1 (2/3 gauche) */}
          <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, right: '33%', padding: '1px 3px', paddingLeft: effectiveBorderColor ? '2px' : '3px', display: 'flex', flexDirection: 'column', gap: '1px', overflow: 'hidden', zIndex: 0 }}>
            {arg.timeText && <span style={{ fontSize: '9px', opacity: 0.75, lineHeight: '1.1', flexShrink: 0 }}>{arg.timeText}</span>}
            <span style={{ fontSize: '11px', fontWeight: 'bold', lineHeight: '1.2', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{finalDisplayName}{badges && ` ${badges}`}</span>
            {infoLine && subSpan(infoLine)}
            {payLine && subSpan(payLine)}
          </div>
        </div>
      );
    }

    // ── Vue splitée Aiglon (Pax 1 / Pax 2) ──
    if (ep.second_booking?.title) {
      const sb = ep.second_booking!;
      const isExp = expandedPax2.has(ep.id);
      const sbPayShort = sb.payment_type ? (TYPE_SHORT[sb.payment_type] ?? null) : null;

      return (
        <div style={{ display: 'flex', height: '100%', overflow: 'hidden', borderLeft: effectiveBorderColor ? `4px solid ${effectiveBorderColor}` : undefined }}>
          {/* Pax 1 */}
          {isExp ? (
            <NativeStopDiv
              style={{ flex: 1, padding: '1px 3px', paddingLeft: effectiveBorderColor ? '2px' : '3px', display: 'flex', flexDirection: 'column', gap: '1px', overflow: 'hidden', cursor: 'pointer' }}
              onNativeClick={() => togglePax2(ep.id)}
            >
              <span style={{ fontSize: '9px', fontWeight: 'bold', opacity: 0.7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px' }}>← {finalDisplayName}</span>
            </NativeStopDiv>
          ) : (
            <div style={{ flex: 2, padding: '1px 3px', paddingLeft: effectiveBorderColor ? '2px' : '3px', display: 'flex', flexDirection: 'column', gap: '1px', overflow: 'hidden' }}>
              {arg.timeText && <span style={{ fontSize: '9px', opacity: 0.75, lineHeight: '1.1', flexShrink: 0 }}>{arg.timeText}</span>}
              <span style={{ fontSize: '11px', fontWeight: 'bold', lineHeight: '1.2', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{finalDisplayName}{badges && ` ${badges}`}</span>
              {infoLine && subSpan(infoLine)}
              {payLine && subSpan(payLine)}
            </div>
          )}
          {/* Séparateur */}
          <div style={{ width: '1px', background: 'rgba(255,255,255,0.35)', flexShrink: 0, margin: '2px 0' }} />
          {/* Pax 2 */}
          <NativeStopDiv
            style={{ flex: isExp ? 2 : 1, padding: '1px 3px', display: 'flex', flexDirection: 'column', gap: '1px', overflow: 'hidden', cursor: 'pointer', opacity: isExp ? 1 : 0.85 }}
            onNativeClick={() => togglePax2(ep.id)}
          >
            {isExp ? (
              <>
                {arg.timeText && <span style={{ fontSize: '9px', opacity: 0.75, lineHeight: '1.1', flexShrink: 0 }}>{arg.timeText}</span>}
                <span style={{ fontSize: '11px', fontWeight: 'bold', lineHeight: '1.2', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sb.title}</span>
                {sb.weight && subSpan(`${sb.weight} kg`)}
                {subSpan(sbPayShort ? sbPayShort : '⚠️ non enc.')}
              </>
            ) : (
              <>
                <span style={{ fontSize: '8px', opacity: 0.65, lineHeight: '1.1', flexShrink: 0 }}>Pax 2</span>
                <span style={{ fontSize: '9px', fontWeight: 'bold', lineHeight: '1.2', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sb.title}{!sb.payment_type ? ' ⚠️' : ''}</span>
              </>
            )}
          </NativeStopDiv>
        </div>
      );
    }

    return (
      <div style={{ padding: '1px 3px', paddingLeft: effectiveBorderColor ? '2px' : '3px', borderLeft: effectiveBorderColor ? `4px solid ${effectiveBorderColor}` : undefined, overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column', gap: '1px' }}>
        {arg.timeText && <span style={{ fontSize: '9px', opacity: 0.75, lineHeight: '1.1', flexShrink: 0 }}>{arg.timeText}</span>}
        <span style={{ fontSize: '11px', fontWeight: 'bold', lineHeight: '1.2', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {finalDisplayName}{badges && ` ${badges}`}
        </span>
        {infoLine && subSpan(infoLine)}
        {payLine && subSpan(payLine)}
      </div>
    );
  }, [monitors, groupColors, expandedPax2, togglePax2, currentUser]);

  const resourceLabelContent = useCallback((arg: { resource: { id: string; title: string } }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '4px', minWidth: 0 }}>
      <span
        style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer', opacity: 0.85 }}
        title={`Remplacer ${arg.resource.title}`}
        onClick={(e) => { e.stopPropagation(); setReplaceMonitor({ id: arg.resource.id, title: arg.resource.title }); }}
        onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
        onMouseLeave={e => (e.currentTarget.style.opacity = '0.85')}
      >{arg.resource.title}</span>
      <button
        onClick={(e) => { e.stopPropagation(); setHiddenMonitorIds(prev => new Set([...prev, arg.resource.id])); }}
        title="Masquer ce pilote"
        style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', opacity: 0.4, fontSize: '11px', padding: '0 2px', lineHeight: '1', color: 'inherit' }}
        onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
        onMouseLeave={e => (e.currentTarget.style.opacity = '0.4')}
      >✕</button>
    </div>
  ), [setReplaceMonitor]);

  const memoizedCalendar = useMemo(() => (
    <FullCalendar
      ref={calendarRef}
      schedulerLicenseKey="CC-Attribution-NonCommercial-NoDerivatives"
      plugins={[resourceTimeGridPlugin, interactionPlugin, scrollgridPlugin]}
      initialView="resourceTimeGridDay"
      resources={visibleMonitors}
      resourceLabelContent={resourceLabelContent}
      datesSet={(arg) => {
        setCurrentDate(arg.startStr.split('T')[0]);
        setViewRange({ start: arg.view.activeStart, end: arg.view.activeEnd });
        const start = new Date(arg.view.activeStart);
        start.setDate(start.getDate() - 15);
        const end = new Date(arg.view.activeEnd);
        end.setDate(end.getDate() + 15);
        dateRangeRef.current = { start: start.toISOString(), end: end.toISOString() };
        loadAppointments();
      }}
      events={calendarEvents}
      locale={frLocale}
      headerToolbar={{ left: 'prev,next today', center: 'title', right: 'resourceTimeGridDay,resourceTimeGridFourDay' }}
      views={{ resourceTimeGridFourDay: { type: 'resourceTimeGrid', duration: { days: 4 }, buttonText: '4 jours' } }}
      slotMinTime={timeBounds.min}
      slotMaxTime={timeBounds.max}
      allDaySlot={false}
      height="auto"
      eventClick={handleEventClick}
      eventContent={renderEventContent}
      slotDuration="00:15:00"
      snapDuration="00:05:00"
      eventOverlap={false}
      slotEventOverlap={false}
      eventTimeFormat={{ hour: '2-digit', minute: '2-digit', meridiem: false, hour12: false }}
      dayMinWidth={130}
    />
  ), [calendarEvents, visibleMonitors, timeBounds, handleEventClick, loadAppointments, renderEventContent, resourceLabelContent]);

  return (
    <div className="p-2 md:p-4 min-h-screen">
      <style dangerouslySetInnerHTML={{ __html: `
        .fc-scrollgrid-section-header .fc-scroller {
          overflow-x: hidden !important;
          touch-action: pan-y !important;
        }
        @media (max-width: 768px) {
          .fc-header-toolbar { flex-direction: column !important; gap: 12px; }
          .fc-toolbar-title { font-size: 1.2rem !important; }
          .fc-button { padding: 0.3em 0.6em !important; font-size: 0.85em !important; }
        }

      `}} />

      <header className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6 md:mb-8 px-2 md:px-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black uppercase italic tracking-tighter text-slate-900 text-center md:text-left">
            Planning <span className="text-sky-500">Vols</span>
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-white border-2 border-slate-200 rounded-2xl px-4 py-1 shadow-sm hover:border-sky-300 transition-colors">
            <CalendarDays size={18} className="mr-2 text-slate-500" />
            <input
              type="date"
              className="bg-transparent font-bold text-sm text-slate-700 outline-none cursor-pointer"
              value={currentDate}
              onChange={(e) => {
                setCurrentDate(e.target.value);
                calendarRef.current?.getApi().gotoDate(e.target.value);
              }}
            />
          </div>
          <button
            onClick={() => setShowGenModal(true)}
            disabled={currentUser?.role !== 'admin'}
            className="bg-slate-900 text-white px-6 py-3 rounded-2xl font-black uppercase text-[10px] shadow-xl hover:scale-105 transition-transform disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            <Wrench size={13} className="inline mr-1" />Générer des créneaux
          </button>
        </div>
      </header>

      <div className="bg-white rounded-2xl md:rounded-[35px] shadow-2xl border border-slate-200 p-2 md:p-6 overflow-hidden">
        {isLoading ? (
          /* Skeleton calendrier — simule des colonnes de moniteurs avec des créneaux */
          <div className="animate-pulse">
            {/* Barre de titre fictive */}
            <div className="flex gap-3 mb-4 px-2">
              <div className="h-8 bg-slate-200 rounded-xl w-24"></div>
              <div className="h-8 bg-slate-200 rounded-xl w-24"></div>
              <div className="flex-1"></div>
              <div className="h-8 bg-slate-100 rounded-xl w-48"></div>
            </div>
            {/* Header colonnes moniteurs */}
            <div className="flex gap-2 mb-3 px-2">
              <div className="w-14 shrink-0"></div>
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="flex-1 h-10 bg-slate-200/70 rounded-xl"></div>
              ))}
            </div>
            {/* Lignes de créneaux */}
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
              <div key={i} className="flex gap-2 mb-2 items-center px-2">
                <div className="w-14 shrink-0 h-4 bg-slate-100 rounded"></div>
                {[1, 2, 3, 4].map(j => (
                  <div key={j} className={`flex-1 rounded-xl ${i % 3 === 1 && j === 2 ? 'h-16 bg-sky-100' : 'h-10 bg-slate-50 border border-slate-100'}`}></div>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <ErrorBoundary variant="widget" zone="planning/fullcalendar">
            {(hiddenActiveMonitors.length > 0 || monitorsWithoutSlots.filter(m => !extraShownIds.has(m.id.toString())).length > 0) && (
              <div className="flex flex-wrap gap-1.5 mb-3 px-1">
                {hiddenActiveMonitors.map(m => (
                  <button
                    key={m.id}
                    onClick={() => setHiddenMonitorIds(prev => { const next = new Set(prev); next.delete(m.id); return next; })}
                    className="flex items-center gap-1.5 bg-slate-100 hover:bg-sky-50 border border-slate-200 hover:border-sky-300 text-slate-500 hover:text-sky-700 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-colors"
                    title={`Réafficher ${m.title}`}
                  >
                    <span>{m.title}</span>
                    <span className="text-[9px] opacity-60">👁</span>
                  </button>
                ))}
                {monitorsWithoutSlots.filter(m => !extraShownIds.has(m.id.toString())).map(m => (
                  <button
                    key={m.id}
                    onClick={() => setExtraShownIds(prev => new Set([...prev, m.id.toString()]))}
                    className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 border border-dashed border-slate-200 hover:border-slate-300 text-slate-400 hover:text-slate-600 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-colors"
                    title={`Afficher ${m.title} (aucun créneau)`}
                  >
                    <span>{m.title}</span>
                    <span className="text-[9px] opacity-50">+</span>
                  </button>
                ))}
              </div>
            )}
            {memoizedCalendar}
          </ErrorBoundary>
        )}
      </div>

      {showEditModal && selectedEvent && (
        <EditSlotModal
          selectedEvent={selectedEvent}
          currentUser={currentUser}
          slotDuration={slotDuration}
          appointments={appointments}
          setAppointments={setAppointments}
          flightTypes={flightTypes}
          monitors={monitors}
          slotDefs={slotDefs}
          loadAppointments={loadAppointments}
          onClose={() => setShowEditModal(false)}
        />
      )}

      {showGenModal && (
        <GenSlotsModal
          availablePlans={availablePlans}
          monitors={monitors}
          loadAppointments={loadAppointments}
          onClose={() => setShowGenModal(false)}
        />
      )}

      {replaceMonitor && (
        <ReplaceMonitorModal
          monitor={replaceMonitor}
          monitors={monitors as { id: string; title: string; is_active?: boolean }[]}
          viewRange={viewRange}
          appointments={appointments}
          availablePlans={availablePlans}
          onClose={() => setReplaceMonitor(null)}
          onSuccess={loadAppointments}
        />
      )}
    </div>
  );
}
