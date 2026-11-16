import {createSpectator} from './spectator-ui.js';
import {joinStations, filterStations, stationColor, isStale, escapeHTML as esc, STALE_MS} from './core.js';
const $ = id => document.getElementById(id);
const FEED = 'https://gbfs.bcycle.com/bcycle_indego/';
const state = {information:null, status:null, stations:[], route:null, selected:null, failed:false, loading:false, lastSuccess:null};
const params = new URLSearchParams(location.search);
for (const [id,key] of [['distance','radius'],['availability','show'],['sort','sort']]) if ([...$(id).options].some(o=>o.value===params.get(key))) $(id).value=params.get(key);
$('search').value=params.get('q') || '';
state.selected=params.get('station');
let map, course, pins, markerById = new Map(), userMarker;
let startupError = false;
function toast(text) { $('toast').textContent=text; $('toast').hidden=false; clearTimeout(toast.timer); toast.timer=setTimeout(()=>$('toast').hidden=true,4500); }
function notice(text) { $('map-notice').textContent=text; $('map-notice').hidden=!text; }
async function json(url) { const res=await fetch(url,{signal:AbortSignal.timeout(15000),cache:'no-cache'}); if(!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); }
function validInformation(v) { if(!v?.data?.stations?.length) throw new Error('Invalid station information'); return v; }
function validStatus(v) { if(!v?.data?.stations?.length || !Number.isFinite(v.last_updated)) throw new Error('Invalid availability feed'); return v; }
function settings() { return {query:$('search').value, distance:$('distance').value, availability:$('availability').value, sort:$('sort').value}; }
function saveURL() { const s=settings(), u=new URL(location.href);u.search='';if(s.distance!=='300')u.searchParams.set('radius',s.distance);if(s.availability!=='all')u.searchParams.set('show',s.availability);if(s.sort!=='course')u.searchParams.set('sort',s.sort);if(s.query)u.searchParams.set('q',s.query);if(state.selected)u.searchParams.set('station',state.selected);history.replaceState(null,'',u); }
function stamp(ms) {return new Date(ms).toLocaleString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'});}
function count(v, enabled=true) {return enabled && v!==null ? v : '—';}
function feet(s) {return `${Math.round(s.distance*3.28084/10)*10} ft`;} 
function stationNote(s) {if(s.bikes===null)return 'Availability unknown';if(!s.renting&&!s.returning)return 'Station unavailable';if(!s.renting)return 'Bike rentals unavailable';if(!s.returning)return 'Returns unavailable';if(isStale(s))return 'Stale counts — check before riding';return '';}
function popup(s) {const stale=isStale(s);return `<h2 class="popup-title">${esc(s.name)}</h2><p>${esc(s.address)}</p><div class="popup-counts"><div><strong>${count(s.bikes,s.renting)}</strong><small>${stale?'last known bikes':'bikes'}</small></div><div><strong>${count(s.electric,s.renting)}</strong><small>e-bikes included</small></div><div><strong>${count(s.docks,s.returning)}</strong><small>open docks</small></div></div><p>${esc(stationNote(s))}${s.reported?`<br>Station report: ${esc(stamp(s.reported))}`:''}<br>~${feet(s)} from approximate course</p><p><a href="https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lon}&travelmode=walking" target="_blank" rel="noopener">Walking directions ↗</a> · <a href="https://www.rideindego.com/stations/" target="_blank" rel="noopener">Check Indego ↗</a></p><p>Race-day access may differ.</p>`;}
function select(id, fly=true) {state.selected=id;saveURL();const marker=markerById.get(id),s=state.stations.find(v=>v.station_id===id);if(marker&&s){if(fly)map.setView([s.lat,s.lon],16,{animate:!matchMedia('(prefers-reduced-motion: reduce)').matches});marker.openPopup();}document.querySelectorAll('.station-card').forEach(c=>c.classList.toggle('selected',c.dataset.id===id));if(innerWidth<=760&&fly)$('map').scrollIntoView({behavior:'smooth',block:'start'});}
function updateHealth() {
  if(startupError)return;
  const old=!state.status || Date.now()-state.status.last_updated*1000>STALE_MS;
  const bad=state.failed || old;
  $('live-dot').className=`dot ${state.loading&&!state.status?'pending':bad?'stale':'good'}`;
  $('live-label').textContent=state.loading&&!state.status?'Connecting to Indego':state.failed?'Live update unavailable':old?'Feed is stale':'Live station availability';
  $('updated').textContent=state.status?`Feed: ${stamp(state.status.last_updated*1000)} · ${bad?'Counts may be outdated. Retrying every 60s.':'Refreshes every 60 seconds'}`:'No live counts yet. Retrying every 60 seconds.';
}
function render() {
  if(!state.information||!state.route)return;
  state.stations=joinStations(state.information,state.status,state.route.geometry.coordinates);
  const shown=filterStations(state.stations,settings()).filter(s=>spectator.showStation(s.station_id));
  $('results-count').textContent=`${shown.length} station${shown.length===1?'':'s'}`;
  const list=$('stations');list.replaceChildren();
  if(!shown.length){const p=document.createElement('p');p.className='empty-state';p.textContent='No stations match. Try widening the distance or changing the filters.';list.append(p);}
  for(const s of shown){const card=document.createElement('div');card.className=`station-card ${state.selected===s.station_id?'selected':''} ${spectator.isChosen(s.station_id)?'chosen':''}`;card.dataset.id=s.station_id;card.innerHTML=`<label class="choose-station"><input type="checkbox" aria-label="Select ${esc(s.name)}" ${spectator.isChosen(s.station_id)?'checked':''}><span class="sr-only">Select station</span></label><button class="station-open"><div class="card-top"><i class="dot ${stationColor(s)}" aria-hidden="true"></i><span class="station-name">${esc(s.name)}</span></div><div class="station-address">${esc(s.address)}</div><div class="counts"><div><strong>${count(s.bikes,s.renting)}</strong> <span>bikes</span></div><div><strong>${count(s.docks,s.returning)}</strong> <span>docks</span></div><span class="distance">~${feet(s)}<br>from course</span></div>${stationNote(s)?`<div class="station-note">${esc(stationNote(s))}</div>`:''}</button>`;card.querySelector('input').addEventListener('change',e=>spectator.toggleStation(s.station_id,e.target.checked));card.querySelector('button').addEventListener('click',()=>select(s.station_id));list.append(card);}

  if(!map)return;
  const openId=[...markerById].find(([,m])=>m.isPopupOpen())?.[0];
  pins.clearLayers();markerById=new Map();
  for(const s of shown){const stale=isStale(s),val=count(s.bikes,s.renting),marker=L.marker([s.lat,s.lon],{icon:L.divIcon({className:'station-pin',html:`<span class="pin ${stationColor(s)} ${spectator.isChosen(s.station_id)?'chosen':''} ${stale&&s.bikes!==null?'stale':''}">${val}</span>`,iconSize:[31,31],iconAnchor:[15,15]}),title:`${s.name}: ${val} bikes${stale?' (stale or unknown)':''}`,keyboard:true}).bindPopup(popup(s)).addTo(pins);marker.on('click',()=>select(s.station_id,false));markerById.set(s.station_id,marker);}
  if(openId&&markerById.has(openId))markerById.get(openId).openPopup();
  updateHealth();spectator.refresh();
}
async function refresh() {
  if(state.loading)return;state.loading=true;$('refresh').disabled=true;updateHealth();
  try {const status=validStatus(await json(`${FEED}station_status.json`));state.status=status;state.failed=false;state.lastSuccess=Date.now();try{localStorage.setItem('philly-half-status-v1',JSON.stringify(status));}catch{} }
  catch(e) {state.failed=true;console.warn('Indego availability request failed',e);}
  finally{state.loading=false;$('refresh').disabled=false;render();updateHealth();}
}
async function start() {
  try {
    const infoPromise=json(`${FEED}station_information.json`).then(validInformation).catch(()=>json('data/stations.json').then(validInformation));
    [state.route,state.information]=await Promise.all([json('data/route.geojson'),infoPromise]);
    try{const saved=JSON.parse(localStorage.getItem('philly-half-status-v1'));if(saved)state.status=validStatus(saved);}catch{}
    if(window.L){map=L.map('map',{zoomControl:false,zoomSnap:0.25});L.control.zoom({position:'topright'}).addTo(map);L.control.scale({position:'bottomright',imperial:true,metric:false}).addTo(map);const tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(map);let tileErrors=0;tiles.on('tileerror',()=>{if(++tileErrors===4)notice('The street basemap could not load. Station positions and the course are still shown.');});L.geoJSON(state.route,{style:{color:'#fff',weight:8,opacity:.9}}).addTo(map);course=L.geoJSON(state.route,{style:{color:'#20594c',weight:4,opacity:.95}}).addTo(map).bindTooltip('Approximate 2026 half marathon course');pins=L.layerGroup().addTo(map);const coordinates=state.route.geometry.coordinates;for(const [text,pt] of [['START',coordinates[0]],['FINISH',coordinates.at(-1)]])L.marker([pt[1],pt[0]],{icon:L.divIcon({className:'',html:`<span class="endpoint">${text}</span>`,iconSize:[53,24],iconAnchor:[26,27]}),zIndexOffset:1000}).addTo(map);map.fitBounds(course.getBounds(),{padding:[25,40],animate:false});map.on('resize',()=>{if(!state.selected)map.fitBounds(course.getBounds(),{padding:[25,40],animate:false});});}
    else notice('The interactive map could not load. You can still browse station availability below.');
    spectator.ready();render();await refresh();if(state.selected)select(state.selected);setInterval(()=>{if(!document.hidden)refresh();},60000);setInterval(updateHealth,15000);
  } catch(e) {startupError=true;$('live-label').textContent='Could not load the map';$('updated').textContent='Check your connection, then reload this page.';$('results-count').textContent='Stations unavailable';notice('Map data could not load. Please reload the page.');console.error(e);}
}
for(const id of ['search','distance','availability','sort'])$(id).addEventListener(id==='search'?'input':'change',()=>{saveURL();render();});
$('refresh').addEventListener('click',()=>startupError?location.reload():refresh());
$('fit').addEventListener('click',()=>{if(map&&course){map.closePopup();state.selected=null;saveURL();document.querySelectorAll('.station-card.selected').forEach(c=>c.classList.remove('selected'));map.fitBounds(course.getBounds(),{padding:[25,40],animate:false});}});
$('share').addEventListener('click',()=>{saveURL();$('share-link').value=spectator.shareURL();$('system-share').hidden=!navigator.share;$('share-dialog').showModal();$('share-link').focus();$('share-link').select();});
$('close-share').addEventListener('click',()=>$('share-dialog').close());
$('copy-plan').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('share-link').value);toast('Map and plan link copied. Ready to share.');}catch{$('share-link').focus();$('share-link').select();toast('The link is selected. Use your browser’s Copy command.');}});
$('system-share').addEventListener('click',async()=>{try{await navigator.share({title:'Along the Course · Philly Half + Indego',url:$('share-link').value});}catch(e){if(e.name!=='AbortError')toast('Use Copy link to share this plan.');}});
$('locate').addEventListener('click',()=>{if(!map)return toast('The map is unavailable.');if(!navigator.geolocation)return toast('Location is not supported by this browser.');navigator.geolocation.getCurrentPosition(pos=>{const ll=[pos.coords.latitude,pos.coords.longitude];if(userMarker)userMarker.remove();userMarker=L.circleMarker(ll,{radius:8,color:'#fff',weight:3,fillColor:'#3266ce',fillOpacity:1}).addTo(map).bindPopup('Your location');map.setView(ll,16);},()=>toast('Location unavailable. Allow location access or search for a nearby street.'),{enableHighAccuracy:true,timeout:10000,maximumAge:60000});});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
const spectator=createSpectator({getMap:()=>map,getStations:()=>state.stations,getRoute:()=>state.route,onSelectionChange:render,toast});
start();
