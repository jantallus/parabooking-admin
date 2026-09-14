// lib/types.ts — Interfaces TypeScript partagées dans tout le projet

// ── Utilisateurs ─────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name?: string;
  role: 'admin' | 'aravis' | 'monitor' | 'permanent' | 'user';
  enseigne?: 'fluide' | 'aravis';
  status?: string;
  is_active_monitor?: boolean;
  google_sync_enabled?: boolean;
  receives_online_payments?: boolean;
  commission_type?: 'none' | 'percentage' | 'fixed';
  commission_value?: number;
  phone?: string;
  color?: string;
  google_calendar_id?: string;
  notify_on_request?: boolean;
  request_notification_sms?: string | null;
}

export interface CurrentUser {
  id: string;
  email: string;
  first_name: string;
  role: 'admin' | 'aravis' | 'monitor' | 'permanent' | 'user';
  enseigne?: 'fluide' | 'aravis';
}

// ── Planning ──────────────────────────────────────────────────────────────────

export interface Slot {
  id: number;
  start_time: string;
  end_time: string;
  status: 'available' | 'booked' | 'blocked';
  monitor_id: string;
  title?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  booking_options?: string | null;
  client_message?: string | null;
  flight_type_id?: number | null;
  weight?: number | null;
  weight_checked?: boolean | null;
  weightChecked?: boolean;
  payment_data?: PaymentData | null;
  billing_name?: string | null;
  second_booking?: { title: string; phone?: string | null; weight?: number | null; payment_type?: string | null; encaisseur_id?: string | null; is_group_booking?: boolean; price_override_cents?: number | null } | null;
  resourceId?: string;
  /** FullCalendar event.start (Date object) — populated when slot comes from calendar click */
  start?: Date | string;
}

export interface CalendarAppointment {
  id: number;
  title: string;
  start: string;
  end: string;
  resourceId: string;
  backgroundColor?: string;
  borderColor?: string;
  extendedProps?: Record<string, unknown>;
}

export interface Monitor {
  id: string;
  title: string;
  is_active?: boolean;
}

export interface SlotDefinition {
  id: number;
  monitor_id?: string;
  start_time: string;
  end_time?: string;
  plan_name?: string;
  duration_minutes?: number;
  label?: string;
}

export interface OpeningPeriod {
  start: string;
  end: string;
  season?: string;
}

// ── Vols & prestations ────────────────────────────────────────────────────────

export interface FlightType {
  id: number;
  name: string;
  description?: string;
  duration_minutes?: number;
  /** Alias used in some components */
  duration?: number;
  price_cents: number;
  season?: string;
  is_active?: boolean;
  popup_content?: string;
  show_popup?: boolean;
  image_url?: string;
  color_code?: string;
  weight_min?: number;
  weight_max?: number;
  booking_delay_hours?: number;
  allowed_time_slots?: string[];
  allow_multi_slots?: boolean;
  restricted_start_time?: string;
  restricted_end_time?: string;
  activity_ski?: boolean;
  activity_snowboard?: boolean;
  activity_pedestrian?: boolean;
  activity_children?: boolean;
  activity_gopro?: boolean;
  media_included?: boolean;
  passengers_per_slot?: number;
  tenant?: string;
}

export interface Complement {
  id: number;
  name: string;
  description?: string;
  price_cents: number;
  is_active?: boolean;
  flight_type_ids?: number[];
  image_url?: string;
}

// ── Bons cadeaux & codes promo ────────────────────────────────────────────────

export interface GiftCard {
  id: number;
  code: string;
  type: 'gift_card' | 'promo';
  buyer_name?: string;
  beneficiary_name?: string;
  buyer_email?: string;
  buyer_phone?: string;
  buyer_address?: string;
  flight_type_id?: number | null;
  flight_name?: string;
  gift_value?: number | null;
  discount_type?: 'fixed' | 'percentage';
  discount_value?: number;
  discount_scope?: 'flight' | 'complements' | 'both';
  max_uses?: number;
  used_count?: number;
  is_unlimited?: boolean;
  is_used?: boolean;
  status?: 'valid' | 'used' | 'inactive';
  price_paid_cents?: number;
  valid_from?: string;
  valid_until?: string;
  is_partner?: boolean;
  partner_amount_cents?: number | null;
  partner_billing_type?: string;
  created_at?: string;
  expires_at?: string | null;
  custom_line_1?: string;
  custom_line_2?: string;
  custom_line_3?: string;
  pdf_background_url?: string;
  included_options?: number[];
  monitor_id?: string | null;
  monitor_name?: string | null;
}

export interface GiftCardTemplate {
  id: number;
  name: string;
  flight_type_id?: number | null;
  custom_line_1?: string;
  custom_line_2?: string;
  custom_line_3?: string;
  pdf_background_url?: string;
  popup_content?: string;
  show_popup?: boolean;
}

// ── Paiement structuré ───────────────────────────────────────────────────────

export type PaymentType = 'np' | 'esp' | 'cb' | 'ancv' | 'ancv_connect' | 'chq' | 'bon_cadeau' | 'online' | 'a_facturer';

export interface PaymentData {
  online?: boolean;      // payé via Stripe CB
  cb?: number;           // CB en centimes (sur place ou en ligne)
  especes?: number;      // Espèces en centimes
  cheque?: number;       // Chèque en centimes
  ancv?: number;         // ANCV en centimes
  voucher?: number;      // Montant couvert par bon/promo en centimes
  code?: string;         // Code bon cadeau ou promo
  code_type?: 'gift_card' | 'promo';
  options?: string[];    // Noms des options ajoutées sur place
  // Encaissement
  payment_type?: PaymentType;
  encaisseur_id?: number | string;
  // Partenaire
  partner?: boolean;
  partner_id?: number;
  partner_name?: string;
  partner_color?: string;
  google_synced?: boolean;
  invoice_amount_cents?: number;
  // Compléments et prix overrides (réservations admin)
  selected_complements?: { id: number; name: string; price_cents: number }[];
  complement_total_cents?: number;
  price_override_cents?: number;
  // Stripe
  stripe_session_id?: string;
  stripe_fee_cents?: number;
  stripe_net_cents?: number;
  // CB net (après commission fournisseur de paiement)
  cb_net_cents?: number;
}

// ── Clients ───────────────────────────────────────────────────────────────────

export interface ClientFlight {
  id: number;
  start_time: string;
  payment_data?: PaymentData | null;
  monitor_name?: string;
  monitor_id?: string;
  flight_name?: string;
  price_cents?: number;
  billing_name?: string | null;
  group_id?: string | null;
}

export interface Client {
  id: number;
  first_name: string;
  last_name?: string;
  email?: string;
  phone?: string;
  billing_name?: string | null;
  billing_email?: string | null;
  has_upcoming?: boolean | number;
  flights?: ClientFlight[];
}

// ── Statistiques ──────────────────────────────────────────────────────────────

export interface DashboardStats {
  todaySlots: number;
  bookedSlots: number;
  revenue: number;
}

export interface UpcomingFlight {
  id: number;
  start_time: string;
  title?: string;
  flight_name?: string;
  monitor_name?: string;
  notes?: string;
}

export interface StatsSummary {
  totalRevenue: number;
  totalBookings: number;
}

// ── Réservation publique ──────────────────────────────────────────────────────

export interface PublicSlot {
  id: number;
  start_time: string;
  end_time: string;
  status: 'available' | 'booked' | 'unavailable';
  monitor_id: string;
}

export interface Passenger {
  firstName: string;
  lastName?: string;
  weight?: string;
  flightId?: string;
  flightName?: string;
  date?: string;
  time?: string;
  weightChecked?: boolean;
  weight_min?: number;
  weight_max?: number;
  selectedComplements?: number[];
}

export interface CartItem {
  slotId: number;
  startTime: string;
  endTime: string;
  flightTypeId: number;
  flightName: string;
  price: number;
  passenger: Passenger;
  selectedOptions: number[];
}

// ── Saisons & config ──────────────────────────────────────────────────────────

export interface Season {
  id: string;
  name: string;
  start: string;
  end: string;
}

export interface GiftCardShopTemplate {
  id: number;
  title: string;
  description?: string;
  price_cents: number;
  validity_months: number;
  is_published: boolean;
  flight_type_id?: number | null;
  flight_name?: string;
  image_url?: string;
  pdf_background_url?: string;
  popup_content?: string;
  show_popup?: boolean;
  custom_line_1?: string;
  custom_line_2?: string;
  custom_line_3?: string;
}

export interface Availability {
  start_date: string;
  end_date: string;
  daily_start_time: string | null;
  daily_end_time: string | null;
}

// ── Statistiques détaillées ───────────────────────────────────────────────────

export interface StatsUpcomingFlight {
  id: number;
  start_time: string;
  client_name?: string;
  flight_name?: string;
  monitor_name?: string;
  total_price: number;
}

// ── Paramètres ────────────────────────────────────────────────────────────────

export interface Setting {
  key: string;
  value: string;
}

// ── Partenaires ───────────────────────────────────────────────────────────────

export interface PartnerBookingFields {
  name: boolean;
  phone: boolean;
  email: boolean;
  flight_type: boolean;
  weight: boolean;
  notes: boolean;
}

export interface PartnerFlightType {
  flight_type_id: number;
  base_price_cents: number | null;
}

export interface Partner {
  id: number;
  name: string;
  code: string;
  color_code: string;
  booking_fields: PartnerBookingFields;
  is_active: boolean;
  commission_type?: 'none' | 'percentage' | 'fixed';
  commission_value?: number;
  facturable?: boolean;
  allowed_flight_types?: PartnerFlightType[];
}

export type SettingsMap = Record<string, string>;

// ── API générique ─────────────────────────────────────────────────────────────

export interface ApiError {
  error: string;
}