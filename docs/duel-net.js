function roomEndpoint(){
 const value=window.WINDBOUND_ROOM_SERVICE;
 if(typeof value!=='string'||!value.trim())throw new Error('房间服务尚未配置，请先在 online-config.js 填写房间服务网址。');
 let url;try{url=new URL(value.trim());}catch{throw new Error('房间服务网址格式不正确，请使用完整的 HTTPS 地址。');}
 if(url.protocol!=='https:')throw new Error('房间服务需要使用 HTTPS 地址。');
 return new URL('/api/duel',url).href;
}
export class DuelLink{
 constructor(onPacket,onStatus,mode='duel'){this.mode=mode;this.onPacket=onPacket;this.onStatus=onStatus;this.seq=0;this.remoteSeq=-1;this.epoch=0;this.closed=false;this.latest=null;this.lastPeer=0;this.channel=null;this.pc=null;}
 async api(action,extra={}){const r=await fetch(roomEndpoint(),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,mode:this.mode,code:this.code,token:this.token,...extra}),signal:AbortSignal.timeout(8000)});if(!(r.headers.get('content-type')||'').includes('application/json')){const e=new Error('房间服务暂时无法访问，请检查服务地址、网络和部署状态。');e.status=r.status;throw e;}const b=await r.json();if(!r.ok){const e=new Error(b.error||'连接失败，请重试。');e.status=r.status;throw e;}return b;}
 async open(code){await this.checkMode();if(this.closed)return;const epoch=this.epoch;const b=await this.api(code?'join':'create',code?{code}:{});if(this.closed||epoch!==this.epoch)return;await this.connect(b);}
 async checkMode(){
  if(this.mode!=='hide')return;
  const response=await fetch(new URL('/api/health',roomEndpoint()),{cache:'no-store',signal:AbortSignal.timeout(8000)});
  let status;try{status=await response.json();}catch{throw new Error('房间服务暂时无法访问，请检查网络。');}
  if(!response.ok||status.hide!==true)throw new Error('捉迷藏服务尚未更新，请先部署捉迷藏版房间后台。');
 }
 async connect(b){if(this.closed)return;this.matching=false;this.code=b.code;this.token=b.token;this.seat=b.seat;this.lastPeer=performance.now();this.started=performance.now();this.onStatus('room',b);this.peer();if(this.seat===0&&this.pc){this.attach(this.pc.createDataChannel('wind-duel',{ordered:false,maxRetransmits:0}));await this.pc.setLocalDescription(await this.pc.createOffer());await this.gather();if(!this.closed)await this.api('signal',{sdp:JSON.stringify(this.pc.localDescription)});}else if(b.offer)await this.answer(b.offer);if(!this.closed)this.loop();}
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
 attach(channel){this.channel=channel;channel.onopen=()=>{this.lastPeer=performance.now();this.onStatus('direct');};channel.onmessage=e=>{try{if(e.data.length>22000)return;const packet=JSON.parse(e.data);this.lastPeer=performance.now();this.onPacket(packet);}catch{}};channel.onclose=()=>this.relay();}
 relay(){if(this.closed)return;this.onStatus('relay');clearTimeout(this.timeout);if(this.polling)this.wakeRequested=true;else this.timeout=setTimeout(()=>this.loop(),0);}
 send(packet){this.latest=packet;if(this.channel?.readyState==='open'&&this.channel.bufferedAmount<64000)this.channel.send(JSON.stringify(packet));}
 async loop(){if(this.closed||this.polling)return;this.polling=true;const direct=this.channel?.readyState==='open'&&performance.now()-this.lastPeer<1500;
  try{
   const b=await this.api(direct?'poll':'sync',direct?{}:{seq:++this.seq,packet:this.latest});if(this.closed)return;
   if(b.closed){this.onStatus('left');return;}
   if(b.joined&&!this.joined){this.joined=true;this.onStatus('joined');}
   if(this.seat===1&&b.offer)await this.answer(b.offer);
   if(this.seat===0&&this.pc&&b.answer&&!this.pc.remoteDescription)await this.pc.setRemoteDescription(JSON.parse(b.answer));
   if(!direct&&b.packet&&b.seq>this.remoteSeq){this.remoteSeq=b.seq;this.lastPeer=performance.now();this.onPacket(b.packet);this.onStatus('relay');}
   this.errors=0;
   if(b.joined&&Date.now()-b.peerSeen>30000&&!direct){this.onStatus('left');return;}
  }catch(e){if(this.closed)return;if(e.status===404||e.status===410){this.onStatus('left');return;}this.errors=(this.errors||0)+1;this.onStatus('retry',e.message);if(this.errors>=5){this.onStatus('error','网络连接已中断，请返回重新创建房间。');return;}}finally{this.polling=false;}
  const wait=this.wakeRequested?0:this.channel?.readyState==='open'&&performance.now()-this.lastPeer<1500?10000:this.joined?150:700;this.wakeRequested=false;
  if(!this.closed)this.timeout=setTimeout(()=>this.loop(),wait);
 }
 close(){if(this.closed)return;this.closed=true;this.epoch++;clearTimeout(this.timeout);clearTimeout(this.matchTimeout);this.matchWake?.();const pending=this.matching&&this.matchTicket;this.matching=false;const body=pending?{action:'match_cancel',mode:this.mode,ticket:this.matchTicket}:this.token?{action:'leave',mode:this.mode,code:this.code,token:this.token}:null;if(body)fetch(roomEndpoint(),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),keepalive:true}).catch(()=>{});this.channel?.close();this.pc?.close();}
}


