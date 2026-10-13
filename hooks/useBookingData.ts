"use client";
import { useState, useEffect } from 'react';
import { getLocalYYYYMMDD } from '@/lib/booking-utils';
import type { FlightType, GiftCardShopTemplate, Complement } from '@/lib/types';

interface InitialData {
  flights: FlightType[];
  complements: Complement[];
  giftTemplates: GiftCardShopTemplate[];
  displayDaysCount: number;
}

export function useBookingData(
  onReady: (dateStr: string, daysCount: number) => void,
  initial?: InitialData,
) {
  const [flights, setFlights] = useState<FlightType[]>(initial?.flights ?? []);
  const [giftTemplates, setGiftTemplates] = useState<GiftCardShopTemplate[]>(initial?.giftTemplates ?? []);
  const [complementsList, setComplementsList] = useState<Complement[]>(initial?.complements ?? []);
  const [displayDaysCount, setDisplayDaysCount] = useState<number>(initial?.displayDaysCount ?? 3);
  const [isLoading, setIsLoading] = useState(!initial);
  const [activeSeason, setActiveSeason] = useState<'Standard' | 'Hiver'>('Standard');

  useEffect(() => {
    const currentMonth = new Date().getMonth();
    let defaultSeason: 'Standard' | 'Hiver' = (currentMonth >= 8 || currentMonth <= 3) ? 'Hiver' : 'Standard';

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('saison')?.toLowerCase() === 'hiver') defaultSeason = 'Hiver';
      if (params.get('saison')?.toLowerCase() === 'ete') defaultSeason = 'Standard';
    }
    setActiveSeason(defaultSeason);

    // Si les données initiales ont été passées depuis le serveur, on s'en sert directement.
    if (initial) {
      const defaultDate = new Date();
      if (defaultDate.getHours() >= 12) defaultDate.setDate(defaultDate.getDate() + 1);
      onReady(getLocalYYYYMMDD(defaultDate), initial.displayDaysCount);
      return;
    }

    const fetchData = async () => {
      try {
        const [resFlights, resComplements, resPublicSettings, resTemplates] = await Promise.all([
          fetch(`/api/proxy/flight-types?t=${Date.now()}`, { cache: 'no-store' }),
          fetch(`/api/proxy/complements?t=${Date.now()}`, { cache: 'no-store' }),
          fetch(`/api/proxy/public/site-settings?t=${Date.now()}`, { cache: 'no-store' }),
          fetch(`/api/proxy/gift-card-templates?publicOnly=true&t=${Date.now()}`, { cache: 'no-store' }),
        ]);

        if (resFlights.ok) setFlights(await resFlights.json());
        if (resComplements.ok) setComplementsList(await resComplements.json());
        if (resTemplates.ok) setGiftTemplates(await resTemplates.json());

        let count = 3;
        if (resPublicSettings.ok) {
          const s = await resPublicSettings.json();
          if (s.display_days_count) count = parseInt(s.display_days_count);
        }
        setDisplayDaysCount(count);

        const defaultDate = new Date();
        if (defaultDate.getHours() >= 12) defaultDate.setDate(defaultDate.getDate() + 1);
        onReady(getLocalYYYYMMDD(defaultDate), count);
      } catch (err) {
        console.error('Erreur chargement données', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { flights, giftTemplates, complementsList, displayDaysCount, isLoading, activeSeason, setActiveSeason };
}
