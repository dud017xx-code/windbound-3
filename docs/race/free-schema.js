import {normalizePrograms,countBlocks,PROGRAM_LIMITS,programPreset} from './program-schema.js';
export const LIMIT=160;
export const TYPES={
 ground:{name:'地块',category:'地形',size:[20,2,20],color:'#c2dbc4'},
 block:{name:'积木平台',category:'地形',size:[6,1,6],color:'#e4dfc7'},
 wall:{name:'墙壁',category:'建筑',size:[8,5,1],color:'#e9e3d1'},
 ramp:{name:'斜坡',category:'地形',size:[5,3,8],color:'#d5c8ab'},
 stairs:{name:'阶梯',category:'地形',size:[5,4,8],color:'#ddd6be'},
 house:{name:'小屋',category:'建筑',size:[6,6,6],color:'#f4debb'},
 tower:{name:'塔楼',category:'建筑',size:[5,11,5],color:'#dedac7'},
 arch:{name:'拱门',category:'建筑',size:[7,7,2],color:'#eee7ce'},
 tree:{name:'树木',category:'装饰',size:[5,7,5],color:'#70b8a1'},
 rock:{name:'岩石',category:'装饰',size:[4,3,4],color:'#a2b8b0'},
 water:{name:'水池',category:'装饰',size:[8,.25,8],color:'#70c9da'},
 crystal:{name:'可收集风晶',category:'玩法',size:[1.3,2,1.3],color:'#5ccbc0'},
 bounce:{name:'弹跳垫',category:'玩法',size:[4,.4,4],color:'#e8b960'},
 hazard:{name:'危险区域',category:'玩法',size:[5,.3,5],color:'#e77b70'},
 checkpoint:{name:'存档点',category:'玩法',size:[2,3,2],color:'#62bdab'},
 finish:{name:'终点',category:'玩法',size:[5,5,2],color:'#e4bc67'},
 spawn:{name:'出生点',category:'玩法',size:[2,.3,2],color:'#3f9390'}
};
export const THEMES={garden:{name:'晴空薄荷',sky:'#d6eeec',fog:'#d6eeec',sun:'#fff4d4'},sunset:{name:'晚霞桃金',sky:'#f4d9d0',fog:'#f4d9d0',sun:'#ffe4a9'},glacier:{name:'星雾浅蓝',sky:'#dae4f6',fog:'#dae4f6',sun:'#effaff'}};
export function uid(){return Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-3);}
export function object(type,x=0,y=0,z=0,size){return {id:uid(),type,pos:[x,y,z],size:[...(size||TYPES[type].size)],yaw:0,color:TYPES[type].color};}
export function clone(value){return JSON.parse(JSON.stringify(value));}
export function normalize(input){
 if(!input||input.kind!=='freeworld'||![1,2].includes(input.version))throw Error('请选择自由地图文件（.windworld.json），赛道文件请在赛道编辑器打开。');
 if(!Array.isArray(input.objects)||input.objects.length>LIMIT||input.objects.length<1)throw Error(`地图需要 1–${LIMIT} 个物体。`);
 const ids=new Set();const objects=input.objects.map(o=>{
  if(!o||!Object.hasOwn(TYPES,o.type))throw Error('地图包含不支持的物体。');
  const vector=(v,min,max,label)=>{if(!Array.isArray(v)||v.length!==3||v.some(n=>typeof n!=='number'||!Number.isFinite(n)||n<min||n>max))throw Error(label+'超出范围。');return v.map(n=>Math.round(n*100)/100);};
  const id=typeof o.id==='string'&&/^[a-zA-Z0-9_-]{1,40}$/.test(o.id)?o.id:uid();if(ids.has(id))throw Error('地图物体编号重复。');ids.add(id);
  const result={id,type:o.type,pos:vector(o.pos,-300,300,'位置'),size:vector(o.size,.2,100,'大小'),yaw:typeof o.yaw==='number'&&Number.isFinite(o.yaw)?Math.round(((o.yaw%360)+360)%360):0,color:/^#[0-9a-f]{6}$/i.test(o.color)?o.color:TYPES[o.type].color};
  if(typeof o.label==='string'&&o.label.trim())result.label=o.label.trim().slice(0,24);if(o.program!==undefined){const program=normalizePrograms(o.program);if(program.length)result.program=program;}return result;
 });
 if(objects.filter(o=>o.type==='spawn').length!==1)throw Error('地图必须有且只有一个出生点。');
 const programs=objects.flatMap(o=>o.program||[]);if(programs.length>PROGRAM_LIMITS.rules||countBlocks(programs)>PROGRAM_LIMITS.blocks)throw Error('整张地图最多放 48 组事件、384 块积木。');
 return {kind:'freeworld',version:programs.length?2:1,name:String(input.name||'我的自由地图').slice(0,32),author:String(input.author||'群岛建造师').slice(0,24),theme:Object.hasOwn(THEMES,input.theme)?input.theme:'garden',objects};
}
export function fingerprint(map){let h=2166136261;for(const c of JSON.stringify(normalize(map))){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return (h>>>0).toString(36);}
export function encode(map){const bytes=new TextEncoder().encode(JSON.stringify(normalize(map)));let str='';for(const b of bytes)str+=String.fromCharCode(b);return btoa(str).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');}
export function decode(code){if(code.length>100000)throw Error('地图链接过长，请导入地图文件。');try{const raw=atob(code.replaceAll('-','+').replaceAll('_','/'));return normalize(JSON.parse(new TextDecoder().decode(Uint8Array.from(raw,c=>c.charCodeAt(0)))));}catch(e){if(e.message.includes('地图'))throw e;throw Error('地图链接不完整，请重新复制或导入地图文件。');}}
export function parseFile(text){if(text.length>100000)throw Error('地图文件过大。');try{return normalize(JSON.parse(text));}catch(e){if(e instanceof SyntaxError)throw Error('这不是有效的 JSON 地图文件。');throw e;}}
export function template(name='village'){
 const objects=[object('ground',0,-1,0,[36,2,36]),object('spawn',0,.16,11)];objects[1].yaw=180;
 const add=(type,x,y,z,size,yaw=0,color)=>{const o=object(type,x,y,z,size);o.yaw=yaw;if(color)o.color=color;objects.push(o);return o;};
 let title='空白场地';
 if(name==='village'){
  title='风栖村 · 浮空庭院';add('ground',31,1,-20,[22,4,24]);add('ground',-32,4,-28,[22,3,22]);
  add('block',20,.25,-9,[16,.5,4],40);add('stairs',-19,2,-20,[5,4,13],65);
  add('house',-10,3,-6,[7,6,7],25);add('house',10,3,-9,[6,6,6],-20);add('tower',31,7.5,-25);add('arch',0,3.5,-10);
  add('block',-32,6.2,-29,[10,1.4,10]);add('finish',-32,9.4,-31);
  for(const [x,z,s]of[[-13,10,6],[13,10,5],[-13,-13,4],[13,-15,5],[36,-12,5],[-37,-24,5]])add('tree',x,s/2,z,[s,s,s]);
  add('rock',-14,1.2,2,[3,2.4,3]);add('water',5,.12,2,[8,.24,6]);add('bounce',-8,.2,-15);add('checkpoint',31,4.5,-16);
  for(const [x,y,z]of[[0,1.8,4],[0,1.8,-1],[0,1.8,-6],[20,2,-9],[30,4,-17],[-25,7,-26]])add('crystal',x,y,z);
 }else if(name==='maze'){
  title='薄荷迷宫';objects[0].size=[40,2,40];objects[1].pos=[-16,.16,16];
  for(const [x,z,w,d]of[[0,-20,40,1],[0,20,40,1],[-20,0,1,40],[20,0,1,40],[-10,3,1,26],[0,-3,1,26],[10,3,1,26],[-15,-10,10,1],[5,10,10,1]])add('wall',x,2.5,z,[w,5,d]);
  add('finish',16,2.5,-16);for(const [x,z]of[[-15,-3],[-5,-15],[5,15],[15,0]])add('crystal',x,1.8,z);
 }else if(name==='logic'){
  title='积木机关 · 风之实验场';objects[0].size=[30,2,30];objects[1].pos=[0,.16,9];
  const key=add('crystal',-5,1.2,5);key.label='风之钥匙';key.program=[programPreset('key')];
  const door=add('wall',0,2.5,-4,[6,5,1]);door.label='钥匙机关门';door.color='#d5bb76';door.program=normalizePrograms([{id:'door',event:{type:'interact',radius:4},steps:[{op:'if',test:'variable',name:'钥匙',cmp:'gte',value:1,then:[{op:'if',test:'variable',name:'门已打开',cmp:'eq',value:0,then:[{op:'move',y:5,seconds:1.2},{op:'set',name:'门已打开',value:1},{op:'message',text:'门已经打开，继续向前吧！'}],else:[{op:'message',text:'门已经打开啦。'}]}],else:[{op:'message',text:'先去左边找到一把钥匙。'}]}]}]);
  add('wall',-10,2.5,-4,[14,5,1]);add('wall',10,2.5,-4,[14,5,1]);const platform=add('block',7,1.2,2,[5,.7,5]);platform.label='往返升降台';platform.program=[programPreset('platform')];
  const sign=add('arch',-8,3.5,10);sign.label='庭院路牌';sign.program=[programPreset('sign')];add('finish',0,2.5,-11);add('tree',-11,3.5,-10);
 }else if(name==='islands'){
  title='无路之岛';objects[0].size=[18,2,18];objects[1].pos=[0,.16,6];
  for(let i=0;i<5;i++)add('block',Math.sin(i*1.3)*9,1+i*1.4,-16-i*9,[8,1,7]);add('finish',Math.sin(5.2)*9,9.6,-52);add('bounce',0,.2,-5);
 }
 return normalize({kind:'freeworld',version:1,name:title,author:'群岛建造师',theme:'garden',objects});
}
