function roomEndpoint(){
 const value=window.WINDBOUND_ROOM_SERVICE;
 if(typeof value!=='string'||!value.trim())throw new Error('房间服务尚未配置，请先在 online-config.js 填写房间服务网址。');
 let url;try{url=new URL(value.trim());}catch{throw new Error('房间服务网址格式不正确，请使用完整的 HTTPS 地址。');}
 if(url.protocol!=='https:')throw new Error('房间服务需要使用 HTTPS 地址。');
 return new URL('/api/duel',url).href;
}
const compactNumber=(key,value)=>typeof value==='number'&&!Number.isInteger(value)?Math.round(value*1000)/1000:value;
export class DuelLink{
 constructor(onPacket,onStatus,mode='duel'){this.mode=mode;this.onPacket=onPacket;this.onStatus=onStatus;this.seq=0;this.remoteSeq=-1;this.epoch=0;this.closed=false;this.latest=null;this.lastPeer=0;this.lastDirect=-Infinity;this.forceRelayUntil=0;this.channel=null;this.pc=null;}
 async api(action,extra={}){const r=await fetch(roomEndpoint(),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,mode:this.mode,code:this.code,token:this.token,...extra},compactNumber),signal:AbortSignal.timeout(8000)});if(!(r.headers.get('content-type')||'').includes('application/json')){const e=new Error('房间服务暂时无法访问，请检查服务地址、网络和部署状态。');e.status=r.status;throw e;}const b=await r.json();if(!r.ok){const e=new Error(b.error||'连接失败，请重试。');e.status=r.status;throw e;}return b;}
 async open(code){await this.checkMode();if(this.closed)return;const epoch=this.epoch;const b=await this.api(code?'join':'create',code?{code}:{});if(this.closed||epoch!==this.epoch)return;await this.connect(b);}
 async checkMode(){
  if(this.mode!=='hide')return;
  const response=await fetch(new URL('/api/health',roomEndpoint()),{cache:'no-store',signal:AbortSignal.timeout(8000)});
  let status;try{status=await response.json();}catch{throw new Error('房间服务暂时无法访问，请检查网络。');}
  if(!response.ok||status.hide!==true)throw new Error('捉迷藏服务尚未更新，请先部署捉迷藏版房间后台。');
 }
 async connect(b){if(this.closed)return;this.matching=false;this.code=b.code;this.token=b.token;this.seat=b.seat;this.lastPeer=performance.now();this.started=performance.now();this.onStatus('room',b);this.watch();this.peer();if(this.seat===0&&this.pc){this.attach(this.pc.createDataChannel('wind-duel',{ordered:false,maxRetransmits:0}));await this.pc.setLocalDescription(await this.pc.createOffer());await this.gather();if(!this.closed)await this.api('signal',{sdp:JSON.stringify(this.pc.localDescription)});}else if(b.offer)await this.answer(b.offer);if(!this.closed)this.loop();}
 async match(){
  await this.checkMode();if(this.closed)return;
  this.matchTicket=crypto.randomUUID()+crypto.randomUUID();this.matching=true;const start=performance.now();let action='match_start',failures=0;
  while(!this.closed&&this.matching){
   let b;
   try{b=await this.api(action,{ticket:this.matchTicket});failures=0;}catch(error){
    if(this.closed)return;
    if(error.status===400||error.status===404||error.status===405)throw new Error('匹配服务尚未更新，请先部署匹配版房间服务。');
    if(++failures>=3)throw new Error('匹配连接中断，请检查网络后重新匹配。');
    this.onStatus('match-retry');
   }
   if(this.closed)return;
   if(b?.status==='matched'){await this.connect({...b,token:this.matchTicket});return;}
   if(b?.status==='cancelled')throw new Error(b.message||'匹配已取消，请重新匹配。');
   if(b){if(b.status!=='waiting')throw new Error('匹配服务返回异常，请稍后重试。');action='match_poll';this.onStatus('match-waiting');}
   if(performance.now()-start>120000)throw new Error('暂时没有找到对手，可以再次点击匹配。');
   await new Promise(resolve=>{this.matchWake=resolve;this.matchTimeout=setTimeout(resolve,2500);});this.matchWake=null;
  }
 }
 peer(){try{this.pc=new RTCPeerConnection({iceServers:[{urls:['stun:stun.cloudflare.com:3478','stun:stun.l.google.com:19302']}]});this.pc.ondatachannel=e=>this.attach(e.channel);this.pc.onconnectionstatechange=()=>{if(this.pc.connectionState==='failed'||this.pc.connectionState==='disconnected')this.relay();};}catch{this.pc=null;this.onStatus('relay');}}
 gather(){if(this.pc.iceGatheringState==='complete')return Promise.resolve();return new Promise(resolve=>{const p=this.pc;const done=()=>{clearTimeout(timer);p.removeEventListener('icegatheringstatechange',change);resolve();};const change=()=>{if(p.iceGatheringState==='complete')done();};const timer=setTimeout(done,3000);p.addEventListener('icegatheringstatechange',change);});}
 async answer(offer){if(!this.pc||this.pc.remoteDescription)return;await this.pc.setRemoteDescription(JSON.parse(offer));await this.pc.setLocalDescription(await this.pc.createAnswer());await this.gather();if(!this.closed)await this.api('signal',{sdp:JSON.stringify(this.pc.localDescription)});}
 deliver(packet){if(!packet||typeof packet!=='object')return;this.lastPeer=performance.now();const stamp=packet._net;if(stamp&&Number.isFinite(stamp.sent))this.remoteStamp=stamp.sent;if(stamp&&Number.isFinite(stamp.echo)&&stamp.echo>0){const rtt=performance.now()-stamp.echo;if(rtt>=0&&rtt<12000)this.rtt=this.rtt?this.rtt*.8+rtt*.2:rtt;}this.onPacket(packet);}
 path(kind){if(this.transport===kind)return;this.transport=kind;this.onStatus(kind);}
 isDirect(){const now=performance.now();return this.channel?.readyState==='open'&&now-this.lastDirect<1500&&now>=this.forceRelayUntil&&this.routeChoice!=='relay'&&now>=(this.remoteRelayUntil||0);}
 control(packet){if(this.channel?.readyState!=='open'||this.channel.bufferedAmount>16000)return;try{this.channel.send(JSON.stringify(packet));}catch{}}
 startProbe(id){const now=performance.now();this.probes??=new Set();id??='p'+Math.random().toString(36).slice(2,12);if(this.probes.has(id))return;this.probes.add(id);if(this.probes.size>20)this.probes.delete(this.probes.values().next().value);this.probeId=id;this.probeUntil=now+5000;this.relay();}
 preferRelay(){const now=performance.now();this.routeChoice='relay';this.preferRelayUntil=now+12000;this.routeHint=now;this.control({kind:'windbound:route',route:'relay',hold:6000});this.relay();}
 chooseRoute(){const now=performance.now(),native=this.directMs||this.rtt,relay=this.relayMs;
  if(this.routeChoice!=='relay'&&relay&&native>250&&(this.relaySamples||0)>=2&&now-(this.relaySampleAt||0)<5000&&relay+60<native*.8)this.preferRelay();
  if(this.channel?.readyState==='open'&&this.routeChoice==='relay'&&now>=(this.preferRelayUntil||0)&&this.directMs&&this.directMs+50<(relay||Infinity)*.8){this.routeChoice='direct';this.preferRelayUntil=this.remoteRelayUntil=0;this.lastDirect=now;this.control({kind:'windbound:route',route:'direct'});this.path('direct');}
 }
 watch(){clearInterval(this.watchdog);this.watchdog=setInterval(()=>{if(this.closed)return;const now=performance.now();if(this.channel?.readyState==='open'){
   if(!this.isDirect()&&this.transport!=='relay')this.relay();
   if(now-(this.lastPing||0)>=1000){this.lastPing=now;this.pings??=new Map();const id=(this.pingId||0)+1;this.pingId=id;this.pings.set(id,now);for(const [key,at]of this.pings)if(now-at>8000)this.pings.delete(key);this.control({kind:'windbound:ping',id,probe:now<(this.probeUntil||0)?this.probeId:null});}
   if((this.directMs>250||this.rtt>600)&&!this.isProbing()&&now-(this.lastProbe||-30000)>20000&&this.isDirect()){this.lastProbe=now;this.startProbe();}
   this.chooseRoute();if(this.routeChoice==='relay'&&now-(this.routeHint||0)>=3000){this.routeHint=now;this.control({kind:'windbound:route',route:'relay',hold:6000});}
  }},250);}
 isProbing(){return performance.now()<(this.probeUntil||0);}
 relayPacket(){this.relaySent??=new Map();this.relayId=(this.relayId||0)+1;this.relaySent.set(this.relayId,performance.now());if(this.relaySent.size>80)this.relaySent.delete(this.relaySent.keys().next().value);return {...(this.latest||{}),_relay:{id:this.relayId,ack:this.relayRemote||0}};}
 readRelay(packet){const stamp=packet?._relay;if(!stamp||!Number.isSafeInteger(stamp.id))return;this.relayRemote=stamp.id;const at=this.relaySent?.get(stamp.ack);if(at!==undefined){const sample=performance.now()-at;this.relaySent.delete(stamp.ack);if(sample>=0&&sample<12000){this.relayMs=this.relayMs?this.relayMs*.65+sample*.35:sample;this.relaySamples=(this.relaySamples||0)+1;this.relaySampleAt=performance.now();}}}
 get networkMs(){return this.isDirect()?this.directMs||this.rtt:this.relayMs||this.rtt;}
 attach(channel){this.channel=channel;channel.onopen=()=>{this.lastPeer=this.lastDirect=performance.now();this.path('direct');};channel.onmessage=e=>{try{if(e.data.length>22000)return;const packet=JSON.parse(e.data);if(!packet||typeof packet!=='object')return;
  if(packet.kind==='windbound:ping'){if(Number.isSafeInteger(packet.id)){this.control({kind:'windbound:pong',id:packet.id});if(typeof packet.probe==='string'&&packet.probe.length<32)this.startProbe(packet.probe);}return;}
  if(packet.kind==='windbound:pong'){const at=this.pings?.get(packet.id);if(at!==undefined){this.pings.delete(packet.id);const ms=performance.now()-at;this.directMs=this.directMs?this.directMs*.65+ms*.35:ms;}return;}
  if(packet.kind==='windbound:route'){if(packet.route==='relay'){this.remoteRelayUntil=performance.now()+Math.min(15000,Math.max(1000,Number(packet.hold)||12000));this.relay();}else if(packet.route==='direct'){this.remoteRelayUntil=0;if(this.routeChoice!=='relay'){this.lastDirect=performance.now();this.path('direct');}}return;}
  this.lastDirect=performance.now();if(this.routeChoice==='relay'||performance.now()<(this.remoteRelayUntil||0))return;this.deliver(packet);if(this.isDirect())this.path('direct');}catch{}};channel.onclose=()=>this.relay();}
 relay(){if(this.closed)return;this.path('relay');clearTimeout(this.timeout);if(this.polling)this.wakeRequested=true;else this.timeout=setTimeout(()=>this.loop(),0);}
 send(packet){this.latest={...packet,_net:{sent:performance.now(),echo:this.remoteStamp||0}};if(this.channel?.readyState==='open'&&this.routeChoice!=='relay'&&performance.now()>=(this.remoteRelayUntil||0)){if(this.channel.bufferedAmount>=16000){this.forceRelayUntil=performance.now()+1500;if(this.transport!=='relay')this.relay();return;}try{this.channel.send(JSON.stringify(this.latest,compactNumber));}catch{this.forceRelayUntil=performance.now()+1500;this.relay();}}}
 async loop(){if(this.closed||this.polling)return;this.polling=true;const loopStarted=performance.now(),direct=this.isDirect();
  try{
   const probing=this.isProbing();const b=await this.api(direct&&!probing?'poll':'sync',direct&&!probing?{}:{seq:++this.seq,packet:this.relayPacket()});if(this.closed)return;const elapsed=performance.now()-loopStarted;this.requestMs=this.requestMs?this.requestMs*.8+elapsed*.2:elapsed;this.fastSync=b.fastSync===true;if(Number.isFinite(b.serverMs))this.serverMs=b.serverMs;this.readRelay(b.packet);
   if(b.closed){this.onStatus('left');return;}
   if(b.joined&&!this.joined){this.joined=true;this.onStatus('joined');}
   if(this.seat===1&&b.offer)await this.answer(b.offer);
   if(this.seat===0&&this.pc&&b.answer&&!this.pc.remoteDescription)await this.pc.setRemoteDescription(JSON.parse(b.answer));
   if(!direct&&b.packet&&b.seq>this.remoteSeq){this.remoteSeq=b.seq;this.deliver(b.packet);this.path('relay');}
   this.errors=0;
   if(b.joined&&Date.now()-b.peerSeen>30000&&!direct){this.onStatus('left');return;}
  }catch(e){if(this.closed)return;if(e.status===404||e.status===410){this.onStatus('left');return;}this.errors=(this.errors||0)+1;this.onStatus('retry',e.message);if(this.errors>=5){this.onStatus('error','网络连接已中断，请返回重新创建房间。');return;}}finally{this.polling=false;}
  const period=this.isDirect()&&!this.isProbing()?10000:this.joined?150:700;
  const wait=this.wakeRequested?0:Math.max(0,period-(performance.now()-loopStarted));this.wakeRequested=false;
  if(!this.closed)this.timeout=setTimeout(()=>this.loop(),wait);
 }
 close(){if(this.closed)return;this.closed=true;this.epoch++;clearTimeout(this.timeout);clearTimeout(this.matchTimeout);clearInterval(this.watchdog);this.matchWake?.();const pending=this.matching&&this.matchTicket;this.matching=false;const body=pending?{action:'match_cancel',mode:this.mode,ticket:this.matchTicket}:this.token?{action:'leave',mode:this.mode,code:this.code,token:this.token}:null;if(body)fetch(roomEndpoint(),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),keepalive:true}).catch(()=>{});this.channel?.close();this.pc?.close();}
}


