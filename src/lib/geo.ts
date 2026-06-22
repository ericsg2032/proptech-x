// Geocoding + commute times via Google Maps Platform.
// Falls back to mock when GOOGLE_MAPS_API_KEY is absent.

export interface GeoResult {
  formattedAddress: string;
  lat: number;
  lng: number;
}

export async function geocode(address: string): Promise<GeoResult | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) {
    return { formattedAddress: address, lat: -37.8136, lng: 144.9631 }; // mock (Melbourne)
  }
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
      address,
    )}&region=au&key=${key}`;
    const res = await fetch(url);
    const data = await res.json();
    const r = data?.results?.[0];
    if (!r) return null;
    return {
      formattedAddress: r.formatted_address,
      lat: r.geometry.location.lat,
      lng: r.geometry.location.lng,
    };
  } catch {
    return null;
  }
}

export interface CommuteResult {
  distanceKm: number;
  driveMin: number;
}

/** Drive time/distance between two points via Distance Matrix. */
export async function commute(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
): Promise<CommuteResult | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) {
    const km = haversineKm(fromLat, fromLng, toLat, toLng);
    return { distanceKm: round1(km), driveMin: Math.round(km * 1.8) };
  }
  try {
    const url =
      `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${fromLat},${fromLng}` +
      `&destinations=${toLat},${toLng}&mode=driving&key=${key}`;
    const res = await fetch(url);
    const data = await res.json();
    const el = data?.rows?.[0]?.elements?.[0];
    if (!el || el.status !== "OK") return null;
    return {
      distanceKm: round1(el.distance.value / 1000),
      driveMin: Math.round(el.duration.value / 60),
    };
  } catch {
    return null;
  }
}

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}
function round1(n: number) {
  return Math.round(n * 10) / 10;
}
