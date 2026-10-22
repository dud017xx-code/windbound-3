import {advanceHidePlayer,canHideStand,normalizeHideInput} from './hide-core.js?v=smooth-v1';
const epoch=s=>`${s.set}:${s.round}:${s.phase}`;
const clone=p=>({...p,seen:{...p.seen}});
const fields=['x','z','y','vy','yaw','rotation','kind','moving','dash','escape'];
const command=(id,c)=>({id,x:c.x,z:c.z,yaw:c.yaw,kind:c.kind,turn:c.turn,jump:c.jump,escape:c.escape});
// Only locomotion is predicted. Damage, shots, scoring and round clocks stay with the host.
export class HideMotion{
 constructor(){this.id=0;this.pending=[];this.key=null;this.predicted=null;this.offset={x:0,y:0,z:0};this.display=[];}
 reset(s,seat){this.key=epoch(s);this.pending=[];this.predicted=clone(s.players[seat]);this.offset={x:0,y:0,z:0};this.display=s.players.map(clone);}
 tick(s,seat,input){if(this.key!==epoch(s))this.reset(s,seat);if(!['prepare','hunt'].includes(s.phase))return;const c=command(++this.id,normalizeHideInput(input));this.pending.push(c);if(this.pending.length>90)this.pending.shift();advanceHidePlayer(this.predicted,c,seat===s.seeker,s.phase,1/60);}
 reconcile(s,seat,ack){if(this.key!==epoch(s)||!this.predicted){this.reset(s,seat);return;}const previous=this.predicted;this.pending=this.pending.filter(c=>c.id>ack);this.predicted=clone(s.players[seat]);for(const c of this.pending)advanceHidePlayer(this.predicted,c,seat===s.seeker,s.phase,1/60);const dx=previous.x-this.predicted.x,dz=previous.z-this.predicted.z;if(Math.hypot(dx,dz)<.65)this.offset={x:dx,y:0,z:dz};else this.offset={x:0,y:0,z:0};}
 view(s,seat,dt,predict=true){if(this.key!==epoch(s)||!this.predicted)this.reset(s,seat);const players=s.players.map((p,i)=>{const target=predict&&i===seat?this.predicted:p,d=this.display[i]||clone(target);if(i===seat){for(const f of fields)d[f]=target[f];if(predict){const fade=Math.exp(-dt*16);this.offset.x*=fade;this.offset.z*=fade;const x=d.x+this.offset.x,z=d.z+this.offset.z;if(canHideStand(x,z,i===s.seeker)){d.x=x;d.z=z;}}}else{const blend=Math.hypot(d.x-p.x,d.z-p.z)>3?1:1-Math.exp(-dt*22);for(const f of ['x','y','z'])d[f]+=(p[f]-d[f])*blend;d.yaw+=Math.atan2(Math.sin(p.yaw-d.yaw),Math.cos(p.yaw-d.yaw))*blend;d.rotation=p.rotation;d.kind=p.kind;d.moving=p.moving;d.vy=p.vy;d.dash=p.dash;}this.display[i]=d;const result={...p};for(const f of fields)result[f]=d[f];return result;});return {...s,players};}
 outgoing(){return {moveEpoch:this.key,moves:this.pending.slice()};}
}
export class HideInputQueue{
 constructor(){this.key=null;this.queue=[];this.ack=0;this.lastQueued=0;}
 sync(s){if(this.key!==epoch(s)){this.key=epoch(s);this.queue=[];this.lastQueued=this.ack;}}
 accept(s,key,moves){this.sync(s);if(key!==this.key||!Array.isArray(moves))return;for(const raw of moves.slice(-90)){if(!Number.isSafeInteger(raw?.id)||raw.id<=this.lastQueued||raw.id<1)continue;const c=command(raw.id,normalizeHideInput(raw));this.queue.push(c);this.lastQueued=c.id;}if(this.queue.length>120)this.queue.splice(0,this.queue.length-120);}
 take(s,input){this.sync(s);const c=this.queue.shift();if(c){this.ack=c.id;return {...input,...c};}return {...input,x:0,z:0,turn:0,jump:s.players[1].seen.jump,escape:s.players[1].seen.escape};}
}
