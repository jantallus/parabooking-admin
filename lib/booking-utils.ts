export const getLocalYYYYMMDD = (d: Date) => {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};

export const getDayName = (dateStr: string) => {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
};

export const calculateGridStart = (dateStr: string, count: number) => {
  // 'T12:00:00' évite le décalage timezone : minuit UTC = veille en UTC-N
  const start = new Date(dateStr + 'T12:00:00');
  if (count === 7) {
    const day = start.getDay();
    const diff = day === 6 ? 0 : day + 1;
    start.setDate(start.getDate() - diff);
  }
  return getLocalYYYYMMDD(start);
};

export const getMarketingInfo = (flightName: string) => {
  if (!flightName) return 'Vol sensationnel';
  const name = flightName.toLowerCase();
  if (name.includes('loupiot')) return '8 min de vol';
  if (name.includes('découverte') || name.includes('decouverte')) return '15 min de vol';
  if (name.includes('ascendance')) return '30 min de vol';
  if (name.includes('prestige')) return '1h de vol';
  if (name.includes('beauregard')) return '500m de dénivelé';
  if (name.includes('loup')) return '800m de dénivelé';
  if (name.includes('aiguille')) return '1200m de dénivelé';
  return 'Vol inoubliable';
};
