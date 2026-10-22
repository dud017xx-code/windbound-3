import {BUILTIN_MAP,normalizeMap,mapFingerprint} from './map-schema.js?v=workshop-v1';
export const ITEMS = [
 {id:'wind',icon:'↗',name:'疾风瓶',type:'加速',desc:'乘风加速 3 秒。起跳后使用，也能飞越更远的断桥。'},
 {id:'shield',icon:'◈',name:'星环盾',type:'防御',desc:'持续 6 秒，抵挡一次对手攻击或陷阱。'},
 {id:'bolt',icon:'➶',name:'追风羽',type:'攻击',desc:'追击前方对手。攻击前有预警，横移或跳跃可躲开。'},
 {id:'ice',icon:'❄',name:'霜花印',type:'陷阱',desc:'在身后放下冰霜陷阱，踩中者短暂减速。'},
 {id:'pulse',icon:'✺',name:'回响铃',type:'近身',desc:'释放风之脉冲，干扰 16 米内的对手。'},
 {id:'spring',icon:'↑',name:'跃云靴',type:'跑酷',desc:'立即高高跃起，随后 5 秒获得更强的跳跃力。'},
 {id:'magnet',icon:'✧',name:'引星石',type:'收集',desc:'8 秒内自动吸引附近风晶，快速补充冲刺风能。'},
 {id:'blink',icon:'⌁',name:'跃迁叶',type:'位移',desc:'向前瞬移 16 米，自动避开落点处的断桥。'}
];
export const GAPS = [[.205,.218],[.545,.557],[.79,.8]];
export const BOX_FRACTIONS = [.04,.095,.16,.255,.3,.375,.445,.5,.6,.665,.735,.845,.91,.965];
export const OBSTACLES = [.125,.465,.695,.87];
export const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export const fraction=(r,s)=>((s/r.length)%1+1)%1;
export const near=(a,b,length)=>{let d=a-b;while(d>length/2)d-=length;while(d< -length/2)d+=length;return d;};
export function supported(r,s,lane){const f=fraction(r,s);const gaps=r.gaps??GAPS;if(Math.abs(lane)>4.65)return false;if(gaps.some(([a,b])=>f>a&&f<b))return false;if(r.shortcut!==false&&f>.315&&f<.425){if(lane>.5&&lane<2.1)return false;if(lane>=2.1&&((f>.35&&f<.359)||(f>.39&&f<.399)))return false;}return true;}
function random(r){r.seed=(Math.imul(r.seed,1664525)+1013904223)>>>0;return r.seed/4294967296;}
function runner(id,name,lane){return {id,name,s:0,lane,speed:0,y:0,vy:0,jumps:0,energy:100,dash:0,boost:0,shield:0,slow:0,spring:0,magnet:0,fall:0,lastSafe:0,inventory:[null,null],crystals:0,finish:null,ack:0,hitAt:-10,itemAt:7,aiJumpAt:-10};}
export function createRace(length,difficulty=0,online=false,seed=812,map=BUILTIN_MAP){const course=normalizeMap(map);return {length,laps:course.laps,mapId:mapFingerprint(course),gaps:course.gaps,obstacles:course.obstacles,shortcut:course.shortcut,difficulty,online,seed,phase:'countdown',countdown:3.2,time:0,tick:0,runners:[runner(0,online?'房主':'你',-1.8),runner(1,online?'朋友':'岚 · 电脑',1.8)],boxes:course.boxes.map(([t,lane])=>({s:t*length,lane,cool:0})),crystals:Array.from({length:course.crystals},(_,i)=>({s:((i+.5)/course.crystals)*length,lane:Math.sin(i*.7)*2.8,cool:0})),traps:[],bolts:[],events:[],eventId:0,winner:null};}
function emit(r,type,data={}){r.events.push({id:++r.eventId,type,t:r.time,...data});if(r.events.length>24)r.events.shift();}
export function jump(r,id){const p=r.runners[id];if(r.phase!=='racing'||p.fall>0||p.finish!==null||p.jumps>=2)return false;p.vy=p.spring>0?15:p.jumps===0?10.3:9.2;p.jumps++;emit(r,'jump',{who:id});return true;}
export function dash(r,id){const p=r.runners[id];if(r.phase!=='racing'||p.energy<35||p.dash>0||p.fall>0||p.finish!==null)return false;p.energy-=35;p.dash=.62;if(p.y>.1)p.vy=Math.max(p.vy,2.8);emit(r,'dash',{who:id});return true;}
function hit(r,id,kind,from){const p=r.runners[id];if(p.finish!==null||r.time-p.hitAt<1)return;if(p.shield>0){p.shield=0;emit(r,'block',{who:id});return;}p.slow=kind==='ice'?1.9:1.3;p.speed*=.55;p.hitAt=r.time;emit(r,'hit',{who:id,kind,from});}
export function useItem(r,id,slot){const p=r.runners[id],item=p.inventory[slot];if(r.phase!=='racing'||p.finish!==null||p.fall>0||!ITEMS.some(x=>x.id===item))return false;p.inventory[slot]=null;const other=r.runners[1-id];
 if(item==='wind')p.boost=3;
 if(item==='shield')p.shield=6;
 if(item==='bolt'){r.bolts.push({from:id,target:1-id,delay:.9+clamp(Math.abs(other.s-p.s)/65,0,1.4),lane:other.lane,source:p.s});emit(r,'warning',{who:1-id});}
 if(item==='ice')r.traps.push({from:id,s:p.s-4,lane:p.lane,life:15});
 if(item==='pulse'&&Math.abs(other.s-p.s)<16){hit(r,1-id,'pulse',id);}
 if(item==='spring'){p.spring=5;p.vy=15;p.jumps=1;}
 if(item==='magnet')p.magnet=8;
 if(item==='blink'){let next=p.s+16;for(let n=0;n<35&&!supported(r,next,0);n++)next++;p.s=Math.min(next,r.length*(r.laps||2)-.1);p.y=Math.max(p.y,.7);p.vy=3;p.lane=0;}
 emit(r,'item',{who:id,item});return true;
}
export function advanceRunner(r,p,input,dt){if(p.finish!==null)return;const f=fraction(r,p.s);for(const key of ['dash','boost','shield','slow','spring','magnet'])p[key]=Math.max(0,p[key]-dt);
 if(p.fall>0){p.fall=Math.max(0,p.fall-dt);p.y-=10*dt;p.speed=0;if(p.fall<=0){p.s=Math.max(0,p.lastSafe-3);p.lane=0;for(let n=0;n<30&&!supported(r,p.s,0);n++)p.s--;p.y=0;p.vy=0;p.jumps=0;emit(r,'respawn',{who:p.id});}return;}
 p.energy=clamp(p.energy+9*dt,0,100);p.lane=clamp(p.lane+clamp(input.side||0,-1,1)*8.2*dt,-5.9,5.9);
 const move=clamp(input.forward||0,0,1),target=move*(p.dash>0?32:p.boost>0?27:18.5)*(p.slow>0?.43:1);
 p.speed+=(target-p.speed)*(1-Math.exp(-dt*(target>p.speed?6:8)));
 const shortcut=r.shortcut!==false&&f>.315&&f<.425&&p.lane>=2.1;
 p.s+=p.speed*dt*(shortcut?1.24:1);p.vy-=25*dt;p.y+=p.vy*dt;
 const ground=supported(r,p.s,p.lane);
 if(p.y<=0&&ground){p.y=0;p.vy=0;p.jumps=0;if(Math.abs(p.lane)<4.3)p.lastSafe=p.s;}
 if(p.y<-.65){p.fall=.8;emit(r,'fall',{who:p.id});}
 for(let i=0;i<r.obstacles.length;i++){const o=r.obstacles[i],d=Math.abs(near(p.s,o.t*r.length,r.length)),lane=obstacleLane(r,o,i);if(d<1.25&&Math.abs(p.lane-lane)<1.15&&p.y<1.1)hit(r,p.id,'bar',null);}
 if(p.s>=r.length*(r.laps||2)){p.s=r.length*(r.laps||2);p.finish=r.time;p.speed=0;if(r.winner===null)r.winner=p.id;emit(r,'finish',{who:p.id});}
}
function aiInput(r,p,dt){const other=r.runners[0],f=fraction(r,p.s);let targetLane=Math.sin(r.time*.48)*2.2;
 const nextBox=r.boxes.find(b=>b.cool<=0&&near(b.s,p.s,r.length)>0&&near(b.s,p.s,r.length)<22);if(nextBox&&p.inventory.includes(null))targetLane=nextBox.lane;
 if(r.shortcut!==false&&f>.295&&f<.43)targetLane=r.difficulty===2?3.2:-2;
 if(f>.43&&f<.46)targetLane=-2;
 const side=clamp((targetLane-p.lane)*1.6,-1,1);
 const aheadGap=r.gaps.some(([a,b])=>f>a-8/r.length&&f<b);
 const sideGap=r.shortcut!==false&&p.lane>2.1&&((f>.35-8/r.length&&f<.359)||(f>.39-8/r.length&&f<.399));
 const aheadBar=r.obstacles.some(g=>near(g.t*r.length,p.s,r.length)>0&&near(g.t*r.length,p.s,r.length)<7);
 if((aheadGap||sideGap||aheadBar)&&p.y===0&&r.time-p.aiJumpAt>.7){jump(r,1);p.aiJumpAt=r.time;}
 if(p.energy>=65&&p.y===0&&f<.95&&supported(r,p.s+15,p.lane))dash(r,1);
 if(r.bolts.some(b=>b.target===1&&b.delay<.65)&&p.y===0&&r.difficulty>0)jump(r,1);
 if(r.time>p.itemAt){const index=p.inventory.findIndex(Boolean);if(index>=0)useItem(r,1,index);p.itemAt=r.time+2.6+random(r)*2.4;}
 return {side,forward:[.78,.92,1][r.difficulty]};
}
export function stepRace(r,inputs,dt){dt=clamp(dt,0,.05);if(r.phase==='finished')return;if(r.phase==='countdown'){r.countdown-=dt;if(r.countdown<=0){r.phase='racing';emit(r,'go');}return;}
 r.time+=dt;r.tick++;for(const b of r.boxes)b.cool=Math.max(0,b.cool-dt);for(const c of r.crystals)c.cool=Math.max(0,c.cool-dt);
 for(let id=0;id<2;id++){const p=r.runners[id],input=r.online?inputs[id]||{}:id===1?aiInput(r,p,dt):inputs[0]||{};advanceRunner(r,p,input,dt);
  if(p.fall>0||p.finish!==null)continue;
  for(const b of r.boxes)if(b.cool<=0&&p.inventory.includes(null)&&Math.abs(near(p.s,b.s,r.length))<2&&Math.abs(p.lane-b.lane)<1.7&&p.y<3){const behind=p.s<r.runners[1-id].s-20;const pool=behind?['wind','wind','blink','bolt','shield','spring','magnet']:ITEMS.map(x=>x.id);const item=pool[Math.floor(random(r)*pool.length)];p.inventory[p.inventory.indexOf(null)]=item;b.cool=5;emit(r,'pickup',{who:id,item});}
  for(const c of r.crystals)if(c.cool<=0&&Math.abs(near(p.s,c.s,r.length))<(p.magnet>0?15:1.7)&&Math.abs(p.lane-c.lane)<(p.magnet>0?8:1.1)&&p.y<4){c.cool=5;p.crystals++;p.energy=clamp(p.energy+8,0,100);emit(r,'crystal',{who:id});}
 }
 for(const t of r.traps){t.life-=dt;const p=r.runners[1-t.from];if(t.life>0&&Math.abs(near(p.s,t.s,r.length))<1.5&&Math.abs(p.lane-t.lane)<1.3&&p.y<1){hit(r,p.id,'ice',t.from);t.life=0;}}
 r.traps=r.traps.filter(t=>t.life>0);for(const b of r.bolts){b.delay-=dt;if(b.delay<=0){const p=r.runners[b.target];if(Math.abs(p.lane-b.lane)<1.7&&p.y<1.7)hit(r,p.id,'bolt',b.from);else emit(r,'dodge',{who:p.id});}}
 r.bolts=r.bolts.filter(b=>b.delay>0);if(r.runners.every(p=>p.finish!==null))r.phase='finished';
}
export function raceSnapshot(r){return {mapId:r.mapId,laps:r.laps,phase:r.phase,countdown:r.countdown,time:r.time,tick:r.tick,runners:r.runners.map(p=>({...p,inventory:[...p.inventory]})),boxes:r.boxes.map(b=>({...b})),crystals:r.crystals.map(c=>({...c})),traps:r.traps.map(t=>({...t})),bolts:r.bolts.map(b=>({...b})),events:r.events.map(e=>({...e})),eventId:r.eventId,winner:r.winner,seed:r.seed};}
export function applySnapshot(r,s){if(!s||s.mapId!==r.mapId||!Array.isArray(s.runners)||s.runners.length!==2||!Number.isFinite(s.time)||!Number.isFinite(s.tick)||s.tick<r.tick)return false;if(s.runners.some(p=>!Number.isFinite(p.s)||!Number.isFinite(p.lane)||!Number.isFinite(p.y)||!Array.isArray(p.inventory)))return false;Object.assign(r,s);return true;}
export function predictRunner(r,p,input,dt){advanceRunner({...r,runners:r.runners.map((v,i)=>i===p.id?p:{...v}),events:[],eventId:0},p,input,dt);}

export function obstacleLane(r,o,index){return o.moving?Math.sin(r.time*.9+index*1.7)*3.1:o.lane;}
