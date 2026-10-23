export const PROGRAM_LIMITS={rulesPerObject:8,rules:48,blocks:384,depth:4};
export const EVENTS={start:'当游戏开始',near:'当玩家靠近',touch:'当玩家碰到',interact:'当玩家互动',timer:'每隔一段时间'};
export const OPS={move:'移动物体',rotate:'旋转物体',color:'改变颜色',visibility:'显示 / 隐藏',reset:'恢复物体原状',wait:'等待',message:'显示文字',teleport:'传送玩家',launch:'弹起玩家',checkpoint:'设置存档点',finish:'完成关卡',add:'变量增加',set:'设置变量',if:'如果 / 否则',repeat:'重复执行'};
function pNumber(v,fallback,min,max){if(v===undefined)return fallback;if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw Error(`积木数值需要在 ${min} 到 ${max} 之间。`);return Math.round(v*100)/100;}
function pText(v,fallback,max){if(v===undefined)return fallback;if(typeof v!=='string')throw Error('积木文字格式无效。');return v.replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,max);}
function pTarget(v){if(v===undefined)return 'self';if(typeof v!=='string'||!/^[a-zA-Z0-9_-]{1,40}$/.test(v))throw Error('积木的目标物体无效。');return v;}
export function countBlocks(rules){let n=0;function walk(list){for(const b of list){n++;if(b.op==='repeat')walk(b.body);if(b.op==='if'){walk(b.then);walk(b.else);}}}for(const r of rules)walk(r.steps);return n;}
export function normalizePrograms(value){
 if(!Array.isArray(value)||value.length>PROGRAM_LIMITS.rulesPerObject)throw Error('每个物体最多可放 8 组事件积木。');let count=0;const ids=new Set();
 function blocks(list,depth=0){if(!Array.isArray(list)||depth>PROGRAM_LIMITS.depth)throw Error('积木嵌套最多 4 层。');return list.map(b=>{
  if(!b||typeof b!=='object'||!Object.hasOwn(OPS,b.op))throw Error('地图包含不支持的编程积木。');if(++count>PROGRAM_LIMITS.blocks)throw Error('地图积木过多。');const op=b.op,r={op};
  if(['move','rotate','color','visibility','reset'].includes(op))r.target=pTarget(b.target);
  if(op==='move'){for(const k of['x','y','z'])r[k]=pNumber(b[k],k==='y'?3:0,-100,100);r.seconds=pNumber(b.seconds,1.5,.05,30);}
  if(op==='rotate'){r.degrees=pNumber(b.degrees,90,-720,720);r.seconds=pNumber(b.seconds,1,.05,30);}
  if(op==='color'){if(b.color!==undefined&&!/^#[0-9a-f]{6}$/i.test(b.color))throw Error('积木颜色无效。');r.color=b.color||'#e8b960';}
  if(op==='visibility'){if(b.visible!==undefined&&typeof b.visible!=='boolean')throw Error('显示积木格式无效。');r.visible=b.visible??false;}
  if(op==='wait')r.seconds=pNumber(b.seconds,1,.05,60);
  if(op==='message'){r.text=pText(b.text,'欢迎来到我的世界！',80);r.seconds=pNumber(b.seconds,3,.3,10);}
  if(op==='teleport'){if(b.mode!==undefined&&!['point','object'].includes(b.mode))throw Error('传送积木格式无效。');r.mode=b.mode||'point';if(r.mode==='object')r.target=pTarget(b.target);else for(const k of['x','y','z'])r[k]=pNumber(b[k],k==='y'?2:0,-300,300);}
  if(op==='launch')r.speed=pNumber(b.speed,14,1,30);
  if(op==='add'||op==='set'){r.name=pText(b.name,'钥匙',16).trim()||'钥匙';r.value=pNumber(b.value,1,-999,999);}
  if(op==='if'){
   if(b.test!==undefined&&!['variable','near','crystals','grounded'].includes(b.test))throw Error('条件积木格式无效。');r.test=b.test||'variable';
   if(r.test==='variable'||r.test==='crystals'){r.cmp=['gte','eq','lte'].includes(b.cmp)?b.cmp:'gte';r.value=pNumber(b.value,1,-999,999);if(r.test==='variable')r.name=pText(b.name,'钥匙',16).trim()||'钥匙';}
   if(r.test==='near')r.radius=pNumber(b.radius,5,.5,50);r.then=blocks(b.then||[],depth+1);r.else=blocks(b.else||[],depth+1);
  }
  if(op==='repeat'){r.count=pNumber(b.count,3,1,20);if(!Number.isInteger(r.count))throw Error('重复次数必须是整数。');r.body=blocks(b.body||[],depth+1);}
  return r;
 });}
 return value.map((rule,i)=>{if(!rule||!rule.event||!Object.hasOwn(EVENTS,rule.event.type))throw Error('事件积木格式无效。');const id=pText(rule.id,'rule'+(i+1),32);if(ids.has(id))throw Error('事件编号重复。');ids.add(id);const event={type:rule.event.type};if(event.type==='near'||event.type==='interact')event.radius=pNumber(rule.event.radius,event.type==='near'?5:4,.5,30);if(event.type==='timer')event.seconds=pNumber(rule.event.seconds,5,.5,60);return {id,event,once:!!rule.once,steps:blocks(rule.steps||[])};});
}
export function defaultBlock(op){return normalizePrograms([{event:{type:'start'},steps:[{op}]}])[0].steps[0];}
export function programPreset(name){
 const rule=(event,steps,once=false)=>({id:'rule'+Math.random().toString(36).slice(2,9),event,once,steps});
 const presets={
  platform:rule({type:'timer',seconds:5},[{op:'move',y:3,seconds:1.5},{op:'wait',seconds:.5},{op:'move',y:-3,seconds:1.5}]),
  sign:rule({type:'interact',radius:4},[{op:'message',text:'顺着风的方向，看看远处的岛屿。',seconds:4}]),
  portal:rule({type:'touch'},[{op:'teleport',mode:'point',x:0,y:2,z:0},{op:'message',text:'你穿过了传送门！'}]),
  key:rule({type:'touch'},[{op:'add',name:'钥匙',value:1},{op:'visibility',visible:false},{op:'message',text:'找到了一把钥匙。'}],true)
 };return normalizePrograms([presets[name]||presets.sign])[0];
}
