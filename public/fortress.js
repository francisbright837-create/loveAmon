/* Fortress of Embers v2: an original third-person dark-fantasy mode (three.js r128).
   - 5 arenas. Clear every wave to open a portal to the next arena, with new and nastier demons.
   - A new power at the end of every level: speed, fire sword, lightning sword, frost, soul surge.
   - Touch controls tuned for iPhone + Android: floating thumbstick, big thumb buttons, auto-target,
     hold-to-attack, aim assist, haptics. Progress is saved on the device. */
(function(){
const T=THREE,$=id=>document.getElementById(id);
const rand=(a,b)=>a+Math.random()*(b-a),clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),lerp=(a,b,t)=>a+(b-a)*t,ease=t=>t*t*(3-2*t),easeOut=t=>1-(1-t)*(1-t);
const adiff=(a,b)=>{let d=b-a;while(d>Math.PI)d-=2*Math.PI;while(d<-Math.PI)d+=2*Math.PI;return d};
const fwd=a=>[-Math.sin(a),-Math.cos(a)];            // heading -> forward direction (characters face -z)
const heading=(dx,dz)=>Math.atan2(-dx,-dz);
const TOUCH=(window.matchMedia&&matchMedia('(pointer:coarse)').matches)||'ontouchstart' in window||(navigator.maxTouchPoints>0);
const buzz=ms=>{try{navigator.vibrate&&navigator.vibrate(ms)}catch(e){}};   // Android vibrates; iPhone ignores this

/* ---------- renderer, scene, lights ---------- */
const ren=new T.WebGLRenderer({antialias:true});ren.setPixelRatio(Math.min(devicePixelRatio||1,TOUCH?1.5:2));ren.shadowMap.enabled=true;ren.shadowMap.type=T.PCFSoftShadowMap;
ren.toneMapping=T.ACESFilmicToneMapping;ren.toneMappingExposure=1.15;ren.outputEncoding=T.sRGBEncoding;document.body.prepend(ren.domElement);
const scene=new T.Scene();scene.background=new T.Color(0x0b0809);scene.fog=new T.FogExp2(0x0b0809,.03);
const cam=new T.PerspectiveCamera(58,1,.1,140);
const resize=()=>{ren.setSize(innerWidth,innerHeight);cam.aspect=innerWidth/innerHeight;cam.fov=cam.aspect<1?74:58;cam.updateProjectionMatrix()};addEventListener('resize',resize);resize();
const hemi=new T.HemisphereLight(0x8393b8,0x2a1d14,.75);scene.add(hemi);
const moon=new T.DirectionalLight(0xa9bce6,.8);moon.castShadow=true;moon.shadow.mapSize.set(TOUCH?768:1024,TOUCH?768:1024);
const sc=moon.shadow.camera;sc.left=sc.bottom=-24;sc.right=sc.top=24;sc.near=1;sc.far=110;scene.add(moon,moon.target);

/* ---------- textures & materials (all drawn in code) ---------- */
function tex(w,draw,rx,ry){const c=document.createElement('canvas');c.width=c.height=w;draw(c.getContext('2d'),w);const t=new T.CanvasTexture(c);t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(rx,ry);t.anisotropy=4;t.encoding=T.sRGBEncoding;return t}
const speck=(g,w,n)=>{for(let i=0;i<n;i++){g.fillStyle='rgba(0,0,0,'+Math.random()*.28+')';g.fillRect(Math.random()*w,Math.random()*w,2,2)}};
const bricks=(g,w)=>{g.fillStyle='#16120f';g.fillRect(0,0,w,w);for(let r=0;r<8;r++)for(let c=-1;c<4;c++){g.fillStyle='hsl(30,'+(6+Math.random()*6)+'%,'+(26+Math.random()*13)+'%)';g.fillRect(c*64+(r%2)*32+2,r*32+2,60,28)}speck(g,w,700)};
const flags=(g,w)=>{g.fillStyle='#120f0d';g.fillRect(0,0,w,w);for(let r=0;r<4;r++)for(let c=0;c<4;c++){g.fillStyle='hsl(28,5%,'+(22+Math.random()*12)+'%)';g.fillRect(c*64+2,r*64+2,60,60)}speck(g,w,900);g.strokeStyle='rgba(0,0,0,.4)';for(let i=0;i<6;i++){g.beginPath();g.moveTo(Math.random()*w,Math.random()*w);g.lineTo(Math.random()*w,Math.random()*w);g.stroke()}};
const planks=(g,w)=>{for(let i=0;i<8;i++){g.fillStyle='hsl(26,'+(30+Math.random()*10)+'%,'+(20+Math.random()*9)+'%)';g.fillRect(i*32,0,30,w);g.fillStyle='rgba(0,0,0,.4)';g.fillRect(i*32+30,0,2,w);for(let k=0;k<14;k++){g.fillStyle='rgba(0,0,0,.14)';g.fillRect(i*32+Math.random()*28,Math.random()*w,1,10+Math.random()*40)}}};
const std=(map,r)=>new T.MeshStandardMaterial({map,roughness:r||.95,metalness:0});
const crypt=(g,w)=>{g.fillStyle='#0b1015';g.fillRect(0,0,w,w);for(let r=0;r<4;r++)for(let c=0;c<4;c++){g.fillStyle='hsl(205,'+(10+Math.random()*8)+'%,'+(14+Math.random()*10)+'%)';g.fillRect(c*64+2,r*64+2,60,60)}speck(g,w,900);g.strokeStyle='rgba(120,200,210,.12)';for(let i=0;i<8;i++){g.beginPath();g.moveTo(Math.random()*w,Math.random()*w);g.lineTo(Math.random()*w,Math.random()*w);g.stroke()}};
const obsid=(g,w)=>{g.fillStyle='#07050c';g.fillRect(0,0,w,w);for(let r=0;r<4;r++)for(let c=0;c<4;c++){g.fillStyle='hsl(268,'+(25+Math.random()*15)+'%,'+(7+Math.random()*7)+'%)';g.fillRect(c*64+2,r*64+2,60,60)}g.strokeStyle='rgba(170,100,255,.35)';g.lineWidth=1.5;for(let i=0;i<9;i++){g.beginPath();let x=Math.random()*w,y=Math.random()*w;g.moveTo(x,y);for(let k=0;k<4;k++){x+=rand(-30,30);y+=rand(-30,30);g.lineTo(x,y)}g.stroke()}};
const cinder=(g,w)=>{g.fillStyle='#120907';g.fillRect(0,0,w,w);for(let r=0;r<4;r++)for(let c=0;c<4;c++){g.fillStyle='hsl(14,'+(18+Math.random()*10)+'%,'+(8+Math.random()*7)+'%)';g.fillRect(c*64+2,r*64+2,60,60)}speck(g,w,900)};
const cracks=(g,w)=>{g.fillStyle='#000';g.fillRect(0,0,w,w);g.strokeStyle='#ff8a2a';g.lineCap='round';for(let i=0;i<16;i++){g.lineWidth=rand(1.5,3.5);g.beginPath();let x=Math.random()*w,y=Math.random()*w;g.moveTo(x,y);for(let k=0;k<5;k++){x+=rand(-40,40);y+=rand(-40,40);g.lineTo(x,y)}g.stroke()}};
const brickTex=tex(256,bricks,1,1),woodTex=tex(256,planks,1,1);
const stone=(rx,ry,tint)=>{const t=brickTex.clone();t.needsUpdate=true;t.repeat.set(rx,ry);const m=std(t);if(tint)m.color.setHex(tint);return m};
const wood=(rx,ry)=>{const t=woodTex.clone();t.needsUpdate=true;t.repeat.set(rx,ry);return std(t)};
const plain=(c,r,m)=>new T.MeshStandardMaterial({color:c,roughness:r==null?.6:r,metalness:m||0});
function glowTex(stops){const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d'),r=g.createRadialGradient(32,32,2,32,32,32);stops.forEach(s=>r.addColorStop(s[0],s[1]));g.fillStyle=r;g.fillRect(0,0,64,64);const t=new T.CanvasTexture(c);t.userData={keep:1};return t}
const flameCache={};
function flameSet(rgb){const k=rgb.join(),r=rgb[0],g=rgb[1],b=rgb[2];if(flameCache[k])return flameCache[k];
  const tx=glowTex([[0,'rgba(255,245,220,1)'],[.25,'rgba('+r+','+g+','+b+',.9)'],[.6,'rgba('+(r*.6|0)+','+(g*.6|0)+','+(b*.6|0)+',.35)'],[1,'rgba('+(r*.3|0)+','+(g*.3|0)+','+(b*.3|0)+',0)']]);
  const mat=new T.SpriteMaterial({map:tx,blending:T.AdditiveBlending,transparent:true,depthWrite:false});mat.userData.keep=1;return flameCache[k]={tx,mat}}
const dotTex=glowTex([[0,'rgba(255,230,160,1)'],[.5,'rgba(255,120,30,.6)'],[1,'rgba(255,60,0,0)']]);

/* ---------- themes: one per arena ---------- */
const TH={
 ember:{bg:0x0b0809,fog:.03,hemi:[0x8393b8,0x2a1d14,.75],moon:[0xa9bce6,.8],flame:[255,170,60],glow:0xff4a10,skin:0x2a0e06,dark:0x140c0a,eye:0xffc060,ember:0xffb060,exp:1.15},
 crypt:{bg:0x060a0d,fog:.045,hemi:[0x5f8fa8,0x15222a,.85],moon:[0x7fc8d8,.8],flame:[60,220,200],glow:0x18c8b0,skin:0x0c2a2a,dark:0x0a1214,eye:0x7fffe8,ember:0x60f0d8,exp:1.2},
 cathedral:{bg:0x07040c,fog:.04,hemi:[0x7a5fc0,0x1a1030,.85],moon:[0xb59cff,.8],flame:[170,90,255],glow:0x9a4cff,skin:0x1c0c2c,dark:0x0c0614,eye:0xe6a0ff,ember:0xc090ff,exp:1.2},
 forge:{bg:0x120604,fog:.035,hemi:[0xc87a4a,0x3a1408,.85],moon:[0xffa860,.9],flame:[255,200,60],glow:0xffa020,skin:0x341006,dark:0x180804,eye:0xffee80,ember:0xffd060,exp:1.2},
 abyss:{bg:0x14040a,fog:.03,hemi:[0xc85a6a,0x2a0a12,.9],moon:[0xff6a7a,.9],flame:[255,50,70],glow:0xff1030,skin:0x300610,dark:0x14040a,eye:0xff5060,ember:0xff5068,exp:1.25}};
let th=TH.ember,FIRE=flameSet(th.flame);

/* ---------- arena: built fresh for every level ---------- */
const colliders=[],flames=[],lights=[],sources=[];   // colliders: {x,z,r,h} circles that block walking (h = how tall, shots hit tall ones)
let grp=null,AR={half:37,round:0,start:[0,22],zmin:-30},gY=()=>0,portal=null;
const addTo=m=>{grp.add(m);return m};
function box(w,h,d,mat,x,y,z,sh){const m=new T.Mesh(new T.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);m.castShadow=m.receiveShadow=sh!==false;return addTo(m)}
function cyl(r0,r1,h,mat,x,y,z){const m=new T.Mesh(new T.CylinderGeometry(r0,r1,h,12),mat);m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;return addTo(m)}
function fire(x,y,z,size,light){const s=new T.Sprite(FIRE.mat);s.position.set(x,y,z);s.scale.set(size,size*1.5,1);grp.add(s);flames.push({s,size,p:rand(0,6)});sources.push({x,y,z});
  if(light){const L=new T.PointLight(th.glow,2.6,22,1.5);L.position.set(x,y+.4,z);grp.add(L);lights.push({L,p:rand(0,6)})}}
function clearArena(){if(!grp)return;scene.remove(grp);const seen=new Set();
  grp.traverse(o=>{if(o.geometry)o.geometry.dispose();const ms=o.material?(Array.isArray(o.material)?o.material:[o.material]):[];
    ms.forEach(m=>{if(m.userData.keep||seen.has(m))return;seen.add(m);if(m.map&&!(m.map.userData&&m.map.userData.keep))m.map.dispose();if(m.emissiveMap)m.emissiveMap.dispose();m.dispose()})});
  colliders.length=flames.length=lights.length=sources.length=0;portal=null;grp=null}
function decal(size,col,x,z){const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');g.strokeStyle=col;g.lineWidth=4;g.shadowColor=col;g.shadowBlur=12;
  [110,96,62].forEach(r=>{g.beginPath();g.arc(128,128,r,0,7);g.stroke()});g.beginPath();for(let i=0;i<=5;i++){const a=i*Math.PI*4/5-Math.PI/2;g[i?'lineTo':'moveTo'](128+Math.cos(a)*96,128+Math.sin(a)*96)}g.stroke();
  const m=new T.Mesh(new T.PlaneGeometry(size,size),new T.MeshBasicMaterial({map:new T.CanvasTexture(c),transparent:true,blending:T.AdditiveBlending,depthWrite:false}));m.rotation.x=-Math.PI/2;m.position.set(x,.03,z);addTo(m)}
// the room shell: floor, four walls, buttresses (square halls) or a round platform
function shell(floorMat,wallTint,round){
  const fl=new T.Mesh(round?new T.CircleGeometry(31,48):new T.PlaneGeometry(80,80),floorMat);fl.rotation.x=-Math.PI/2;fl.receiveShadow=true;addTo(fl);if(round)return;
  [[0,-40,80,2],[0,40,80,2],[-40,0,2,80],[40,0,2,80]].forEach(a=>box(a[2],14,a[3],stone(a[2]/4,3.5,wallTint),a[0],7,a[1]));
  for(let i=-30;i<=30;i+=15){[[i,-38.6],[i,38.6]].forEach(p=>box(1.8,9,1.4,stone(.5,2,wallTint),p[0],4.5,p[1]));[[-38.6,i],[38.6,i]].forEach(p=>box(1.4,9,1.8,stone(.5,2,wallTint),p[0],4.5,p[1]))}}
const TORCH=[[-15,-37.4],[15,-37.4],[-30,37.4],[30,37.4],[-37.4,0],[37.4,-15],[37.4,15],[-37.4,25]];
const torches=()=>TORCH.forEach((p,i)=>{box(.2,.6,.2,plain(0x2a2018),p[0],3.2,p[1]);fire(p[0],3.8,p[1],1.6,i<3)});
const brazier=(x,z,size,light)=>{cyl(.45,.3,.5,plain(0x241a14,.5,.5),x,.9,z);cyl(.1,.1,.7,plain(0x241a14),x,.35,z);fire(x,1.4,z,size,light);colliders.push({x,z,r:.6,h:.9})};

function buildFortress(){
  AR={half:37,round:0,start:[0,22],zmin:-13};
const floor=new T.Mesh(new T.PlaneGeometry(80,80),std(tex(256,flags,20,20)));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;addTo(floor);
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
[[-16,-4],[16,-4],[-16,14],[16,14],[-8,26],[8,26]].forEach(p=>{cyl(.85,1,11,stone(1,3),p[0],5.5,p[1]);cyl(1.2,1.2,.5,stone(1,.3),p[0],11,p[1]);colliders.push({x:p[0],z:p[1],r:1.1,h:11})});
for(let i=0;i<14;i++){const x=rand(-34,34),z=rand(-10,34);if(Math.hypot(x,z-8)<7)continue;if(i%2){box(1.4,1.4,1.4,wood(1,1),x,.7,z).rotation.y=rand(0,3);colliders.push({x,z,r:.95,h:1.4})}else{cyl(.5,.55,1.1,wood(1,1),x,.55,z);colliders.push({x,z,r:.6,h:1.1})}}
[[-9,8],[9,8],[-9,-8],[9,-8]].forEach((p,i)=>{cyl(.45,.3,.5,plain(0x241a14,.5,.5),p[0],.9,p[1]);cyl(.1,.1,.7,plain(0x241a14),p[0],.35,p[1]);fire(p[0],1.4,p[1],2.2,i<3);colliders.push({x:p[0],z:p[1],r:.6,h:.9})});
gY=(x,z)=>(x>ST.x0&&x<ST.x1&&z<=ST.z1&&z>=ST.z0)?3*((-14-z)/8):(x>DECK.x0&&x<DECK.x1&&z<ST.z0&&z>DECK.z0)?3:0;
}
function buildCatacombs(){
  AR={half:37,round:0,start:[0,24],zmin:-30};const tint=0x7f9ab8;shell(std(tex(256,crypt,20,20)),tint);torches();
  [[-18,-14],[0,-14],[18,-14],[-18,8],[18,8],[-9,26],[9,26]].forEach(p=>{cyl(.9,1.05,11,stone(1,3,0x8fa8c0),p[0],5.5,p[1]);cyl(1.25,1.25,.5,stone(1,.3,0x8fa8c0),p[0],11,p[1]);colliders.push({x:p[0],z:p[1],r:1.15,h:11})});
  for(let i=0;i<9;i++){const x=rand(-32,32),z=rand(-30,26);if(Math.hypot(x,z-24)<9||Math.hypot(x,z)<6)continue;const r=rand(0,3.1);
    box(1.6,.9,3.2,stone(1,1,0x9fb0c0),x,.45,z).rotation.y=r;box(1.7,.25,3.3,stone(1,1,0xb4c4d4),x,1,z).rotation.y=r;colliders.push({x,z,r:1.5,h:1.2})}
  for(let i=0;i<50;i++){const b=cyl(.05,.05,rand(.3,.7),plain(0xcfc8b0,.8),rand(-36,36),.05,rand(-36,36));b.rotation.z=rand(0,3);b.rotation.y=rand(0,3)}
  [[-9,6],[9,6],[0,-6]].forEach((p,i)=>brazier(p[0],p[1],2.2,i<2));}
function buildCathedral(){
  AR={half:37,round:0,start:[0,24],zmin:-30};shell(new T.MeshStandardMaterial({map:tex(256,obsid,16,16),roughness:.28,metalness:.55}),0x5a4a7a);torches();decal(28,'#b07aff',0,0);
  [[-14,-24],[14,-24],[-14,-8],[14,-8],[-14,8],[14,8],[-14,24],[14,24]].forEach(p=>{cyl(.9,1.1,17,stone(1,4,0x6a5a8a),p[0],8.5,p[1]);cyl(1.3,1.3,.6,stone(1,.3,0x6a5a8a),p[0],.3,p[1]);colliders.push({x:p[0],z:p[1],r:1.2,h:17})});
  [-24,-12,0,12,24].forEach(x=>{const w=new T.Mesh(new T.PlaneGeometry(3,9),new T.MeshBasicMaterial({color:0x7a3cff}));w.position.set(x,8,-39.1);addTo(w)});
  box(8,1.2,3,stone(2,1,0x6a5a8a),0,.6,-31);colliders.push({x:-2.6,z:-31,r:1.9,h:1.2},{x:2.6,z:-31,r:1.9,h:1.2});
  [[-9,12],[9,12],[-9,-6],[9,-6]].forEach((p,i)=>brazier(p[0],p[1],2.4,i<2));}
function buildForge(){
  AR={half:37,round:0,start:[0,24],zmin:-30};shell(new T.MeshStandardMaterial({map:tex(256,cinder,20,20),emissive:0xff6a1a,emissiveMap:tex(256,cracks,10,10),emissiveIntensity:.9,roughness:.9}),0x8a5a4a);torches();
  const lava=glowTex([[0,'rgba(255,235,130,1)'],[.6,'rgba(255,130,20,1)'],[.92,'rgba(200,50,0,1)'],[1,'rgba(70,12,0,1)']]);
  [[-18,-8,4.2],[17,-14,3.6],[-8,14,3.2],[22,10,4]].forEach((p,i)=>{const m=new T.Mesh(new T.CircleGeometry(p[2],32),new T.MeshBasicMaterial({map:lava}));m.rotation.x=-Math.PI/2;m.position.set(p[0],.04,p[1]);addTo(m);colliders.push({x:p[0],z:p[1],r:p[2]-.2,h:0});
    if(i<2){const L=new T.PointLight(0xff7a20,2.2,16,1.5);L.position.set(p[0],1.6,p[1]);grp.add(L);lights.push({L,p:rand(0,6)})}sources.push({x:p[0],y:.3,z:p[1]})});
  [[-26,-20],[27,-4],[-4,-2]].forEach(p=>{box(1.3,.7,.8,plain(0x2a2a30,.4,.8),p[0],.9,p[1]);box(.9,.6,.6,plain(0x1c1c20,.6,.4),p[0],.3,p[1]);colliders.push({x:p[0],z:p[1],r:.8,h:1.2})});
  for(let i=0;i<10;i++)cyl(.04,.04,7,plain(0x3a3a40,.5,.8),rand(-34,34),9,rand(-34,10));
  [[-34,-34],[34,-34],[-34,34],[34,34]].forEach(p=>cyl(2,2.4,13,stone(1,3,0x6a4a3a),p[0],6.5,p[1]));}
function buildThrone(){
  AR={half:0,round:29,start:[0,20],zmin:-30};shell(new T.MeshStandardMaterial({map:tex(256,obsid,14,14),color:0xb07080,roughness:.45,metalness:.35}),0,true);decal(48,'#ff3050',0,0);
  for(let i=0;i<30;i++){const a=i/30*Math.PI*2,r=31.5+rand(0,2.5),m=new T.Mesh(new T.ConeGeometry(rand(.8,1.6),rand(3,8),5),plain(0x2a0c14,.9));m.position.set(Math.cos(a)*r,1.5,Math.sin(a)*r);m.castShadow=true;addTo(m)}
  for(let i=0;i<8;i++){const a=i/8*Math.PI*2+.3,x=Math.cos(a)*19,z=Math.sin(a)*19,h=rand(6,11);cyl(.9,1.1,h,stone(1,2,0x7a4a5a),x,h/2,z);colliders.push({x,z,r:1.15,h});if(i%2)fire(x,h+.4,z,2,i<4)}
  box(10,.5,5,stone(2,1,0x6a3a4a),0,.25,-24);box(7,1,3.5,stone(2,1,0x6a3a4a),0,.75,-24.4);box(2.4,1.2,2,plain(0x1a0a10,.4,.5),0,1.6,-24.6);box(2.6,5,.5,plain(0x1a0a10,.4,.5),0,3.5,-25.7);
  [-1,1].forEach(s=>{const sp=new T.Mesh(new T.ConeGeometry(.3,2.4,5),plain(0x1a0a10,.4,.5));sp.position.set(s*1.4,6.4,-25.7);sp.castShadow=true;addTo(sp)});colliders.push({x:0,z:-24.5,r:3.3,h:5});
  [[-10,-8],[10,-8],[-12,10],[12,10]].forEach((p,i)=>brazier(p[0],p[1],2.4,i<2));
  const mt=new T.Sprite(new T.SpriteMaterial({map:flameSet([255,70,90]).tx,blending:T.AdditiveBlending,transparent:true,depthWrite:false,fog:false}));mt.material.userData.keep=0;mt.scale.set(80,80,1);mt.position.set(0,34,-95);grp.add(mt);}
const ARENAS=[buildFortress,buildCatacombs,buildCathedral,buildForge,buildThrone];

/* drifting embers */
const EN=380,epos=new Float32Array(EN*3),evel=[],egeo=new T.BufferGeometry();
for(let i=0;i<EN;i++){evel.push({vx:rand(-.3,.3),vy:rand(.8,2.2),vz:rand(-.3,.3),l:rand(0,3)});epos[i*3+1]=-50}
egeo.setAttribute('position',new T.BufferAttribute(epos,3));
const emberMat=new T.PointsMaterial({size:.16,map:dotTex,blending:T.AdditiveBlending,transparent:true,depthWrite:false,color:0xffb060});scene.add(new T.Points(egeo,emberMat));
function emberStep(dt){const src=sources.concat(foes.filter(e=>!e.dead).map(e=>({x:e.pos.x,y:e.pos.y+1,z:e.pos.z})));if(!src.length)return;
  for(let i=0;i<EN;i++){const v=evel[i];v.l-=dt;if(v.l<=0){const s=src[(Math.random()*src.length)|0];epos[i*3]=s.x+rand(-.4,.4);epos[i*3+1]=s.y;epos[i*3+2]=s.z+rand(-.4,.4);v.l=rand(1.2,3.2)}
   epos[i*3]+=(v.vx+Math.sin(v.l*3+i)*.3)*dt;epos[i*3+1]+=v.vy*dt;epos[i*3+2]+=v.vz*dt}egeo.attributes.position.needsUpdate=true}
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
  if(c.demon){const hs=c.hornS||1,hp=c.hornP||1,eye=new T.MeshBasicMaterial({color:c.eye||0xffc060});
    for(let q=0;q<hp;q++)[-1,1].forEach(s=>{const h=part(new T.ConeGeometry(.04*hs,(.22+q*.12)*hs,6),plain(0x120808),s*(.09+q*.05),.12+q*.03,-.02);h.rotation.z=-s*(.5+q*.25);head.add(h)});
    [-1,1].forEach(s=>head.add(part(new T.BoxGeometry(.05,.025,.02),eye,s*.05,.02,-.115)));
    if(c.crown)for(let q=0;q<7;q++){const a=q/7*Math.PI*2,k=part(new T.ConeGeometry(.03,.16,5),plain(0xe0a030,.3,.8),Math.cos(a)*.11,.15,Math.sin(a)*.11);head.add(k)}
    if(c.wings){R.wings=[];[-1,1].forEach(s=>{const w=new T.Group();w.position.set(s*.2,.5,.16);tor.add(w);const m=part(new T.ConeGeometry(.3,1.1,3),plain(0x120808,.9),s*.55,0,0);m.rotation.z=-s*Math.PI/2;m.scale.z=.14;w.add(m);R.wings.push(w)})}
    if(c.spikes)for(let q=0;q<4;q++){const sp=part(new T.ConeGeometry(.05,.22,5),plain(0x120808),0,.1+q*.13,.17);sp.rotation.x=.5;tor.add(sp);[-1,1].forEach(s=>{const k=part(new T.ConeGeometry(.05,.2,5),plain(0x120808),s*.3,.5,0);k.rotation.z=-s*.9;tor.add(k)})}
    if(c.robe)hips.add(part(new T.CylinderGeometry(.2,.36,.75,10),plain(0x1a0f1f,.9),0,-.38,0))}
  else{head.add(part(new T.CylinderGeometry(.135,.145,.2,10),c.armor,0,.03,0));head.add(part(new T.BoxGeometry(.2,.03,.05),plain(0x050505),0,.03,-.13));const pl=part(new T.ConeGeometry(.04,.3,6),new T.MeshStandardMaterial({color:0x8a1d1d,roughness:.8}),0,.28,.04);pl.rotation.x=.5;head.add(pl)}
  [[1,'r'],[-1,'l']].forEach(([s,n])=>{
    tor.add(part(new T.SphereGeometry(.11,8,6),c.trim,s*.3,.52,0));
    const sh=new T.Group();sh.position.set(s*.3,.5,0);tor.add(sh);sh.add(limb(.32,.07,.06,c.armor));
    const el=new T.Group();el.position.y=-.32;sh.add(el);el.add(limb(.3,.06,.05,c.armor));
    const hand=new T.Group();hand.position.y=-.3;el.add(hand);hand.add(part(new T.SphereGeometry(.06,6,6),c.skin,0,0,0));R[n+'A']=sh;R[n+'F']=el;R[n+'H']=hand});
  if(c.sword){const g=new T.Group();g.add(part(new T.BoxGeometry(.05,.05,.06),plain(0x3a2a1a),0,0,0));g.add(part(new T.BoxGeometry(.22,.04,.05),c.trim,0,-.05,0));
    g.add(part(new T.BoxGeometry(.06,1.05,.018),R.bladeMat=new T.MeshStandardMaterial({color:0xcfd8e6,roughness:.25,metalness:.9,emissive:0x2a4a7a,emissiveIntensity:.6}),0,-.6,0));g.rotation.x=-1.4;R.rH.add(g);R.sword=g;
    if(c.fx){const fx=new T.Sprite(new T.SpriteMaterial({map:dotTex,blending:T.AdditiveBlending,transparent:true,depthWrite:false}));fx.position.set(0,-.62,0);fx.scale.set(.9,1.7,1);fx.visible=false;g.add(fx);R.fx=fx;const L=new T.PointLight(0xff7a30,0,7);L.position.set(0,-.6,0);g.add(L);R.fxL=L}}
  if(c.axe){const g=new T.Group();g.add(part(new T.BoxGeometry(.07,1.6,.07),plain(0x2a1a12),0,-.75,0));g.add(part(new T.BoxGeometry(.6,.42,.09),new T.MeshStandardMaterial({color:0x2a2a30,metalness:.8,roughness:.3,emissive:c.glowC||0xff4a10,emissiveIntensity:.8}),.25,-1.45,0));g.rotation.x=-1.4;R.rH.add(g);R.sword=g}
  if(c.cape){const cp=new T.Group();cp.position.set(0,.55,.15);tor.add(cp);const pm=new T.Mesh(new T.PlaneGeometry(.5,.95,1,3),new T.MeshStandardMaterial({color:0x7a1818,roughness:.9,side:T.DoubleSide}));pm.position.y=-.475;pm.castShadow=true;cp.add(pm);R.cape=cp}
  if(c.flames){R.fl=[];[[0,.45,0,2.5],[0,.95,0,1.7],[.35,.1,0,1.3],[-.35,.1,0,1.3]].forEach(a=>{const fm=(c.fmat||flameSet([255,170,60]).mat).clone();if(!c.fmat)fm.color.setHex(0xff8a40);const s=new T.Sprite(fm);s.position.set(a[0],a[1],a[2]);s.scale.set(a[3],a[3]*1.4,1);tor.add(s);R.fl.push(s)})}
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
  if(R.wings)R.wings.forEach((w,i)=>{w.rotation.z=(i?1:-1)*(.3+Math.sin(t*12+S.ph)*.35)});
  if(R.fl)R.fl.forEach((s,i)=>{const f=1+Math.sin(t*14+i*2)*.12;s.scale.set(s.scale.x,s.scale.x*1.4*f,1);s.material.opacity=S.dead>0?Math.max(0,1-S.dead/1.4):1})}

/* ---------- the hero ---------- */
const hero=makeRig({armor:plain(0x2c3038,.35,.85),trim:plain(0xb08a45,.4,.8),skin:plain(0xcaa88a,.8),sword:true,cape:true,scale:1.05,fx:true});
const P={pos:new T.Vector3(0,0,22),vel:new T.Vector3(),hp:100,max:100,st:100,souls:0,S:newState(),stT:0,lock:null,auto:TOUCH,chain:0,wantAtk:0,dead:false,iframe:0,powers:[],cd:0,elem:null};
P.S.face=0;hero.root.position.copy(P.pos);

/* ---------- powers: one new power at the end of every level ---------- */
const POW={speed:{n:'Windstep',ico:'💨',d:'You run and roll much faster.',col:0x80e0ff},fire:{n:'Flame Blade',ico:'🔥',d:'Your sword burns. Hits set demons on fire.',col:0xff6a20},
  storm:{n:'Storm Blade',ico:'⚡',d:'Lightning leaps from demon to demon.',col:0x9fd8ff},frost:{n:'Frostbite',ico:'❄️',d:'Your hits slow demons down.',col:0x7fe8ff},surge:{n:'Soul Surge',ico:'🌟',d:'Your Power blast is bigger and recharges faster.',col:0xffd060}};
const hasP=k=>P.powers.includes(k);
const ELEM={fire:{c:0xff5a10,i:1.6},storm:{c:0x9fd8ff,i:1.9},frost:{c:0x7fe8ff,i:1.5}};
function weaponFx(){const e=['frost','storm','fire'].find(k=>hasP(k)),B=hero.bladeMat;P.elem=e||null;
  if(!e){B.emissive.setHex(0x2a4a7a);B.emissiveIntensity=.6;hero.fx.visible=false;hero.fxL.intensity=0;return}
  B.emissive.setHex(ELEM[e].c);B.emissiveIntensity=ELEM[e].i;hero.fx.material.color.setHex(ELEM[e].c);hero.fx.visible=true;hero.fxL.color.setHex(ELEM[e].c)}
function renderPowers(){$('pw').textContent=P.powers.map(k=>POW[k].ico).join(' ');const b=$('bP');b.style.display=P.powers.length?'flex':'none'}
const DM=()=>1+lvl*.1+(hasP('fire')?.2:0)+(hasP('storm')?.1:0);          // player damage multiplier
const FM=()=>1+Math.min(lvl,9)*.12;                                         // enemy health multiplier
const FD=()=>1+Math.min(lvl,9)*.08;                                         // enemy damage multiplier

/* ---------- little effects: rings, lightning, puffs ---------- */
const fxs=[];
function ringFx(pos,col,maxR,dur){const m=new T.Mesh(new T.RingGeometry(.9,1,48),new T.MeshBasicMaterial({color:col,transparent:true,blending:T.AdditiveBlending,side:T.DoubleSide,depthWrite:false}));
  m.rotation.x=-Math.PI/2;m.position.set(pos.x,pos.y+.15,pos.z);scene.add(m);fxs.push({t:0,dur,u(k){const r=lerp(1,maxR,easeOut(k));m.scale.set(r,r,1);m.material.opacity=1-k},end(){scene.remove(m);m.geometry.dispose();m.material.dispose()}})}
function arcFx(a,b,col){const pts=[],n=7;for(let i=0;i<=n;i++){const k=i/n;pts.push(new T.Vector3(lerp(a.x,b.x,k)+(i&&i<n?rand(-.35,.35):0),lerp(a.y,b.y,k)+(i&&i<n?rand(-.35,.35):0),lerp(a.z,b.z,k)+(i&&i<n?rand(-.35,.35):0)))}
  const l=new T.Line(new T.BufferGeometry().setFromPoints(pts),new T.LineBasicMaterial({color:col,transparent:true,blending:T.AdditiveBlending}));scene.add(l);fxs.push({t:0,dur:.2,u(k){l.material.opacity=1-k},end(){scene.remove(l);l.geometry.dispose();l.material.dispose()}})}
function puff(pos,col){const s=new T.Sprite(new T.SpriteMaterial({map:dotTex,color:col,blending:T.AdditiveBlending,transparent:true,depthWrite:false}));s.position.set(pos.x+rand(-.2,.2),pos.y+.25,pos.z+rand(-.2,.2));s.scale.set(.6,.6,1);scene.add(s);
  fxs.push({t:0,dur:.4,u(k){s.material.opacity=.8*(1-k);s.scale.setScalar(.6+k*.5)},end(){scene.remove(s);s.material.dispose()}})}
function updateFx(dt){for(let i=fxs.length-1;i>=0;i--){const f=fxs[i];f.t+=dt;const k=Math.min(1,f.t/f.dur);f.u(k);if(k>=1){f.end();fxs.splice(i,1)}}}
function dmgText(pos,v,col){const d=document.createElement('div');d.className='dmg';d.textContent=v;if(col)d.style.color=col;document.body.appendChild(d);const v3=pos.clone();v3.y+=2;let t=0;(function f(){t+=.016;v3.y+=.02;const q=v3.clone().project(cam);d.style.left=(q.x*.5+.5)*innerWidth+'px';d.style.top=(-q.y*.5+.5)*innerHeight-t*40+'px';d.style.opacity=1-t/.9;if(t<.9)requestAnimationFrame(f);else d.remove()})()}
function banner(a,b,ms){const m=$('msg');m.innerHTML=a+(b?'<small>'+b+'</small>':'');m.style.opacity=1;clearTimeout(banner.t);if(ms)banner.t=setTimeout(()=>{m.style.opacity=0},ms)}

/* ---------- the demons ---------- */
// every type has its own body: size, horns, wings, spikes, robes, crown, weapons and behaviour
const FOES={
 husk:{n:'Burning Husk',hp:70,spd:3.5,dmg:12,rng:1.9,wind:.45,rec:.7,scale:1,souls:60,flames:1},
 imp:{n:'Imp',hp:42,spd:5.4,dmg:9,rng:1.6,wind:.28,rec:.45,scale:.78,souls:45,wings:1,hornS:1.3,flames:0},
 brute:{n:'Brute',hp:170,spd:2.3,dmg:24,rng:2.5,wind:.7,rec:1.1,scale:1.5,souls:200,spikes:1,hornP:2,flames:1},
 spitter:{n:'Fire Spitter',hp:60,spd:3,dmg:14,rng:0,ranged:1,wind:.75,rec:1.1,scale:1.05,souls:90,robe:1,hornS:1.4,flames:0,shot:11},
 warden:{n:'Horned Warden',hp:520,spd:2.7,dmg:34,rng:3.4,wind:.9,rec:1.2,scale:2.2,souls:700,spikes:1,hornP:2,hornS:2,axe:1,slam:1,boss:1,flames:1},
 lord:{n:'The Demon Lord',hp:1400,spd:3,dmg:40,rng:3.8,wind:.8,rec:1,scale:2.8,souls:2500,spikes:1,wings:1,hornP:3,hornS:2.4,crown:1,axe:1,slam:1,volley:1,summon:1,boss:1,flames:1,shot:12}};
const foes=[],shots=[];
function spawnFoe(type){
  const D=FOES[type],charred=plain(th.dark,.9),hot=new T.MeshStandardMaterial({color:th.skin,emissive:th.glow,emissiveIntensity:D.boss?.8:.55,roughness:.8}),fm=flameSet(th.flame).mat;
  const plate=D.boss?plain(th.dark,.45,.6):hot;
  const rig=makeRig({armor:plate,trim:charred,skin:hot,demon:true,flames:D.flames!==0,fmat:fm,scale:D.scale*rand(.95,1.08),hornS:D.hornS,hornP:D.hornP,wings:D.wings,spikes:D.spikes,robe:D.robe,crown:D.crown,axe:D.axe,eye:th.eye,glowC:th.glow});
  const pos=spawnPos(),hp=Math.round(D.hp*FM());
  const e={rig,S:newState(),def:D,type,pos:new T.Vector3(pos[0],0,pos[1]),hp,max:hp,spd:D.spd*(1+Math.min(lvl,9)*.03),dmg:Math.round(D.dmg*FD()),rng:D.rng,big:D.scale>1.4,st:'idle',tm:0,cd:rand(1,2.5),dead:false,burn:0,bt:0,slow:0,stun:0,flash:0,summoned:false,hitDone:false};
  e.S.face=0;rig.root.position.copy(e.pos);foes.push(e);return e}
function spawnPos(){for(let k=0;k<25;k++){let x,z;if(AR.round){const a=rand(0,6.28),r=rand(8,24);x=Math.cos(a)*r;z=Math.sin(a)*r}else{x=rand(-30,30);z=rand(AR.zmin,6)}
  if(Math.hypot(x-P.pos.x,z-P.pos.z)<12||colliders.some(c=>Math.hypot(x-c.x,z-c.z)<c.r+1.2))continue;return[x,z]}return[rand(-15,15),-8]}
function hitFoe(e,dm,col,dot,heavy){if(e.dead)return;e.hp-=dm;dmgText(e.pos,dm,col);e.flash=.12;
  if(!dot){e.S.hit=e.def.boss?.1:.3;if(!e.def.boss||heavy){e.S.prep=0;e.S.at=null;e.st='stagger';e.tm=e.def.boss?.3:(e.big?.28:.5)}}
  if(e.hp<=0)killFoe(e)}
function killFoe(e){e.dead=true;e.S.dead=.001;P.souls+=e.def.souls;if(!P.dead)P.hp=Math.min(P.max,P.hp+(e.def.boss?P.max*.25:4));hud();if(P.lock===e)P.lock=null;buzz(e.def.boss?120:25);if(e.def.boss)ringFx(e.pos,th.glow,12,.9)}
function fireShot(e,spread){const D=e.def,o=e.pos.clone();o.y+=1.5*D.scale;const d=P.pos.clone();d.y+=1.1;d.sub(o);
  if(spread){const a=Math.atan2(d.x,d.z)+spread,l=Math.hypot(d.x,d.z);d.x=Math.sin(a)*l;d.z=Math.cos(a)*l}d.normalize();
  const s=new T.Sprite(FIRE.mat);s.scale.set(1.2,1.2,1);s.position.copy(o);scene.add(s);shots.push({s,p:o,v:d.multiplyScalar(D.shot||11),life:3.5,dmg:e.dmg})}
function updateShots(dt){for(let i=shots.length-1;i>=0;i--){const q=shots[i];q.p.addScaledVector(q.v,dt);q.s.position.copy(q.p);q.life-=dt;let gone=q.life<=0;
  const dx=P.pos.x-q.p.x,dz=P.pos.z-q.p.z;if(!gone&&dx*dx+dz*dz<.7&&Math.abs(q.p.y-(P.pos.y+1))<1.2){hurtPlayer(q.dmg,q.p);gone=true}
  if(!gone)for(const c of colliders)if(c.h>q.p.y&&Math.hypot(q.p.x-c.x,q.p.z-c.z)<c.r){gone=true;break}
  if(gone){scene.remove(q.s);shots.splice(i,1)}}}
function clearShots(){shots.forEach(q=>scene.remove(q.s));shots.length=0}
function slam(e,R){ringFx(e.pos,th.glow,R,.55);buzz(40);const d=Math.hypot(P.pos.x-e.pos.x,P.pos.z-e.pos.z);if(d<R&&P.pos.y<1.5)hurtPlayer(Math.round(e.dmg*1.2),e.pos)}
function summonImps(e){for(let i=0;i<3;i++){const m=spawnFoe('imp');m.pos.set(e.pos.x+rand(-4,4),0,e.pos.z+rand(-4,4));m.st='chase'}banner('THE LORD CALLS HIS BROOD','',1800)}
/* ---------- levels ---------- */
const LEVELS=[
 {name:'Fortress of Embers',sub:'The husks are burning. Survive.',th:'ember',arena:0,waves:[{husk:4},{husk:5,brute:1}],reward:'speed'},
 {name:'Ashen Catacombs',sub:'Imps swarm out of the bones.',th:'crypt',arena:1,waves:[{husk:3,imp:3},{imp:4,spitter:2},{brute:2,imp:3,spitter:1}],reward:'fire'},
 {name:'Obsidian Cathedral',sub:'The Horned Warden guards the altar.',th:'cathedral',arena:2,waves:[{imp:4,spitter:3},{brute:2,spitter:3,husk:2},{warden:1,imp:3}],reward:'storm'},
 {name:'Forge of Cinders',sub:'Molten demons hammer in the dark.',th:'forge',arena:3,waves:[{imp:6,brute:2},{spitter:4,brute:2},{warden:1,brute:2,spitter:2}],reward:'frost'},
 {name:'Abyssal Throne',sub:'The Demon Lord awaits.',th:'abyss',arena:4,waves:[{imp:6,spitter:3},{brute:3,warden:1},{lord:1}],reward:'surge'}];
const lvlDef=i=>{if(i<LEVELS.length)return LEVELS[i];const k=i-LEVELS.length+1;
  return{name:'Endless Abyss '+k,sub:'There is no end. Only more demons.',th:['crypt','cathedral','forge','abyss'][k%4],arena:[1,2,3,4][k%4],reward:null,
   waves:[{imp:6+k*2,spitter:3+k,brute:1+k},{brute:3+k,warden:1+(k>>1),spitter:2+k},{lord:1,warden:k>>1,imp:4+k}]}};
let lvl=0,L=LEVELS[0],wave=0,waveWait=2,state='play',clearT=0,busy=false,snapCam=false;
const SAVE='fortress-embers-v2';
const save=()=>{try{localStorage.setItem(SAVE,JSON.stringify({lvl,powers:P.powers,souls:P.souls}))}catch(e){}};
const loadSave=()=>{try{return JSON.parse(localStorage.getItem(SAVE)||'null')}catch(e){return null}};
function hud(){$('souls').textContent='Souls '+P.souls;$('wave').textContent=state==='clear'?'Level cleared':'Wave '+Math.max(1,wave)+' / '+L.waves.length;$('lvl').textContent='Level '+(lvl+1)+' · '+L.name}
function applyTheme(k){th=TH[k];scene.background.setHex(th.bg);scene.fog.color.setHex(th.bg);scene.fog.density=th.fog;hemi.color.setHex(th.hemi[0]);hemi.groundColor.setHex(th.hemi[1]);hemi.intensity=th.hemi[2];
  moon.color.setHex(th.moon[0]);moon.intensity=th.moon[1];emberMat.color.setHex(th.ember);ren.toneMappingExposure=th.exp;FIRE=flameSet(th.flame)}
function startLevel(i){lvl=i;L=lvlDef(i);clearShots();foes.forEach(e=>scene.remove(e.rig.root));foes.length=0;applyTheme(L.th);clearArena();grp=new T.Group();scene.add(grp);ARENAS[L.arena]();
  P.max=100+20*Math.min(lvl,15);P.hp=P.max;P.st=100;P.dead=false;P.S.dead=0;P.S.hit=0;P.S.at=null;P.S.roll=null;P.pos.set(AR.start[0],0,AR.start[1]);P.vel.set(0,0,0);P.lock=null;P.cd=0;
  hero.root.position.copy(P.pos);wave=0;waveWait=2.4;state='play';snapCam=true;hud();renderPowers();weaponFx();banner(L.name.toUpperCase(),L.sub,3800);save()}
function nextWave(){const w=L.waves[wave];wave++;Object.keys(w).forEach(t=>{for(let i=0;i<w[t];i++)spawnFoe(t)});hud();
  const boss=Object.keys(w).find(t=>FOES[t].boss);banner(boss?'⚠ '+FOES[boss].n.toUpperCase():'WAVE '+wave+' / '+L.waves.length,'',2000)}
function makePortal(){const g=new T.Group(),col=th.glow;g.position.set(0,0,8);
  const ring=new T.Mesh(new T.TorusGeometry(1.8,.16,10,36),new T.MeshStandardMaterial({color:col,emissive:col,emissiveIntensity:1.6}));ring.position.y=2.1;g.add(ring);
  const disc=new T.Mesh(new T.CircleGeometry(1.7,32),new T.MeshBasicMaterial({color:col,transparent:true,opacity:.45,blending:T.AdditiveBlending,side:T.DoubleSide,depthWrite:false}));disc.position.y=2.1;g.add(disc);
  const pl=new T.PointLight(col,3,18,1.5);pl.position.y=2.1;g.add(pl);grp.add(g);return{g,ring,disc,pos:new T.Vector3(0,0,8)}}
function levelClear(){state='clear';clearT=8;const k=L.reward;
  if(k&&!hasP(k)){P.powers.push(k);weaponFx();renderPowers();banner('LEVEL CLEARED','NEW POWER · '+POW[k].ico+' '+POW[k].n+'<br>'+POW[k].d,7000);ringFx(P.pos,POW[k].col,9,1)}
  else banner('LEVEL CLEARED','Your life grows stronger',5000);
  P.hp=P.max;P.souls+=500;portal=makePortal();hud();save();buzz(80)}
function goNext(){if(busy)return;busy=true;state='trans';const f=$('fade');f.style.opacity=1;banner('ENTERING…','',0);
  setTimeout(()=>{startLevel(lvl+1);f.style.opacity=0;busy=false},900)}
function newGame(){try{localStorage.removeItem(SAVE)}catch(e){}P.powers=[];P.souls=0;startLevel(0)}

/* ---------- input: keyboard, floating thumbstick, thumb buttons ---------- */
const key={};let yaw=0,pitch=.38,atkHeld=false,joy={on:false,id:null,x:0,y:0,ox:0,oy:0},look={id:null,x:0,y:0};
const JR=64,DEAD=.12;                                   // thumbstick travel (px) and dead zone
addEventListener('keydown',e=>{key[e.code]=1;if(e.code==='Space')roll();if(e.code==='KeyJ')P.wantAtk=.35;if(e.code==='KeyQ')toggleAuto();if(e.code==='KeyE')nova();if(/^(Space|Arrow)/.test(e.code))e.preventDefault()});
addEventListener('keyup',e=>{key[e.code]=0});
const onBtn=(id,down,up)=>{const b=$(id);b.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();try{b.setPointerCapture(e.pointerId)}catch(x){}b.classList.add('on');down()});
  ['pointerup','pointercancel','lostpointercapture'].forEach(n=>b.addEventListener(n,()=>{b.classList.remove('on');if(up)up()}))};
onBtn('bA',()=>{atkHeld=true;P.wantAtk=.35},()=>{atkHeld=false});onBtn('bR',()=>roll());onBtn('bL',()=>toggleAuto());onBtn('bP',()=>nova());
function joyShow(on){$('joy').style.display=on?'block':'none';$('joyHint').style.opacity=on?0:.55}
addEventListener('pointerdown',e=>{if(e.target.closest&&e.target.closest('.btn,#exit,#newg'))return;
  if(e.pointerType!=='mouse'&&e.clientX<innerWidth*.55&&e.clientY>innerHeight*.16){if(!joy.on){joy={on:true,id:e.pointerId,x:0,y:0,ox:e.clientX,oy:e.clientY};const j=$('joy');j.style.left=e.clientX+'px';j.style.top=e.clientY+'px';j.firstChild.style.transform='';joyShow(true)}}
  else{look={id:e.pointerId,x:e.clientX,y:e.clientY};if(e.pointerType==='mouse'&&e.button===0){atkHeld=true;P.wantAtk=.35}}});
addEventListener('pointermove',e=>{if(joy.on&&e.pointerId===joy.id){let dx=e.clientX-joy.ox,dy=e.clientY-joy.oy;const l=Math.hypot(dx,dy)||1;
    if(l>JR){joy.ox+=dx/l*(l-JR);joy.oy+=dy/l*(l-JR);dx=e.clientX-joy.ox;dy=e.clientY-joy.oy;const j=$('joy');j.style.left=joy.ox+'px';j.style.top=joy.oy+'px'}   // the stick follows your thumb if you drift
    const l2=Math.min(Math.hypot(dx,dy),JR),m=l2/JR,v=m<DEAD?0:(m-DEAD)/(1-DEAD),a=Math.atan2(dy,dx);joy.x=Math.cos(a)*v;joy.y=Math.sin(a)*v;$('joy').firstChild.style.transform='translate('+Math.cos(a)*l2+'px,'+Math.sin(a)*l2+'px)'}
  else if(e.pointerId===look.id){const k=TOUCH?.0075:.006;yaw-=(e.clientX-look.x)*k;pitch=clamp(pitch+(e.clientY-look.y)*.004,.12,.85);look.x=e.clientX;look.y=e.clientY}});
['pointerup','pointercancel'].forEach(n=>addEventListener(n,e=>{if(e.pointerId===joy.id){joy.on=false;joy.x=joy.y=0;joyShow(false)}if(e.pointerId===look.id){look.id=null;if(e.pointerType==='mouse')atkHeld=false}}));
addEventListener('blur',()=>{joy.on=false;joy.x=joy.y=0;atkHeld=false;joyShow(false)});
['gesturestart','gesturechange','dblclick','contextmenu'].forEach(n=>addEventListener(n,e=>e.preventDefault()));       // no pinch-zoom / long-press menus on iPhone + Android
document.addEventListener('touchmove',e=>e.preventDefault(),{passive:false});
$('exit').addEventListener('click',()=>{try{parent.postMessage('fortress-exit','*')}catch(x){}if(parent===window)history.back()});
$('newg').addEventListener('click',()=>{if(confirm('Start a brand-new game? Your powers will be reset.'))newGame()});
function moveInput(){let f=(key.KeyW||key.ArrowUp?1:0)-(key.KeyS||key.ArrowDown?1:0)-joy.y,r=(key.KeyD||key.ArrowRight?1:0)-(key.KeyA||key.ArrowLeft?1:0)+joy.x;
  const fx=-Math.sin(yaw),fz=-Math.cos(yaw),rx=Math.cos(yaw),rz=-Math.sin(yaw);let x=fx*f+rx*r,z=fz*f+rz*r;const l=Math.hypot(x,z);if(l>1){x/=l;z/=l}return[x,z]}
const nearestFoe=r=>{let best=null,bd=r;foes.forEach(e=>{if(e.dead)return;const d=e.pos.distanceTo(P.pos);if(d<bd){bd=d;best=e}});return best};
function autoTarget(force){if(P.dead)return;if(!force&&P.lock&&!P.lock.dead&&P.lock.pos.distanceTo(P.pos)<32)return;P.lock=nearestFoe(24)}
function toggleAuto(){P.auto=!P.auto;if(P.auto)autoTarget(true);else P.lock=null;$('bL').textContent=P.auto?'Auto ✓':'Auto'}

/* ---------- combat ---------- */
function assist(){const S=P.S,t=P.lock&&!P.lock.dead?P.lock:nearestFoe(6.5);if(t){const d=t.pos.clone().sub(P.pos);S.face=heading(d.x,d.z)}}   // swings aim at the nearest demon for you
function startAttack(){const S=P.S;if(P.dead||S.roll||S.hit>0)return;const chain=S.at&&S.at.t>S.at.dur*.55;if(S.at&&!chain)return;if(P.st<14)return;
  const kind=S.at?(S.at.kind+1)%3:0;P.st-=kind===2?24:16;P.stT=.7;S.at={t:0,dur:(kind===2?.85:.62)*(hasP('speed')?.9:1),kind:kind===2?0:kind,heavy:kind===2,hits:new Set()};assist();buzz(10)}
function roll(){const S=P.S;if(P.dead||S.roll||S.hit>0||P.st<18)return;P.st-=hasP('speed')?14:20;P.stT=.7;S.at=null;
  const m=moveInput();let d;if(Math.hypot(m[0],m[1])>.1)d=m;else if(P.lock&&!P.lock.dead){d=fwd(S.face);d=[-d[0],-d[1]]}else d=fwd(S.face);          // no stick + locked on = hop backwards
  const l=Math.hypot(d[0],d[1])||1;S.roll={t:0,dur:hasP('speed')?.48:.55,dx:d[0]/l,dz:d[1]/l};P.iframe=.5;S.face=heading(S.roll.dx,S.roll.dz)}
function hurtPlayer(n,from){if(P.dead||P.iframe>0)return;P.hp-=n;P.S.hit=.35;P.S.at=null;dmgText(P.pos,n,'#ff6a5a');buzz(50);const d=P.pos.clone().sub(from);d.y=0;d.normalize().multiplyScalar(3.5);P.vel.add(d);
  if(P.hp<=0){P.hp=0;P.dead=true;P.S.dead=.001;P.S.roll=null;banner('YOU DIED','Tap Attack or Roll to rise again');buzz(200)}}
function respawn(){P.hp=P.max;P.st=100;P.dead=false;P.S.dead=0;P.S.hit=0;P.pos.set(AR.start[0],0,AR.start[1]);P.lock=null;clearShots();$('msg').style.opacity=0;foes.forEach(e=>{if(!e.dead){e.st='idle';e.S.prep=0;e.S.at=null}})}
function pushOut(pos,r){colliders.forEach(c=>{const dx=pos.x-c.x,dz=pos.z-c.z,d=Math.hypot(dx,dz),m=c.r+r;if(d<m&&d>.001){pos.x=c.x+dx/d*m;pos.z=c.z+dz/d*m}});
  if(AR.round){const l=Math.hypot(pos.x,pos.z),m=AR.round-r;if(l>m){pos.x*=m/l;pos.z*=m/l}}else{pos.x=clamp(pos.x,-37,37);pos.z=clamp(pos.z,-37,37)}}
function applyElem(e,heavy){if(hasP('fire')){e.burn=3.5;e.bt=.5}if(hasP('frost'))e.slow=2.5;if(hasP('storm')&&(heavy||Math.random()<.25))e.stun=Math.max(e.stun,e.def.boss?.15:.5)}
function chainBolt(e,dm){if(!hasP('storm'))return;let n=0;const a=e.pos.clone();a.y+=1.3;foes.forEach(o=>{if(o===e||o.dead||n>=2||o.pos.distanceTo(e.pos)>7)return;n++;const b=o.pos.clone();b.y+=1.3;arcFx(a,b,0x9fd8ff);hitFoe(o,Math.round(dm*.5),'#9fd8ff',true)})}
function swordHits(){const S=P.S,f=fwd(S.face);foes.forEach(e=>{if(e.dead||S.at.hits.has(e))return;const d=e.pos.clone().sub(P.pos);d.y=0;const dist=d.length();if(dist>2.9+(e.big?.5:0)+(e.def.boss?.8:0))return;
    if(dist>.8&&(d.x*f[0]+d.z*f[1])/dist<.35)return;S.at.hits.add(e);const dm=Math.round((S.at.heavy?38:22)*rand(.9,1.15)*DM());
    const col=P.elem==='fire'?'#ff9a3a':P.elem==='storm'?'#9fd8ff':P.elem==='frost'?'#9ff0ff':null;hitFoe(e,dm,col,false,S.at.heavy);buzz(15);
    if(!e.def.boss)e.pos.add(d.normalize().multiplyScalar(e.big?.4:1.1));if(!e.dead){applyElem(e,S.at.heavy);chainBolt(e,dm)}})}
function nova(){if(P.dead||P.cd>0||!P.powers.length)return;P.cd=hasP('surge')?5.5:8;buzz(40);
  const R=hasP('surge')?9:6.5,col=hasP('surge')?0xffd060:P.elem?ELEM[P.elem].c:0x80e0ff,dm=Math.round(45*DM()*(hasP('surge')?1.5:1));ringFx(P.pos,col,R,.55);if(hasP('surge'))ringFx(P.pos,0xffffff,R*.6,.4);
  foes.forEach(e=>{if(e.dead)return;const d=e.pos.distanceTo(P.pos);if(d>R+(e.big?1:0))return;hitFoe(e,dm,'#ffd27a',false,true);if(!e.dead){applyElem(e,true);e.stun=Math.max(e.stun,e.def.boss?.2:.6);if(!e.def.boss){const k=e.pos.clone().sub(P.pos);k.y=0;e.pos.add(k.normalize().multiplyScalar(2.2))}}});
  if(hasP('storm')){const a=P.pos.clone();a.y+=1.4;foes.filter(e=>!e.dead&&e.pos.distanceTo(P.pos)<17).slice(0,4).forEach(e=>{const b=e.pos.clone();b.y+=1.3;arcFx(a,b,0x9fd8ff);hitFoe(e,Math.round(30*DM()),'#9fd8ff',true)})}}
function updatePlayer(dt,t){
  const S=P.S;P.iframe=Math.max(0,P.iframe-dt);P.cd=Math.max(0,P.cd-dt);P.stT-=dt;if(P.stT<=0)P.st=Math.min(100,P.st+24*(hasP('speed')?1.3:1)*dt);S.hit=Math.max(0,S.hit-dt);
  if(P.dead){S.dead+=dt;if(S.dead>1.2&&(key.Space||P.wantAtk>0||atkHeld))respawn();pose(hero,S,dt,t);return}
  if(atkHeld)P.wantAtk=.35;
  if(P.wantAtk>0){P.wantAtk-=dt;startAttack();if(S.at&&S.at.t<.02)P.wantAtk=0}
  const m=moveInput(),SP=5.4*(hasP('speed')?1.3:1);let tx=0,tz=0;
  if(S.roll){S.roll.t+=dt;const rs=8.4*(hasP('speed')?1.25:1);tx=S.roll.dx*rs;tz=S.roll.dz*rs;P.vel.x=tx;P.vel.z=tz;if(S.roll.t>=S.roll.dur){S.roll=null}}
  else if(S.at){S.at.t+=dt;const u=S.at.t/S.at.dur;const f=fwd(S.face),push=u>.35&&u<.62?(S.at.heavy?5.5:4):0;P.vel.x=f[0]*push;P.vel.z=f[1]*push;
    if(u>.38&&u<.55)swordHits();if(S.at.t>=S.at.dur)S.at=null}
  else if(S.hit<=0){P.vel.x+=(m[0]*SP-P.vel.x)*Math.min(1,dt*10);P.vel.z+=(m[1]*SP-P.vel.z)*Math.min(1,dt*10);
    if(P.lock&&!P.lock.dead){const d=P.lock.pos.clone().sub(P.pos);S.face+=adiff(S.face,heading(d.x,d.z))*Math.min(1,dt*12)}
    else if(Math.hypot(m[0],m[1])>.15)S.face+=adiff(S.face,heading(m[0],m[1]))*Math.min(1,dt*12)}
  else{P.vel.multiplyScalar(.9)}
  P.pos.x+=P.vel.x*dt;P.pos.z+=P.vel.z*dt;pushOut(P.pos,.45);
  const gy=gY(P.pos.x,P.pos.z);P.pos.y+=(gy-P.pos.y)*Math.min(1,dt*(gy>P.pos.y?14:7));
  const spd=Math.hypot(P.vel.x,P.vel.z);S.sp=S.roll||S.at?0:Math.min(1,spd/5.4);if(P.lock&&P.lock.dead)P.lock=null;
  if(hasP('speed')&&spd>5.5&&(P.puffT=(P.puffT||0)-dt)<=0){P.puffT=.05;puff(P.pos,0x80e0ff)}                      // wind trail
  pose(hero,S,dt,t)}
function updateFoes(dt,t){foes.forEach(e=>{const S=e.S,D=e.def;S.hit=Math.max(0,S.hit-dt);
  if(e.dead){S.dead+=dt;pose(e.rig,S,dt,t);if(S.dead>2.6){scene.remove(e.rig.root);e.gone=true}return}
  if(e.burn>0){e.burn-=dt;e.bt-=dt;if(e.bt<=0){e.bt=.5;hitFoe(e,Math.round(6*DM()),'#ff9a3a',true);if(e.dead)return}}
  e.slow=Math.max(0,e.slow-dt);e.stun=Math.max(0,e.stun-dt);if(e.stun>0){S.sp*=.8;pose(e.rig,S,dt,t);return}
  const sp=e.spd*(e.slow>0?.5:1),d=P.pos.clone().sub(e.pos);d.y=0;const dist=d.length(),dir=dist>.01?d.clone().divideScalar(dist):d;e.tm-=dt;e.cd-=dt;
  const face=k=>{S.face+=adiff(S.face,heading(dir.x,dir.z))*Math.min(1,dt*k)},go=m=>{e.pos.x+=dir.x*sp*m*dt;e.pos.z+=dir.z*sp*m*dt;S.sp=Math.min(1,S.sp+dt*5)};
  const ramp=s=>{S.prep=Math.min(1,S.prep+dt/s)};
  if(D.summon&&!e.summoned&&e.hp<e.max*.5){e.summoned=true;summonImps(e)}
  switch(e.st){
   case'idle':S.sp*=.9;if(dist<26&&!P.dead)e.st='chase';break;
   case'chase':face(7);if(P.dead){e.st='idle';break}
     if(D.ranged){if(dist<7)go(-.9);else if(dist>13)go(1);else S.sp*=.8;if(e.cd<=0&&dist<22){e.st='wind';e.tm=D.wind;e.cd=rand(1.6,2.8)}break}
     if(D.boss&&e.cd<=0){e.cd=rand(2.8,4.5);if(D.volley&&(dist>7||Math.random()<.35)){e.st='volley';e.tm=.95;break}if(D.slam&&dist<7&&Math.random()<.6){e.st='slam';e.tm=1.05;break}}
     if(dist>e.rng*.85)go(1);else{S.sp*=.8;e.st='wind';e.tm=D.wind}break;
   case'wind':face(3);S.sp*=.8;ramp(D.wind*.8);if(e.tm<=0){S.prep=0;if(D.ranged){fireShot(e,0);e.st='recover';e.tm=D.rec}else{e.st='strike';e.tm=.45;S.at={t:0,dur:.45,kind:0};e.hitDone=false}}break;
   case'strike':S.at.t+=dt;if(!e.hitDone&&S.at.t>.2){e.hitDone=true;if(dist<e.rng+.5)hurtPlayer(e.dmg,e.pos)}if(e.tm<=0){S.at=null;e.st='recover';e.tm=D.rec}break;
   case'volley':face(3);S.sp*=.8;ramp(.9);if(e.tm<=0){S.prep=0;for(let i=-2;i<=2;i++)fireShot(e,i*.18);e.st='recover';e.tm=D.rec}break;
   case'slam':face(2);S.sp*=.8;ramp(1);if(e.tm<=0){S.prep=0;slam(e,5.6);e.st='recover';e.tm=1.4}break;
   case'recover':S.sp*=.9;if(e.tm<=0)e.st='chase';break;
   case'stagger':S.sp*=.8;if(e.tm<=0)e.st='chase';break}
  foes.forEach(o=>{if(o!==e&&!o.dead){const q=e.pos.clone().sub(o.pos);q.y=0;const l=q.length(),m=(e.big||o.big)?1.9:1.3;if(l<m&&l>.01)e.pos.addScaledVector(q.divideScalar(l),(m-l)*.5)}});
  pushOut(e.pos,.5);e.pos.y+=(gY(e.pos.x,e.pos.z)-e.pos.y)*Math.min(1,dt*10);pose(e.rig,S,dt,t)});
  for(let i=foes.length-1;i>=0;i--)if(foes[i].gone)foes.splice(i,1)}

/* ---------- camera + main loop ---------- */
const cp=new T.Vector3();let last=performance.now(),clock=0;
function frame(now){const dt=Math.min(.05,(now-last)/1000);last=now;clock+=dt;
  if(P.auto)autoTarget();
  updatePlayer(dt,clock);updateFoes(dt,clock);updateShots(dt);updateFx(dt);
  hero.root.position.copy(P.pos);hero.root.rotation.y=P.S.face;foes.forEach(e=>{e.rig.root.position.copy(e.pos);e.rig.root.rotation.y=e.S.face});
  if(P.elem){const f=1+Math.sin(clock*25)*.15+Math.random()*.1;hero.fx.scale.set(.9*f,1.7*f,1);hero.fxL.intensity=(P.elem==='storm'?2:1.4)*f}
  // level logic: clear a wave, next wave; clear the last wave, the portal opens
  if(state==='play'){if(!foes.some(e=>!e.dead)&&!P.dead){waveWait-=dt;if(waveWait<=0){if(wave<L.waves.length){nextWave();waveWait=3}else levelClear()}}else waveWait=Math.max(waveWait,2.5)}
  else if(state==='clear'&&portal){clearT-=dt;portal.ring.rotation.z+=dt*1.5;portal.disc.rotation.z-=dt*2;const pu=1+Math.sin(clock*4)*.06;portal.disc.scale.set(pu,pu,1);
    if(P.pos.distanceTo(portal.pos)<2.6||clearT<=0)goNext()}
  const bs=foes.find(e=>e.def.boss&&!e.dead);$('boss').style.display=bs?'block':'none';if(bs){$('bossName').textContent=bs.def.n;$('boss').lastChild.firstChild.style.width=Math.max(0,bs.hp/bs.max*100)+'%'}
  const tgt=P.pos.clone();tgt.y+=1.6;let cy=yaw;
  if(P.lock&&!P.lock.dead){const d=P.lock.pos.clone().sub(P.pos);const want=heading(d.x,d.z);yaw+=adiff(yaw,want)*Math.min(1,dt*4);cy=yaw}
  const D=TOUCH&&innerWidth<innerHeight?8:6.2,hgt=Math.sin(pitch)*D+1.2,hor=Math.cos(pitch)*D;cp.set(tgt.x+Math.sin(cy)*hor,tgt.y+hgt-1.2,tgt.z+Math.cos(cy)*hor);
  if(AR.round){const l=Math.hypot(cp.x,cp.z);if(l>43){cp.x*=43/l;cp.z*=43/l}}else{cp.x=clamp(cp.x,-38,38);cp.z=clamp(cp.z,-38,38)}cp.y=Math.max(cp.y,.8);
  if(snapCam){cam.position.copy(cp);snapCam=false}else cam.position.lerp(cp,Math.min(1,dt*9));cam.lookAt(tgt);
  moon.position.set(P.pos.x-18,P.pos.y+38,P.pos.z-8);moon.target.position.copy(P.pos);
  flames.forEach(f=>{const k=1+Math.sin(clock*13+f.p)*.1+Math.sin(clock*7.3+f.p*2)*.08;f.s.scale.set(f.size*k,f.size*1.5*k,1)});
  lights.forEach(l=>{l.L.intensity=2.4+Math.sin(clock*11+l.p)*.5+Math.sin(clock*5.2+l.p)*.4});
  emberStep(dt);
  $('hp').firstChild.style.width=P.hp/P.max*100+'%';$('st').firstChild.style.width=P.st+'%';
  const bp=$('bP');if(P.powers.length){bp.textContent=P.cd>0?Math.ceil(P.cd):'Power';bp.style.opacity=P.cd>0?.5:1}
  const lk=$('lock');if(P.lock&&!P.lock.dead){const q=P.lock.pos.clone();q.y+=2.4*(P.lock.big?1.5:1);q.project(cam);lk.style.display='block';lk.style.left=(q.x*.5+.5)*innerWidth+'px';lk.style.top=(-q.y*.5+.5)*innerHeight+'px'}else lk.style.display='none';
  ren.render(scene,cam);requestAnimationFrame(frame)}
/* ---------- start (continues from your saved level) ---------- */
$('bL').textContent=P.auto?'Auto ✓':'Auto';
const sv=loadSave();if(sv&&sv.powers){P.powers=sv.powers.filter(k=>POW[k]);P.souls=sv.souls|0}
startLevel(sv&&sv.lvl>0?sv.lvl:0);
if(sv&&sv.lvl>0)banner('WELCOME BACK','Level '+(lvl+1)+' · '+L.name,3200);
setTimeout(()=>{const h=$('help');if(h)h.style.opacity=0},9000);
requestAnimationFrame(t=>{last=t;frame(t)});
window.fortress={P,foes,hero,cam,scene,get lvl(){return lvl},get state(){return state},get wave(){return wave},get AR(){return AR},get colliders(){return colliders},shots,key,startLevel,startAttack,roll,nova,hitFoe,spawnFoe,levelClear,goNext,newGame,toggleAuto,
  killAll(){foes.forEach(e=>{if(!e.dead)hitFoe(e,99999,'#fff',true,true)})},get yaw(){return yaw},set yaw(v){yaw=v}};
})();
