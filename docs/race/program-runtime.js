export function touchesObject(p,o){const a=o.yaw*Math.PI/180,dx=p.x-o.pos[0],dz=p.z-o.pos[2],x=dx*Math.cos(a)-dz*Math.sin(a),z=dx*Math.sin(a)+dz*Math.cos(a);return Math.abs(x)<=o.size[0]/2+.39&&Math.abs(z)<=o.size[2]/2+.39&&p.y<=o.pos[1]+o.size[1]/2+.15&&p.y+1.75>=o.pos[1]-o.size[1]/2-.1;}
// Interpret validated block data. No generated JavaScript is executed.
export function distanceToObject(p,o){const a=o.yaw*Math.PI/180,c=Math.cos(a),s=Math.sin(a),dx=p.x-o.pos[0],dz=p.z-o.pos[2],x=dx*c-dz*s,z=dx*s+dz*c;return Math.hypot(Math.max(0,Math.abs(x)-o.size[0]/2),Math.max(0,Math.abs(p.y+.85-o.pos[1])-o.size[1]/2),Math.max(0,Math.abs(z)-o.size[2]/2));}
export function createProgramRuntime(map,{onMessage=()=>{}}={}){
 const originals=new Map(map.objects.map(o=>[o.id,{pos:[...o.pos],yaw:o.yaw,color:o.color}])),byId=new Map(map.objects.map(o=>[o.id,o])),vars=new Map(),channels=new Map();
 const rules=[];for(const o of map.objects)for(const r of o.program||[])rules.push({object:o,rule:r,inside:false,started:false,next:r.event.seconds||0,fired:0,job:null});
 let time=0,operations=0,triggers=0,changed=false,lastMessage='',interactable=null,token=0;
 const target=(b,owner)=>b.target==='self'||!b.target?owner:byId.get(b.target);
 const clamp=n=>Math.max(-300,Math.min(300,n));
 function show(text,seconds){lastMessage=text;onMessage(text,seconds);}
 function start(entry){if(entry.job||(entry.rule.once&&entry.fired))return;entry.fired++;triggers++;entry.job={frames:[{list:entry.rule.steps,index:0,left:1}],waiting:null};}
 function condition(b,owner,p){if(b.test==='near')return owner.visible!==false&&distanceToObject(p,owner)<=b.radius;if(b.test==='grounded')return !!p.grounded;const value=b.test==='crystals'?p.collected.length:vars.get(b.name)||0;return b.cmp==='eq'?value===b.value:b.cmp==='lte'?value<=b.value:value>=b.value;}
 function animate(o,kind,to,duration,job){const key=o.id+':'+kind,id=++token;channels.set(key,id);job.waiting={type:'tween',object:o,kind,start:time,end:time+duration,from:kind==='pos'?[...o.pos]:o.yaw,to,key,id};}
 function waiting(job){const w=job.waiting;if(!w)return false;if(w.type==='wait'){if(time+1e-8<w.end)return true;job.waiting=null;return false;}if(channels.get(w.key)!==w.id){job.waiting=null;return false;}const f=Math.min(1,(time-w.start)/(w.end-w.start)),t=f*f*(3-2*f);if(w.kind==='pos')w.object.pos=w.from.map((v,i)=>v+(w.to[i]-v)*t);else w.object.yaw=w.from+(w.to-w.from)*t;changed=true;if(f<1)return true;job.waiting=null;return false;}
 function advance(entry,p,budget){const job=entry.job;if(!job||waiting(job))return budget;while(job.frames.length&&budget>0){const frame=job.frames.at(-1);if(frame.index>=frame.list.length){if(--frame.left>0)frame.index=0;else job.frames.pop();continue;}const b=frame.list[frame.index++];budget--;operations++;const owner=entry.object,o=target(b,owner);
  if(b.op==='if'){job.frames.push({list:condition(b,owner,p)?b.then:b.else,index:0,left:1});continue;}
  if(b.op==='repeat'){job.frames.push({list:b.body,index:0,left:b.count});continue;}
  if(b.op==='wait'){job.waiting={type:'wait',end:time+b.seconds};break;}
  if(b.op==='move'&&o){animate(o,'pos',o.pos.map((v,i)=>clamp(v+b[['x','y','z'][i]])),b.seconds,job);break;}
  if(b.op==='rotate'&&o){animate(o,'yaw',o.yaw+b.degrees,b.seconds,job);break;}
  if(b.op==='color'&&o){o.color=b.color;changed=true;}
  if(b.op==='visibility'&&o){o.visible=b.visible;changed=true;}
  if(b.op==='reset'&&o){const initial=originals.get(o.id);o.pos=[...initial.pos];o.yaw=initial.yaw;o.color=initial.color;o.visible=true;channels.set(o.id+':pos',++token);channels.set(o.id+':yaw',++token);changed=true;}
  if(b.op==='message')show(b.text,b.seconds);
  if(b.op==='add'||b.op==='set')vars.set(b.name,Math.max(-999999,Math.min(999999,b.op==='set'?b.value:(vars.get(b.name)||0)+b.value)));
  if(b.op==='teleport'){
   const destination=b.mode==='object'?target(b,owner):null;if(b.mode==='object'&&!destination)continue;
   [p.x,p.y,p.z]=destination?[destination.pos[0],destination.pos[1]+destination.size[1]/2+.25,destination.pos[2]]:[b.x,b.y,b.z];p.vx=p.vy=p.vz=0;p.grounded=false;p.jumps=0;p.standingOn=null;
  }
  if(b.op==='launch'){p.vy=b.speed;p.grounded=false;p.jumps=1;p.standingOn=null;}
  if(b.op==='checkpoint'){p.checkpoint=[p.x,p.y+.15,p.z];p.checkpointId=owner.id;show('存档位置已更新',2);}
  if(b.op==='finish'){p.finished=true;show('抵达终点！',3);}
 }
 if(!job.frames.length&&!job.waiting)entry.job=null;return budget;}
 function tick(p,dt,{interact=false}={}){
  if(p.finished)return false;time+=dt;changed=false;
  const supporting=p.grounded&&p.standingOn?byId.get(p.standingOn):null,oldSupport=supporting?{pos:[...supporting.pos],yaw:supporting.yaw}:null;
  interactable=null;let nearest=Infinity;
  for(const entry of rules){const {object:o,rule:r}=entry,e=r.event;const distance=distanceToObject(p,o);if(e.type==='interact'&&o.visible!==false&&distance<=e.radius&&distance<nearest){interactable=o.id;nearest=distance;}}
  for(const entry of rules){const {object:o,rule:r}=entry,e=r.event;let inside=false;
   if(e.type==='start'&&!entry.started){entry.started=true;start(entry);}
   if(e.type==='timer'&&time+1e-8>=entry.next){entry.next=time+e.seconds;start(entry);}
   if(e.type==='near'||e.type==='touch'){inside=o.visible!==false&&(e.type==='near'?distanceToObject(p,o)<=e.radius:touchesObject(p,o));if(inside&&!entry.inside)start(entry);entry.inside=inside;}
   if(e.type==='interact'&&interact&&o.id===interactable)start(entry);
  }
  let budget=200;for(const entry of rules)budget=advance(entry,p,budget);
  if(supporting&&p.grounded&&p.standingOn===supporting.id&&oldSupport){const a=oldSupport.yaw*Math.PI/180,b=supporting.yaw*Math.PI/180,dx=p.x-oldSupport.pos[0],dz=p.z-oldSupport.pos[2],x=dx*Math.cos(a)-dz*Math.sin(a),z=dx*Math.sin(a)+dz*Math.cos(a);p.x=supporting.pos[0]+x*Math.cos(b)+z*Math.sin(b);p.z=supporting.pos[2]-x*Math.sin(b)+z*Math.cos(b);p.y+=supporting.pos[1]-oldSupport.pos[1];}
  return changed;
 }
 return {tick,get interactable(){return interactable;},snapshot:()=>({time,operations,triggers,variables:Object.fromEntries(vars),active:rules.filter(r=>r.job).length,lastMessage,interactable})};
}
