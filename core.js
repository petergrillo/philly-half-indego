export const STALE_MS = 5 * 60 * 1000;
export function distanceToRoute(lon, lat, route) {
  const scaleX = 111320 * Math.cos(lat * Math.PI / 180), scaleY = 111320;
  let distance = Infinity, order = 0;
  for (let i = 0; i < route.length - 1; i++) {
    const ax = (route[i][0] - lon) * scaleX, ay = (route[i][1] - lat) * scaleY;
    const dx = (route[i+1][0] - route[i][0]) * scaleX, dy = (route[i+1][1] - route[i][1]) * scaleY;
    const t = Math.max(0, Math.min(1, -(ax*dx + ay*dy) / (dx*dx + dy*dy || 1)));
    const d = Math.hypot(ax + t*dx, ay + t*dy);
    if (d < distance) { distance = d; order = i + t; }
  }
  return {distance, order};
}
const count = value => Number.isFinite(value) && value >= 0 ? value : null;
export function joinStations(information, status, route) {
  const byId = new Map((status?.data?.stations || []).map(s => [s.station_id, s]));
  return information.data.stations.filter(s => Number.isFinite(s.lat) && Number.isFinite(s.lon)).map(s => {
    const v = byId.get(s.station_id);
    return {...s, ...distanceToRoute(s.lon, s.lat, route), bikes: count(v?.num_bikes_available), docks: count(v?.num_docks_available), electric: count(v?.num_bikes_available_types?.electric), renting: v ? v.is_installed === 1 && v.is_renting === 1 : false, returning: v ? v.is_installed === 1 && v.is_returning === 1 : false, reported: v?.last_reported ? v.last_reported * 1000 : null};
  });
}
export function isStale(station, now = Date.now()) { return !station.reported || now - station.reported > STALE_MS || station.reported - now > STALE_MS; }
export function stationColor(station) {
  if (!station.renting || station.bikes === null) return 'unknown';
  return station.bikes === 0 ? 'empty' : station.bikes < 5 ? 'low' : 'good';
}
export function filterStations(stations, {query = '', distance = '300', availability = 'all', sort = 'course'} = {}, now = Date.now()) {
  const q = query.toLocaleLowerCase().trim();
  return stations.filter(s => (distance === 'all' || s.distance <= Number(distance)) && (!q || `${s.name} ${s.address || ''}`.toLocaleLowerCase().includes(q)) && (availability === 'all' || !isStale(s, now) && (availability === 'bikes' ? s.renting && s.bikes > 0 : availability === 'electric' ? s.renting && s.electric > 0 : s.returning && s.docks > 0))).sort((a,b) => sort === 'name' ? a.name.localeCompare(b.name) : sort === 'bikes' ? (b.renting && !isStale(b,now) ? b.bikes ?? -1 : -1) - (a.renting && !isStale(a,now) ? a.bikes ?? -1 : -1) : sort === 'docks' ? (b.returning && !isStale(b,now) ? b.docks ?? -1 : -1) - (a.returning && !isStale(a,now) ? a.docks ?? -1 : -1) : a.order - b.order);
}
export function escapeHTML(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
