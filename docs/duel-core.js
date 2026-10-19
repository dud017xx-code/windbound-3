// Shared host simulation. Guests send controls, never positions, health or hit claims.
export const BLOCKS=[{x:-8,z:-3,w:1.3,d:2.8,h:2.8},{x:8,z:3,w:1.3,d:2.8,h:2.8},{x:-5,z:9,w:2.3,d:1.5,h:1.4},{x:5,z:-9,w:2.3,d:1.5,h:1.4}];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export const blankInput=()=>({seq:0,x:0,z:0,yaw:0,jump:0,dash:0,attack:0,heavy:0,weapon:'sword',ready:0,rematch:0,focused:true});
function fighter(i){return {x:0,y:0,z:i?7:-7,vy:0,yaw:i?Math.PI:0,hp:100,stamina:100,regen:0,weapon:'sword',action:'idle',timer:0,elapsed:0,dash:0,inv:0,cool:0,stun:0,buff:0,ready:false,air:2,jumps:0,seen:{jump:0,dash:0,attack:0,heavy:0,ready:0,rematch:0},dx:0,dz:0,speed:0};}
export function createMatch(){return {t:0,phase:'lobby',timer:0,round:1,scores:[0,0],players:[fighter(0),fighter(1)],shots:[],events:[],eventId:0,shotId:0,winner:null,roundWinner:null,rematch:[false,false]};}
function event(s,kind,p,extra={}){s.events.push({id:++s.eventId,kind,x:p.x,y:p.y,z:p.z,...extra});s.events=s.events.slice(-12);}
function resetRound(s){s.players=s.players.map((old,i)=>({...fighter(i),weapon:old.weapon,ready:true,seen:{...old.seen}}));s.shots=[];s.timer=3;s.phase='countdown';}
function finishRound(s,winner){s.roundWinner=winner;if(winner!==null)s.scores[winner]++;s.shots=[];s.phase=s.scores.some(n=>n>=2)?'finished':'roundEnd';s.timer=4;s.winner=s.phase==='finished'?s.scores[0]>s.scores[1]?0:1:null;event(s,'round',s.players[winner??0],{winner});}
function spend(p,n){if(p.stamina<n)return false;p.stamina-=n;p.regen=.8;return true;}
function hurt(s,from,to,damage,heavy=false){const p=s.players[to];if(p.inv>0){if(p.dash>0&&p.buff<=0){p.buff=3;p.stamina=Math.min(100,p.stamina+18);event(s,'dodge',p,{player:to});}return;}
 const a=s.players[from],counter=a.buff>0;if(counter){damage=Math.round(damage*1.45);a.buff=0;}
 p.hp=Math.max(0,p.hp-damage);p.inv=.16;p.stun=heavy?.42:.18;p.action='hurt';p.timer=p.stun;event(s,counter?'counter':'hit',p,{player:to,damage});
}
function inBlock(x,z,b,r=.38){return Math.abs(x-b.x)<b.w+r&&Math.abs(z-b.z)<b.d+r;}
function coverBetween(a,b){for(let j=1;j<12;j++){const t=j/12,x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t,y=a.y+1+(b.y-a.y)*t;if(BLOCKS.some(c=>y<c.h&&inBlock(x,z,c,0)))return true;}return false;}
function collide(p,ox,oz){for(const b of BLOCKS){if(p.y>=b.h+.03)continue;if(inBlock(p.x,p.z,b)){if(!inBlock(ox,p.z,b))p.x=ox;else if(!inBlock(p.x,oz,b))p.z=oz;else{p.x=ox;p.z=oz;}}}const r=Math.hypot(p.x,p.z);if(r>18.4){p.x*=18.4/r;p.z*=18.4/r;}}
export function normalizeInput(v){const o=blankInput();if(!v||typeof v!=='object')return o;for(const k of ['seq','jump','dash','attack','heavy','ready','rematch'])o[k]=Number.isSafeInteger(v[k])&&v[k]>=0?v[k]:0;for(const k of ['x','z'])o[k]=Number.isFinite(v[k])?clamp(v[k],-1,1):0;o.yaw=Number.isFinite(v.yaw)?v.yaw%(Math.PI*2):0;o.weapon=v.weapon==='gun'?'gun':'sword';o.focused=v.focused!==false;return o;}
export function step(s,controls,dt){dt=clamp(dt,0,.05);s.t+=dt;const inputs=controls.map(normalizeInput);
 if(s.phase==='lobby'){inputs.forEach((c,i)=>{if(c.ready>s.players[i].seen.ready){s.players[i].ready=!s.players[i].ready;s.players[i].seen.ready=c.ready;}s.players[i].weapon=c.weapon;});if(s.players.every(p=>p.ready))resetRound(s);return;}
 if(s.phase==='finished'){inputs.forEach((c,i)=>{if(c.rematch>s.players[i].seen.rematch){s.rematch[i]=true;s.players[i].seen.rematch=c.rematch;}});if(s.rematch.every(Boolean)){s.scores=[0,0];s.round=1;s.rematch=[false,false];resetRound(s);}return;}
 if(s.phase==='countdown'||s.phase==='roundEnd'){s.timer-=dt;inputs.forEach((c,i)=>{for(const k of ['jump','dash','attack','heavy'])s.players[i].seen[k]=c[k];});if(s.timer<=0){if(s.phase==='countdown'){s.phase='fight';s.timer=120;}else{if(s.roundWinner!==null)s.round++;resetRound(s);}}return;}
 s.timer-=dt;
 for(let i=0;i<2;i++){
  const p=s.players[i],c=inputs[i];for(const k of ['inv','cool','stun','buff','regen'])p[k]=Math.max(0,p[k]-dt);if(p.regen===0)p.stamina=Math.min(100,p.stamina+25*dt);
  if(!['light','heavy','gun','charged'].includes(p.action))p.weapon=c.weapon;const wasAction=p.action;
  if(p.timer>0){p.timer-=dt;p.elapsed+=dt;if(p.timer<=0){
   if(wasAction==='light'||wasAction==='heavy'){
    const q=s.players[1-i],d=dist(p,q),dx=(q.x-p.x)/(d||1),dz=(q.z-p.z)/(d||1),facing=dx*Math.sin(p.yaw)+dz*Math.cos(p.yaw);
    if(d<(wasAction==='heavy'?3.6:3.0)&&Math.abs(p.y-q.y)<2.2&&facing>.25&&!coverBetween(p,q)){hurt(s,i,1-i,wasAction==='heavy'?30:17,wasAction==='heavy');}
    event(s,'slash',p,{player:i,yaw:p.yaw,heavy:wasAction==='heavy'});p.action='recover';p.timer=wasAction==='heavy'?.72:.40;
   }else if(wasAction==='gun'||wasAction==='charged'){
    const charged=wasAction==='charged';s.shots.push({id:++s.shotId,owner:i,x:p.x+Math.sin(p.yaw)*.7,y:p.y+1.25,z:p.z+Math.cos(p.yaw)*.7,dx:Math.sin(p.yaw),dz:Math.cos(p.yaw),life:1.5,speed:charged?27:23,damage:charged?24:12,heavy:charged});event(s,'fire',p,{player:i});p.action='recover';p.timer=charged?.68:.36;
   }else{p.action='idle';p.elapsed=0;}
  }}
  const fresh=k=>{const yes=c[k]>p.seen[k];p.seen[k]=c[k];return yes;};
  const wantDash=fresh('dash'),wantJump=fresh('jump'),wantAttack=fresh('attack'),wantHeavy=fresh('heavy');
  const busy=p.timer>0&&p.action!=='idle';
  let mx=c.focused?c.x:0,mz=c.focused?c.z:0,n=Math.hypot(mx,mz);if(n>1){mx/=n;mz/=n;n=1;}
  if(wantDash&&p.stun===0&&p.cool===0&&p.dash===0&&(!busy||p.action==='recover')&&(p.y===0||p.air>0)&&spend(p,28)){
   p.dx=n>.1?mx:Math.sin(c.yaw);p.dz=n>.1?mz:Math.cos(c.yaw);p.dash=.22;p.inv=.19;p.cool=.65;p.timer=0;p.action='idle';if(p.y>0)p.air--;event(s,'dash',p,{player:i});
  }
  if(wantJump&&p.stun===0&&!busy&&p.jumps<2){p.vy=8.5;p.jumps++;}
  if(!busy&&p.dash===0&&p.stun===0&&c.focused&&(wantAttack||wantHeavy)){
   const heavy=wantHeavy;if(spend(p,heavy?30:p.weapon==='gun'?13:17)){
    p.yaw=c.yaw;p.action=p.weapon==='gun'?(heavy?'charged':'gun'):(heavy?'heavy':'light');p.timer=heavy?.70:p.weapon==='gun'?.32:.30;p.elapsed=0;event(s,'windup',p,{player:i,heavy});
   }
  }
  const ox=p.x,oz=p.z,locked=p.stun>0||['light','heavy','gun','charged'].includes(p.action),speed=locked?1.8:p.action==='recover'?3:6.5;
  if(p.dash>0){p.dash=Math.max(0,p.dash-dt);p.x+=p.dx*23*dt;p.z+=p.dz*23*dt;p.speed=23;}
  else{p.x+=mx*speed*dt;p.z+=mz*speed*dt;p.speed=n*speed;if(!locked)p.yaw=c.yaw;}
  p.vy-=23*dt;p.y+=p.vy*dt;if(p.y<=0){p.y=0;p.vy=0;p.jumps=0;p.air=2;}collide(p,ox,oz);
 }
 // Keep fighters distinct so close sword combat has a readable silhouette.
 const a=s.players[0],b=s.players[1],d=dist(a,b);if(d<.8&&d>.001&&Math.abs(a.y-b.y)<2){const f=(.8-d)/2,dx=(a.x-b.x)/d,dz=(a.z-b.z)/d;a.x+=dx*f;a.z+=dz*f;b.x-=dx*f;b.z-=dz*f;}
 for(const q of s.shots){const oldX=q.x,oldZ=q.z;q.x+=q.dx*q.speed*dt;q.z+=q.dz*q.speed*dt;q.life-=dt;
  const p=s.players[1-q.owner],vx=q.x-oldX,vz=q.z-oldZ,k=clamp(((p.x-oldX)*vx+(p.z-oldZ)*vz)/(vx*vx+vz*vz||1),0,1),near=Math.hypot(oldX+vx*k-p.x,oldZ+vz*k-p.z);
  // Cover blocks the complete traveled segment, including low frame rates.
  let blocked=false;for(let j=0;j<=6;j++){const x=oldX+vx*j/6,z=oldZ+vz*j/6;if(BLOCKS.some(b=>q.y<b.h&&inBlock(x,z,b,.03))){blocked=true;break;}}
  if(blocked)q.life=0;else if(near<.60&&Math.abs(q.y-(p.y+1.1))<1.1){hurt(s,q.owner,1-q.owner,q.damage,q.heavy);q.life=0;}
 }
 s.shots=s.shots.filter(q=>q.life>0);
 if(a.hp<=0||b.hp<=0)finishRound(s,a.hp===b.hp?null:a.hp>b.hp?0:1);else if(s.timer<=0)finishRound(s,a.hp===b.hp?null:a.hp>b.hp?0:1);
}
