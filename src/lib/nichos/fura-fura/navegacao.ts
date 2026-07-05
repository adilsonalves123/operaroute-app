type PontoEndereco = {
  endereco?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

export function linksNavegacaoPonto(ponto: PontoEndereco): {
  waze: string;
  google: string;
} | null {
  if (ponto.latitude != null && ponto.longitude != null) {
    const ll = `${ponto.latitude},${ponto.longitude}`;
    return {
      waze: `https://waze.com/ul?ll=${ll}&navigate=yes`,
      google: `https://www.google.com/maps/dir/?api=1&destination=${ll}`,
    };
  }

  const endereco = [ponto.endereco, ponto.bairro, ponto.cidade].filter(Boolean).join(", ");
  if (!endereco.trim()) return null;

  const q = encodeURIComponent(endereco);
  return {
    waze: `https://waze.com/ul?q=${q}&navigate=yes`,
    google: `https://www.google.com/maps/dir/?api=1&destination=${q}`,
  };
}
