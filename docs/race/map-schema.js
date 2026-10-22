export const MAP_VERSION=1;
export const MAP_LIMITS=Object.freeze({points:12,gaps:8,boxes:24,obstacles:16,fileBytes:18000,linkChars:9000});
export const THEMES=[{id:'garden',name:'浮光花园',color:'#a8c98b'},{id:'sunset',name:'霞光群岛',color:'#d4a188'},{id:'glacier',name:'薄荷冰境',color:'#90cbd0'}];
export const BUILTIN_MAP={version:1,name:'浮光环岛',author:'逐风跃岛',theme:'garden',laps:2,points:[[-80,11,30],[-70,14,-48],[0,20,-100],[83,17,-67],[106,13,4],[61,20,77],[-13,16,103],[-85,10,75]],gaps:[[.205,.218],[.545,.557],[.79,.8]],shortcut:true,boxes:[.04,.095,.16,.255,.3,.375,.445,.5,.6,.665,.735,.845,.91,.965].map((t,i)=>[t,[-2.7,0,2.7,0][i%4]]),obstacles:[.125,.465,.695,.87].map(t=>({t,lane:0,moving:true})),crystals:72};
export const cloneMap=map=>JSON.parse(JSON.stringify(map));
const clean=(value,max,fallback)=>typeof value==='string'?value.replace(/[<>\x00-\x1f\x7f]/g,'').trim().slice(0,max)||fallback:fallback;
function number(value,min,max,label){if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)throw new Error(`${label}必须在 ${min} 到 ${max} 之间。`);return Math.round(value*100000)/100000;}
const cross=(a,b,c)=>(b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0]);
function intersects(a,b,c,d){return cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0;}
export function normalizeMap(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||raw.version!==MAP_VERSION)throw new Error('这不是可识别的逐风跃岛地图，请使用工坊导出的地图文件。');
 if(!Array.isArray(raw.points)||raw.points.length<5||raw.points.length>MAP_LIMITS.points)throw new Error('赛道需要 5 到 12 个路线节点。');
 const points=raw.points.map((p,i)=>{if(!Array.isArray(p)||p.length!==3)throw new Error(`节点 ${i+1} 的坐标不完整。`);return [number(p[0],-145,145,'横向位置'),number(p[1],5,30,'赛道高度'),number(p[2],-145,145,'纵向位置')];});
 for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++)if(Math.hypot(points[i][0]-points[j][0],points[i][2]-points[j][2])<12)throw new Error(`节点 ${i+1} 与节点 ${j+1} 太近，请把它们拉开。`);
 let area=0,perimeter=0;
 for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length],d=Math.hypot(a[0]-b[0],a[2]-b[2]);if(d<16)throw new Error(`节点 ${i+1} 与下一个节点太近，至少留出 16 米。`);if(Math.abs(a[1]-b[1])/d>.38)throw new Error(`节点 ${i+1} 附近坡度过陡，请降低高度差。`);area+=a[0]*b[2]-b[0]*a[2];perimeter+=d;for(let j=i+2;j<points.length;j++){if(i===0&&j===points.length-1)continue;if(intersects(a,b,points[j],points[(j+1)%points.length]))throw new Error('赛道路线交叉了。请拖动节点，让环形赛道不要交叉。');}}
 if(Math.abs(area)<3500||perimeter<200||perimeter>1400)throw new Error('赛道太小或过于拥挤，请把路线节点向外展开。');
 const list=(v,max,label)=>{if(!Array.isArray(v)||v.length>max)throw new Error(`${label}最多放置 ${max} 个。`);return v;};
 const gaps=list(raw.gaps,MAP_LIMITS.gaps,'断桥').map(g=>{if(!Array.isArray(g)||g.length!==2)throw new Error('断桥位置不完整。');const a=number(g[0],.045,.94,'断桥起点'),b=number(g[1],.045,.955,'断桥终点');if(b<=a||(b-a)*perimeter>10.5)throw new Error('断桥过长，请把缺口缩短到约 10 米以内。');return [a,b];}).sort((a,b)=>a[0]-b[0]);
 for(let i=1;i<gaps.length;i++)if(gaps[i][0]-gaps[i-1][1]<.018)throw new Error('两段断桥太近，请留出一段落脚的赛道。');
 const boxes=list(raw.boxes,MAP_LIMITS.boxes,'道具箱').map(b=>{if(!Array.isArray(b)||b.length!==2)throw new Error('道具箱位置不完整。');return [number(b[0],.025,.975,'道具箱位置'),number(b[1],-3.5,3.5,'道具箱横向位置')];});
 const obstacles=list(raw.obstacles,MAP_LIMITS.obstacles,'路障').map(o=>{if(!o||typeof o!=='object')throw new Error('路障数据不完整。');return {t:number(o.t,.045,.95,'路障位置'),lane:number(o.lane,-3.1,3.1,'路障横向位置'),moving:o.moving===true};});
 const laps=number(raw.laps,1,3,'比赛圈数'),crystals=number(raw.crystals,0,96,'风晶数量');if(!Number.isInteger(laps)||!Number.isInteger(crystals))throw new Error('圈数和风晶数量需要是整数。');
 const map={version:1,name:clean(raw.name,24,'未命名赛道'),author:clean(raw.author,16,'逐风旅人'),theme:THEMES.some(t=>t.id===raw.theme)?raw.theme:'garden',laps,points,gaps,shortcut:raw.shortcut===true,boxes,obstacles,crystals};
 if(JSON.stringify(map).length>6500)throw new Error('地图太大，请减少节点或物件。');return map;
}
export function mapFingerprint(map){const text=JSON.stringify(normalizeMap(map));let n=2166136261;for(let i=0;i<text.length;i++)n=Math.imul(n^text.charCodeAt(i),16777619);return (n>>>0).toString(16).padStart(8,'0');}
export function encodeMap(map){const bytes=new TextEncoder().encode(JSON.stringify(normalizeMap(map)));let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);const encoded=btoa(binary).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');if(encoded.length>MAP_LIMITS.linkChars)throw new Error('地图链接过长，请改用地图文件分享。');return encoded;}
export function decodeMap(value){if(typeof value!=='string'||value.length>MAP_LIMITS.linkChars||!/^[A-Za-z0-9_-]+$/.test(value))throw new Error('地图链接不完整或太长，请重新复制完整链接。');try{const raw=atob(value.replaceAll('-','+').replaceAll('_','/'));const bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));return normalizeMap(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)));}catch(error){if(error.message.includes('地图')||error.message.includes('节点')||error.message.includes('赛道')||error.message.includes('断桥'))throw error;throw new Error('地图链接无法解析，请重新复制或导入地图文件。');}}
export function parseMapFile(text){if(typeof text!=='string'||new TextEncoder().encode(text).length>MAP_LIMITS.fileBytes)throw new Error('地图文件太大，最大为 18 KB。');let value;try{value=JSON.parse(text);}catch{throw new Error('地图文件不是有效的 JSON，请选择工坊导出的文件。');}return normalizeMap(value);}
export function shareMapURL(map,base){const url=new URL('./index.html',base);url.search='';url.hash='map='+encodeMap(map);return url.href;}
export function templateMap(id='island'){const map=cloneMap(BUILTIN_MAP);map.author='逐风旅人';map.name='我的浮光赛道';map.laps=1;map.shortcut=false;map.gaps=[];map.obstacles=[];if(id==='ring'){map.name='薄荷圆环';map.theme='glacier';map.points=Array.from({length:8},(_,i)=>{const a=Math.PI+i*Math.PI/4;return [Math.round(Math.cos(a)*75),12,Math.round(Math.sin(a)*75)];});map.boxes=map.boxes.filter((_,i)=>i%2===0);}if(id==='petal'){map.name='霞光花瓣';map.theme='sunset';map.points=Array.from({length:10},(_,i)=>{const a=Math.PI+i*Math.PI/5,r=i%2?65:110;return [Math.round(Math.cos(a)*r),12+(i%3)*2,Math.round(Math.sin(a)*r)];});}return normalizeMap(map);}
