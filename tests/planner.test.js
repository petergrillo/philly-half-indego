import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {parsePace,parseClock,routeModel,pointAtMile,stationPasses,arrival,runnerAt,sightings,buildItinerary,travelMinutes,validRunner} from '../planner.js';
const route=JSON.parse(fs.readFileSync(new URL('../data/route.geojson',import.meta.url))),model=routeModel(route);
const alex={id:'a',name:'Alex',pace:540,start:420},sam={id:'b',name:'Sam',pace:600,start:430};
const stops=[{id:'one',name:'First',mile:2,point:[-75.16,39.95]},{id:'two',name:'Next',mile:6,point:[-75.161,39.951]}];
test('paces and clock input reject invalid values',()=>{assert.equal(parsePace('9:30'),570);assert.equal(parsePace('9:75'),null);assert.equal(parsePace('0:00'),null);assert.equal(parseClock('07:10'),430);assert.equal(parseClock('25:00'),null);});
test('independent starts and pace produce correct arrivals',()=>{assert.equal(arrival(alex,5),465);assert.equal(arrival(sam,5),480);assert.equal(runnerAt(alex,419).status,'Not started');assert.equal(runnerAt(alex,465).mile,5);assert.equal(runnerAt(alex,600).mile,13.1);});
test('observed split anchors subsequent predictions and interpolates earlier progress',()=>{const r={...alex,anchorMile:6,anchorTime:480};assert.equal(arrival(r,7),489);assert.equal(arrival(r,3),450);assert.equal(runnerAt(r,450).mile,3);assert.equal(runnerAt(r,489).mile,7);assert.ok(validRunner(r));assert.equal(validRunner({...r,anchorTime:410}),false);assert.equal(validRunner({...r,anchorTime:420}),false);});
test('mile model preserves start, finish and calibration anchors',()=>{assert.deepEqual(pointAtMile(model,0),route.geometry.coordinates[0]);assert.deepEqual(pointAtMile(model,13.1),route.geometry.coordinates.at(-1));assert.ok(Math.abs(model.toMile(model.cumulative[18])-6.3)<.001);for(let m=0;m<13.1;m+=.5)assert.ok(Math.abs(model.toMile(model.toMetres(m))-m)<.001);});
test('station near separate passes yields distinct viewing opportunities',()=>{const f={geometry:{coordinates:[[0,0],[.01,0],[.01,.02],[0,.02],[0,.001]]},properties:{}},m=routeModel(f);const passes=stationPasses({lon:0,lat:0},m,150);assert.equal(passes.length,2);assert.ok(passes[1].mile>10);});
test('itinerary accounts for buffers and avoids impossible transfers',()=>{const events=sightings([alex,sam],stops,3),plan=buildItinerary(events,{from:420,buffer:3,speed:10,setup:5,detour:1.5});for(let i=1;i<plan.length;i++)assert.ok(plan[i-1].end+plan[i].travel<=plan[i].start);const ids=plan.flatMap(v=>v.events.map(e=>e.id));assert.equal(new Set(ids).size,ids.length);assert.ok(ids.length>=3);assert.equal(travelMinutes(stops[0],stops[0]),0);});
test('optimization chooses more sightings over an early dead end',()=>{const a={id:'x',mile:1,point:[-75.3,39.9]},b={id:'y',mile:2,point:[-75.14,39.96]};const events=[{id:'1',stop:a,runner:alex,time:430},{id:'2',stop:b,runner:alex,time:435},{id:'3',stop:b,runner:sam,time:438}];const plan=buildItinerary(events,{from:420,buffer:3,speed:3,mode:'walk',detour:2});assert.equal(plan.reduce((n,v)=>n+v.events.length,0),2);assert.equal(plan[0].stop.id,'y');});
test('overlapping sighting windows at one stop can all be covered by waiting',()=>{const point=stops[0],events=[430,435,440].map((time,i)=>({id:String(i),stop:point,runner:alex,time}));const plan=buildItinerary(events,{from:420,buffer:3});assert.equal(plan.length,1);assert.equal(plan[0].events.length,3);assert.equal(plan[0].start,427);assert.equal(plan[0].end,443);});
test('a sighting at the selected start time remains eligible',()=>{const plan=buildItinerary([{id:'now',stop:stops[0],runner:alex,time:420}],{from:420,buffer:3});assert.equal(plan.length,1);assert.equal(plan[0].start,420);});

import {buildFairItinerary,fairCoverage,automaticStops} from '../planner.js';
test('fair planning sees everyone before collecting extra sightings of one friend',()=>{
 const x={id:'west',point:[-75.27,39.9]},y={id:'east',point:[-75.14,39.96]};
 const events=[{id:'a1',runner:alex,stop:x,time:430},{id:'a2',runner:alex,stop:x,time:440},{id:'a3',runner:alex,stop:x,time:450},{id:'b1',runner:sam,stop:y,time:435},{id:'a4',runner:alex,stop:y,time:434}];
 const plan=buildFairItinerary(events,[alex,sam],{from:420,mode:'walk',speed:3,detour:2});assert.deepEqual(fairCoverage(plan,[alex,sam]),{a:1,b:1});
});
test('fair planning balances second sightings before a third',()=>{
 const x={id:'west',point:[-75.27,39.9]},y={id:'east',point:[-75.14,39.96]};
 const entries=[[x,alex,430],[x,alex,440],[x,alex,450],[x,sam,435],[y,alex,432],[y,alex,442],[y,sam,436],[y,sam,446]];
 const events=entries.map(([stop,runner,time],i)=>({id:String(i),stop,runner,time}));const plan=buildFairItinerary(events,[alex,sam],{from:420,mode:'walk',speed:3,detour:2});assert.deepEqual(fairCoverage(plan,[alex,sam]),{a:2,b:2});
});
test('fair plans respect transfer windows, visit limit, and three sightings per racer',()=>{
 const places=Array.from({length:8},(_,i)=>({id:'p'+i,mile:i+1,point:[-75.16+i*.001,39.95]})),events=sightings([alex,sam],places,3),plan=buildFairItinerary(events,[alex,sam],{from:420,maxVisits:4});assert.ok(plan.length<=4);for(let i=1;i<plan.length;i++)assert.ok(plan[i-1].end+plan[i].travel<=plan[i].start);const counts=fairCoverage(plan,[alex,sam]);assert.ok(counts.a<=3&&counts.b<=3);assert.equal(counts.a,counts.b);
});
test('pinning narrows automatic viewing options to the pinned station',()=>{
 const station={station_id:'museum',name:'Museum',lon:-75.17987,lat:39.96439,distance:100};const selected=automaticStops([station],model,new Set(['museum']));assert.ok(selected.length>0);assert.ok(selected.every(s=>s.stationId==='museum'));assert.equal(automaticStops([station],model,new Set(['other'])).length,0);
});
