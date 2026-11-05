import type { FlightType, Complement, GiftCard, Passenger } from '@/lib/types';

const priceFormatter = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** "70 €", "130 €", "1,50 €" — jamais de décimales inutiles */
export function formatPrice(euros: number): string {
  return priceFormatter.format(euros);
}

const shortDateFormatter = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  timeZone: 'Europe/Paris',
});

/** "2026-12-13" → "dim. 13 déc." */
export function formatShortDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  return shortDateFormatter.format(new Date(y, m - 1, d));
}

export interface PriceBreakdown {
  flightTotal: number;
  complementsTotal: number;
  originalPrice: number;
  discountAmount: number;
  finalPrice: number;
}

/**
 * Calcule le détail de prix d'une réservation.
 * Fonction pure — aucun effet de bord, 100 % testable.
 */
export function calculateBookingPrice(
  cart: Record<string, number>,
  flights: FlightType[],
  passengers: Passenger[],
  complementsList: Complement[],
  appliedVoucher: GiftCard | null
): PriceBreakdown {
  let flightTotal = 0;
  let complementsTotal = 0;

  // Total des vols
  Object.entries(cart).forEach(([key, qty]) => {
    const [fId] = key.split('|');
    const f = flights.find(fl => fl.id.toString() === fId);
    if (f && f.price_cents) flightTotal += (f.price_cents / 100) * qty;
  });

  // Total des options sélectionnées par passager (hors compléments offerts par l'activité)
  passengers.forEach(p => {
    const passengerFlight = flights.find(f => f.id.toString() === p.flightId);
    (p.selectedComplements ?? []).forEach(compId => {
      const comp = complementsList.find(c => c.id === compId);
      if (!comp || !comp.price_cents) return;
      const isLockedByActivity = !!(passengerFlight?.activity_gopro && (
        comp.name.toLowerCase().includes('photo') ||
        comp.name.toLowerCase().includes('vidéo') ||
        comp.name.toLowerCase().includes('video') ||
        comp.name.toLowerCase().includes('gopro')
      ));
      if (!isLockedByActivity) complementsTotal += comp.price_cents / 100;
    });
  });

  const originalPrice = flightTotal + complementsTotal;
  let discountAmount = 0;

  if (appliedVoucher) {
    if (appliedVoucher.type === 'gift_card') {
      // Le bon couvre un montant fixe (ne peut pas dépasser le total)
      discountAmount = Math.min(Number(appliedVoucher.price_paid_cents) / 100, originalPrice);
    } else if (appliedVoucher.type === 'promo') {
      const discountVal = Number(appliedVoucher.discount_value);
      const scope = appliedVoucher.discount_scope ?? 'both';

      let targetAmount = originalPrice;
      if (scope === 'flight') targetAmount = flightTotal;
      if (scope === 'complements') targetAmount = complementsTotal;

      if (appliedVoucher.discount_type === 'fixed') {
        discountAmount = Math.min(discountVal, targetAmount);
      } else if (appliedVoucher.discount_type === 'percentage') {
        discountAmount = targetAmount * (discountVal / 100);
      }
    }
  }

  const finalPrice = Math.max(0, originalPrice - discountAmount);

  return { flightTotal, complementsTotal, originalPrice, discountAmount, finalPrice };
}
