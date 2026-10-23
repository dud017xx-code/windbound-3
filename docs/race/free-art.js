import * as T from './vendor/three.module.js';
import {THEMES} from './free-schema.js';
export function createWorld(canvas){
 const renderer=new T.WebGLRenderer({canvas,antialias:false,alpha:false,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(canvas.clientWidth,canvas.clientHeight,false);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(48,1,.1,1400),root=new T.Group();scene.add(root);scene.fog=new T.Fog('#d6eeec',180,530);
 scene.add(new T.HemisphereLight('#edfaff','#9cae96',2.4));const sun=new T.DirectionalLight('#fff4da',3.4);sun.position.set(-50,100,50);scene.add(sun);
 const grid=new T.GridHelper(160,80,'#7caaa5','#aec9c1');grid.position.y=-.02;grid.material.transparent=true;grid.material.opacity=.19;scene.add(grid);
 const selection=new T.Box3Helper(new T.Box3(),'#e4b961');scene.add(selection);selection.visible=false;
 const geoms={box:new T.BoxGeometry(1,1,1),ball:new T.IcosahedronGeometry(1,1),cone:new T.ConeGeometry(1,1,6),cylinder:new T.CylinderGeometry(1,1,1,10),gem:new T.OctahedronGeometry(1),ring:new T.TorusGeometry(1,.045,5,40),disk:new T.CircleGeometry(1,16)};
 const shadowMaterial=new T.MeshBasicMaterial({color:'#315a50',transparent:true,opacity:.12,depthWrite:false});
 const materials=new Map();function mat(color,emissive=false){const key=color+emissive;if(!materials.has(key))materials.set(key,new T.MeshStandardMaterial({color,roughness:.85,metalness:emissive?.2:0,...(emissive?{emissive:color,emissiveIntensity:.25}:{})}));return materials.get(key);}
 function mesh(group,geom,color,pos,scale,rot){const m=new T.Mesh(typeof geom==='string'?geoms[geom]:geom,mat(color));m.position.set(...pos);m.scale.set(...scale);if(rot)m.rotation.set(...rot);group.add(m);return m;}
 const clouds=new T.Group();scene.add(clouds);for(let i=0;i<28;i++){const a=i*2.399,r=95+(i%4)*40;mesh(clouds,'ball','#eff7ed',[Math.cos(a)*r,-18-(i%5)*5,Math.sin(a)*r],[18+i%9,4,9]);}
 const meshes=new Map(),animated=[],runtimeHidden=new Set();
 function makeObject(o){const g=new T.Group(),[w,h,d]=o.size;g.position.set(...o.pos);g.rotation.y=o.yaw*Math.PI/180;g.userData.objectId=o.id;
  const box=(col,x,y,z,sx,sy,sz)=>mesh(g,'box',col,[x,y,z],[sx,sy,sz]);
  if(['ground','block','wall','rock','water','bounce','hazard'].includes(o.type)){
   if(o.type==='rock')mesh(g,'ball',o.color,[0,0,0],[w/2,h/2,d/2]);else box(o.color,0,0,0,w,h,d);
   if(o.type==='ground'){box('#dfe4c5',0,h/2+.025,0,w,.05,d);box(o.color,0,h*.33,0,w+.06,.25,d+.06);mesh(g,'cone','#a4b7aa',[0,-h*1.1,0],[w*.58,h*2,d*.58],[Math.PI,Math.PI/4,0]);}
   if(o.type==='block'){box('#f7efd7',0,h/2+.02,0,w,.04,d);for(const x of[-1,1])box('#bcae83',x*(w/2-.12),0,0,.1,h+.02,d);}
   if(o.type==='water'){for(let i=0;i<3;i++)box('#b8eee8',0,h/2+.015,-d*.3+i*d*.3,w*.6,.025,.08);}
   if(o.type==='bounce'||o.type==='hazard'){const a=o.type==='bounce'?'#fff3be':'#fff0d8';for(let i=-1;i<=1;i++)box(a,i*w/4,h/2+.02,0,.15,.04,d*.6);if(o.type==='bounce')mesh(g,'ring',a,[0,h/2+.05,0],[w*.35,d*.35,1],[Math.PI/2,0,0]);}
  }else if(o.type==='ramp'){
   const geom=new T.BufferGeometry();const v=[[-.5,-.5,-.5],[.5,-.5,-.5],[-.5,.5,-.5],[.5,.5,-.5],[-.5,-.5,.5],[.5,-.5,.5]],faces=[0,2,3,0,3,1,0,4,2,1,3,5,2,4,5,2,5,3,0,1,5,0,5,4],arr=[];for(const i of faces)arr.push(...v[i]);geom.setAttribute('position',new T.Float32BufferAttribute(arr,3));geom.computeVertexNormals();mesh(g,geom,o.color,[0,0,0],[w,h,d]);
  }else if(o.type==='stairs'){
   for(let i=0;i<6;i++){const height=h*(i+1)/6;box(o.color,0,-h/2+height/2,d/2-d*(i+.5)/6,w,height,d/6);box('#fbf1d5',0,-h/2+height+.02,d/2-d*(i+.5)/6,w,.04,d/6);}
  }else if(o.type==='house'){
   box(o.color,0,-h*.12,0,w,h*.76,d);mesh(g,'cone','#497c7c',[0,h*.36,0],[w*.78,h*.35,d*.78],[0,Math.PI/4,0]);
   box('#315f65',0,-h*.22,d/2+.02,w*.2,h*.52,.06);box('#c7e9de',-w*.3,0,d/2+.03,w*.18,h*.2,.08);box('#c7e9de',w*.3,0,d/2+.03,w*.18,h*.2,.08);box('#b6a580',0,-h*.49,d*.56,w*1.06,h*.04,d*.18);
  }else if(o.type==='tower'){
   mesh(g,'cylinder',o.color,[0,-h*.1,0],[w*.48,h*.8,d*.48]);mesh(g,'cone','#548786',[0,h*.35,0],[w*.64,h*.32,d*.64]);for(let i=0;i<2;i++)box('#386271',0,-h*.1+i*h*.23,d*.46,w*.16,h*.15,.12);
  }else if(o.type==='arch'){
   box(o.color,-w*.43,0,0,w*.14,h,d);box(o.color,w*.43,0,0,w*.14,h,d);box(o.color,0,h*.43,0,w,h*.14,d);for(const x of[-1,1]){box('#b6a778',x*w*.43,h*.26,0,w*.2,h*.045,d*1.16);box('#d3cdb5',x*w*.43,-h*.48,0,w*.24,h*.06,d*1.4);}mesh(g,'gem','#78b9ae',[0,h*.65,0],[w*.08,h*.08,d*.4]);
  }else if(o.type==='tree'){
   box('#a48665',0,-h*.25,0,w*.14,h*.5,d*.14);mesh(g,'ball',o.color,[0,h*.18,0],[w*.5,h*.32,d*.5]);mesh(g,'ball','#acd5b2',[w*.18,h*.28,0],[w*.31,h*.25,d*.34]);
  }else if(o.type==='crystal'){
   const gem=mesh(g,'gem',o.color,[0,0,0],[w*.5,h*.5,d*.5]);animated.push({id:o.id,gem,base:0});mesh(g,'ring','#e9e0b1',[0,-h*.38,0],[w*.55,d*.55,1],[Math.PI/2,0,0]);
  }else if(o.type==='checkpoint'){
   box('#dad5b9',0,-h*.1,0,w*.17,h*.8,d*.17);mesh(g,'gem',o.color,[0,h*.28,0],[w*.5,h*.27,d*.5]);mesh(g,'ring',o.color,[0,-h*.45,0],[w*.8,d*.8,1],[Math.PI/2,0,0]);
  }else if(o.type==='finish'){
   for(const x of[-1,1])box(o.color,x*w*.45,0,0,w*.06,h,d*.12);box(o.color,0,h*.4,0,w,h*.2,d*.12);for(let i=0;i<8;i++)box(i%2?'#fff1c5':'#2b7475',-w*.39+i*w*.11,h*.4,d*.07,w*.11,h*.17,.03);mesh(g,'ring',o.color,[0,-h*.49,0],[w*.5,d*.6,1],[Math.PI/2,0,0]);
  }else if(o.type==='spawn'){
   mesh(g,'cylinder',o.color,[0,0,0],[w*.5,h,d*.5]);mesh(g,'ring','#fff0c2',[0,h/2+.04,0],[w*.4,d*.4,1],[Math.PI/2,0,0]);mesh(g,'cone','#fff6d7',[0,h/2+.12,d*.15],[w*.18,.09,d*.27],[Math.PI/2,0,0]);
  }
  if(['house','tower','tree','arch','rock'].includes(o.type)){const shadow=new T.Mesh(geoms.disk,shadowMaterial);shadow.position.y=-h/2+.035;shadow.rotation.x=-Math.PI/2;shadow.scale.set(w*.62,d*.62,1);g.add(shadow);}
  g.userData.originalColor=o.color;g.traverse(m=>{if(m.isMesh)m.userData.originalMaterial=m.material;});root.add(g);meshes.set(o.id,g);return g;
 }
 function clear(){root.traverse(m=>{if(m.geometry&&!Object.values(geoms).includes(m.geometry))m.geometry.dispose();});root.clear();meshes.clear();animated.length=0;runtimeHidden.clear();}
 function build(map){clear();for(const o of map.objects)makeObject(o);scene.background=new T.Color(THEMES[map.theme].sky);scene.fog.color.set(THEMES[map.theme].fog);sun.color.set(THEMES[map.theme].sun);}
 const player=new T.Group();scene.add(player);player.visible=false;const playerShadow=new T.Mesh(geoms.disk,shadowMaterial);playerShadow.rotation.x=-Math.PI/2;playerShadow.scale.set(.5,.36,1);scene.add(playerShadow);playerShadow.visible=false;
 mesh(player,'cylinder','#163e51',[0,.94,0],[.25,.48,.18]);mesh(player,'ball','#f3d8bd',[0,1.48,0],[.23,.26,.22]);mesh(player,'ball','#e4eae3',[0,1.64,-.025],[.25,.18,.23]);
 for(const x of[-.09,.09])mesh(player,'ball','#2b7e87',[x,1.51,.205],[.025,.035,.016]);mesh(player,'box','#c2a366',[0,.78,.015],[.53,.08,.36]);mesh(player,'box','#f0e7ca',[-.18,1.02,.21],[.09,.43,.04]);
 const arms=[],legs=[];for(const side of[-1,1]){const arm=new T.Group();arm.position.set(side*.32,1.14,0);player.add(arm);mesh(arm,'box','#34576b',[0,-.2,0],[.16,.4,.18]);mesh(arm,'ball','#efd2b8',[0,-.43,0],[.09,.09,.09]);arms.push(arm);const leg=new T.Group();leg.position.set(side*.14,.75,0);player.add(leg);mesh(leg,'box','#18364b',[0,-.29,0],[.19,.57,.21]);mesh(leg,'box','#293d48',[0,-.67,.07],[.21,.16,.34]);legs.push(leg);}
 const scarf=mesh(player,'box','#64c6b5',[.1,1.25,-.29],[.22,.16,.68]);scarf.rotation.x=-.2;
 const orbit={target:new T.Vector3(0,0,0),yaw:.65,pitch:.68,distance:62};
 function cameraOrbit(){const d=orbit.distance,p=orbit.pitch;camera.position.set(orbit.target.x+Math.sin(orbit.yaw)*Math.cos(p)*d,orbit.target.y+Math.sin(p)*d,orbit.target.z+Math.cos(orbit.yaw)*Math.cos(p)*d);camera.lookAt(orbit.target);}
 function resize(){const w=canvas.clientWidth,h=canvas.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
 function select(id){const g=meshes.get(id);selection.visible=!!g;if(g)selection.box.setFromObject(g);}
 const ray=new T.Raycaster(),v2=new T.Vector2();function rayAt(x,y){const r=canvas.getBoundingClientRect();v2.set((x-r.x)/r.width*2-1,-(y-r.y)/r.height*2+1);camera.updateMatrixWorld();ray.setFromCamera(v2,camera);return ray;}
 function pick(x,y){root.updateMatrixWorld(true);const hits=rayAt(x,y).intersectObjects(root.children,true);if(!hits.length)return null;let g=hits[0].object;while(g&&!g.userData.objectId)g=g.parent;return {id:g?.userData.objectId,point:hits[0].point,normal:hits[0].face.normal.clone().transformDirection(hits[0].object.matrixWorld)};}
 function planePoint(x,y,height=0){const point=new T.Vector3();return rayAt(x,y).ray.intersectPlane(new T.Plane(new T.Vector3(0,1,0),-height),point);}
 function project(pos){camera.updateMatrixWorld(true);const p=new T.Vector3(...pos).project(camera),r=canvas.getBoundingClientRect();return {x:r.x+(p.x+1)*r.width/2,y:r.y+(1-p.y)*r.height/2,visible:p.z<1};}
 function updatePlayer(p,t){player.visible=!!p;playerShadow.visible=!!p&&p.grounded;if(!p)return;player.position.set(p.x,p.y,p.z);playerShadow.position.set(p.x,p.y+.03,p.z);player.rotation.y=p.yaw;const speed=Math.hypot(p.vx,p.vz),cycle=t*speed*1.6;legs.forEach((g,i)=>g.rotation.x=p.grounded?Math.sin(cycle+i*Math.PI)*Math.min(.85,speed*.09):i?-.45:.6);arms.forEach((g,i)=>g.rotation.x=p.grounded?-Math.sin(cycle+i*Math.PI)*Math.min(.7,speed*.07):-.7);scarf.rotation.x=-.2-speed*.025;}
 function applyRuntime(map){runtimeHidden.clear();for(const o of map.objects){const g=meshes.get(o.id);if(!g)continue;g.position.set(...o.pos);g.rotation.y=o.yaw*Math.PI/180;g.visible=o.visible!==false;if(!g.visible)runtimeHidden.add(o.id);if(g.userData.appliedColor!==o.color){g.traverse(m=>{if(m.isMesh&&m.material!==shadowMaterial)m.material=o.color===g.userData.originalColor?m.userData.originalMaterial:mat(o.color);});g.userData.appliedColor=o.color;}}}
 function render(t,p){for(const a of animated){a.gem.rotation.y=t*.9;a.gem.position.y=Math.sin(t*2+a.id.length)*.12;const g=meshes.get(a.id);if(g)g.visible=!runtimeHidden.has(a.id)&&!p?.collected.includes(a.id);}renderer.render(scene,camera);}
 function dispose(){clear();for(const g of Object.values(geoms))g.dispose();for(const m of materials.values())m.dispose();shadowMaterial.dispose();renderer.dispose();}
 resize();cameraOrbit();return {renderer,scene,camera,orbit,grid,selection,meshes,build,resize,select,pick,planePoint,project,cameraOrbit,updatePlayer,applyRuntime,render,dispose};
}
