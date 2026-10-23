export const CATEGORIES={all:'全部世界',explore:'自由探索',challenge:'跳跃闯关',maze:'迷宫解谜',hangout:'村落与建筑',other:'其他创意'};
const KEY='windbound-gallery-creator-v1';
export function creatorKey(create=false){let key;try{key=localStorage.getItem(KEY);}catch{}if(/^[a-f0-9]{64}$/i.test(key||''))return key;if(!create)return null;const bytes=crypto.getRandomValues(new Uint8Array(32));key=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');try{localStorage.setItem(KEY,key);}catch{throw Error('浏览器不允许保存创作者身份。请允许网站存储后再发布；仍可浏览和试玩地图。');}return key;}
export async function mapsAPI(body,{signal,timeout=14000}={}){
 const base=String(window.WINDBOUND_ROOM_SERVICE||'').replace(/\/$/,'');if(!/^https?:\/\//.test(base))throw Error('地图大厅尚未配置服务地址，请更新 online-config.js。');
 const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),timeout),cancel=()=>abort.abort();signal?.addEventListener('abort',cancel,{once:true});
 try{const response=await fetch(base+'/api/maps',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:abort.signal,cache:'no-store'});let result;try{result=await response.json();}catch{throw Error('地图大厅服务尚未更新，请部署本次房间服务和 Pages 入口包。');}if(!response.ok){const error=new Error(response.status===404&&result.code!=='MAP_NOT_FOUND'?'地图大厅服务尚未更新，请部署本次房间服务和 Pages 入口包。':result.error||'地图大厅暂时无法连接。');error.code=result.code;error.status=response.status;throw error;}return result;}catch(e){if(e.name==='AbortError')throw Error(signal?.aborted?'请求已取消。':'地图大厅连接超时，请检查网络后重试。');if(e instanceof TypeError)throw Error('无法连接地图大厅，请检查网络和服务部署。');throw e;}finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);}
}
export function playURL(id){const u=new URL('./studio.html',location.href);u.searchParams.set('map',id);u.searchParams.set('play','1');return u.href;}
export function editURL(id){const u=new URL('./studio.html',location.href);u.searchParams.set('map',id);return u.href;}
