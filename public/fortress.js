/* Fortress of Embers: an original third-person dark-fantasy mode (three.js r128). */
(function(){
const T=THREE,$=id=>document.getElementById(id);
const rand=(a,b)=>a+Math.random()*(b-a),clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),lerp=(a,b,t)=>a+(b-a)*t,ease=t=>t*t*(3-2*t),easeOut=t=>1-(1-t)*(1-t);
const adiff=(a,b)=>{let d=b-a;while(d>Math.PI)d-=2*Math.PI;while(d<-Math.PI)d+=2*Math.PI;return d};
const fwd=a=>[-Math.sin(a),-Math.cos(a)];            // heading -> forward direction (characters face -z)
const heading=(dx,dz)=>Math.atan2(-dx,-dz);

/* ---------- renderer, scene, lights ---------- */
const ren=new T.WebGLRenderer({antialias:true});ren.setPixelRatio(Math.min(devicePixelRatio||1,2));ren.shadowMap.enabled=true;ren.shadowMap.type=T.PCFSoftShadowMap;
ren.toneMapping=T.ACESFilmicToneMapping;ren.toneMappingExposure=1.15;ren.outputEncoding=T.sRGBEncoding;document.body.prepend(ren.domElement);
const scene=new T.Scene();scene.background=new T.Color(0x0b0809);scene.fog=new T.FogExp2(0x0b0809,.03);
const cam=new T.PerspectiveCamera(58,1,.1,140);
const resize=()=>{ren.setSize(innerWidth,innerHeight);cam.aspect=innerWidth/innerHeight;cam.updateProjectionMatrix()};addEventListener('resize',resize);resize();
scene.add(new T.HemisphereLight(0x8393b8,0x2a1d14,.75));
const moon=new T.DirectionalLight(0xa9bce6,.8);moon.castShadow=true;moon.shadow.mapSize.set(1024,1024);
const sc=moon.shadow.camera;sc.left=sc.bottom=-24;sc.right=sc.top=24;sc.near=1;sc.far=110;scene.add(moon,moon.target);

/* ---------- textures & materials (all drawn in code) ---------- */
function tex(w,draw,rx,ry){const c=document.createElement('canvas');c.width=c.height=w;draw(c.getContext('2d'),w);const t=new T.CanvasTexture(c);t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(rx,ry);t.anisotropy=4;t.encoding=T.sRGBEncoding;return t}
const speck=(g,w,n)=>{for(let i=0;i<n;i++){g.fillStyle='rgba(0,0,0,'+Math.random()*.28+')';g.fillRect(Math.random()*w,Math.random()*w,2,2)}};
const bricks=(g,w)=>{g.fillStyle='#16120f';g.fillRect(0,0,w,w);for(let r=0;r<8;r++)for(let c=-1;c<4;c++){g.fillStyle='hsl(30,'+(6+Math.random()*6)+'%,'+(26+Math.random()*13)+'%)';g.fillRect(c*64+(r%2)*32+2,r*32+2,60,28)}speck(g,w,700)};
const flags=(g,w)=>{g.fillStyle='#120f0d';g.fillRect(0,0,w,w);for(let r=0;r<4;r++)for(let c=0;c<4;c++){g.fillStyle='hsl(28,5%,'+(22+Math.random()*12)+'%)';g.fillRect(c*64+2,r*64+2,60,60)}speck(g,w,900);g.strokeStyle='rgba(0,0,0,.4)';for(let i=0;i<6;i++){g.beginPath();g.moveTo(Math.random()*w,Math.random()*w);g.lineTo(Math.random()*w,Math.random()*w);g.stroke()}};
const planks=(g,w)=>{for(let i=0;i<8;i++){g.fillStyle='hsl(26,'+(30+Math.random()*10)+'%,'+(20+Math.random()*9)+'%)';g.fillRect(i*32,0,30,w);g.fillStyle='rgba(0,0,0,.4)';g.fillRect(i*32+30,0,2,w);for(let k=0;k<14;k++){g.fillStyle='rgba(0,0,0,.14)';g.fillRect(i*32+Math.random()*28,Math.random()*w,1,10+Math.random()*40)}}};
const std=(map,r)=>new T.MeshStandardMaterial({map,roughness:r||.95,metalness:0});
const brickTex=tex(256,bricks,1,1),woodTex=tex(256,planks,1,1);
const stone=(rx,ry)=>{const t=brickTex.clone();t.needsUpdate=true;t.repeat.set(rx,ry);return std(t)};
const wood=(rx,ry)=>{const t=woodTex.clone();t.needsUpdate=true;t.repeat.set(rx,ry);return std(t)};
const plain=(c,r,m)=>new T.MeshStandardMaterial({color:c,roughness:r==null?.6:r,metalness:m||0});
function glowTex(stops){const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d'),r=g.createRadialGradient(32,32,2,32,32,32);stops.forEach(s=>r.addColorStop(s[0],s[1]));g.fillStyle=r;g.fillRect(0,0,64,64);return new T.CanvasTexture(c)}
const flameTex=glowTex([[0,'rgba(255,245,200,1)'],[.25,'rgba(255,170,60,.9)'],[.6,'rgba(220,70,20,.35)'],[1,'rgba(120,20,0,0)']]),dotTex=glowTex([[0,'rgba(255,230,160,1)'],[.5,'rgba(255,120,30,.6)'],[1,'rgba(255,60,0,0)']]);
const flameMat=new T.SpriteMaterial({map:flameTex,blending:T.AdditiveBlending,transparent:true,depthWrite:false});

/* ---------- the fortress ---------- */
const colliders=[];                         // circles that block walking
const flames=[],lights=[],sources=[];       // flickering fire
function box(w,h,d,mat,x,y,z,sh){const m=new T.Mesh(new T.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);m.castShadow=m.receiveShadow=sh!==false;scene.add(m);return m}
function cyl(r0,r1,h,mat,x,y,z){const m=new T.Mesh(new T.CylinderGeometry(r0,r1,h,12),mat);m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;scene.add(m);return m}
function fire(x,y,z,size,light){const s=new T.Sprite(flameMat);s.position.set(x,y,z);s.scale.set(size,size*1.5,1);scene.add(s);flames.push({s,size,p:rand(0,6)});sources.push({x,y,z});
  if(light){const L=new T.PointLight(0xff8a3a,2.6,22,1.5);L.position.set(x,y+.4,z);scene.add(L);lights.push({L,p:rand(0,6)})}}
const floor=new T.Mesh(new T.PlaneGeometry(80,80),std(tex(256,flags,20,20)));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);
[[0,-40,80,2],[0,40,80,2],[-40,0,2,80],[40,0,2,80]].forEach(a=>box(a[2],14,a[3],stone(a[2]/4,3.5),a[0],7,a[1]));
box(9,7,1,plain(0x030203),0,3.5,-38.7);                              // dark gate
for(let i=-30;i<=30;i+=15){[[i,-38.6],[i,38.6]].forEach(p=>box(1.8,9,1.4,stone(.5,2),p[0],4.5,p[1]));[[-38.6,i],[38.6,i]].forEach(p=>box(1.4,9,1.8,stone(.5,2),p[0],4.5,p[1]))}
[[-15,-37.4],[15,-37.4],[-30,37.4],[30,37.4],[-37.4,0],[37.4,-15],[37.4,15],[-37.4,25]].forEach((p,i)=>{box(.2,.6,.2,plain(0x2a2018),p[0],3.2,p[1]);fire(p[0],3.8,p[1],1.6,i<3)});
// wooden stairway + deck (like the walkways in dark fortresses)
const WOOD=wood(2,1),DECK={x0:-12,x1:12,z0:-38,z1:-22,y:3},ST={x0:-4,x1:4,z0:-22,z1:-14};
for(let i=0;i<16;i++)box(8,(i+1)*.1875,.5,WOOD,0,(i+1)*.1875/2,-14-(i+.5)*.5);
box(24,.5,16,wood(6,3),0,2.75,-30);
[-4.3,4.3].forEach(x=>{const r=box(.12,.12,8.54,WOOD,x,2.2,-18);r.rotation.x=Math.atan(3/8);for(let i=0;i<=8;i++)box(.14,1.1,.14,WOOD,x,i*.375+.55,-14-i);});
for(let x=-12;x<=12;x+=2){if(Math.abs(x)>4.3)box(.14,1.1,.14,WOOD,x,3.55,-22)}box(7.4,.12,.12,WOOD,-8.3,4.1,-22);box(7.4,.12,.12,WOOD,8.3,4.1,-22);
[-12,12].forEach(x=>{box(.12,.12,16,WOOD,x,4.1,-30);for(let z=-38;z<=-22;z+=2)box(.14,1.1,.14,WOOD,x,3.55,z)});
fire(-11,4.1,-23,1.4,false);fire(11,4.1,-23,1.4,false);
// pillars, crates, barrels, braziers
[[-16,-4],[16,-4],[-16,14],[16,14],[-8,26],[8,26]].forEach(p=>{cyl(.85,1,11,stone(1,3),p[0],5.5,p[1]);cyl(1.2,1.2,.5,stone(1,.3),p[0],11,p[1]);colliders.push({x:p[0],z:p[1],r:1.1})});
for(let i=0;i<14;i++){const x=rand(-34,34),z=rand(-10,34);if(Math.hypot(x,z-8)<7)continue;if(i%2){box(1.4,1.4,1.4,wood(1,1),x,.7,z).rotation.y=rand(0,3);colliders.push({x,z,r:.95})}else{cyl(.5,.55,1.1,wood(1,1),x,.55,z);colliders.push({x,z,r:.6})}}
[[-9,8],[9,8],[-9,-8],[9,-8]].forEach((p,i)=>{cyl(.45,.3,.5,plain(0x241a14,.5,.5),p[0],.9,p[1]);cyl(.1,.1,.7,plain(0x241a14),p[0],.35,p[1]);fire(p[0],1.4,p[1],2.2,i<3);colliders.push({x:p[0],z:p[1],r:.6})});
const groundY=(x,z)=>(x>ST.x0&&x<ST.x1&&z<=ST.z1&&z>=ST.z0)?3*((-14-z)/8):(x>DECK.x0&&x<DECK.x1&&z<ST.z0&&z>DECK.z0)?3:0;
// drifting embers
const EN=420,epos=new Float32Array(EN*3),evel=[],egeo=new T.BufferGeometry();
for(let i=0;i<EN;i++){evel.push({vx:rand(-.3,.3),vy:rand(.8,2.2),vz:rand(-.3,.3),l:rand(0,3)});epos[i*3+1]=-50}
egeo.setAttribute('position',new T.BufferAttribute(epos,3));
scene.add(new T.Points(egeo,new T.PointsMaterial({size:.16,map:dotTex,blending:T.AdditiveBlending,transparent:true,depthWrite:false,color:0xffb060})));
function emberStep(dt){const src=sources.concat(foes.filter(e=>!e.dead).map(e=>({x:e.pos.x,y:e.pos.y+1,z:e.pos.z})));
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
  if(c.demon){[-1,1].forEach(s=>{const h=part(new T.ConeGeometry(.04,.22,6),plain(0x120808),s*.09,.12,-.02);h.rotation.z=-s*.5;head.add(h);head.add(part(new T.BoxGeometry(.05,.025,.02),new T.MeshBasicMaterial({color:0xffc060}),s*.05,.02,-.115))})}
  else{head.add(part(new T.CylinderGeometry(.135,.145,.2,10),c.armor,0,.03,0));head.add(part(new T.BoxGeometry(.2,.03,.05),plain(0x050505),0,.03,-.13));const pl=part(new T.ConeGeometry(.04,.3,6),new T.MeshStandardMaterial({color:0x8a1d1d,roughness:.8}),0,.28,.04);pl.rotation.x=.5;head.add(pl)}
  [[1,'r'],[-1,'l']].forEach(([s,n])=>{
    tor.add(part(new T.SphereGeometry(.11,8,6),c.trim,s*.3,.52,0));
    const sh=new T.Group();sh.position.set(s*.3,.5,0);tor.add(sh);sh.add(limb(.32,.07,.06,c.armor));
    const el=new T.Group();el.position.y=-.32;sh.add(el);el.add(limb(.3,.06,.05,c.armor));
    const hand=new T.Group();hand.position.y=-.3;el.add(hand);hand.add(part(new T.SphereGeometry(.06,6,6),c.skin,0,0,0));R[n+'A']=sh;R[n+'F']=el;R[n+'H']=hand});
  if(c.sword){const g=new T.Group();g.add(part(new T.BoxGeometry(.05,.05,.06),plain(0x3a2a1a),0,0,0));g.add(part(new T.BoxGeometry(.22,.04,.05),c.trim,0,-.05,0));
    g.add(part(new T.BoxGeometry(.06,1.05,.018),new T.MeshStandardMaterial({color:0xcfd8e6,roughness:.25,metalness:.9,emissive:0x2a4a7a,emissiveIntensity:.6}),0,-.6,0));g.rotation.x=-1.4;R.rH.add(g);R.sword=g}
  if(c.cape){const cp=new T.Group();cp.position.set(0,.55,.15);tor.add(cp);const pm=new T.Mesh(new T.PlaneGeometry(.5,.95,1,3),new T.MeshStandardMaterial({color:0x7a1818,roughness:.9,side:T.DoubleSide}));pm.position.y=-.475;pm.castShadow=true;cp.add(pm);R.cape=cp}
  if(c.flames){R.fl=[];[[0,.45,0,2.5],[0,.95,0,1.7],[.35,.1,0,1.3],[-.35,.1,0,1.3]].forEach(a=>{const fm=flameMat.clone();fm.color.setHex(0xff8a40);const s=new T.Sprite(fm);s.position.set(a[0],a[1],a[2]);s.scale.set(a[3],a[3]*1.4,1);tor.add(s);R.fl.push(s)})}
  root.scale.setScalar(c.scale||1);scene.add(root);R.shadowMats=c.mats||[];return R}
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
  if(S.at){const a=S.at,u=a.t/a.dur,K=a.kind===1?SIDE:KEYS,e=u<.4?ease(u/.4):u<.62?1:0;let A,B,w;
    if(u<.4){A=K[0];B=K[1];w=ease(u/.4)}else if(u<.62){A=K[1];B=K[2];w=easeOut((u-.4)/.22)}else{A=K[2];B=K[0];w=ease((u-.62)/.38)}
    const m=i=>lerp(A[i],B[i],w);rAx=m(0);rAz=m(1);rF=m(2);lAx=m(3);tY=m(4);tX=m(5);rT=m(6);lT=m(7);rS=-.5;lS=-.4;kf=Math.min(1,dt*30);bodyX=-.05*(u>.4&&u<.62?1:0)}
  if(S.prep){const u=S.prep;rAx=lerp(rAx,2.6,u);lAx=lerp(lAx,2.4,u);rF=.5;lFx=.5;tX=.25*u}                                                       // enemy wind-up: both arms overhead
  if(S.hit>0){tX=.5;rAx=.8;lAx=.8;hx=.35;kf=Math.min(1,dt*30)}
  R.hips.position.y=hipY;
  damp(R.rT,rT,0,-.04,kf);damp(R.lT,lT,0,.04,kf);damp(R.rS,rS,0,0,kf);damp(R.lS,lS,0,0,kf);
  damp(R.tor,tX,tY,0,kf);damp(R.rA,rAx,0,rAz,kf);damp(R.lA,lAx,0,-.05,kf);damp(R.rF,rF,0,0,kf);damp(R.lF,lFx,0,0,kf);damp(R.head,hx-tX*.5,-tY*.5,0,k);
  if(S.sprint)R.tor.rotation.x-=.1;
  if(R.cape){R.cape.rotation.x+=(-(.12+sp*.7+(S.at?.4:0)+Math.sin(t*3)*.05)-R.cape.rotation.x)*.2}
  // roll / death overrides
  if(S.roll){const u=S.roll.t/S.roll.dur;const th=-u*Math.PI*2;R.body.rotation.x=th;R.body.position.set(0,.95-.95*Math.cos(th)-.35,-.95*Math.sin(th));R.rT.rotation.x=1.6;R.lT.rotation.x=1.6;R.rS.rotation.x=-2;R.lS.rotation.x=-2;R.tor.rotation.x=-.9;R.rA.rotation.x=1.4;R.lA.rotation.x=1.4}
  else if(S.dead>0){const u=Math.min(1,S.dead/.9);R.body.rotation.x=lerp(0,1.5,easeOut(u));R.body.position.y=lerp(0,.12,u);R.rA.rotation.z=lerp(R.rA.rotation.z,1.2,u*.2);R.lA.rotation.z=-1}
  else{R.body.rotation.x+=(bodyX-R.body.rotation.x)*.3;R.body.position.y+=(0-R.body.position.y)*.3;R.body.position.z+=(0-R.body.position.z)*.3}
  if(R.fl)R.fl.forEach((s,i)=>{const f=1+Math.sin(t*14+i*2)*.12;s.scale.set(s.scale.x,s.scale.x*1.4*f,1);s.material.opacity=S.dead>0?Math.max(0,1-S.dead/1.4):1})}

/* ---------- player ---------- */
const hero=makeRig({armor:plain(0x2c3038,.35,.85),trim:plain(0xb08a45,.4,.8),skin:plain(0xcaa88a,.8),sword:true,cape:true,scale:1.05});
const P={pos:new T.Vector3(0,0,22),vel:new T.Vector3(),hp:100,max:100,st:100,souls:0,S:newState(),stT:0,lock:null,chain:0,wantAtk:0,dead:false,iframe:0};
P.S.face=0;hero.root.position.copy(P.pos);
/* ---------- enemies: burning husks ---------- */
const foes=[];let wave=0,waveWait=1.5;
function spawn(brute){
  const big=brute?1.5:1;
  const charred=plain(0x140c0a,.9),hot=new T.MeshStandardMaterial({color:0x2a0e06,emissive:0xff4a10,emissiveIntensity:.55,roughness:.8});
  const rig=makeRig({armor:hot,trim:charred,skin:hot,demon:true,flames:true,scale:big*rand(.95,1.1)});
  const e={rig,S:newState(),pos:new T.Vector3(rand(-28,28),0,rand(-18,2)),hp:brute?170:70,max:brute?170:70,spd:brute?2.3:3.5,dmg:brute?24:12,rng:brute?2.5:1.9,brute,st:'idle',tm:0,dead:false,hitId:-1};
  e.S.face=0;rig.root.position.copy(e.pos);foes.push(e)}
function nextWave(){wave++;const n=3+wave*2;for(let i=0;i<n;i++)spawn(wave>=3&&i%4===3);$('wave').textContent='Wave '+wave;banner('WAVE '+wave,'',1700)}

/* ---------- input ---------- */
const key={};let yaw=0,pitch=.38,joy={on:false,id:null,x:0,y:0,ox:0,oy:0},look={id:null,x:0,y:0};
addEventListener('keydown',e=>{key[e.code]=1;if(e.code==='Space')roll();if(e.code==='KeyJ')P.wantAtk=.35;if(e.code==='KeyQ')toggleLock();if(/^(Space|Arrow)/.test(e.code))e.preventDefault()});
addEventListener('keyup',e=>{key[e.code]=0});
const onBtn=(id,f)=>{const b=$(id);b.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();f()})};
onBtn('bA',()=>{P.wantAtk=.35});onBtn('bR',roll);onBtn('bL',toggleLock);
addEventListener('pointerdown',e=>{if(e.target.closest&&e.target.closest('.btn,#exit'))return;
  if(e.clientX<innerWidth*.45&&e.pointerType!=='mouse'){if(!joy.on){joy={on:true,id:e.pointerId,x:0,y:0,ox:e.clientX,oy:e.clientY};const j=$('joy');j.style.display='block';j.style.left=e.clientX+'px';j.style.top=e.clientY+'px'}}
  else{look={id:e.pointerId,x:e.clientX,y:e.clientY};if(e.pointerType==='mouse'&&e.button===0)P.wantAtk=.35}});
addEventListener('pointermove',e=>{if(joy.on&&e.pointerId===joy.id){const dx=e.clientX-joy.ox,dy=e.clientY-joy.oy,l=Math.hypot(dx,dy)||1,m=Math.min(l,50);joy.x=dx/l*(m/50);joy.y=dy/l*(m/50);$('joy').firstChild.style.transform='translate('+dx/l*m+'px,'+dy/l*m+'px)'}
  else if(e.pointerId===look.id){yaw-=(e.clientX-look.x)*.006;pitch=clamp(pitch+(e.clientY-look.y)*.004,.12,.85);look.x=e.clientX;look.y=e.clientY}});
['pointerup','pointercancel'].forEach(n=>addEventListener(n,e=>{if(e.pointerId===joy.id){joy.on=false;joy.x=joy.y=0;$('joy').style.display='none';$('joy').firstChild.style.transform=''}if(e.pointerId===look.id)look.id=null}));
$('exit').addEventListener('click',()=>{try{parent.postMessage('fortress-exit','*')}catch(x){}if(parent===window)history.back()});
function toggleLock(){if(P.lock){P.lock=null;return}let best=null,bd=26;foes.forEach(e=>{if(e.dead)return;const d=e.pos.distanceTo(P.pos);if(d<bd){bd=d;best=e}});P.lock=best}

/* ---------- combat ---------- */
function banner(a,b,ms){const m=$('msg');m.innerHTML=a+(b?'<small>'+b+'</small>':'');m.style.opacity=1;clearTimeout(banner.t);if(ms)banner.t=setTimeout(()=>{m.style.opacity=0},ms)}
function dmgText(pos,v,col){const d=document.createElement('div');d.className='dmg';d.textContent=v;if(col)d.style.color=col;document.body.appendChild(d);const v3=pos.clone();v3.y+=2;let t=0;(function f(){t+=.016;v3.y+=.02;const q=v3.clone().project(cam);d.style.left=(q.x*.5+.5)*innerWidth+'px';d.style.top=(-q.y*.5+.5)*innerHeight-t*40+'px';d.style.opacity=1-t/.9;if(t<.9)requestAnimationFrame(f);else d.remove()})()}
function startAttack(){const S=P.S;if(P.dead||S.roll||S.hit>0)return;const chain=S.at&&S.at.t>S.at.dur*.55;if(S.at&&!chain)return;if(P.st<14)return;
  const kind=S.at?(S.at.kind+1)%3:0;P.st-=kind===2?24:16;P.stT=.7;S.at={t:0,dur:kind===2?.85:.62,kind:kind===2?0:kind,heavy:kind===2,hits:new Set()}}
function roll(){const S=P.S;if(P.dead||S.roll||S.hit>0||P.st<20)return;P.st-=20;P.stT=.7;S.at=null;
  const m=moveInput();let d=Math.hypot(m[0],m[1])>.1?m:fwd(S.face);const l=Math.hypot(d[0],d[1])||1;S.roll={t:0,dur:.55,dx:d[0]/l,dz:d[1]/l};P.iframe=.5;S.face=heading(S.roll.dx,S.roll.dz)}
function moveInput(){let f=(key.KeyW||key.ArrowUp?1:0)-(key.KeyS||key.ArrowDown?1:0)-joy.y,r=(key.KeyD||key.ArrowRight?1:0)-(key.KeyA||key.ArrowLeft?1:0)+joy.x;
  const fx=-Math.sin(yaw),fz=-Math.cos(yaw),rx=Math.cos(yaw),rz=-Math.sin(yaw);let x=fx*f+rx*r,z=fz*f+rz*r;const l=Math.hypot(x,z);if(l>1){x/=l;z/=l}return[x,z]}
function hurtPlayer(n,from){if(P.dead||P.iframe>0)return;P.hp-=n;P.S.hit=.35;P.S.at=null;dmgText(P.pos,n,'#ff6a5a');const d=P.pos.clone().sub(from);d.y=0;d.normalize().multiplyScalar(3.5);P.vel.add(d);
  if(P.hp<=0){P.hp=0;P.dead=true;P.S.dead=.001;P.S.roll=null;banner('YOU DIED','Press Space or tap Roll to rise again');}}
function respawn(){P.hp=P.max;P.st=100;P.dead=false;P.S.dead=0;P.S.hit=0;P.pos.set(0,0,22);P.lock=null;banner('',0,10);$('msg').style.opacity=0;foes.forEach(e=>{if(!e.dead){e.st='idle';e.S.prep=0;e.S.at=null}})}
function pushOut(pos,r){colliders.forEach(c=>{const dx=pos.x-c.x,dz=pos.z-c.z,d=Math.hypot(dx,dz),m=c.r+r;if(d<m&&d>.001){pos.x=c.x+dx/d*m;pos.z=c.z+dz/d*m}});pos.x=clamp(pos.x,-37,37);pos.z=clamp(pos.z,-37,37)}

function updatePlayer(dt,t){
  const S=P.S;P.iframe=Math.max(0,P.iframe-dt);P.stT-=dt;if(P.stT<=0)P.st=Math.min(100,P.st+24*dt);S.hit=Math.max(0,S.hit-dt);
  if(P.dead){S.dead+=dt;if(S.dead>1.2&&(key.Space||P.wantAtk>0)){respawn()}pose(hero,S,dt,t);return}
  if(P.wantAtk>0){P.wantAtk-=dt;startAttack();if(S.at&&S.at.t<.02)P.wantAtk=0}
  const m=moveInput();let tx=0,tz=0;
  if(S.roll){S.roll.t+=dt;tx=S.roll.dx*8.4;tz=S.roll.dz*8.4;P.vel.x=tx;P.vel.z=tz;if(S.roll.t>=S.roll.dur){S.roll=null}}
  else if(S.at){S.at.t+=dt;const u=S.at.t/S.at.dur;const f=fwd(S.face),push=u>.35&&u<.62?(S.at.heavy?5.5:4):0;P.vel.x=f[0]*push;P.vel.z=f[1]*push;
    if(u>.38&&u<.55)swordHits();if(S.at.t>=S.at.dur)S.at=null}
  else if(S.hit<=0){const sp=5.4;P.vel.x+=(m[0]*sp-P.vel.x)*Math.min(1,dt*10);P.vel.z+=(m[1]*sp-P.vel.z)*Math.min(1,dt*10);
    if(P.lock&&!P.lock.dead){const d=P.lock.pos.clone().sub(P.pos);S.face+=adiff(S.face,heading(d.x,d.z))*Math.min(1,dt*12)}
    else if(Math.hypot(m[0],m[1])>.15)S.face+=adiff(S.face,heading(m[0],m[1]))*Math.min(1,dt*12)}
  else{P.vel.multiplyScalar(.9)}
  P.pos.x+=P.vel.x*dt;P.pos.z+=P.vel.z*dt;pushOut(P.pos,.45);
  const gy=groundY(P.pos.x,P.pos.z);P.pos.y+=(gy-P.pos.y)*Math.min(1,dt*(gy>P.pos.y?14:7));
  S.sp=S.roll||S.at?0:Math.min(1,Math.hypot(P.vel.x,P.vel.z)/5.4);if(P.lock&&P.lock.dead)P.lock=null;
  pose(hero,S,dt,t)}
function swordHits(){const S=P.S,f=fwd(S.face);foes.forEach((e,i)=>{if(e.dead||S.at.hits.has(e))return;const d=e.pos.clone().sub(P.pos);d.y=0;const dist=d.length();if(dist>2.9+(e.brute?.4:0))return;
    if(dist>.8&&(d.x*f[0]+d.z*f[1])/dist<.35)return;S.at.hits.add(e);const dm=Math.round((S.at.heavy?38:22)*rand(.9,1.15));e.hp-=dm;e.S.hit=.3;e.S.prep=0;e.S.at=null;e.st='stagger';e.tm=e.brute?.28:.5;
    const kb=d.normalize().multiplyScalar(e.brute?.4:1.1);e.pos.add(kb);dmgText(e.pos,dm);e.flash=.12;
    if(e.hp<=0){e.dead=true;e.S.dead=.001;P.souls+=e.brute?200:60;$('souls').textContent='Souls '+P.souls;if(P.lock===e)P.lock=null}})}
function updateFoes(dt,t){foes.forEach(e=>{const S=e.S;S.hit=Math.max(0,S.hit-dt);
  if(e.dead){S.dead+=dt;pose(e.rig,S,dt,t);if(S.dead>2.6){scene.remove(e.rig.root);e.gone=true}return}
  const d=P.pos.clone().sub(e.pos);d.y=0;const dist=d.length(),dir=dist>.01?d.clone().divideScalar(dist):d;e.tm-=dt;
  const face=()=>{S.face+=adiff(S.face,heading(dir.x,dir.z))*Math.min(1,dt*(e.st==='chase'?7:3))};
  if(e.st==='idle'){S.sp*=.9;if(dist<24&&!P.dead)e.st='chase'}
  else if(e.st==='chase'){face();if(P.dead){e.st='idle'}else if(dist>e.rng*.85){e.pos.x+=dir.x*e.spd*dt;e.pos.z+=dir.z*e.spd*dt;S.sp=Math.min(1,S.sp+dt*5)}else{S.sp*=.8;e.st='wind';e.tm=e.brute?.85:.55}}
  else if(e.st==='wind'){face();S.sp*=.8;S.prep=Math.min(1,S.prep+dt/(e.brute?.7:.45));if(e.tm<=0){e.st='strike';e.tm=.45;S.prep=0;S.at={t:0,dur:.45,kind:0};e.hitDone=false}}
  else if(e.st==='strike'){S.at.t+=dt;if(!e.hitDone&&S.at.t>.2){e.hitDone=true;if(dist<e.rng+.5)hurtPlayer(e.dmg,e.pos)}if(e.tm<=0){S.at=null;e.st='recover';e.tm=e.brute?1.1:.7}}
  else if(e.st==='recover'){S.sp*=.9;if(e.tm<=0)e.st='chase'}
  else if(e.st==='stagger'){if(e.tm<=0)e.st='chase'}
  foes.forEach(o=>{if(o!==e&&!o.dead){const q=e.pos.clone().sub(o.pos);q.y=0;const l=q.length();if(l<1.3&&l>.01){e.pos.addScaledVector(q.divideScalar(l),(1.3-l)*.5)}}});
  pushOut(e.pos,.5);e.pos.y+=(groundY(e.pos.x,e.pos.z)-e.pos.y)*Math.min(1,dt*10);if(e.st!=='chase')S.sp=Math.min(S.sp,e.st==='stagger'?0:S.sp);
  pose(e.rig,S,dt,t);if(e.flash>0){e.flash-=dt}});
  for(let i=foes.length-1;i>=0;i--)if(foes[i].gone)foes.splice(i,1)}

/* ---------- camera + loop ---------- */
const cp=new T.Vector3();let last=performance.now(),clock=0,hint=0;
function frame(now){const dt=Math.min(.05,(now-last)/1000);last=now;clock+=dt;
  updatePlayer(dt,clock);updateFoes(dt,clock);
  hero.root.position.copy(P.pos);hero.root.rotation.y=P.S.face;foes.forEach(e=>{e.rig.root.position.copy(e.pos);e.rig.root.rotation.y=e.S.face});
  if(!foes.some(e=>!e.dead)&&!P.dead){waveWait-=dt;if(waveWait<=0){nextWave();waveWait=4}}else waveWait=Math.max(waveWait,3);
  const tgt=P.pos.clone();tgt.y+=1.6;let cy=yaw;
  if(P.lock&&!P.lock.dead){const d=P.lock.pos.clone().sub(P.pos);const want=heading(d.x,d.z);yaw+=adiff(yaw,want)*Math.min(1,dt*4);cy=yaw}
  const D=6.2,hgt=Math.sin(pitch)*D+1.2,hor=Math.cos(pitch)*D;cp.set(tgt.x+Math.sin(cy)*hor,tgt.y+hgt-1.2,tgt.z+Math.cos(cy)*hor);
  cp.x=clamp(cp.x,-38,38);cp.z=clamp(cp.z,-38,38);cp.y=Math.max(cp.y,.8);cam.position.lerp(cp,Math.min(1,dt*9));cam.lookAt(tgt);
  moon.position.set(P.pos.x-18,P.pos.y+38,P.pos.z-8);moon.target.position.copy(P.pos);
  flames.forEach(f=>{const k=1+Math.sin(clock*13+f.p)*.1+Math.sin(clock*7.3+f.p*2)*.08;f.s.scale.set(f.size*k,f.size*1.5*k,1)});
  lights.forEach(l=>{l.L.intensity=2.6+Math.sin(clock*11+l.p)*.5+Math.sin(clock*5.2+l.p)*.4});
  emberStep(dt);
  $('hp').firstChild.style.width=P.hp/P.max*100+'%';$('st').firstChild.style.width=P.st+'%';
  const lk=$('lock');if(P.lock&&!P.lock.dead){const q=P.lock.pos.clone();q.y+=2.4*(P.lock.brute?1.5:1);q.project(cam);lk.style.display='block';lk.style.left=(q.x*.5+.5)*innerWidth+'px';lk.style.top=(-q.y*.5+.5)*innerHeight+'px'}else lk.style.display='none';
  ren.render(scene,cam);requestAnimationFrame(frame)}
banner('FORTRESS OF EMBERS','The husks are burning. Survive.',3200);
requestAnimationFrame(t=>{last=t;frame(t)});
window.fortress={P,foes,hero,cam,spawn,scene,get yaw(){return yaw},set yaw(v){yaw=v},key,startAttack,roll};
})();
