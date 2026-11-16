export const RACE_MILES = 13.1;
export const COLORS = ['#7256bb','#d6516d','#247ba0','#b16a14','#337b46','#aa4b9c','#3c6097','#9d4e26'];
export function parsePace(value) {const m=String(value).trim().match(/^(\d{1,2}):([0-5]\d)$/);if(!m)return null;const seconds=Number(m[1])*60+Number(m[2]);return seconds>=180&&seconds<=1800?seconds:null;}
export function parseClock(value) {const m=String(value).match(/^(\d{2}):([0-5]\d)$/);return m&&Number(m[1])<24?Number(m[1])*60+Number(m[2]):null;}
export function clockValue(minutes) {return `${String(Math.floor(minutes/60)%24).padStart(2,'0')}:${String(Math.floor(minutes%60)).padStart(2,'0')}`;}
export function clockLabel(minutes) {const rounded=Math.round(minutes),hours=Math.floor(rounded/60);return `${hours%12||12}:${String((rounded%60+60)%60).padStart(2,'0')} ${hours>=12?'PM':'AM'}`;}
export function metres(a,b) {return Math.hypot((b[0]-a[0])*111320*Math.cos((a[1]+b[1])/2*Math.PI/180),(b[1]-a[1])*111320);}
export function routeModel(feature) {
  const coords=feature.geometry.coordinates, cumulative=[0];for(let i=1;i<coords.length;i++)cumulative.push(cumulative.at(-1)+metres(coords[i-1],coords[i]));
  // Published water-stop mileages calibrate the simplified trace; the locations remain approximate.
  const anchors=feature.properties.mileAnchors || [{index:0,mile:0},{index:coords.length-1,mile:RACE_MILES}];
  const atIndex=index=>{const i=Math.floor(index);return cumulative[i]+(cumulative[Math.min(i+1,coords.length-1)]-cumulative[i])*(index-i);};
  const knots=anchors.map(a=>({metres:atIndex(a.index),mile:a.mile}));
  const toMile=m=>{let i=knots.findIndex(k=>k.metres>=m);if(i<=0)return i===0?0:RACE_MILES;const a=knots[i-1],b=knots[i];return a.mile+(b.mile-a.mile)*(m-a.metres)/(b.metres-a.metres);};
  const toMetres=mile=>{let i=knots.findIndex(k=>k.mile>=mile);if(i<=0)return i===0?0:cumulative.at(-1);const a=knots[i-1],b=knots[i];return a.metres+(b.metres-a.metres)*(mile-a.mile)/(b.mile-a.mile);};
  return {coords,cumulative,toMile,toMetres};
}
export function pointAtMile(model,mile) {const d=model.toMetres(Math.max(0,Math.min(RACE_MILES,mile)));let i=model.cumulative.findIndex(v=>v>=d);if(i<=0)return model.coords[0];const a=model.coords[i-1],b=model.coords[i],t=(d-model.cumulative[i-1])/(model.cumulative[i]-model.cumulative[i-1]||1);return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];}
export function stationPasses(station, model, radius=300) {
  const p=[station.lon,station.lat], x=111320*Math.cos(p[1]*Math.PI/180),y=111320,candidates=[];
  for(let i=0;i<model.coords.length-1;i++){
    const a=model.coords[i],b=model.coords[i+1],ax=(a[0]-p[0])*x,ay=(a[1]-p[1])*y,dx=(b[0]-a[0])*x,dy=(b[1]-a[1])*y;
    const t=Math.max(0,Math.min(1,-(ax*dx+ay*dy)/(dx*dx+dy*dy||1))),distance=Math.hypot(ax+t*dx,ay+t*dy);
    if(distance<=radius)candidates.push({mile:model.toMile(model.cumulative[i]+(model.cumulative[i+1]-model.cumulative[i])*t),distance,point:[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]});
  }
  const groups=[];for(const c of candidates){const last=groups.at(-1);if(last&&c.mile-last.at(-1).mile<.3)last.push(c);else groups.push([c]);}
  return groups.map(g=>g.reduce((a,b)=>a.distance<b.distance?a:b));
}
export function arrival(runner,mile) {const anchorMile=runner.anchorMile??0,anchorTime=runner.anchorTime??runner.start;if(anchorMile>0&&mile<=anchorMile)return runner.start+(anchorTime-runner.start)*mile/anchorMile;return anchorTime+(mile-anchorMile)*runner.pace/60;}
export function runnerAt(runner,minutes) {if(minutes<runner.start)return {mile:0,status:'Not started'};const mile=runner.anchorMile!=null&&minutes>=runner.anchorTime?runner.anchorMile+(minutes-runner.anchorTime)*60/runner.pace:runner.anchorMile!=null?runner.anchorMile*(minutes-runner.start)/(runner.anchorTime-runner.start||1):(minutes-runner.start)*60/runner.pace;return {mile:Math.max(0,Math.min(RACE_MILES,mile)),status:mile>=RACE_MILES?'Projected finished':'Projected'};}
export function sightings(runners,stops,buffer=3) {
  return stops.flatMap(stop=>runners.map(runner=>({id:`${stop.id}:${runner.id}`,stop,runner,time:arrival(runner,stop.mile),start:arrival(runner,stop.mile)-buffer,end:arrival(runner,stop.mile)+buffer}))).sort((a,b)=>a.time-b.time);
}
export function travelMinutes(a,b,{speed=10,detour=1.5,setup=5,mode='bike'}={}) {if(a.id===b.id)return 0;const miles=metres(a.point,b.point)/1609.344;return miles*detour/speed*60+(mode==='bike'?setup:0);}
export function buildItinerary(events,options={}) {
  const {buffer=3,from=420,speed=10,detour=1.5,setup=5,mode='bike'}=options;
  // Each event is one possible sighting. A chronological DAG allows overlapping
  // wait windows at the same stop, while transfers require the full buffer.
  const nodes=events.filter(e=>e.time>=from).map(e=>({...e,start:Math.max(from,e.time-buffer),end:e.time+buffer})).sort((a,b)=>a.time-b.time);
  const scores=[],previous=[];
  for(let j=0;j<nodes.length;j++){scores[j]=1;previous[j]=-1;for(let i=0;i<j;i++){
    const same=nodes[i].stop.id===nodes[j].stop.id;
    const travel=same?0:travelMinutes(nodes[i].stop,nodes[j].stop,{speed,detour,setup,mode});
    if((same||nodes[i].end+travel<=nodes[j].start)&&scores[i]+1>scores[j]){scores[j]=scores[i]+1;previous[j]=i;}
  }}
  if(!nodes.length)return [];
  let last=scores.indexOf(Math.max(...scores));const path=[];while(last>=0){path.unshift(nodes[last]);last=previous[last];}
  const result=[];for(const e of path){const prior=result.at(-1);if(prior?.stop.id===e.stop.id){prior.events.push(e);prior.end=e.end;}else result.push({stop:e.stop,start:e.start,end:e.end,events:[e]});}
  return result.map((v,i)=>({...v,travel:i?travelMinutes(result[i-1].stop,v.stop,{speed,detour,setup,mode}):0}));
}
export function validRunner(r) {return r&&typeof r.id==='string'&&typeof r.name==='string'&&r.name.length<=60&&Number.isFinite(r.pace)&&r.pace>=180&&r.pace<=1800&&Number.isFinite(r.start)&&r.start>=360&&r.start<=720&&(r.anchorMile==null||Number.isFinite(r.anchorMile)&&r.anchorMile>=0&&r.anchorMile<=RACE_MILES&&Number.isFinite(r.anchorTime)&&r.anchorTime>=r.start&&(r.anchorMile===0||r.anchorTime>r.start)&&r.anchorTime<1440);}
export function validStop(s) {return s&&typeof s.id==='string'&&typeof s.name==='string'&&s.name.length<=200&&Number.isFinite(s.mile)&&s.mile>=0&&s.mile<=RACE_MILES&&Array.isArray(s.point)&&s.point.length===2&&Number.isFinite(s.point[0])&&Number.isFinite(s.point[1])&&s.point[0]>-75.3&&s.point[0]<-75.0&&s.point[1]>39.8&&s.point[1]<40.1;}

export function automaticStops(stations,model,chosen=new Set()) {
  const eligible=stations.filter(s=>chosen.size?chosen.has(s.station_id):s.distance<=300);
  let passes=eligible.flatMap(s=>stationPasses(s,model,300).map(p=>({id:`${s.station_id}-${Math.round(p.mile*100)}`,name:s.name,mile:p.mile,point:p.point,stationId:s.station_id,accessMetres:p.distance})));
  passes.sort((a,b)=>a.mile-b.mile||a.accessMetres-b.accessMetres);
  if(chosen.size){const result=[];for(const p of passes){const near=result.findIndex(s=>Math.abs(s.mile-p.mile)<.18);if(near<0)result.push(p);else if(p.accessMetres<result[near].accessMetres)result[near]=p;}if(result.length<=20)return result;return Array.from({length:20},(_,i)=>result[Math.round(i*(result.length-1)/19)]);}
  const stops=[];
  for(const target of [.7,2,3.5,4.8,6.3,7.6,8.8,10,12,13.1]){
    const options=passes.filter(p=>Math.abs(p.mile-target)<=.8&&!stops.some(s=>Math.abs(s.mile-p.mile)<.3)).sort((a,b)=>(Math.abs(a.mile-target)+a.accessMetres/1400)-(Math.abs(b.mile-target)+b.accessMetres/1400));if(options.length)stops.push(options[0]);
  }
  return stops.sort((a,b)=>a.mile-b.mile);
}
export function fairCoverage(plan,runners) {const counts=Object.fromEntries(runners.map(r=>[r.id,0]));for(const visit of plan)for(const event of visit.events)counts[event.runner.id]=(counts[event.runner.id]||0)+1;return counts;}
export function buildFairItinerary(events,runners,options={}) {
  const {buffer=3,from=420,speed=10,detour=1.5,setup=5,mode='bike',maxVisits=4,target=3,beam=16}=options;
  const indexes=new Map(runners.map((r,i)=>[r.id,i]));
  const nodes=events.filter(e=>e.time>=from&&indexes.has(e.runner.id)).map(e=>({...e,start:Math.max(from,e.time-buffer),end:e.time+buffer})).sort((a,b)=>a.time-b.time);
  if(!nodes.length||!runners.length)return [];
  const travel=new Map(),getTravel=(a,b)=>{const key=`${a.id}|${b.id}`;if(!travel.has(key))travel.set(key,travelMinutes(a,b,{speed,detour,setup,mode}));return travel.get(key);};
  // Compare coverage before repeat sightings: everyone once, then twice, then three times.
  const compare=(a,b)=>{for(let i=0;i<target;i++)if(a.levels[i]!==b.levels[i])return b.levels[i]-a.levels[i];return a.visits-b.visits||a.travel-b.travel;};
  const states=[];let best=null;
  for(let j=0;j<nodes.length;j++){
    const racer=indexes.get(nodes[j].runner.id),candidates=new Map();
    function add(previous,travelTime,visits){const counts=previous?previous.counts.slice():Array(runners.length).fill(0);if(counts[racer]>=target||visits>maxVisits)return;const levels=previous?previous.levels.slice():Array(target).fill(0);levels[counts[racer]]++;counts[racer]++;const state={counts,levels,visits,travel:(previous?.travel||0)+travelTime,previous,index:j};const key=counts.join(',');const existing=candidates.get(key);if(!existing||compare(state,existing)<0)candidates.set(key,state);}
    add(null,0,1);
    for(let i=0;i<j;i++){const same=nodes[i].stop.id===nodes[j].stop.id,minutes=same?0:getTravel(nodes[i].stop,nodes[j].stop);if(!same&&nodes[i].end+minutes>nodes[j].start)continue;for(const prior of states[i])add(prior,minutes,prior.visits+(same?0:1));}
    states[j]=[...candidates.values()].sort(compare).slice(0,beam);
    for(const state of states[j])if(!best||compare(state,best)<0)best=state;
  }
  const path=[];for(let s=best;s;s=s.previous)path.unshift(nodes[s.index]);
  const result=[];for(const event of path){const last=result.at(-1);if(last?.stop.id===event.stop.id){last.events.push(event);last.end=event.end;}else result.push({stop:event.stop,start:event.start,end:event.end,events:[event]});}
  return result.map((v,i)=>({...v,travel:i?getTravel(result[i-1].stop,v.stop):0}));
}
