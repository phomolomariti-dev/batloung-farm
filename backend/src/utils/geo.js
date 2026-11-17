require('dotenv').config();

const depot = () => ({
  lat: Number(process.env.DEPOT_LAT) || -29.3167,
  lng: Number(process.env.DEPOT_LNG) || 27.4833,
});
const cfg = () => ({
  speed: Number(process.env.AVG_SPEED_KMH) || 40,
  roadFactor: Number(process.env.ROAD_FACTOR) || 1.35,
  handling: Number(process.env.HANDLING_MINUTES) || 10,
});

// Great-circle distance in km (Haversine formula)
function haversineKm(a, b) {
  const R = 6371;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Straight-line distance x road factor = estimated driving distance; time = distance / speed + handling
function estimateLeg(from, to) {
  const { speed, roadFactor, handling } = cfg();
  const distance_km = Math.round(haversineKm(from, to) * roadFactor * 10) / 10;
  const travel_minutes = Math.round((distance_km / speed) * 60);
  return { distance_km, travel_minutes, eta_minutes: travel_minutes + handling };
}

function estimateFromDepot(lat, lng) {
  if (lat == null || lng == null) return null;
  return estimateLeg(depot(), { lat: Number(lat), lng: Number(lng) });
}

// Nearest-neighbour route: always drive to the closest remaining stop. Gives cumulative arrival times.
function planRoute(stops) {
  const { handling } = cfg();
  let current = depot();
  let clock = 0;
  let totalKm = 0;
  const remaining = stops.filter((s) => s.latitude != null && s.longitude != null);
  const route = [];
  while (remaining.length) {
    let bestIdx = 0;
    let best = Infinity;
    remaining.forEach((s, i) => {
      const d = haversineKm(current, { lat: Number(s.latitude), lng: Number(s.longitude) });
      if (d < best) { best = d; bestIdx = i; }
    });
    const stop = remaining.splice(bestIdx, 1)[0];
    const pos = { lat: Number(stop.latitude), lng: Number(stop.longitude) };
    const leg = estimateLeg(current, pos);
    clock += leg.travel_minutes;
    totalKm += leg.distance_km;
    route.push({ order: route.length + 1, ...stop, leg_km: leg.distance_km, leg_minutes: leg.travel_minutes, arrival_after_minutes: clock });
    clock += handling;
    current = pos;
  }
  return { depot: depot(), stops: route, total_km: Math.round(totalKm * 10) / 10, total_minutes_excluding_return: clock };
}

// ---------- Supplier trips (Maseru -> South Africa) ----------
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const tripCfg = () => ({
  speed: Number(process.env.SUPPLIER_SPEED_KMH) || 80,
  roadFactor: Number(process.env.SUPPLIER_ROAD_FACTOR) || 1.25,
  border: Number(process.env.BORDER_MINUTES) || 60,
  costPerKm: Number(process.env.TRIP_COST_PER_KM) || 5,      // fuel + vehicle wear, maloti per km
  fixed: process.env.TRIP_FIXED_COST ? Number(process.env.TRIP_FIXED_COST) : 300, // permits / border fees per trip
  loading: Number(process.env.LOADING_MINUTES) || 45,         // time spent loading at each supplier
});

// Single return trip Maseru -> supplier -> Maseru
function estimateTrip(lat, lng) {
  if (lat == null || lng == null) return null;
  const t = tripCfg();
  const distance_km = Math.round(haversineKm(depot(), { lat: Number(lat), lng: Number(lng) }) * t.roadFactor);
  const drive_minutes = Math.round((distance_km / t.speed) * 60);
  const one_way_minutes = drive_minutes + t.border;
  const round_trip_km = distance_km * 2;
  return { distance_km, drive_minutes, border_minutes: t.border, one_way_minutes, round_trip_minutes: one_way_minutes * 2,
    round_trip_km, trip_cost: round2(round_trip_km * t.costPerKm + t.fixed) };
}

// One trip visiting several suppliers (nearest-neighbour order), then back to Maseru
function planSupplierRoute(stops) {
  const t = tripCfg();
  let cur = depot();
  let clock = t.border; // crossing out of Lesotho
  let km = 0;
  const remaining = stops.filter((s) => s.latitude != null && s.longitude != null);
  const route = [];
  while (remaining.length) {
    let bi = 0; let best = Infinity;
    remaining.forEach((s, i) => { const d = haversineKm(cur, { lat: Number(s.latitude), lng: Number(s.longitude) }); if (d < best) { best = d; bi = i; } });
    const stop = remaining.splice(bi, 1)[0];
    const pos = { lat: Number(stop.latitude), lng: Number(stop.longitude) };
    const leg_km = Math.round(haversineKm(cur, pos) * t.roadFactor);
    const leg_minutes = Math.round((leg_km / t.speed) * 60);
    km += leg_km; clock += leg_minutes;
    route.push({ order: route.length + 1, ...stop, leg_km, leg_minutes, arrival_after_minutes: clock });
    clock += t.loading;
    cur = pos;
  }
  const return_km = Math.round(haversineKm(cur, depot()) * t.roadFactor);
  km += return_km;
  clock += Math.round((return_km / t.speed) * 60) + t.border; // drive home + crossing back into Lesotho
  return { depot: depot(), stops: route, total_km: km, total_minutes: clock, return_km,
    trip_cost: route.length ? round2(km * t.costPerKm + t.fixed) : 0 };
}

module.exports = { haversineKm, estimateFromDepot, estimateTrip, planRoute, planSupplierRoute, depot };
