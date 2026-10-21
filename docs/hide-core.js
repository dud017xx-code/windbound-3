export const PROP_TYPES=[
 {id:'crate',name:'木箱',key:'1',radius:.57,height:1.12,color:'#b88755'},
 {id:'pot',name:'花盆',key:'2',radius:.43,height:1.27,color:'#d69b7d'},
 {id:'barrel',name:'酒桶',key:'3',radius:.52,height:1.3,color:'#9e744b'},
 {id:'statue',name:'小石像',key:'4',radius:.46,height:1.85,color:'#d1d8ca'}
];
export const WALLS=[
 {x:-16,z:-11,w:4.9,d:3.7,h:5.2},{x:15.8,z:-11,w:4.8,d:3.7,h:5.7},
 {x:-16,z:11,w:4.9,d:3.7,h:5.7},{x:16,z:11,w:4.9,d:3.7,h:5.2},
 {x:0,z:0,w:1.8,d:1.8,h:1.0},{x:-8,z:-1,w:2.3,d:1,h:.8},
 {x:8,z:-3,w:2.7,d:1.2,h:1.35},{x:-8,z:7,w:2.6,d:1.1,h:1.35},
 {x:2.5,z:9.8,w:3.4,d:.43,h:1.55},{x:-3.8,z:-8,w:.45,d:2.1,h:1.6}
];
const groups=[[-11,-5],[-8,-11],[3,-12],[9,-9],[13,-4],[16,0],[12,6],[8,13],[-2,14],[-10,12],[-14,5],[-17,0],[-5,3],[5,4],[-5,-4],[3,-6]];
export const SCENE_PROPS=groups.flatMap(([x,z],i)=>[
 {x,z,kind:i%4,rotation:(i%4)*Math.PI/2},
 {x:x+1.75,z:z+(i%2?1.6:-1.6),kind:(i+1)%4,rotation:0}
]);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const player=seat=>({seat,x:seat?7:0,z:seat?3:15,y:0,vy:0,yaw:seat?0:Math.PI,rotation:0,kind:0,hp:100,energy:100,escape:1,dash:0,inv:0,shotCool:0,regenDelay:0,reveal:0,trail:0,ready:false,seen:{fire:0,jump:0,escape:0,ready:0,rematch:0},moving:false});
export function blankHideInput(){return {seq:0,x:0,z:0,yaw:0,ax:0,ay:0,az:1,kind:0,turn:0,fire:0,jump:0,escape:0,ready:0,rematch:0,focused:true};}
export function normalizeHideInput(value){const p=blankHideInput();if(!value||typeof value!=='object')return p;for(const k of ['seq','fire','jump','escape','ready','rematch'])p[k]=Number.isSafeInteger(value[k])&&value[k]>=0?value[k]:0;for(const k of ['x','z','turn'])p[k]=Number.isFinite(value[k])?clamp(value[k],-1,1):0;for(const k of ['ax','ay','az'])p[k]=Number.isFinite(value[k])?clamp(value[k],-1,1):p[k];const length=Math.hypot(p.ax,p.ay,p.az);if(length>.001){p.ax/=length;p.ay/=length;p.az/=length;}p.yaw=Number.isFinite(value.yaw)?value.yaw%(2*Math.PI):0;p.kind=Number.isInteger(value.kind)?clamp(value.kind,0,3):0;p.focused=value.focused!==false;return p;}
export function createHideGame(){return {version:1,t:0,phase:'lobby',timer:0,round:1,set:0,seeker:0,scores:[0,0],players:[player(0),player(1)],events:[],eventId:0,pulse:30,winner:null,roundWinner:null,rematch:[false,false]};}
function event(s,kind,data={}){s.events.push({id:++s.eventId,kind,...data});if(s.events.length>18)s.events.splice(0,s.events.length-18);}
function beginRound(s){s.seeker=(s.set+s.round-1)%2;s.players=s.players.map((old,i)=>({...player(i),x:i===s.seeker?0:7,z:i===s.seeker?15:3,yaw:i===s.seeker?Math.PI:0,ready:true,seen:{...old.seen}}));s.timer=25;s.phase='prepare';s.pulse=30;s.roundWinner=null;event(s,'prepare',{round:s.round,seeker:s.seeker});}
function finishRound(s,winner,reason){s.scores[winner]++;s.roundWinner=winner;s.phase=s.round>=2?'finished':'roundEnd';s.timer=5;s.winner=s.phase==='finished'?(s.scores[0]===s.scores[1]?null:s.scores[0]>s.scores[1]?0:1):null;event(s,'round',{winner,reason});}
function boxHit(o,v,x,z,w,d,lo,hi,max=45){let near=0,far=max;for(const [a,b,c,e]of[[o.x,v.x,x-w,x+w],[o.y,v.y,lo,hi],[o.z,v.z,z-d,z+d]]){if(Math.abs(b)<1e-7){if(a<c||a>e)return Infinity;}else{let t0=(c-a)/b,t1=(e-a)/b;if(t0>t1)[t0,t1]=[t1,t0];near=Math.max(near,t0);far=Math.min(far,t1);if(near>far)return Infinity;}}return near;}
export function rayObstacle(o,v,max=45){let distance=max;if(v.y<-.00001)distance=Math.min(distance,Math.max(0,-o.y/v.y));for(const b of WALLS)distance=Math.min(distance,boxHit(o,v,b.x,b.z,b.w,b.d,0,b.h,max));for(const p of SCENE_PROPS){const shape=PROP_TYPES[p.kind];distance=Math.min(distance,boxHit(o,v,p.x,p.z,shape.radius,shape.radius,0,shape.height,max));}return distance;}
function collides(x,z,y,r){if(Math.abs(x)>21.3-r||Math.abs(z)>17.3-r)return true;for(const b of WALLS)if(y<b.h&&Math.abs(x-b.x)<b.w+r&&Math.abs(z-b.z)<b.d+r)return true;for(const p of SCENE_PROPS){const shape=PROP_TYPES[p.kind];if(y<shape.height&&Math.abs(x-p.x)<r+shape.radius&&Math.abs(z-p.z)<r+shape.radius)return true;}return false;}
function move(p,input,seeker,dt){p.yaw=input.yaw;if(!seeker){p.kind=input.kind;p.rotation+=input.turn*1.6*dt;}let x=input.x,z=input.z,n=Math.hypot(x,z);if(n>1){x/=n;z/=n;}p.moving=Math.hypot(x,z)>.04;const speed=p.dash>0?15:seeker?5.4:4.5,r=seeker?.38:.80,dx=x*speed*dt,dz=z*speed*dt;
 if(!collides(p.x+dx,p.z,0,r))p.x+=dx;if(!collides(p.x,p.z+dz,0,r))p.z+=dz;
 p.vy-=18*dt;p.y=Math.max(0,p.y+p.vy*dt);if(p.y<=0)p.vy=0;
 if(input.jump>p.seen.jump&&p.y<=0){p.vy=seeker?6.6:4.8;p.seen.jump=input.jump;}
}
function fire(s,c){const hunter=s.players[s.seeker],hider=s.players[1-s.seeker];if(c.fire<=hunter.seen.fire)return;hunter.seen.fire=c.fire;if(hunter.shotCool>0||hunter.energy<6)return;hunter.energy-=6;hunter.shotCool=.62;hunter.regenDelay=.8;const o={x:hunter.x+Math.sin(hunter.yaw)*.48,y:hunter.y+1.25,z:hunter.z+Math.cos(hunter.yaw)*.48},v={x:c.ax,y:c.ay,z:c.az};const wall=rayObstacle(o,v),shape=PROP_TYPES[hider.kind],target=boxHit(o,v,hider.x,hider.z,shape.radius,shape.radius,hider.y,hider.y+shape.height),hit=target<wall&&target<45;let distance=hit?target:wall;
 if(hit){if(hider.inv<=0){hider.hp=Math.max(0,hider.hp-50);hider.inv=.35;hider.reveal=1.2;event(s,'hit',{player:1-s.seeker,x:hider.x,y:hider.y,z:hider.z});if(hider.hp===0)finishRound(s,s.seeker,'caught');}}
 else{for(const p of SCENE_PROPS){const d=PROP_TYPES[p.kind],at=boxHit(o,v,p.x,p.z,d.radius,d.radius,0,d.height);if(Math.abs(at-wall)<.01){hunter.energy=Math.max(0,hunter.energy-12);event(s,'wrong');break;}}}
 event(s,'shot',{x:o.x,y:o.y,z:o.z,ex:o.x+v.x*distance,ey:o.y+v.y*distance,ez:o.z+v.z*distance,hit});
}
export function stepHide(s,controls,dt){dt=clamp(dt,0,.05);s.t+=dt;const input=controls.map(normalizeHideInput);
 if(s.phase==='lobby'){for(let i=0;i<2;i++)if(input[i].ready>s.players[i].seen.ready){s.players[i].ready=!s.players[i].ready;s.players[i].seen.ready=input[i].ready;}if(s.players.every(x=>x.ready))beginRound(s);return;}
 if(s.phase==='finished'){for(let i=0;i<2;i++)if(input[i].rematch>s.players[i].seen.rematch){s.rematch[i]=true;s.players[i].seen.rematch=input[i].rematch;}if(s.rematch.every(Boolean)){s.set++;s.round=1;s.scores=[0,0];s.rematch=[false,false];beginRound(s);}return;}
 if(s.phase==='roundEnd'){s.timer-=dt;if(s.timer<=0){s.round++;beginRound(s);}return;}
 for(let i=0;i<2;i++){const p=s.players[i];for(const k of ['dash','inv','shotCool','regenDelay','reveal','trail'])p[k]=Math.max(0,p[k]-dt);if(p.regenDelay===0)p.energy=Math.min(100,p.energy+9*dt);const seeker=i===s.seeker;
  if(s.phase==='prepare'&&seeker){p.moving=false;p.seen.fire=input[i].fire;p.seen.escape=input[i].escape;p.seen.jump=input[i].jump;continue;}
  if(!seeker&&s.phase==='hunt'&&input[i].escape>p.seen.escape){p.seen.escape=input[i].escape;if(p.escape>0){p.escape--;p.dash=.30;p.inv=.27;event(s,'escape',{x:p.x,z:p.z});}}
  move(p,input[i],seeker,dt);if(!seeker&&p.moving&&s.phase==='hunt'&&p.trail===0){p.trail=.23;event(s,'trail',{x:p.x,y:p.y,z:p.z});}
 }
 if(s.phase==='hunt')fire(s,input[s.seeker]);if(s.phase!=='hunt'&&s.phase!=='prepare')return;s.timer-=dt;
 if(s.phase==='prepare'&&s.timer<=0){s.phase='hunt';s.timer=180;event(s,'hunt');}
 else if(s.phase==='hunt'){s.pulse-=dt;if(s.pulse<=0){s.pulse=30;const p=s.players[1-s.seeker];event(s,'bell',{x:p.x,z:p.z});}if(s.timer<=0)finishRound(s,1-s.seeker,'timeout');}
}
