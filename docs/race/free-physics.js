// Free movement and collision are independent of the racing route.
const R=.38,H=1.75;
function shape(o,offset,size,type='box'){
 const a=o.yaw*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
 return {id:o.id,type,x:o.pos[0]+offset[0]*c+offset[2]*s,y:o.pos[1]+offset[1],z:o.pos[2]-offset[0]*s+offset[2]*c,w:size[0],h:size[1],d:size[2],c,s};
}
export function colliders(map){
 const result=[];for(const o of map.objects){if(o.visible===false)continue;const [w,h,d]=o.size;
 if(['ground','block','wall','rock','bounce'].includes(o.type))result.push(shape(o,[0,0,0],o.size));
 if(o.type==='ramp')result.push(shape(o,[0,0,0],o.size,'ramp'));
 if(o.type==='stairs')for(let i=0;i<6;i++){const height=h*(i+1)/6;result.push(shape(o,[0,-h/2+height/2,d/2-d*(i+.5)/6],[w,height,d/6]));}
 if(o.type==='house')result.push(shape(o,[0,-h*.12,0],[w,h*.76,d]),shape(o,[0,h*.36,0],[w*1.35,h*.35,d*1.35],'roof'));
 if(o.type==='tower')result.push(shape(o,[0,-h*.1,0],[w*.72,h*.8,d*.72]),shape(o,[0,h*.35,0],[w*1.15,h*.32,d*1.15],'roof'));
 if(o.type==='tree')result.push(shape(o,[0,-h*.25,0],[w*.14,h*.5,d*.14]));
 if(o.type==='arch'){
  result.push(shape(o,[-w*.43,0,0],[w*.14,h,d]),shape(o,[w*.43,0,0],[w*.14,h,d]),shape(o,[0,h*.43,0],[w,h*.14,d]));
 }
 }return result;
}
const local=(p,b)=>{const x=p.x-b.x,z=p.z-b.z;return {x:x*b.c-z*b.s,z:x*b.s+z*b.c};};
export function surface(b,x,z){const p=local({x,z},b);if(Math.abs(p.x)>b.w/2+R*.65||Math.abs(p.z)>b.d/2+R*.65)return null;if(b.type==='roof')return b.y-b.h/2+b.h*(1-Math.min(1,Math.max(Math.abs(p.x)/(b.w/2),Math.abs(p.z)/(b.d/2))));return b.type==='ramp'?b.y+b.h/2-Math.max(0,Math.min(1,(p.z+b.d/2)/b.d))*b.h:b.y+b.h/2;}
export function newPlayer(map){const sp=map.objects.find(o=>o.type==='spawn');return {x:sp.pos[0],y:sp.pos[1]+.2,z:sp.pos[2],vx:0,vy:0,vz:0,grounded:false,jumps:0,yaw:sp.yaw*Math.PI/180,energy:1,collected:[],checkpoint:[...sp.pos],finished:false,deaths:0,time:0,message:''};}
export function respawn(p){[p.x,p.y,p.z]=p.checkpoint;p.y+=.4;p.vx=p.vy=p.vz=0;p.grounded=false;p.standingOn=null;p.jumps=0;p.energy=1;p.deaths++;p.message='回到存档位置';}
export function step(p,input,dt,solids,map){
 if(p.finished)return;p.time+=dt;p.message='';
 const amount=Math.min(1,Math.hypot(input.x||0,input.z||0)),x=(input.x||0)/(Math.hypot(input.x||0,input.z||0)||1),z=(input.z||0)/(Math.hypot(input.x||0,input.z||0)||1);
 const dashing=input.dash&&p.energy>.07&&amount>.1,speed=dashing?15:7.5;
 const accel=1-Math.exp(-(p.grounded?14:6)*dt);p.vx+=(x*speed*amount-p.vx)*accel;p.vz+=(z*speed*amount-p.vz)*accel;
 p.energy=Math.max(0,Math.min(1,p.energy+(dashing?-.68:.36)*dt));if(amount>.1)p.yaw=Math.atan2(x,z);
 if(input.jump&&p.jumps<2){p.vy=p.jumps?9:10.5;p.jumps++;p.grounded=false;p.standingOn=null;}
 const oldY=p.y;const oldX=p.x,oldZ=p.z;p.x+=p.vx*dt;p.z+=p.vz*dt;
 // Resolve cylinder against rotated rectangles; sloped surfaces remain walkable.
 for(let k=0;k<2;k++)for(const b of solids){const v=local(p,b),top=surface(b,p.x,p.z),floor=b.type==='ramp'?b.y+b.h/2-Math.max(0,Math.min(1,(v.z+b.d/2)/b.d))*b.h:top??b.y+b.h/2;
  if(p.y>=floor-.72||p.y+H<=b.y-b.h/2+.02)continue;
  const nx=Math.max(-b.w/2,Math.min(b.w/2,v.x)),nz=Math.max(-b.d/2,Math.min(b.d/2,v.z));let dx=v.x-nx,dz=v.z-nz,dist=Math.hypot(dx,dz);
  if(dist>=R)continue;
  if(dist<.00001){const px=b.w/2-Math.abs(v.x),pz=b.d/2-Math.abs(v.z);if(px<pz){dx=v.x>=0?1:-1;dz=0;dist=-px;}else{dx=0;dz=v.z>=0?1:-1;dist=-pz;}}
  else {dx/=dist;dz/=dist;}
  const push=R-dist;p.x+=(dx*b.c+dz*b.s)*push;p.z+=(-dx*b.s+dz*b.c)*push;
 }
 p.vy-=25*dt;p.y+=p.vy*dt;p.grounded=false;
 let best=-Infinity,support=null;
 for(const b of solids){const top=surface(b,p.x,p.z);if(top===null)continue;
  const before=surface(b,oldX,oldZ);const risingRamp=b.type==='ramp'&&before!==null&&Math.abs(oldY-before)<.35&&p.vy<=0;
  if(p.vy<=0&&((oldY>=top-.72&&p.y<=top+.12)||risingRamp)&&top>best){best=top;support=b.id;}
  const bottom=b.y-b.h/2;if(p.vy>0&&oldY+H<=bottom+.02&&p.y+H>=bottom){p.y=bottom-H;p.vy=0;}
 }
 if(best>-Infinity){p.y=best;p.vy=0;p.grounded=true;p.jumps=0;p.standingOn=support;}else p.standingOn=null;
 for(const o of map.objects){if(o.visible===false)continue;if(!['crystal','checkpoint','finish','hazard','bounce'].includes(o.type))continue;
  const b=shape(o,[0,0,0],o.size),v=local(p,b),inside=Math.abs(v.x)<b.w/2+R&&Math.abs(v.z)<b.d/2+R&&p.y+H>b.y-b.h/2&&p.y<b.y+b.h/2+(.4);
  if(!inside)continue;
  if(o.type==='crystal'&&!p.collected.includes(o.id)){p.collected.push(o.id);p.message='风晶 +1';}
  if(o.type==='checkpoint'&&p.checkpointId!==o.id){p.checkpoint=[o.pos[0],o.pos[1]-o.size[1]/2+.15,o.pos[2]];p.checkpointId=o.id;p.message='存档点已点亮';}
  if(o.type==='finish'){p.finished=true;p.message='抵达终点！';}
  if(o.type==='hazard'){respawn(p);return;}
  if(o.type==='bounce'&&p.vy<=0&&p.grounded){p.vy=18;p.grounded=false;p.jumps=1;p.message='借风起跳！';}
 }
 if(p.y<-45||Math.abs(p.x)>340||Math.abs(p.z)>340)respawn(p);
}
