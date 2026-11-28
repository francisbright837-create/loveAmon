/* Fortress of Embers: third-person dark-fantasy mode (three.js r128).
   v2: easier touch controls, 5 themed levels with portals, 5 demon types + a boss per level, and a new power every level. */
(function(){
const T=THREE,$=id=>document.getElementById(id);
const rand=(a,b)=>a+Math.random()*(b-a),clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),lerp=(a,b,t)=>a+(b-a)*t,ease=t=>t*t*(3-2*t),easeOut=t=>1-(1-t)*(1-t);
const adiff=(a,b)=>{let d=b-a;while(d>Math.PI)d-=2*Math.PI;while(d<-Math.PI)d+=2*Math.PI;return d};
const fwd=a=>[-Math.sin(a),-Math.cos(a)];            // heading -> forward direction (characters face -z)
const heading=(dx,dz)=>Math.atan2(-dx,-dz);
const TOUCH=(window.matchMedia&&matchMedia('(pointer:coarse)').matches)||'ontouchstart' in window;
const buzz=ms=>{try{navigator.vibrate&&navigator.vibrate(ms)}catch(e){}};

/* ---------- renderer, scene, lights ---------- */
const ren=new T.WebGLRenderer({antialias:true});ren.setPixelRatio(Math.min(devicePixelRatio||1,2));ren.shadowMap.enabled=true;ren.shadowMap.type=T.PCFSoftShadowMap;
ren.toneMapping=T.ACESFilmicToneMapping;ren.toneMappingExposure=1.15;ren.outputEncoding=T.sRGBEncoding;document.body.prepend(ren.domElement);
const scene=new T.Scene();scene.background=new T.Color(0x0b0809);scene.fog=new T.FogExp2(0x0b0809,.03);
const cam=new T.PerspectiveCamera(58,1,.1,140);
const resize=()=>{ren.setSize(innerWidth,innerHeight);cam.aspect=innerWidth/innerHeight;cam.updateProjectionMatrix()};addEventListener('resize',resize);resize();
const hemi=new T.HemisphereLight(0x8393b8,0x2a1d14,.75);scene.add(hemi);
const moon=new T.DirectionalLight(0xa9bce6,.8);moon.castShadow=true;moon.shadow.mapSize.set(1024,1024);
const sc=moon.shadow.camera;sc.left=sc.bottom=-24;sc.right=sc.top=24;sc.near=1;sc.far=110;scene.add(moon,moon.target);

/* ---------- the five places (colours, layout, props) ---------- */
const THEMES=[
 {name:'FORTRESS OF EMBERS',sub:'The husks are burning. Survive.',boss:'The Ember Warden',bg:0x0b0809,fog:.03,hemi:[0x8393b8,0x2a1d14],moon:0xa9bce6,hue:30,sat:6,lum:26,fireHue:null,fire:0xff8a3a,ember:0xffb060,prop:'crate',stairs:true,center:'none',
  pillars:()=>[[-16,-4],[16,-4],[-16,14],[16,14],[-8,26],[8,26]],braz:[[-9,8],[9,8],[-9,-8],[9,-8]]},
 {name:'ASHEN CATACOMBS',sub:'The dead do not rest here.',boss:'The Ashen Lord',bg:0x060b09,fog:.036,hemi:[0x6fa088,0x14201a],moon:0x8fd0b0,hue:150,sat:9,lum:24,fireHue:135,fire:0x5cff8a,ember:0x8cffb0,prop:'coffin',center:'altar',
  pillars:()=>{const a=[];for(let i=0;i<8;i++){const r=i/8*Math.PI*2;a.push([Math.cos(r)*17,8+Math.sin(r)*17])}return a},braz:[[9,8],[-9,8],[4.5,15.8],[-4.5,15.8],[4.5,0.2],[-4.5,0.2]]},
 {name:'CRIMSON ABYSS',sub:'Even the stone bleeds.',boss:'The Crimson Tyrant',bg:0x120405,fog:.036,hemi:[0xb86a6a,0x2a0c0c],moon:0xff9a8a,hue:2,sat:26,lum:20,fireHue:8,fire:0xff3a2a,ember:0xff6a40,prop:'spike',center:'mono',
  propSpec:{color:0x1a0808,emissive:0x701010,emissiveIntensity:.55,roughness:.5},
  pillars:()=>[[-20,-8],[0,-8],[20,-8],[-20,12],[20,12],[-20,30],[20,30],[0,30]],braz:[[-10,-6],[10,-6],[-10,20],[10,20]]},
 {name:'FROSTBOUND CITADEL',sub:'The cold hunts for you.',boss:'The Frost Sovereign',bg:0x080c14,fog:.026,hemi:[0x9ac0f0,0x1a2433],moon:0xbfe0ff,hue:210,sat:14,lum:34,fireHue:195,fire:0x6ad0ff,ember:0xaee6ff,prop:'ice',center:'crystal',
  propSpec:{color:0x9fdcff,emissive:0x1a6aa0,emissiveIntensity:.6,roughness:.15,transparent:true,opacity:.85},
  pillars:()=>[[-12,-4],[12,-4],[-12,20],[12,20],[-26,8],[26,8]],braz:[[-6,6],[6,6],[0,-12],[0,26]]},
 {name:'THRONE OF THE VOID',sub:'Nothing is left to lose.',boss:'The Void King',bg:0x0a0612,fog:.034,hemi:[0xa08ae0,0x1a1030],moon:0xc8b0ff,hue:270,sat:16,lum:26,fireHue:280,fire:0xb070ff,ember:0xd0a0ff,prop:'void',center:'gate',
  propSpec:{color:0x2a1a50,emissive:0x6a2aff,emissiveIntensity:.7,roughness:.4},
  pillars:()=>{const a=[];let tries=0;while(a.length<7&&tries++<200){const x=rand(-30,30),z=rand(-14,32);if(Math.hypot(x,z-22)<7||Math.hypot(x,z-6)<6||a.some(p=>Math.hypot(p[0]-x,p[1]-z)<10))continue;a.push([x,z])}return a},braz:[[-14,6],[14,6],[0,-10]]}
];

/* ---------- textures & materials (all drawn in code) ---------- */
let TH=THEMES[0];
function tex(w,draw,rx,ry){const c=document.createElement('canvas');c.width=c.height=w;draw(c.getContext('2d'),w);const t=new T.CanvasTexture(c);t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(rx,ry);t.anisotropy=4;t.encoding=T.sRGBEncoding;return t}
const speck=(g,w,n)=>{for(let i=0;i<n;i++){g.fillStyle='rgba(0,0,0,'+Math.random()*.28+')';g.fillRect(Math.random()*w,Math.random()*w,2,2)}};
const bricks=(g,w)=>{g.fillStyle='hsl('+TH.hue+',20%,7%)';g.fillRect(0,0,w,w);for(let r=0;r<8;r++)for(let c=-1;c<4;c++){g.fillStyle='hsl('+TH.hue+','+(TH.sat+Math.random()*6)+'%,'+(TH.lum+Math.random()*13)+'%)';g.fillRect(c*64+(r%2)*32+2,r*32+2,60,28)}speck(g,w,700)};
const flags=(g,w)=>{g.fillStyle='hsl('+TH.hue+',20%,6%)';g.fillRect(0,0,w,w);for(let r=0;r<4;r++)for(let c=0;c<4;c++){g.fillStyle='hsl('+TH.hue+','+Math.max(3,TH.sat-2)+'%,'+(TH.lum-4+Math.random()*12)+'%)';g.fillRect(c*64+2,r*64+2,60,60)}speck(g,w,900);g.strokeStyle='rgba(0,0,0,.4)';for(let i=0;i<6;i++){g.beginPath();g.moveTo(Math.random()*w,Math.random()*w);g.lineTo(Math.random()*w,Math.random()*w);g.stroke()}};
const planks=(g,w)=>{for(let i=0;i<8;i++){g.fillStyle='hsl(26,'+(30+Math.random()*10)+'%,'+(20+Math.random()*9)+'%)';g.fillRect(i*32,0,30,w);g.fillStyle='rgba(0,0,0,.4)';g.fillRect(i*32+30,0,2,w);for(let k=0;k<14;k++){g.fillStyle='rgba(0,0,0,.14)';g.fillRect(i*32+Math.random()*28,Math.random()*w,1,10+Math.random()*40)}}};
const std=(map,r)=>new T.MeshStandardMaterial({map,roughness:r||.95,metalness:0});
let brickTex=null,woodTex=null;
const stone=(rx,ry)=>{const t=brickTex.clone();t.needsUpdate=true;t.repeat.set(rx,ry);return std(t)};
const wood=(rx,ry)=>{const t=woodTex.clone();t.needsUpdate=true;t.repeat.set(rx,ry);return std(t)};
const plain=(c,r,m)=>new T.MeshStandardMaterial({color:c,roughness:r==null?.6:r,metalness:m||0});
function glowTex(stops){const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d'),r=g.createRadialGradient(32,32,2,32,32,32);stops.forEach(s=>r.addColorStop(s[0],s[1]));g.fillStyle=r;g.fillRect(0,0,64,64);return new T.CanvasTexture(c)}
const fireTex=h=>glowTex([[0,'hsla('+h+',100%,92%,1)'],[.25,'hsla('+h+',100%,62%,.9)'],[.6,'hsla('+h+',90%,42%,.35)'],[1,'hsla('+h+',80%,25%,0)']]);
const flameTex0=glowTex([[0,'rgba(255,245,200,1)'],[.25,'rgba(255,170,60,.9)'],[.6,'rgba(220,70,20,.35)'],[1,'rgba(120,20,0,0)']]);
const dotTex=glowTex([[0,'rgba(255,230,160,1)'],[.5,'rgba(255,120,30,.6)'],[1,'rgba(255,60,0,0)']]);
const softTex=glowTex([[0,'rgba(255,255,255,1)'],[.3,'rgba(255,255,255,.7)'],[.65,'rgba(255,255,255,.2)'],[1,'rgba(255,255,255,0)']]);
const spriteMat=map=>new T.SpriteMaterial({map,blending:T.AdditiveBlending,transparent:true,depthWrite:false});
const flameMat0=spriteMat(flameTex0),softMat=spriteMat(softTex);
let flameMat=flameMat0;

/* ---------- the arena (rebuilt for every level) ---------- */
let env=null,groundY=()=>0;
const colliders=[];                         // circles that block walking
const flames=[],lights=[],sources=[];       // flickering fire
function box(w,h,d,mat,x,y,z,sh){const m=new T.Mesh(new T.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);m.castShadow=m.receiveShadow=sh!==false;env.add(m);return m}
function cyl(r0,r1,h,mat,x,y,z){const m=new T.Mesh(new T.CylinderGeometry(r0,r1,h,12),mat);m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;env.add(m);return m}
function cone(r,h,mat,x,y,z){const m=new T.Mesh(new T.ConeGeometry(r,h,7),mat);m.position.set(x,y,z);m.castShadow=true;env.add(m);return m}
function fire(x,y,z,size,light){const s=new T.Sprite(flameMat);s.position.set(x,y,z);s.scale.set(size,size*1.5,1);env.add(s);flames.push({s,size,p:rand(0,6)});sources.push({x,y,z});
  if(light){const L=new T.PointLight(TH.fire,2.6,22,1.5);L.position.set(x,y+.4,z);env.add(L);lights.push({L,p:rand(0,6)})}}
function clearEnv(){if(!env)return;scene.remove(env);
  env.traverse(o=>{if(o.isMesh){o.geometry.dispose();const m=o.material;if(m){if(m.map)m.map.dispose();m.dispose()}}});
  if(flameMat!==flameMat0){if(flameMat.map)flameMat.map.dispose();flameMat.dispose()}
  env=null;colliders.length=flames.length=lights.length=sources.length=0;portal=null}

function buildArena(L){
  clearEnv();TH=THEMES[(L-1)%THEMES.length];env=new T.Group();scene.add(env);
  scene.background.setHex(TH.bg);scene.fog.color.setHex(TH.bg);scene.fog.density=TH.fog;
  hemi.color.setHex(TH.hemi[0]);hemi.groundColor.setHex(TH.hemi[1]);moon.color.setHex(TH.moon);emberMat.color.setHex(TH.ember);
  flameMat=TH.fireHue==null?flameMat0:spriteMat(fireTex(TH.fireHue));
  brickTex=tex(256,bricks,1,1);woodTex=tex(256,planks,1,1);groundY=()=>0;
  const floor=new T.Mesh(new T.PlaneGeometry(80,80),std(tex(256,flags,20,20)));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;env.add(floor);
  [[0,-40,80,2],[0,40,80,2],[-40,0,2,80],[40,0,2,80]].forEach(a=>box(a[2],14,a[3],stone(a[2]/4,3.5),a[0],7,a[1]));
  box(9,7,1,plain(0x030203),0,3.5,-38.7);                              // dark gate
  for(let i=-30;i<=30;i+=15){[[i,-38.6],[i,38.6]].forEach(p=>box(1.8,9,1.4,stone(.5,2),p[0],4.5,p[1]));[[-38.6,i],[38.6,i]].forEach(p=>box(1.4,9,1.8,stone(.5,2),p[0],4.5,p[1]))}
  [[-15,-37.4],[15,-37.4],[-30,37.4],[30,37.4],[-37.4,0],[37.4,-15],[37.4,15],[-37.4,25]].forEach((p,i)=>{box(.2,.6,.2,plain(0x2a2018),p[0],3.2,p[1]);fire(p[0],3.8,p[1],1.6,i<3)});
  // level 1 only: wooden stairway + deck
  if(TH.stairs){
    const WOOD=wood(2,1),DECK={x0:-12,x1:12,z0:-38,z1:-22,y:3},ST={x0:-4,x1:4,z0:-22,z1:-14};
    for(let i=0;i<16;i++)box(8,(i+1)*.1875,.5,WOOD,0,(i+1)*.1875/2,-14-(i+.5)*.5);
    box(24,.5,16,wood(6,3),0,2.75,-30);
    [-4.3,4.3].forEach(x=>{const r=box(.12,.12,8.54,WOOD,x,2.2,-18);r.rotation.x=Math.atan(3/8);for(let i=0;i<=8;i++)box(.14,1.1,.14,WOOD,x,i*.375+.55,-14-i)});
    for(let x=-12;x<=12;x+=2){if(Math.abs(x)>4.3)box(.14,1.1,.14,WOOD,x,3.55,-22)}box(7.4,.12,.12,WOOD,-8.3,4.1,-22);box(7.4,.12,.12,WOOD,8.3,4.1,-22);
    [-12,12].forEach(x=>{box(.12,.12,16,WOOD,x,4.1,-30);for(let z=-38;z<=-22;z+=2)box(.14,1.1,.14,WOOD,x,3.55,z)});
    fire(-11,4.1,-23,1.4,false);fire(11,4.1,-23,1.4,false);
    groundY=(x,z)=>(x>ST.x0&&x<ST.x1&&z<=ST.z1&&z>=ST.z0)?3*((-14-z)/8):(x>DECK.x0&&x<DECK.x1&&z<ST.z0&&z>DECK.z0)?3:0}
  // pillars
  TH.pillars().forEach(p=>{cyl(.85,1,11,stone(1,3),p[0],5.5,p[1]);cyl(1.2,1.2,.5,stone(1,.3),p[0],11,p[1]);colliders.push({x:p[0],z:p[1],r:1.1})});
  // centre piece
  const C=TH.center;
  if(C==='altar'){box(4,.9,3,stone(1,.4),0,.45,6);box(2.6,.5,2,stone(1,.3),0,1.15,6);fire(0,2.1,6,2.4,true);colliders.push({x:0,z:6,r:2.3})}
  else if(C==='mono'){box(2.6,.5,2.6,stone(1,.3),0,.25,6);box(2.2,10,2.2,plain(0x120608,.3,.6),0,5.4,6);fire(0,10.8,6,3,true);colliders.push({x:0,z:6,r:1.8})}
  else if(C==='crystal'){const im=new T.MeshStandardMaterial(TH.propSpec);cone(1.6,7,im,0,3.5,6);cone(.9,4.5,im,1.5,2.2,6.8).rotation.z=-.25;cone(.8,3.8,im,-1.4,1.9,5.4).rotation.z=.25;fire(0,1.4,6,1.8,true);colliders.push({x:0,z:6,r:2.3})}
  else if(C==='gate'){const rg=new T.Mesh(new T.TorusGeometry(2.4,.28,10,36),new T.MeshStandardMaterial({color:0x2a1a50,emissive:0x8a3aff,emissiveIntensity:1,roughness:.4}));rg.position.set(0,3,6);env.add(rg);
    const dk=new T.Mesh(new T.CircleGeometry(2.2,32),new T.MeshBasicMaterial({color:0x2a0a60,transparent:true,opacity:.55,side:T.DoubleSide}));dk.position.set(0,3,6);env.add(dk);
    box(1,.6,1,stone(1,.3),-2.4,.3,6);box(1,.6,1,stone(1,.3),2.4,.3,6);fire(0,3,6,2.6,true);colliders.push({x:-2.4,z:6,r:.8},{x:2.4,z:6,r:.8})}
  // props
  const pm=TH.propSpec?new T.MeshStandardMaterial(TH.propSpec):null;
  for(let i=0;i<14;i++){const x=rand(-34,34),z=rand(-10,34);if(Math.hypot(x,z-8)<7||Math.hypot(x,z-22)<4||colliders.some(c=>Math.hypot(c.x-x,c.z-z)<c.r+1.5))continue;
    const K=TH.prop;
    if(K==='crate'){if(i%2){box(1.4,1.4,1.4,wood(1,1),x,.7,z).rotation.y=rand(0,3);colliders.push({x,z,r:.95})}else{cyl(.5,.55,1.1,wood(1,1),x,.55,z);colliders.push({x,z,r:.6})}}
    else if(K==='coffin'){box(1.1,.7,2.3,stone(.5,.5),x,.35,z).rotation.y=rand(0,3);colliders.push({x,z,r:1})}
    else{const n=K==='spike'?1:3;for(let k=0;k<n;k++){const h=rand(1.2,2.8)*(K==='spike'?1.4:1);const c=cone(rand(.25,.5),h,pm,x+(n>1?rand(-.5,.5):0),h/2,z+(n>1?rand(-.5,.5):0));c.rotation.z=rand(-.15,.15)}colliders.push({x,z,r:.7})}}
  // braziers
  TH.braz.forEach((p,i)=>{cyl(.45,.3,.5,plain(0x241a14,.5,.5),p[0],.9,p[1]);cyl(.1,.1,.7,plain(0x241a14),p[0],.35,p[1]);fire(p[0],1.4,p[1],2.2,i<2);colliders.push({x:p[0],z:p[1],r:.6})});
}

// drifting embers
const EN=420,epos=new Float32Array(EN*3),evel=[],egeo=new T.BufferGeometry();
for(let i=0;i<EN;i++){evel.push({vx:rand(-.3,.3),vy:rand(.8,2.2),vz:rand(-.3,.3),l:rand(0,3)});epos[i*3+1]=-50}
egeo.setAttribute('position',new T.BufferAttribute(epos,3));
const emberMat=new T.PointsMaterial({size:.16,map:dotTex,blending:T.AdditiveBlending,transparent:true,depthWrite:false,color:0xffb060});
scene.add(new T.Points(egeo,emberMat));
function emberStep(dt){const src=sources.concat(foes.filter(e=>!e.dead).map(e=>({x:e.pos.x,y:e.pos.y+1,z:e.pos.z})));if(!src.length)return;
  for(let i=0;i<EN;i++){const v=evel[i];v.l-=dt;if(v.l<=0){const s=src[(Math.random()*src.length)|0];epos[i*3]=s.x+rand(-.4,.4);epos[i*3+1]=s.y;epos[i*3+2]=s.z+rand(-.4,.4);v.l=rand(1.2,3.2)}
   epos[i*3]+=(v.vx+Math.sin(v.l*3+i)*.3)*dt;epos[i*3+1]+=v.vy*dt;epos[i*3+2]+=v.vz*dt}egeo.attributes.position.needsUpdate=true}

/* ---------- articulated characters ---------- */
const limb=(len,r0,r1,mat)=>{const m=new T.Mesh(new T.CylinderGeometry(r0,r1,len,8),mat);m.position.y=-len/2;m.castShadow=true;return m};
const part=(g,mat,x,y,z)=>{const m=new T.Mesh(g,mat);m.position.set(x,y,z);m.castShadow=true;return m};
function makeRig(c){
  const R={},root=new T.Group(),body=new T.Group();root.add(body);R.root=root;R.body=body;
  const hips=new T.Group();hips.position.y=.95;body.add(hips);R.hips=hips;hips.add(part(new T.BoxGeometry(.4,.2,.26),c.armor,0,0,0));
  [[1,'r'],[-1,'l']].forEach(([s,n])=>{
    const th=new T.Group();th.position.set(s*.12,-.08,0);hips.add(th);th.add(limb(.46,.09,.07,c.armor));
    const sh=new T.Group();sh.position.y=-.46;th.add(sh);sh.add(limb(.46,.07,.06,c.armor));sh.add(part(new T.BoxGeometry(.13,.07,.28),c.trim,0,-.47,-.05));R[n+'T']=th;R[n+'S']=sh});
  const tor=new T.Group();tor.position.y=.12;hips.add(tor);R.tor=tor;
  tor.add(part(new T.BoxGeometry(.46,.52,.28),c.armor,0,.3,0));tor.add(part(new T.BoxGeometry(.48,.07,.3),c.trim,0,.04,0));
  const head=new T.Group();head.position.y=.68;tor.add(head);R.head=head;
  head.add(part(new T.SphereGeometry(.12,10,8),c.skin,0,0,0));
  if(c.demon){[-1,1].forEach(s=>{const h=part(new T.ConeGeometry(.04,.22*(c.horn||1),6),plain(0x120808),s*.09,.12,-.02);h.rotation.z=-s*.5;head.add(h);head.add(part(new T.BoxGeometry(.05,.025,.02),new T.MeshBasicMaterial({color:c.eye||0xffc060}),s*.05,.02,-.115))})}
  else{head.add(part(new T.CylinderGeometry(.135,.145,.2,10),c.armor,0,.03,0));head.add(part(new T.BoxGeometry(.2,.03,.05),plain(0x050505),0,.03,-.13));const pl=part(new T.ConeGeometry(.04,.3,6),new T.MeshStandardMaterial({color:0x8a1d1d,roughness:.8}),0,.28,.04);pl.rotation.x=.5;head.add(pl)}
  [[1,'r'],[-1,'l']].forEach(([s,n])=>{
    tor.add(part(new T.SphereGeometry(.11,8,6),c.trim,s*.3,.52,0));
    const sh=new T.Group();sh.position.set(s*.3,.5,0);tor.add(sh);sh.add(limb(.32,.07,.06,c.armor));
    const el=new T.Group();el.position.y=-.32;sh.add(el);el.add(limb(.3,.06,.05,c.armor));
    const hand=new T.Group();hand.position.y=-.3;el.add(hand);hand.add(part(new T.SphereGeometry(.06,6,6),c.skin,0,0,0));R[n+'A']=sh;R[n+'F']=el;R[n+'H']=hand});
  if(c.sword){const g=new T.Group();g.add(part(new T.BoxGeometry(.05,.05,.06),plain(0x3a2a1a),0,0,0));g.add(part(new T.BoxGeometry(.22,.04,.05),c.trim,0,-.05,0));
    const bm=new T.MeshStandardMaterial({color:0xcfd8e6,roughness:.25,metalness:.9,emissive:0x2a4a7a,emissiveIntensity:.6});
    g.add(part(new T.BoxGeometry(.06,1.05,.018),bm,0,-.6,0));g.rotation.x=-1.4;R.rH.add(g);R.sword=g;R.bladeMat=bm}
  if(c.cape){const cp=new T.Group();cp.position.set(0,.55,.15);tor.add(cp);const pm=new T.Mesh(new T.PlaneGeometry(.5,.95,1,3),new T.MeshStandardMaterial({color:0x7a1818,roughness:.9,side:T.DoubleSide}));pm.position.y=-.475;pm.castShadow=true;cp.add(pm);R.cape=cp}
  if(c.flames){R.fl=[];[[0,.45,0,2.5],[0,.95,0,1.7],[.35,.1,0,1.3],[-.35,.1,0,1.3]].forEach(a=>{const fm=(c.flameCol!=null?softMat:flameMat0).clone();fm.color.setHex(c.flameCol!=null?c.flameCol:0xff8a40);const s=new T.Sprite(fm);s.position.set(a[0],a[1],a[2]);s.scale.set(a[3],a[3]*1.4,1);tor.add(s);R.fl.push(s)})}
  root.scale.setScalar(c.scale||1);scene.add(root);return R}
const newState=()=>({prep:0,sp:0,ph:Math.random()*6,at:null,roll:null,hit:0,dead:0,face:0,combo:0});
// pose targets are eased toward each frame so every blend between idle / run / swing looks fluid
const damp=(o,x,y,z,k)=>{o.rotation.x+=(x-o.rotation.x)*k;o.rotation.y+=(y-o.rotation.y)*k;o.rotation.z+=(z-o.rotation.z)*k};
const KEYS=[[0,0,0,0,0,0,0,0],[2.7,.2,.9,.3,.55,-.15,-.5,.35],[.3,0,.25,0,.15,-.5,.9,-.6]];       // overhead: rest, wind-up, strike
const SIDE=[[1.1,.2,.8,.5,-.2,0,-.3,.3],[1.2,1.6,.5,.3,-.75,-.05,-.4,.4],[1.0,-.9,.3,.2,.95,-.2,.7,-.5]]; // side slash
function pose(R,S,dt,t){
  const k=Math.min(1,dt*16),sp=S.sp,gait=sp>.04;S.ph+=dt*(5+sp*7)*(gait?1:0);const p=S.ph,sn=Math.sin(p),cs=Math.cos(p);
  let rAx=0,rAz=.05,rF=.25+sp*.5,lAx=0,lFx=.25+sp*.5,tY=0,tX=-.18*sp,rT=sn*sp*.95,lT=-sn*sp*.95,rS=-(.1+Math.max(0,cs)*1.1)*sp,lS=-(.1+Math.max(0,-cs)*1.1)*sp,hipY=.95-Math.abs(sn)*.06*sp,bodyX=0,hx=0;
  rAx=-sn*.8*sp;lAx=sn*.8*sp;tY=-sn*.2*sp;
  if(!gait){const b=Math.sin(t*2+S.ph)*.02;tX=b;rAx=.05+b;lAx=.05-b;rF=.3;lFx=.3}
  let kf=k;
  if(S.at){const a=S.at,u=a.t/a.dur,K=a.kind===1?SIDE:KEYS;let A,B,w;
    if(u<.4){A=K[0];B=K[1];w=ease(u/.4)}else if(u<.62){A=K[1];B=K[2];w=easeOut((u-.4)/.22)}else{A=K[2];B=K[0];w=ease((u-.62)/.38)}
    const m=i=>lerp(A[i],B[i],w);rAx=m(0);rAz=m(1);rF=m(2);lAx=m(3);tY=m(4);tX=m(5);rT=m(6);lT=m(7);rS=-.5;lS=-.4;kf=Math.min(1,dt*30);bodyX=-.05*(u>.4&&u<.62?1:0)}
  if(S.prep){const u=S.prep;rAx=lerp(rAx,2.6,u);lAx=lerp(lAx,2.4,u);rF=.5;lFx=.5;tX=.25*u}                                                       // enemy wind-up: both arms overhead
  if(S.hit>0){tX=.5;rAx=.8;lAx=.8;hx=.35;kf=Math.min(1,dt*30)}
  R.hips.position.y=hipY;
  damp(R.rT,rT,0,-.04,kf);damp(R.lT,lT,0,.04,kf);damp(R.rS,rS,0,0,kf);damp(R.lS,lS,0,0,kf);
  damp(R.tor,tX,tY,0,kf);damp(R.rA,rAx,0,rAz,kf);damp(R.lA,lAx,0,-.05,kf);damp(R.rF,rF,0,0,kf);damp(R.lF,lFx,0,0,kf);damp(R.head,hx-tX*.5,-tY*.5,0,k);
  if(R.cape){R.cape.rotation.x+=(-(.12+sp*.7+(S.at?.4:0)+Math.sin(t*3)*.05)-R.cape.rotation.x)*.2}
  // roll / death overrides
  if(S.roll){const u=S.roll.t/S.roll.dur;const th=-u*Math.PI*2;R.body.rotation.x=th;R.body.position.set(0,.95-.95*Math.cos(th)-.35,-.95*Math.sin(th));R.rT.rotation.x=1.6;R.lT.rotation.x=1.6;R.rS.rotation.x=-2;R.lS.rotation.x=-2;R.tor.rotation.x=-.9;R.rA.rotation.x=1.4;R.lA.rotation.x=1.4}
  else if(S.dead>0){const u=Math.min(1,S.dead/.9);R.body.rotation.x=lerp(0,1.5,easeOut(u));R.body.position.y=lerp(0,.12,u);R.rA.rotation.z=lerp(R.rA.rotation.z,1.2,u*.2);R.lA.rotation.z=-1}
  else{R.body.rotation.x+=(bodyX-R.body.rotation.x)*.3;R.body.position.y+=(0-R.body.position.y)*.3;R.body.position.z+=(0-R.body.position.z)*.3}
  if(R.fl)R.fl.forEach((s,i)=>{const f=1+Math.sin(t*14+i*2)*.12;s.scale.set(s.scale.x,s.scale.x*1.4*f,1);s.material.opacity=S.dead>0?Math.max(0,1-S.dead/1.4):1})}

/* ---------- powers: one new power at the end of each level ---------- */
const POWERS=[
 {id:'swift',icon:'💨',name:'Wind Step',desc:'You move, roll and strike faster'},
 {id:'fire',icon:'🔥',name:'Flame Blade',desc:'Your sword burns what it cuts'},
 {id:'bolt',icon:'⚡',name:'Storm Edge',desc:'Lightning leaps between demons'},
 {id:'drain',icon:'🩸',name:'Soul Drinker',desc:'Every kill heals you'},
 {id:'quake',icon:'🌋',name:'Earthbreaker',desc:'Heavy strikes shatter the ground'}];
let powers=new Set();

/* ---------- player ---------- */
const SAVE='fortress-save-v1';
const loadSave=()=>{try{return JSON.parse(localStorage.getItem(SAVE))||{}}catch(e){return{}}};
const writeSave=n=>{try{localStorage.setItem(SAVE,JSON.stringify({level:n,souls:P.souls}))}catch(e){}};
const hero=makeRig({armor:plain(0x2c3038,.35,.85),trim:plain(0xb08a45,.4,.8),skin:plain(0xcaa88a,.8),sword:true,cape:true,scale:1.05});
const P={pos:new T.Vector3(0,0,22),vel:new T.Vector3(),hp:100,max:100,st:100,souls:0,S:newState(),stT:0,lock:null,wantAtk:0,dead:false,iframe:0,spd:1,atk:1,dmgMul:1,stRegen:24};
P.S.face=0;hero.root.position.copy(P.pos);
// sword effects for the fire / lightning powers
hero.fxFire=[0,1,2].map(i=>{const s=new T.Sprite(softMat.clone());s.material.color.setHex(0xff6a1a);s.position.set(0,-.35-i*.3,0);s.scale.set(.5,.7,1);s.visible=false;hero.sword.add(s);return s});
hero.fxBolt=[0,1,2].map(()=>{const s=new T.Sprite(softMat.clone());s.material.color.setHex(0xaad4ff);s.scale.set(.32,.32,1);s.visible=false;hero.sword.add(s);return s});
hero.swLight=new T.PointLight(0xff7020,0,7,2);hero.swLight.position.set(0,-.6,0);hero.sword.add(hero.swLight);
function swordFx(t){const f=powers.has('fire'),b=powers.has('bolt');
  hero.fxFire.forEach((s,i)=>{s.visible=f;if(f){const k=1+Math.sin(t*18+i*2)*.2;s.scale.set(.5*k,.75*k,1)}});
  hero.fxBolt.forEach(s=>{s.visible=b&&Math.random()<.5;if(s.visible)s.position.set(rand(-.08,.08),-.2-Math.random()*.9,0)});
  let col=0x2a4a7a,ei=.6;
  if(f&&!b){col=0xff5a10;ei=1.3}else if(b&&!f){col=0x6aaaff;ei=1.5+Math.random()*.8}else if(f&&b){col=Math.random()<.5?0xff5a10:0x6aaaff;ei=1.5}
  hero.bladeMat.emissive.setHex(col);hero.bladeMat.emissiveIntensity=ei;hero.swLight.color.setHex(col);hero.swLight.intensity=(f||b)?1.3:0}
function renderPowers(){const el=$('powers');el.innerHTML='';POWERS.forEach(p=>{if(powers.has(p.id)){const d=document.createElement('div');d.className='pw';d.textContent=p.icon;d.title=p.name;el.appendChild(d)}})}
function applyStats(){const sw=powers.has('swift');P.spd=sw?1.3:1;P.atk=sw?.82:1;P.stRegen=sw?33:24;P.dmgMul=1+(level>POWERS.length?(level-POWERS.length)*.08:0);
  const mx=100+(level-1)*10;if(mx!==P.max){P.hp+=mx-P.max;P.max=mx}renderPowers()}

/* ---------- enemies ---------- */
const TYPES={
 husk:  {hp:70, spd:3.5,dmg:12,rng:1.9,scale:1,   souls:60,  wind:.55,rec:.7, em:0xff4a10,col:0x2a0e06},
 imp:   {hp:42, spd:6.2,dmg:10,rng:1.7,scale:.82, souls:50,  wind:.3, rec:.5, em:0xff2a50,col:0x2a0610,flameCol:0xff3060,eye:0xffffff,lunge:true},
 brute: {hp:170,spd:2.3,dmg:24,rng:2.5,scale:1.5, souls:200, wind:.85,rec:1.1,em:0xff4a10,col:0x2a0e06,horn:1.5},
 caster:{hp:55, spd:2.6,dmg:14,rng:0,  scale:1,   souls:120, wind:.65,rec:.8, em:0x6a30ff,col:0x10082a,flameCol:0x9a60ff,eye:0xd0a0ff,ranged:true,keep:11},
 boss:  {hp:420,spd:2.6,dmg:30,rng:3.6,scale:2.6, souls:1500,wind:.8, rec:1.0, em:0xff1a00,col:0x180606,flameCol:0xff3a10,eye:0xffffff,horn:2,ranged:true,aoe:5.4}
};
const foes=[],shots=[],fxs=[];
let level=1,wave=0,waves=3,waveWait=1.5,levelClear=false,transitioning=false,portal=null,shake=0;
function spawn(type,at){
  const D=TYPES[type],lm=1+(level-1)*(type==='boss'?.3:.22),dmm=1+(level-1)*.12;
  const dark=plain(D.col,.9),hot=new T.MeshStandardMaterial({color:D.col,emissive:D.em,emissiveIntensity:.55,roughness:.8});
  const sc=D.scale*(type==='boss'?1:rand(.95,1.1));
  const rig=makeRig({armor:hot,trim:dark,skin:hot,demon:true,flames:true,flameCol:D.flameCol,eye:D.eye,horn:D.horn,scale:sc});
  const pos=at?at.clone():new T.Vector3(rand(-28,28),0,rand(-18,2));pushOut(pos,.5);
  const e={rig,S:newState(),pos,hp:Math.round(D.hp*lm),max:Math.round(D.hp*lm),spd:D.spd*(1+Math.min(.3,(level-1)*.04)),dmg:Math.round(D.dmg*dmm),rng:D.rng,type,T:D,sc,
    heavy:type==='brute'||type==='boss',boss:type==='boss',keep:D.keep||0,st:'idle',tm:0,cd:rand(1,3),dead:false,burn:0};
  e.S.face=0;rig.root.position.copy(pos);foes.push(e);return e}
function pickType(w){let acc=0;const r=Math.random(),o=[];
  if(level>=3)o.push(['caster',.14]);if(level>=2)o.push(['imp',.22]);if(w>=2&&(level>=2||w>=3))o.push(['brute',.2]);
  for(const [k,p] of o){acc+=p;if(r<acc)return k}return 'husk'}
function nextWave(){wave++;const last=wave===waves,n=Math.min(15,3+wave*2+(level-1)*2)-(last?2:0);
  for(let i=0;i<n;i++)spawn(pickType(wave));
  if(last){spawn('boss',new T.Vector3(0,0,-8));banner('BOSS',TH.boss,2600)}else banner('WAVE '+wave,'',1700);
  setWaveText()}
const setWaveText=()=>{$('wave').textContent='Level '+level+' · '+(wave>=waves?'Boss':'Wave '+wave+'/'+waves)};

/* ---------- levels ---------- */
function startLevel(n){
  level=n;powers=new Set(POWERS.slice(0,Math.min(n-1,POWERS.length)).map(p=>p.id));applyStats();
  buildArena(n);
  foes.forEach(e=>scene.remove(e.rig.root));foes.length=0;shots.forEach(s=>{scene.remove(s.sp);s.sp.material.dispose()});shots.length=0;
  P.pos.set(0,0,22);P.vel.set(0,0,0);P.lock=null;P.hp=P.max;P.st=100;P.dead=false;P.S.dead=0;P.S.hit=0;P.S.at=null;P.S.roll=null;P.S.face=0;P.iframe=0;yaw=0;
  wave=0;waves=3+(n>=4?1:0);levelClear=false;waveWait=2.4;
  const gr=Math.floor((n-1)/THEMES.length);
  banner(TH.name+(gr?' · DEPTH '+(gr+1):''),TH.sub,3400);$('wave').textContent='Level '+n+' · Wave 0/'+waves;$('souls').textContent='Souls '+P.souls;
  writeSave(n)}
function completeLevel(){
  levelClear=true;const pw=POWERS[level-1];
  if(pw){powers.add(pw.id);applyStats()}
  P.hp=P.max;P.st=100;writeSave(level+1);
  banner('LEVEL '+level+' CLEARED',pw?'New power: '+pw.icon+' '+pw.name+'<br>'+pw.desc:'Your strength grows… (+8% damage)',5600);
  spawnPortal()}
function spawnPortal(){
  const x=clamp(P.pos.x-Math.sin(yaw)*8,-30,30),z=clamp(P.pos.z-Math.cos(yaw)*8,-30,30),col=0xc07bff,g=new T.Group();
  const ring=new T.Mesh(new T.TorusGeometry(1.5,.16,10,40),new T.MeshBasicMaterial({color:col})),ring2=new T.Mesh(new T.TorusGeometry(1.2,.09,10,40),new T.MeshBasicMaterial({color:0x6df2ff}));
  const disc=new T.Mesh(new T.CircleGeometry(1.4,32),new T.MeshBasicMaterial({color:0x2a0a60,transparent:true,opacity:.6,side:T.DoubleSide}));
  const beam=new T.Mesh(new T.CylinderGeometry(1.2,1.2,26,16,1,true),new T.MeshBasicMaterial({color:col,transparent:true,opacity:.12,blending:T.AdditiveBlending,depthWrite:false,side:T.DoubleSide}));beam.position.y=10;
  const glow=new T.Sprite(softMat.clone());glow.material.color.setHex(col);glow.scale.set(6,6,1);
  const light=new T.PointLight(col,3,16,1.5);g.add(ring,ring2,disc,glow,light);
  g.position.set(x,groundY(x,z)+1.7,z);g.rotation.y=Math.atan2(P.pos.x-x,P.pos.z-z);
  const bg=new T.Group();bg.position.set(x,groundY(x,z),z);bg.add(beam);beam.position.y=10;
  env.add(g,bg);portal={g,x,z,ring,ring2,light,t:0}}
function goNext(){if(transitioning)return;transitioning=true;buzz(30);$('fade').style.opacity=1;
  setTimeout(()=>{startLevel(level+1);setTimeout(()=>{$('fade').style.opacity=0;transitioning=false},250)},700)}

/* ---------- input ---------- */
const key={};let yaw=0,pitch=.38,holdAtk=false;
const joy={on:false,id:null,x:0,y:0,ox:0,oy:0},look={id:null,x:0,y:0};
const JR=46;   // how far the thumb can push the stick
addEventListener('keydown',e=>{key[e.code]=1;if(e.code==='Space')roll();if(e.code==='KeyJ')P.wantAtk=.35;if(e.code==='KeyQ')toggleLock();if(/^(Space|Arrow)/.test(e.code))e.preventDefault()});
addEventListener('keyup',e=>{key[e.code]=0});
// on-screen buttons. Attack can be HELD to keep swinging. They light up while pressed.
function onBtn(id,down,up){const b=$(id);
  b.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();b.classList.add('on');buzz(8);down()});
  ['pointerup','pointercancel','pointerleave'].forEach(n=>b.addEventListener(n,()=>{if(b.classList.contains('on')){b.classList.remove('on');if(up)up()}}))}
onBtn('bA',()=>{holdAtk=true;P.wantAtk=.35},()=>{holdAtk=false});onBtn('bR',roll);onBtn('bL',toggleLock);
addEventListener('pointerdown',e=>{if(e.target.closest&&e.target.closest('.btn,#exit'))return;
  const left=e.clientX<innerWidth*.5&&e.pointerType!=='mouse';
  if(left){if(!joy.on){joy.on=true;joy.id=e.pointerId;joy.x=joy.y=0;joy.ox=e.clientX;joy.oy=e.clientY;const j=$('joy');j.style.display='block';j.style.left=e.clientX+'px';j.style.top=e.clientY+'px'}}
  else if(look.id===null){look.id=e.pointerId;look.x=e.clientX;look.y=e.clientY;if(e.pointerType==='mouse'&&e.button===0)P.wantAtk=.35}});
addEventListener('pointermove',e=>{
  if(joy.on&&e.pointerId===joy.id){let dx=e.clientX-joy.ox,dy=e.clientY-joy.oy,l=Math.hypot(dx,dy)||1;
    if(l>JR*1.3){const ex=l-JR*1.3;joy.ox+=dx/l*ex;joy.oy+=dy/l*ex;dx=e.clientX-joy.ox;dy=e.clientY-joy.oy;l=Math.hypot(dx,dy)||1;const j=$('joy');j.style.left=joy.ox+'px';j.style.top=joy.oy+'px'}   // the stick follows your thumb, so you never run out of room
    const k=Math.min(1,l/JR),v=k<.12?0:Math.min(1,(k-.12)/.7);joy.x=dx/l*v;joy.y=dy/l*v;
    const m=Math.min(l,JR);$('joy').firstChild.style.transform='translate('+dx/l*m+'px,'+dy/l*m+'px)'}
  else if(e.pointerId===look.id){yaw-=(e.clientX-look.x)*.006;pitch=clamp(pitch+(e.clientY-look.y)*.004,.12,.85);look.x=e.clientX;look.y=e.clientY}});
['pointerup','pointercancel'].forEach(n=>addEventListener(n,e=>{
  if(e.pointerId===joy.id){joy.on=false;joy.id=null;joy.x=joy.y=0;$('joy').style.display='none';$('joy').firstChild.style.transform=''}
  if(e.pointerId===look.id)look.id=null}));
// stop the phone from zooming, scrolling or opening menus while you play
['gesturestart','gesturechange','gestureend','contextmenu'].forEach(n=>addEventListener(n,e=>e.preventDefault()));
document.addEventListener('touchmove',e=>e.preventDefault(),{passive:false});
$('exit').addEventListener('click',()=>{try{parent.postMessage('fortress-exit','*')}catch(x){}if(parent===window)history.back()});
if(TOUCH)$('help').textContent='Left thumb: move · Right side: Attack (hold to keep swinging) / Roll / Lock · Drag the right side to turn the camera';
function toggleLock(){if(P.lock){P.lock=null;return}let best=null,bd=26;foes.forEach(e=>{if(e.dead)return;const d=e.pos.distanceTo(P.pos);if(d<bd){bd=d;best=e}});P.lock=best}

/* ---------- effects ---------- */
function banner(a,b,ms){const m=$('msg');m.innerHTML=a+(b?'<small>'+b+'</small>':'');m.style.opacity=1;clearTimeout(banner.t);if(ms)banner.t=setTimeout(()=>{m.style.opacity=0},ms)}
function dmgText(pos,v,col){const d=document.createElement('div');d.className='dmg';d.textContent=v;if(col)d.style.color=col;document.body.appendChild(d);const v3=pos.clone();v3.y+=2;let t=0;(function f(){t+=.016;v3.y+=.02;const q=v3.clone().project(cam);d.style.left=(q.x*.5+.5)*innerWidth+'px';d.style.top=(-q.y*.5+.5)*innerHeight-t*40+'px';d.style.opacity=1-t/.9;if(t<.9)requestAnimationFrame(f);else d.remove()})()}
function addFx(obj,dur,upd){scene.add(obj);fxs.push({o:obj,t:0,dur,upd})}
function fxStep(dt){for(let i=fxs.length-1;i>=0;i--){const f=fxs[i];f.t+=dt;const u=f.t/f.dur;if(u>=1){scene.remove(f.o);f.o.traverse(c=>{if(c.geometry)c.geometry.dispose();if(c.material)c.material.dispose()});fxs.splice(i,1)}else f.upd(u,f.o)}}
function ring(pos,r,col,dur){const m=new T.Mesh(new T.RingGeometry(.8,1,40),new T.MeshBasicMaterial({color:col,transparent:true,opacity:.8,side:T.DoubleSide,depthWrite:false,blending:T.AdditiveBlending}));
  m.rotation.x=-Math.PI/2;m.position.set(pos.x,pos.y+.12,pos.z);addFx(m,dur||.45,(u,o)=>{o.scale.setScalar(lerp(.3,r,easeOut(u)));o.material.opacity=.8*(1-u)})}
function boltFx(a,b){const g=new T.Group(),pa=a.clone(),pb=b.clone();pa.y+=1.2;pb.y+=1.2;
  for(let k=0;k<3;k++){const pts=[];for(let i=0;i<=7;i++){const u=i/7,p=pa.clone().lerp(pb,u);if(i>0&&i<7){p.x+=rand(-.45,.45);p.y+=rand(-.45,.45);p.z+=rand(-.45,.45)}pts.push(p)}
    g.add(new T.Line(new T.BufferGeometry().setFromPoints(pts),new T.LineBasicMaterial({color:k?0x9fd0ff:0xffffff,transparent:true})))}
  addFx(g,.2,(u,o)=>{o.children.forEach(c=>{c.material.opacity=1-u})})}
function shoot(from,dir,dmg,col,spd){const sp=new T.Sprite(softMat.clone());sp.material.color.setHex(col);sp.scale.set(1.2,1.2,1);sp.position.copy(from);scene.add(sp);shots.push({sp,vx:dir.x*spd,vz:dir.z*spd,life:4,dmg})}
function updateShots(dt){for(let i=shots.length-1;i>=0;i--){const s=shots[i],p=s.sp.position;p.x+=s.vx*dt;p.z+=s.vz*dt;s.life-=dt;s.sp.scale.setScalar(1.2+Math.sin(clock*20+i)*.15);
  let gone=s.life<=0||Math.abs(p.x)>39||Math.abs(p.z)>39||colliders.some(c=>Math.hypot(p.x-c.x,p.z-c.z)<c.r);
  if(!gone&&!P.dead&&Math.hypot(p.x-P.pos.x,p.z-P.pos.z)<.85){hurtPlayer(s.dmg,p);gone=true}
  if(gone){scene.remove(s.sp);s.sp.material.dispose();shots.splice(i,1)}}}

/* ---------- combat ---------- */
function aimAssist(){const S=P.S,f=fwd(S.face);let best=null,bs=1e9;
  foes.forEach(e=>{if(e.dead)return;const dx=e.pos.x-P.pos.x,dz=e.pos.z-P.pos.z,d=Math.hypot(dx,dz);if(d>4.6)return;const dot=(dx*f[0]+dz*f[1])/(d||1);if(d>1.6&&dot<.2)return;const s=d-dot*2;if(s<bs){bs=s;best=e}});
  if(best)S.face=heading(best.pos.x-P.pos.x,best.pos.z-P.pos.z)}           // your swing turns toward the nearest demon in front of you
function startAttack(){const S=P.S;if(P.dead||S.roll||S.hit>0||transitioning)return;const chain=S.at&&S.at.t>S.at.dur*.55;if(S.at&&!chain)return;if(P.st<14)return;
  if(!P.lock)aimAssist();
  const kind=S.at?(S.at.kind+1)%3:0;P.st-=kind===2?24:16;P.stT=.7;S.at={t:0,dur:(kind===2?.85:.62)*P.atk,kind:kind===2?0:kind,heavy:kind===2,hits:new Set()}}
function roll(){const S=P.S;if(P.dead||S.roll||S.hit>0||P.st<20||transitioning)return;P.st-=20;P.stT=.7;S.at=null;
  const m=moveInput();let d=Math.hypot(m[0],m[1])>.1?m:fwd(S.face);const l=Math.hypot(d[0],d[1])||1;S.roll={t:0,dur:.55,dx:d[0]/l,dz:d[1]/l};P.iframe=.5;S.face=heading(S.roll.dx,S.roll.dz)}
function moveInput(){let f=(key.KeyW||key.ArrowUp?1:0)-(key.KeyS||key.ArrowDown?1:0)-joy.y,r=(key.KeyD||key.ArrowRight?1:0)-(key.KeyA||key.ArrowLeft?1:0)+joy.x;
  const fx=-Math.sin(yaw),fz=-Math.cos(yaw),rx=Math.cos(yaw),rz=-Math.sin(yaw);let x=fx*f+rx*r,z=fz*f+rz*r;const l=Math.hypot(x,z);if(l>1){x/=l;z/=l}return[x,z]}
function hurtPlayer(n,from){if(P.dead||P.iframe>0||transitioning)return;P.hp-=n;P.S.hit=.35;P.S.at=null;dmgText(P.pos,n,'#ff6a5a');shake=Math.max(shake,.25);buzz(40);const d=P.pos.clone().sub(from);d.y=0;d.normalize().multiplyScalar(3.5);P.vel.add(d);
  if(P.hp<=0){P.hp=0;P.dead=true;holdAtk=false;P.S.dead=.001;P.S.roll=null;banner('YOU DIED','Press Space or tap Roll to rise again');buzz([80,40,120])}}
function respawn(){P.hp=P.max;P.st=100;P.dead=false;P.S.dead=0;P.S.hit=0;P.pos.set(0,0,22);P.lock=null;banner('',0,10);$('msg').style.opacity=0;
  shots.forEach(s=>{scene.remove(s.sp);s.sp.material.dispose()});shots.length=0;foes.forEach(e=>{if(!e.dead){e.st='idle';e.S.prep=0;e.S.at=null}})}
function pushOut(pos,r){colliders.forEach(c=>{const dx=pos.x-c.x,dz=pos.z-c.z,d=Math.hypot(dx,dz),m=c.r+r;if(d<m&&d>.001){pos.x=c.x+dx/d*m;pos.z=c.z+dz/d*m}});pos.x=clamp(pos.x,-37,37);pos.z=clamp(pos.z,-37,37)}

function killFoe(e){e.dead=true;e.S.dead=.001;P.souls+=e.T.souls;$('souls').textContent='Souls '+P.souls;if(P.lock===e)P.lock=null;
  if(powers.has('drain')){const h=e.boss?40:10;P.hp=Math.min(P.max,P.hp+h);dmgText(P.pos,'+'+h,'#7aff9a')}}
function hitFoe(e,dm,o){o=o||{};if(e.dead)return;e.hp-=dm;dmgText(e.pos,dm,o.col);e.flash=.12;
  if(o.react!==false){if(e.boss)e.S.hit=.1;else{e.S.hit=.3;e.S.prep=0;e.S.at=null;e.st='stagger';e.tm=e.heavy?.28:.5}}
  if(o.kb&&!e.boss)e.pos.add(o.kb);
  if(e.hp<=0){killFoe(e);return}
  if(e.boss&&!e.p2&&e.hp<e.max*.5){e.p2=true;banner('',TH.boss+' calls its minions!',2200);for(let i=0;i<3;i++)spawn(level>=2?'imp':'husk',new T.Vector3(e.pos.x+rand(-6,6),0,e.pos.z+rand(-6,6)))}}
function chain(src,dm){const near=foes.filter(o=>o!==src&&!o.dead&&o.pos.distanceTo(src.pos)<8).sort((a,b)=>a.pos.distanceTo(src.pos)-b.pos.distanceTo(src.pos)).slice(0,2);
  near.forEach(o=>{boltFx(src.pos,o.pos);hitFoe(o,Math.max(1,Math.round(dm*.6)),{col:'#9fd0ff'})})}
function quake(){const f=fwd(P.S.face),c=new T.Vector3(P.pos.x+f[0]*1.8,P.pos.y,P.pos.z+f[1]*1.8);ring(c,5.5,0xffb060,.55);shake=Math.max(shake,.35);buzz(30);
  foes.forEach(e=>{if(e.dead)return;const d=e.pos.clone().sub(c);d.y=0;if(d.length()<5.2){hitFoe(e,Math.round(28*P.dmgMul),{kb:d.normalize().multiplyScalar(2.4)})}})}
function swordHits(){const S=P.S,f=fwd(S.face);
  foes.forEach(e=>{if(e.dead||S.at.hits.has(e))return;const d=e.pos.clone().sub(P.pos);d.y=0;const dist=d.length();if(dist>2.9+(e.heavy?.4:0)+(e.boss?.9:0))return;
    if(dist>.8&&(d.x*f[0]+d.z*f[1])/dist<.35)return;S.at.hits.add(e);
    let dm=(S.at.heavy?38:22)*rand(.9,1.15)*P.dmgMul;if(powers.has('fire'))dm*=1.25;dm=Math.round(dm);
    hitFoe(e,dm,{kb:d.normalize().multiplyScalar(e.heavy?.4:1.1)});buzz(12);
    if(!e.dead&&powers.has('fire')){e.burn=3;e.burnDps=Math.round(8*P.dmgMul)}
    if(powers.has('bolt'))chain(e,dm)});
  if(S.at.heavy&&powers.has('quake')&&!S.at.quaked){S.at.quaked=true;quake()}}

function updatePlayer(dt,t){
  const S=P.S;P.iframe=Math.max(0,P.iframe-dt);P.stT-=dt;if(P.stT<=0)P.st=Math.min(100,P.st+P.stRegen*dt);S.hit=Math.max(0,S.hit-dt);
  if(transitioning){P.vel.set(0,0,0);S.sp=0;pose(hero,S,dt,t);return}
  if(P.dead){S.dead+=dt;if(S.dead>1.2&&(key.Space||P.wantAtk>0)){respawn()}pose(hero,S,dt,t);return}
  if(holdAtk)P.wantAtk=.35;
  if(P.wantAtk>0){P.wantAtk-=dt;startAttack();if(S.at&&S.at.t<.02)P.wantAtk=0}
  const m=moveInput(),MAXV=5.4*P.spd;
  if(S.roll){S.roll.t+=dt;P.vel.x=S.roll.dx*8.4*P.spd;P.vel.z=S.roll.dz*8.4*P.spd;if(S.roll.t>=S.roll.dur){S.roll=null}}
  else if(S.at){S.at.t+=dt;const u=S.at.t/S.at.dur;const f=fwd(S.face),push=u>.35&&u<.62?(S.at.heavy?5.5:4):0;P.vel.x=f[0]*push;P.vel.z=f[1]*push;
    if(u>.38&&u<.55)swordHits();if(S.at.t>=S.at.dur)S.at=null}
  else if(S.hit<=0){P.vel.x+=(m[0]*MAXV-P.vel.x)*Math.min(1,dt*10);P.vel.z+=(m[1]*MAXV-P.vel.z)*Math.min(1,dt*10);
    if(P.lock&&!P.lock.dead){const d=P.lock.pos.clone().sub(P.pos);S.face+=adiff(S.face,heading(d.x,d.z))*Math.min(1,dt*12)}
    else if(Math.hypot(m[0],m[1])>.15)S.face+=adiff(S.face,heading(m[0],m[1]))*Math.min(1,dt*12)}
  else{P.vel.multiplyScalar(.9)}
  P.pos.x+=P.vel.x*dt;P.pos.z+=P.vel.z*dt;pushOut(P.pos,.45);
  const gy=groundY(P.pos.x,P.pos.z);P.pos.y+=(gy-P.pos.y)*Math.min(1,dt*(gy>P.pos.y?14:7));
  S.sp=S.roll||S.at?0:Math.min(1,Math.hypot(P.vel.x,P.vel.z)/MAXV);if(P.lock&&P.lock.dead)P.lock=null;
  pose(hero,S,dt,t)}

function updateFoes(dt,t){foes.forEach(e=>{const S=e.S,D=e.T;S.hit=Math.max(0,S.hit-dt);
  if(e.burn>0&&!e.dead){e.burn-=dt;e.bt=(e.bt||0)-dt;if(e.bt<=0){e.bt=.5;hitFoe(e,Math.max(1,Math.round(e.burnDps*.5)),{react:false,col:'#ff9a40'})}}
  if(e.dead){S.dead+=dt;pose(e.rig,S,dt,t);if(S.dead>2.6){scene.remove(e.rig.root);e.gone=true}return}
  const d=P.pos.clone().sub(e.pos);d.y=0;const dist=d.length(),dir=dist>.01?d.clone().divideScalar(dist):d;e.tm-=dt;e.cd-=dt;
  const face=()=>{S.face+=adiff(S.face,heading(dir.x,dir.z))*Math.min(1,dt*(e.st==='chase'?7:3))};
  const mv=k=>{e.pos.x+=dir.x*e.spd*k*dt;e.pos.z+=dir.z*e.spd*k*dt};
  if(e.st==='idle'){S.sp*=.9;if(dist<(e.boss?60:24)&&!P.dead)e.st='chase'}
  else if(e.st==='chase'){face();
    if(P.dead){e.st='idle'}
    else if(D.ranged&&e.cd<=0&&dist<28&&dist>(e.boss?5.5:4)){e.st='castwind';e.tm=D.wind}
    else if(e.keep){                                                       // casters keep their distance
      if(dist<e.keep-3){e.pos.x-=dir.x*e.spd*dt*1.1;e.pos.z-=dir.z*e.spd*dt*1.1;S.sp=Math.min(1,S.sp+dt*5)}
      else if(dist>e.keep+2){mv(1);S.sp=Math.min(1,S.sp+dt*5)}else S.sp*=.8}
    else if(dist>e.rng*.85){mv(1);S.sp=Math.min(1,S.sp+dt*5)}
    else{S.sp*=.8;e.st='wind';e.tm=D.wind}}
  else if(e.st==='wind'){face();S.sp*=.8;S.prep=Math.min(1,S.prep+dt/(D.wind*.8));if(e.tm<=0){e.st='strike';e.tm=.45;S.prep=0;S.at={t:0,dur:.45,kind:0};e.hitDone=false}}
  else if(e.st==='strike'){S.at.t+=dt;if(D.lunge&&S.at.t<.2)mv(2.2);                                    // imps lunge at you
    if(!e.hitDone&&S.at.t>.2){e.hitDone=true;
      if(e.boss){ring(e.pos,D.aoe,0xff5a20,.5);shake=Math.max(shake,.5);buzz(30);if(dist<D.aoe)hurtPlayer(e.dmg,e.pos)}   // the archdemon's ground slam
      else if(dist<e.rng+.5)hurtPlayer(e.dmg,e.pos)}
    if(e.tm<=0){S.at=null;e.st='recover';e.tm=D.rec}}
  else if(e.st==='castwind'){face();S.sp*=.8;S.prep=Math.min(1,S.prep+dt/(D.wind*.8));
    if(e.tm<=0){const from=e.pos.clone();from.y+=1.3*e.sc;from.x+=dir.x*.8;from.z+=dir.z*.8;const a=Math.atan2(dir.z,dir.x),n=e.boss?(level>=4?5:3):1;
      for(let i=0;i<n;i++){const aa=a+(i-(n-1)/2)*.3;shoot(from,{x:Math.cos(aa),z:Math.sin(aa)},Math.round(e.dmg*(e.boss?.6:1)),D.flameCol||0xff6a20,e.boss?8:9.5)}
      S.prep=0;S.at={t:0,dur:.4,kind:0};e.st='cast';e.tm=.4;e.cd=rand(2.4,4)*(e.boss?.8:1)}}
  else if(e.st==='cast'){S.at.t+=dt;if(e.tm<=0){S.at=null;e.st='recover';e.tm=D.rec}}
  else if(e.st==='recover'){S.sp*=.9;if(e.tm<=0)e.st='chase'}
  else if(e.st==='stagger'){if(e.tm<=0)e.st='chase'}
  foes.forEach(o=>{if(o!==e&&!o.dead){const q=e.pos.clone().sub(o.pos);q.y=0;const l=q.length();if(l<1.3&&l>.01){e.pos.addScaledVector(q.divideScalar(l),(1.3-l)*.5)}}});
  pushOut(e.pos,.5);e.pos.y+=(groundY(e.pos.x,e.pos.z)-e.pos.y)*Math.min(1,dt*10);if(e.st==='stagger')S.sp=0;
  pose(e.rig,S,dt,t);if(e.flash>0){e.flash-=dt}});
  for(let i=foes.length-1;i>=0;i--)if(foes[i].gone)foes.splice(i,1)}

/* ---------- camera + loop ---------- */
const cp=new T.Vector3();let last=performance.now(),clock=0;
function frame(now){const dt=Math.min(.05,(now-last)/1000);last=now;clock+=dt;
  updatePlayer(dt,clock);updateFoes(dt,clock);updateShots(dt);fxStep(dt);swordFx(clock);
  hero.root.position.copy(P.pos);hero.root.rotation.y=P.S.face;foes.forEach(e=>{e.rig.root.position.copy(e.pos);e.rig.root.rotation.y=e.S.face});
  // waves -> boss -> level cleared -> portal
  if(!foes.some(e=>!e.dead)&&!P.dead&&!levelClear&&!transitioning){waveWait-=dt;if(waveWait<=0){if(wave>=waves)completeLevel();else nextWave();waveWait=4}}else waveWait=Math.max(waveWait,levelClear?0:3);
  const ph=$('phint');
  if(portal){portal.t+=dt;portal.ring.rotation.z+=dt*1.4;portal.ring2.rotation.z-=dt*2;portal.g.scale.setScalar(1+Math.sin(portal.t*4)*.04);portal.light.intensity=3+Math.sin(portal.t*7)*.8;
    const dx=portal.x-P.pos.x,dz=portal.z-P.pos.z,dd=Math.hypot(dx,dz);
    if(!transitioning&&!P.dead&&dd<2.2)goNext();
    const fx=-Math.sin(yaw),fz=-Math.cos(yaw),rx=Math.cos(yaw),rz=-Math.sin(yaw);
    $('parrow').style.transform='rotate('+Math.atan2(dx*rx+dz*rz,dx*fx+dz*fz)+'rad)';$('pdist').textContent='Portal · '+Math.round(dd)+' m';ph.style.display=transitioning?'none':'flex'}
  else ph.style.display='none';
  const tgt=P.pos.clone();tgt.y+=1.6;let cy=yaw;
  if(P.lock&&!P.lock.dead){const d=P.lock.pos.clone().sub(P.pos);const want=heading(d.x,d.z);yaw+=adiff(yaw,want)*Math.min(1,dt*4);cy=yaw}
  const D=6.2,hgt=Math.sin(pitch)*D+1.2,hor=Math.cos(pitch)*D;cp.set(tgt.x+Math.sin(cy)*hor,tgt.y+hgt-1.2,tgt.z+Math.cos(cy)*hor);
  cp.x=clamp(cp.x,-38,38);cp.z=clamp(cp.z,-38,38);cp.y=Math.max(cp.y,.8);cam.position.lerp(cp,Math.min(1,dt*9));
  if(shake>.003){cam.position.x+=rand(-1,1)*shake;cam.position.y+=rand(-1,1)*shake*.6;shake*=Math.pow(.02,dt)}
  cam.lookAt(tgt);
  moon.position.set(P.pos.x-18,P.pos.y+38,P.pos.z-8);moon.target.position.copy(P.pos);
  flames.forEach(f=>{const k=1+Math.sin(clock*13+f.p)*.1+Math.sin(clock*7.3+f.p*2)*.08;f.s.scale.set(f.size*k,f.size*1.5*k,1)});
  lights.forEach(l=>{l.L.intensity=2.6+Math.sin(clock*11+l.p)*.5+Math.sin(clock*5.2+l.p)*.4});
  emberStep(dt);
  $('hp').firstChild.style.width=P.hp/P.max*100+'%';$('st').firstChild.style.width=P.st+'%';
  const boss=foes.find(e=>e.boss&&!e.dead),bb=$('boss');
  if(boss){bb.style.display='block';$('bossname').textContent=TH.boss;$('bosshp').firstChild.style.width=Math.max(0,boss.hp/boss.max*100)+'%'}else bb.style.display='none';
  const lk=$('lock');if(P.lock&&!P.lock.dead){const q=P.lock.pos.clone();q.y+=2.4*P.lock.sc;q.project(cam);lk.style.display='block';lk.style.left=(q.x*.5+.5)*innerWidth+'px';lk.style.top=(-q.y*.5+.5)*innerHeight+'px'}else lk.style.display='none';
  ren.render(scene,cam);requestAnimationFrame(frame)}

/* ---------- go! ---------- */
const sv=loadSave();P.souls=sv.souls|0;startLevel(Math.max(1,sv.level|0));
requestAnimationFrame(t=>{last=t;frame(t)});
window.fortress={P,foes,hero,cam,spawn,scene,get yaw(){return yaw},set yaw(v){yaw=v},key,startAttack,roll,startLevel,completeLevel,nextWave,get level(){return level},get powers(){return [...powers]},
  reset(){try{localStorage.removeItem(SAVE)}catch(e){}P.souls=0;startLevel(1)}};
})();
