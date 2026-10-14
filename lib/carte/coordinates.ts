/**
 * Coordinates as people paste them from an online map: « 50.45, 4.2 »,
 * « 50,45 4,2 », « 50.45;4.2 ». Latitude first, as every map gives them.
 */
export function parseCoordinates(raw: string): [number, number] | null {
  const value = raw.trim();
  if (!value) return null;
  let parts = value.split(/\s*;\s*|,\s+|\s+/).filter(Boolean);
  if (parts.length === 1 && /^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/.test(value))
    parts = value.split(",");
  if (parts.length !== 2) return null;
  const [lat, lng] = parts.map((p) =>
    /^-?\d+([.,]\d+)?$/.test(p) ? Number(p.replace(",", ".")) : NaN,
  );
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return [Math.round(lat * 1e5) / 1e5, Math.round(lng * 1e5) / 1e5];
}

export function formatCoordinates(lat: number, lng: number): string {
  const short = (n: number) => String(Number(n.toFixed(5)));
  return `${short(lat)}, ${short(lng)}`;
}
