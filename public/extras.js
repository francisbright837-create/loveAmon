// Fit the chat to the visible area when the phone keyboard opens
  (function () {
    if (!window.visualViewport) return;
    function fit() {
      var shell = document.querySelector('#chat-screen .chat-shell');
      if (!shell) return;
      shell.style.height = window.visualViewport.height + 'px';
      var list = document.getElementById('chat-messages');
      if (list) list.scrollTop = list.scrollHeight;
      window.scrollTo(0, 0);
    }
    window.visualViewport.addEventListener('resize', fit);
  })();

  // WhatsApp-style message bar: emoji picker + mic/send switch
  (function () {
    var input = document.getElementById('message-input');
    var panel = document.getElementById('emoji-panel');
    var emojiBtn = document.getElementById('emoji-btn');
    var mic = document.getElementById('mic-btn');
    var send = document.getElementById('send-btn');
    if (!input || !panel || !emojiBtn || !mic || !send) return;

    var EMOJIS = ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','😉','😊','😇','🥰','😍','🤩','😘',
      '😋','😜','🤪','😎','🤗','🤔','😐','🙄','😏','😬','😴','😢','😭','😤','😡','🥺',
      '😱','🥳','😳','🤦','🤷','🙏','👍','👎','👏','🙌','💪','🤝','👋','✌️','🤞','👌',
      '❤️','🧡','💛','💚','💙','💜','🖤','💕','💔','💯','🔥','✨','🎉','🎂','🎁','🌹',
      '☕','🍕','🍔','🍺','🌍','⭐','✅','❌','📞','📷','🎵','🏠'];

    EMOJIS.forEach(function (e) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = e;
      b.addEventListener('mousedown', function (ev) { ev.preventDefault(); });   // keep keyboard open
      b.addEventListener('click', function () {
        var start = input.selectionStart, end = input.selectionEnd;
        if (start == null) { start = end = input.value.length; }
        input.value = input.value.slice(0, start) + e + input.value.slice(end);
        var pos = start + e.length;
        try { input.setSelectionRange(pos, pos); } catch (err) {}
        input.focus();
        update();
      });
      panel.appendChild(b);
    });

    emojiBtn.addEventListener('click', function () {
      var menu = document.getElementById('attach-menu');
      if (menu) menu.style.display = 'none';
      panel.style.display = (panel.style.display === 'grid') ? 'none' : 'grid';
    });
    document.addEventListener('click', function (ev) {
      if (!panel.contains(ev.target) && !emojiBtn.contains(ev.target)) panel.style.display = 'none';
    });

    function update() {
      var has = input.value.trim().length > 0;
      mic.style.display = has ? 'none' : 'flex';
      send.style.display = has ? 'flex' : 'none';
    }
    input.addEventListener('input', update);
    send.addEventListener('click', function () { setTimeout(update, 50); });
    setInterval(update, 300);   // also catches the box being cleared after a message is sent
    update();
  })();

/* Shadow Dimension game is isolated so it does not overwrite LoveConnect functions. */
(function(){
 const screen=document.getElementById('shadow-game-screen'),canvas=document.getElementById('shadow-game-canvas');if(!screen||!canvas)return;const ctx=canvas.getContext('2d');
 let w=0,h=0,raf=0,last=0,time=0,active=false,started=false,keys={},camX=0,camY=0;
 const world={w:1900,h:1350},player={x:110,y:120,hp:100,max:100,level:1,power:1,kills:0,xp:0,fx:1,fy:0,cd:0,inv:0};
 const weapons=[{name:'Rift Katana',icon:'⚔',damage:1,owned:true},{name:'Demon Fang',icon:'🗡',damage:1.6,owned:false},{name:'War Hammer',icon:'🔨',damage:2.2,owned:false},{name:'Moon Edge',icon:'🌙',damage:3,owned:false}];let equipped=0,drops=[],boss=null,bossDead=false;
 const rivers=[{x:0,y:440,w:550,h:85},{x:650,y:440,w:450,h:85},{x:1250,y:400,w:650,h:100},{x:850,y:0,w:75,h:350},{x:1450,y:850,w:65,h:500}];
 const buildings=[{x:300,y:220,w:135,h:85},{x:1150,y:180,w:150,h:95},{x:1550,y:850,w:170,h:100},{x:260,y:900,w:130,h:85}];
 const cars=Array.from({length:8},(_,i)=>({x:180+(i*223)%1600,y:160+(i*173)%1050,a:(i%4)*.3}));
 const trees=Array.from({length:100},(_,i)=>({x:(i*197+31)%world.w,y:(i*283+61)%world.h,dead:i%4===0,s:.7+(i%5)*.12}));
 const demons=[];function spawn(x,y,t){const d=DT[t];demons.push({t,d,x,y,hp:d.hp,max:d.hp,r:d.r,alive:true,cd:0,phase:Math.random()*6})}
 function resize(){const d=Math.min(devicePixelRatio||1,2);w=screen.clientWidth;h=screen.clientHeight;canvas.width=w*d;canvas.height=h*d;ctx.setTransform(d,0,0,d,0,0)}
 function inWater(x,y){return rivers.some(r=>x>r.x&&x<r.x+r.w&&y>r.y&&y<r.y+r.h)}
 function toast(s){document.getElementById('sg-objective').textContent=s}
 window.openShadowGame=function(){if(typeof window.showTab==='function'){try{document.querySelectorAll('#app > div').forEach(el=>{if(el.id!=='shadow-game-screen'&&el.id!=='bottom-nav')el.style.display='none'})}catch(e){}}screen.style.display='block';document.getElementById('bottom-nav').style.display='none';resize();active=true;if(!raf){last=0;raf=requestAnimationFrame(loop)}};
 window.closeShadowGame=function(){active=false;screen.style.display='none';document.getElementById('bottom-nav').style.display='flex';if(typeof window.showTab==='function'){try{window.showTab('videos')}catch(e){}}};
 window.startShadowGame=function(){applyHero();started=true;document.getElementById('sg-start').style.display='none';toast(coarse?'Drag on the left to move · tap the right to attack':'Explore the ruins and find the shrine in the east')};
 function attack(){if(!active||!started||player.cd>0)return;player.cd=hero.cd;player.atkT=.32;let hit=false;for(const d of demons){if(!d.alive)continue;let dx=d.x-player.x,dy=d.y-player.y,dist=Math.hypot(dx,dy)||1;if(dist<hero.reach&&(dx*player.fx+dy*player.fy)/dist>-.45){const dm=dealt(d);d.hp-=dm;hitFx(d,dm,d.y-d.r*2-20);hit=true;if(d.hp<=0){d.alive=false;player.kills++;player.xp++;if(Math.random()<.55){let wi=Math.random()<.72?1:2;drops.push({x:d.x,y:d.y,wi})}if(player.xp>=player.level*4){player.xp=0;player.level++;player.power++;player.max+=10;player.hp=Math.min(player.max,player.hp+25);toast('LEVEL UP! Ren is now level '+player.level)}else toast('Demon defeated · essence absorbed')}break}}
 if(boss&&!boss.dead){let dist=Math.hypot(boss.x-player.x,boss.y-player.y);if(dist<hero.reach+22){const bd=dealt(boss)*1.3;boss.hp-=bd;hitFx(boss,bd,boss.y-90);hit=true;if(boss.hp<=0){bossKilled()}}}if(!hit)toast('Strike toward a nearby demon');}
 function interact(){let i=drops.findIndex(d=>Math.hypot(d.x-player.x,d.y-player.y)<55);if(i>=0){let d=drops.splice(i,1)[0];weapons[d.wi].owned=true;equipped=d.wi;document.getElementById('sg-weapon').textContent=weapons[equipped].icon+' '+weapons[equipped].name;toast('Collected '+weapons[equipped].name);return}if(Math.hypot(1730-player.x,1120-player.y)<100){if(bossDead){toast('The gate is open — more dimensions await!')}else if(!boss||boss.dead){spawnBoss()}else toast('Defeat '+boss.n+'!')}else toast('Find glowing weapon drops or travel east to the shrine')}
 function keydown(e){let k=e.key.toLowerCase();if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(k))e.preventDefault();keys[k]=true;if(k===' ')attack();if(k==='e')interact();if('1234'.includes(k)&&weapons[+k-1].owned){equipped=+k-1;document.getElementById('sg-weapon').textContent=weapons[equipped].icon+' '+weapons[equipped].name}}
 function keyup(e){keys[e.key.toLowerCase()]=false}window.addEventListener('keydown',keydown);window.addEventListener('keyup',keyup);
 document.querySelectorAll('#sg-dpad button').forEach(b=>{let k={up:'w',down:'s',left:'a',right:'d'}[b.dataset.move];const on=e=>{e.preventDefault();keys[k]=true},off=e=>{e.preventDefault();keys[k]=false};b.addEventListener('pointerdown',on);['pointerup','pointercancel','pointerleave'].forEach(n=>b.addEventListener(n,off))});document.getElementById('sg-attack').addEventListener('click',attack);document.getElementById('sg-pickup').addEventListener('click',interact);window.addEventListener('resize',resize);
 function update(dt){time+=dt;tick(dt);player.cd=Math.max(0,player.cd-dt);player.inv=Math.max(0,player.inv-dt);let dx=0,dy=0;if(keys.w||keys.arrowup)dy--;if(keys.s||keys.arrowdown)dy++;if(keys.a||keys.arrowleft)dx--;if(keys.d||keys.arrowright)dx++;if(joy.on){dx+=joy.vx;dy+=joy.vy}let l=Math.hypot(dx,dy)||1;dx/=l;dy/=l;if(dx||dy){player.fx=dx;player.fy=dy}let sp=inWater(player.x,player.y)?1.25:2.4,nx=Math.max(15,Math.min(world.w-15,player.x+dx*sp)),ny=Math.max(15,Math.min(world.h-15,player.y+dy*sp));if(!buildings.some(b=>nx>b.x-12&&nx<b.x+b.w+12&&ny>b.y-12&&ny<b.y+b.h+12)){player.x=nx;player.y=ny}
 demonAI(dt);if(boss&&!boss.dead){let x=player.x-boss.x,y=player.y-boss.y,dist=Math.hypot(x,y)||1;if(dist>75){boss.x+=x/dist*.45;boss.y+=y/dist*.45}boss.cd=(boss.cd||0)-dt;if(dist<48&&boss.cd<=0){boss.cd=1.2;boss.atk=.4;if(!player.inv){hurtP(boss.b.dmg);player.inv=.6}}}if(player.hp<=0){player.hp=player.max;player.x=110;player.y=120;toast('Ren recovered at the shrine')}
 document.getElementById('sg-stats').textContent=`Level ${player.level} · Power ${player.power} · Demons ${player.kills}`;document.getElementById('sg-health').style.width=100*player.hp/player.max+'%';document.getElementById('sg-objective').textContent=bossDead?'Gate opened — keep exploring':boss?'Defeat the Gatekeeper':'Find the shrine in the east';}
 function draw(){ctx.clearRect(0,0,w,h);camX=Math.max(0,Math.min(world.w-w,player.x-w/2));camY=Math.max(0,Math.min(world.h-h,player.y-h/2));ctx.save();ctx.translate(-camX+(Math.random()-.5)*shake*6,-camY+(Math.random()-.5)*shake*6);ctx.fillStyle='#1c2b3e';ctx.fillRect(0,0,world.w,world.h);for(let y=0;y<world.h;y+=60)for(let x=0;x<world.w;x+=60){ctx.fillStyle=(x+y)%120?'#1c2b3e':'#20324a';ctx.fillRect(x,y,60,60)}ctx.fillStyle='#2e3d52';ctx.fillRect(0,360,world.w,65);ctx.fillRect(600,0,65,world.h);drawCracks();
 rivers.forEach(r=>{ctx.fillStyle='#11677d';ctx.fillRect(r.x,r.y,r.w,r.h);ctx.strokeStyle='#54d7e7';ctx.lineWidth=2;ctx.strokeRect(r.x,r.y,r.w,r.h);for(let i=0;i<5;i++){ctx.fillStyle='#8debf2';ctx.globalAlpha=.5;ctx.fillRect(r.x+(time*25+i*77)%r.w,r.y+15+i*11,26,2)}ctx.globalAlpha=1});buildings.forEach(b=>{ctx.fillStyle='#17191e';ctx.fillRect(b.x+6,b.y+8,b.w,b.h);ctx.fillStyle='#56637a';ctx.fillRect(b.x,b.y,b.w,b.h);ctx.fillStyle='#7d4f6a';ctx.beginPath();ctx.moveTo(b.x-8,b.y);ctx.lineTo(b.x+b.w/2,b.y-22);ctx.lineTo(b.x+b.w+8,b.y);ctx.fill()});cars.forEach(car=>{ctx.save();ctx.translate(car.x,car.y);ctx.rotate(car.a);ctx.fillStyle='#101318';ctx.fillRect(-26,-14,52,28);ctx.fillStyle='#5c5a53';ctx.fillRect(-21,-10,42,20);ctx.strokeStyle='#a86754';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-22,-12);ctx.lineTo(9,9);ctx.lineTo(20,-8);ctx.stroke();ctx.restore()});trees.forEach(a=>{ctx.save();ctx.translate(a.x,a.y);ctx.scale(a.s,a.s);ctx.fillStyle='#59443b';ctx.fillRect(-3,-5,6,20);if(a.dead){ctx.strokeStyle='#76504a';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(-15,-24);ctx.moveTo(0,0);ctx.lineTo(15,-17);ctx.stroke()}else{[['#244b3b',-9,-14,17],['#356448',8,-22,18],['#214636',0,-34,17]].forEach(v=>{ctx.fillStyle=v[0];ctx.beginPath();ctx.arc(v[1],v[2],v[3],0,7);ctx.fill()})}ctx.restore()});
 drawCrystals();ctx.save();ctx.translate(1730,1120);ctx.strokeStyle=bossDead?'#66ffd1':'#ff754d';ctx.lineWidth=6;ctx.strokeRect(-30,-40,60,80);ctx.fillStyle='#241629';ctx.fillRect(-18,-27,36,52);ctx.fillStyle='#fff';ctx.font='12px Arial';ctx.textAlign='center';ctx.fillText('SHRINE',0,55);ctx.restore();drops.forEach(d=>{ctx.fillStyle='#ffd36b';ctx.shadowColor='#ffd36b';ctx.shadowBlur=15;ctx.beginPath();ctx.arc(d.x,d.y+Math.sin(time*4)*3,10,0,7);ctx.fill();ctx.shadowBlur=0;ctx.font='15px Arial';ctx.textAlign='center';ctx.fillText(weapons[d.wi].icon,d.x,d.y+5)});
 drawEntities();ctx.restore();post();} /* ---- cinematic upgrade: icy atmosphere, animated bodies, combat HUD ---- */
 const fx=[],snow=Array.from({length:70},(_,i)=>({x:(i*97%1000)/1000,y:(i*61%1000)/1000,s:.5+(i%4)*.35}));let combo=0,comboT=0,comboPop=0,shake=0;
 const crystals=Array.from({length:34},(_,i)=>({x:(i*353+90)%world.w,y:(i*211+40)%world.h,h:50+(i*37)%70,w:12+(i*13)%16}));
 const cracks=Array.from({length:26},(_,i)=>{let x=(i*271+50)%world.w,y=(i*167+20)%world.h,p=[[x,y]];for(let k=0;k<5;k++){x+=((i*31+k*53)%70)-30;y+=((i*17+k*41)%50)-12;p.push([x,y])}return p});
 const bladeCol=['#e9f2ff','#9ff0ff','#ffb15e','#d9b3ff'];
 function hitFx(t,dmg,yy){fx.push({x:t.x+Math.random()*24-12,y:yy,v:Math.round(dmg*12),t:0});combo++;comboT=2.5;comboPop=1;shake=.6;t.flash=.12}
 function tick(dt){player.walk=player.walk||0;player.face=player.face||1;player.mv=!!(keys.w||keys.s||keys.a||keys.d||keys.arrowup||keys.arrowdown||keys.arrowleft||keys.arrowright||(joy.on&&Math.hypot(joy.vx,joy.vy)>.25));if(player.mv)player.walk+=dt*(inWater(player.x,player.y)?6:11);if(player.fx<-.1)player.face=-1;else if(player.fx>.1)player.face=1;player.atkT=Math.max(0,(player.atkT||0)-dt);comboT-=dt;if(comboT<=0)combo=0;comboPop=Math.max(0,comboPop-dt*4);shake=Math.max(0,shake-dt*5);
  const mv=(o)=>{const m=Math.hypot(o.x-(o.lx===undefined?o.x:o.lx),o.y-(o.ly===undefined?o.y:o.ly));o.mv=m>.05;o.lx=o.x;o.ly=o.y;if(o.mv)o.walk=(o.walk||0)+dt*8;o.flash=Math.max(0,(o.flash||0)-dt)};
  demons.forEach(d=>{if(d.alive)mv(d)});if(boss&&!boss.dead)mv(boss);for(let i=fx.length-1;i>=0;i--){fx[i].t+=dt;if(fx[i].t>1)fx.splice(i,1)}}
 function limb(c,x,y,a,l,wd,col){c.save();c.translate(x,y);c.rotate(a);c.fillStyle=col;c.fillRect(-wd/2,-1,wd,l+1);c.restore()}
 function fig(o){const c=ctx,ph=o.walk||0,mv=o.moving,sw=mv?Math.sin(ph):0,bob=mv?Math.abs(Math.cos(ph))*2.2:Math.sin(time*2+(o.seed||0))*.9,p=o.atk,wh=o.flash>0,sk=wh?'#fff':o.skin,cl=wh?'#fff':o.cloth,lg=wh?'#fff':o.legs;
  c.save();c.translate(o.x,o.y);c.scale(o.s,o.s);c.fillStyle='rgba(4,10,24,.5)';c.beginPath();c.ellipse(0,0,15,5,0,0,7);c.fill();c.scale(o.face,1);
  if(p>=0)c.translate(Math.sin(p*Math.PI)*5,0);c.translate(0,-bob);
  limb(c,0,-33,.25-sw*.7,15,5,o.demon?cl:'#1d2b45');limb(c,-3,-18,sw*.75,18,6,lg);limb(c,3,-18,-sw*.75,18,6,lg);
  c.strokeStyle=o.accent;c.lineWidth=4;c.lineCap='round';c.beginPath();c.moveTo(-5,-36);c.quadraticCurveTo(-16,-34+Math.sin(time*7+ph)*4,-24-(mv?6:0),-30+Math.sin(time*6)*6);c.stroke();
  c.fillStyle=cl;c.beginPath();c.moveTo(-8,-34);c.lineTo(8,-34);c.lineTo(6,-17);c.lineTo(-6,-17);c.fill();c.fillStyle=o.accent;c.fillRect(-6,-21,12,3);
  c.fillStyle=sk;c.beginPath();c.arc(0,-42,6.5,0,7);c.fill();
  if(o.demon){c.fillStyle='#160a1c';c.beginPath();c.moveTo(-5,-46);c.lineTo(-9,-57);c.lineTo(-1,-48);c.fill();c.beginPath();c.moveTo(5,-46);c.lineTo(9,-57);c.lineTo(1,-48);c.fill();c.fillStyle='#ff639b';c.shadowColor='#ff639b';c.shadowBlur=6;c.fillRect(0,-43,3,2.5);c.fillRect(-4,-43,3,2.5);c.shadowBlur=0;if(o.crown){c.fillStyle='#ffd36b';c.fillRect(-6,-50,12,3)}}
  else{c.fillStyle=o.hair;c.beginPath();c.moveTo(-7,-42);c.lineTo(-5,-53);c.lineTo(0,-48);c.lineTo(6,-54);c.lineTo(8,-41);c.fill();c.fillStyle='#8de8ff';c.fillRect(1,-43,3,2)}
  const ang=p>=0?2.6-4.2*(1-Math.pow(1-p,2)):.2+sw*.7;
  c.save();c.translate(2,-33);c.rotate(ang);c.fillStyle=cl;c.fillRect(-2.5,-1,5,15);c.translate(0,15);
  if(o.blade){c.fillStyle='#3a2a1e';c.fillRect(-1.5,-3,3,7);c.fillStyle=o.blade;c.shadowColor=o.blade;c.shadowBlur=10;c.fillRect(-1.5,4,3,26)}
  else{c.fillStyle='#160a1c';c.beginPath();c.moveTo(-3,0);c.lineTo(0,9);c.lineTo(3,0);c.fill()}
  c.restore();
  if(p>.12&&p<.9&&o.blade){c.strokeStyle=o.blade;c.globalAlpha=.6*(1-p);c.lineWidth=7;c.shadowColor=o.blade;c.shadowBlur=14;c.beginPath();c.arc(2,-33,40,2.6+Math.PI/2,ang+Math.PI/2,true);c.stroke()}
  c.restore()}
 function drawCracks(){ctx.strokeStyle='rgba(150,210,255,.22)';ctx.lineWidth=2;cracks.forEach(p=>{ctx.beginPath();p.forEach((v,i)=>i?ctx.lineTo(v[0],v[1]):ctx.moveTo(v[0],v[1]));ctx.stroke()})}
 function drawCrystals(){crystals.forEach(k=>{const g=ctx.createLinearGradient(0,k.y-k.h,0,k.y);g.addColorStop(0,'rgba(150,220,255,.9)');g.addColorStop(1,'rgba(30,70,130,.9)');ctx.fillStyle=g;ctx.shadowColor='#7fd0ff';ctx.shadowBlur=14;ctx.beginPath();ctx.moveTo(k.x-k.w/2,k.y);ctx.lineTo(k.x-k.w/4,k.y-k.h*.6);ctx.lineTo(k.x,k.y-k.h);ctx.lineTo(k.x+k.w/3,k.y-k.h*.55);ctx.lineTo(k.x+k.w/2,k.y);ctx.fill();ctx.shadowBlur=0})}
 /* ---- v3: choose-your-hero, demon art from the Demons of the Dimension sheet, touch joystick ---- */
 const HEROES={kai:{name:'Kai',tag:'Balanced',color:'#ff7a1f',hp:100,dmg:1,reach:58,cd:.32,armor:1,crit:0},luna:{name:'Luna',tag:'Magic, long reach',color:'#ff5fa8',hp:85,dmg:1.35,reach:76,cd:.36,armor:1,crit:0},rei:{name:'Rei',tag:'Defender',color:'#4da3ff',hp:140,dmg:.9,reach:62,cd:.36,armor:.7,crit:0},mika:{name:'Mika',tag:'Fast assassin',color:'#7bff3d',hp:90,dmg:1,reach:56,cd:.22,armor:1,crit:.25}};
 let heroId='kai';try{heroId=localStorage.getItem('sgHero')||'kai'}catch(e){}if(!HEROES[heroId])heroId='kai';let hero=HEROES[heroId];
 const shots=[],joy={on:false,id:null,vx:0,vy:0,ox:0,oy:0,x:0,y:0},coarse=!!(window.matchMedia&&matchMedia('(pointer:coarse)').matches);
 const imgs={};function spr(p){let e=imgs[p];if(!e){e=imgs[p]={i:new Image(),ok:false};e.i.onload=()=>{e.ok=true};e.i.src=p}return e.ok?e.i:null}
 function applyHero(){hero=HEROES[heroId];player.max=hero.hp+(player.level-1)*10;player.hp=player.max}
 function pickHero(id){heroId=id;hero=HEROES[id];try{localStorage.setItem('sgHero',id)}catch(e){}document.querySelectorAll('#sg-heroes button').forEach(b=>{b.style.boxShadow=b.dataset.hero===id?'0 0 14px '+HEROES[id].color:'none';b.style.opacity=b.dataset.hero===id?'1':'.6'})}
 (function(){const card=document.getElementById('sg-start-card');if(!card||!card.querySelector)return;const row=document.createElement('div');row.id='sg-heroes';row.style.cssText='display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:10px 0';
  Object.keys(HEROES).forEach(id=>{const H=HEROES[id],b=document.createElement('button');b.type='button';b.dataset.hero=id;b.style.cssText='display:flex!important;flex-direction:column;align-items:center;gap:3px;padding:6px 2px!important;margin:0!important;width:auto!important;height:auto!important;background:#14121c!important;border:2px solid '+H.color+'!important;border-radius:10px;color:#fff;font-size:10px;cursor:pointer';
   b.innerHTML='<img src="/sprites/'+id+'.png" alt="" style="height:72px;max-width:100%;object-fit:contain" onerror="this.style.display=\'none\'"><b style="color:'+H.color+';font-size:13px">'+H.name+'</b><span style="opacity:.85;line-height:1.15">'+H.tag+'</span>';b.onclick=()=>pickHero(id);row.appendChild(b)});
  const t=document.createElement('div');t.style.cssText='color:#ffb347;font-weight:bold;margin-top:8px';t.textContent='CHOOSE YOUR HERO';const f=card.querySelector('button');card.insertBefore(t,f);card.insertBefore(row,f);pickHero(heroId)})();
 if(coarse){const dp=document.getElementById('sg-dpad');if(dp)dp.style.display='none'}
 canvas.style.touchAction='none';screen.style.touchAction='none';
 const cpos=e=>{const r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top,w:r.width}};
 screen.addEventListener('pointerdown',e=>{if(!started||(e.target.closest&&e.target.closest('button')))return;const p=cpos(e);if(p.x<p.w*.6){if(!joy.on){joy.on=true;joy.id=e.pointerId;joy.ox=joy.x=p.x;joy.oy=joy.y=p.y;joy.vx=joy.vy=0}}else attack();e.preventDefault()});
 screen.addEventListener('pointermove',e=>{if(!joy.on||e.pointerId!==joy.id)return;const p=cpos(e),dx=p.x-joy.ox,dy=p.y-joy.oy,l=Math.hypot(dx,dy),m=Math.min(l,60);joy.x=joy.ox+(l?dx/l*m:0);joy.y=joy.oy+(l?dy/l*m:0);joy.vx=l>10?dx/l:0;joy.vy=l>10?dy/l:0});
 ['pointerup','pointercancel'].forEach(n=>screen.addEventListener(n,e=>{if(e.pointerId===joy.id){joy.on=false;joy.id=null;joy.vx=joy.vy=0}}));
 function drawJoy(){if(!joy.on)return;ctx.strokeStyle='rgba(255,255,255,.4)';ctx.lineWidth=3;ctx.beginPath();ctx.arc(joy.ox,joy.oy,60,0,7);ctx.stroke();ctx.fillStyle='rgba(255,255,255,.35)';ctx.beginPath();ctx.arc(joy.x,joy.y,24,0,7);ctx.fill()}
 const DT={imp:{s:'imp',hp:3,sp:.95,h:52,r:14,dmg:5,nd:0},hound:{s:'hound',hp:4,sp:1.5,h:46,r:16,dmg:6,nd:-1},darkling:{s:'darkling',hp:3,sp:.7,h:58,r:14,dmg:6,nd:0,shoot:2.2,keep:170},fiend:{s:'fiend',hp:6,sp:.85,h:76,r:18,dmg:9,nd:0},leech:{s:'leech',hp:4,sp:.6,h:70,r:15,dmg:4,nd:0,heal:3},ogre:{s:'ogre',hp:12,sp:.5,h:84,r:26,dmg:14,nd:0,slam:1},assassin:{s:'assassin',hp:5,sp:1.9,h:66,r:16,dmg:10,nd:0},wraith:{s:'wraith',hp:6,sp:.6,h:84,r:18,dmg:8,nd:0,shoot:2.6,keep:200,home:1},sentinel:{s:'sentinel',hp:18,sp:.45,h:88,r:28,dmg:12,nd:0,tank:1}};
 const BOSSES=[{n:'Gatekeeper Morvak',s:'morvak',hp:40,dmg:15,h:130,drop:3},{n:'Lady Nyxira',s:'nyxira',hp:60,dmg:16,h:135,shoot:1.6,drop:2},{n:'Azur-Oni, the Demon King',s:'azur',hp:90,dmg:22,h:150,shoot:2.4,drop:1}];let bossIdx=0;
 [[350,150,'imp'],[500,350,'hound'],[720,300,'imp'],[1040,320,'darkling'],[1230,600,'fiend'],[1450,300,'leech'],[1600,500,'assassin'],[1740,750,'ogre'],[1000,1000,'sentinel'],[450,1120,'wraith'],[1700,1150,'fiend'],[800,700,'hound'],[1300,900,'darkling'],[1500,1000,'wraith'],[300,650,'imp'],[1100,1150,'assassin']].forEach(v=>spawn(v[0],v[1],v[2]));
 function hurtP(n){player.hp-=n*hero.armor}
 function dealt(t){return player.power*weapons[equipped].damage*hero.dmg*(Math.random()<hero.crit?2:1)*(t.d&&t.d.tank?.5:1)}
 function spawnBoss(){const b=BOSSES[bossIdx];boss={x:1730,y:1120,hp:b.hp,max:b.hp,dead:false,n:b.n,b,cd:0,atk:0};toast(b.n.toUpperCase()+' HAS AWAKENED!')}
 function bossKilled(){boss.dead=true;drops.push({x:boss.x,y:boss.y,wi:boss.b.drop});if(bossIdx<BOSSES.length-1){toast(boss.n+' falls! Return to the shrine (E) for the next challenge');bossIdx++}else{bossDead=true;toast('Azur-Oni falls! The dimension gate is open!')}}
 function demonAI(dt){demons.forEach(d=>{if(!d.alive)return;const T=d.d;let x=player.x-d.x,y=player.y-d.y,dist=Math.hypot(x,y)||1;d.cd=Math.max(0,d.cd-dt);d.atk=Math.max(0,(d.atk||0)-dt);const aggro=dist<(T.shoot?420:290);
   if(aggro){let dir=1;if(T.keep){if(dist<T.keep-30)dir=-1;else if(dist<T.keep+30)dir=0}d.x+=x/dist*T.sp*dir;d.y+=y/dist*T.sp*dir}
   if(T.shoot&&aggro){d.st=(d.st===undefined?T.shoot:d.st)-dt;if(d.st<=0){d.st=T.shoot;d.atk=.35;shots.push({x:d.x,y:d.y-24,vx:x/dist*130,vy:y/dist*130,dmg:T.dmg,home:T.home,life:4})}}
   if(T.heal){d.ht=(d.ht||T.heal)-dt;if(d.ht<=0){d.ht=T.heal;demons.forEach(o=>{if(o!==d&&o.alive&&o.hp<o.max&&Math.hypot(o.x-d.x,o.y-d.y)<170){o.hp=Math.min(o.max,o.hp+1);fx.push({x:o.x,y:o.y-50,v:'+1',t:0,heal:1})}})}}
   if(!T.shoot&&dist<(T.slam?38:28)&&d.cd===0){d.cd=.9;d.atk=.35;if(player.inv===0){hurtP(T.dmg);player.inv=.55;shake=.8}}});
  if(boss&&!boss.dead){boss.atk=Math.max(0,(boss.atk||0)-dt);const b=boss.b;if(b.shoot){const x=player.x-boss.x,y=player.y-boss.y,dist=Math.hypot(x,y)||1;if(dist<600){boss.st=(boss.st===undefined?b.shoot:boss.st)-dt;if(boss.st<=0){boss.st=b.shoot;boss.atk=.4;[-.3,0,.3].forEach(a=>{const c=Math.cos(a),s=Math.sin(a);shots.push({x:boss.x,y:boss.y-60,vx:(x*c-y*s)/dist*150,vy:(x*s+y*c)/dist*150,dmg:b.dmg*.5,life:4})})}}}}
  for(let i=shots.length-1;i>=0;i--){const s=shots[i];if(s.home){const x=player.x-s.x,y=player.y-s.y,l=Math.hypot(x,y)||1;s.vx+=(x/l*110-s.vx)*dt*1.6;s.vy+=(y/l*110-s.vy)*dt*1.6}s.x+=s.vx*dt;s.y+=s.vy*dt;s.life-=dt;if(Math.hypot(s.x-player.x,s.y-(player.y-18))<16){if(player.inv===0){hurtP(s.dmg);player.inv=.5;shake=.6}s.life=0}if(s.life<=0)shots.splice(i,1)}}
 function drawSprite(im,x,y,h,o){const c=ctx,w=im.width/im.height*h,mv=o.moving,ph=o.walk||0,a=o.atk,s=a>=0?Math.sin(a*Math.PI):0;c.save();c.translate(x,y);c.fillStyle='rgba(4,10,24,.5)';c.beginPath();c.ellipse(0,0,Math.min(w*.3,44),7,0,0,7);c.fill();
  c.translate(s*h*.22*o.face,mv?-Math.abs(Math.sin(ph))*h*.07:Math.sin(time*2+(o.seed||0))*h*.012);c.rotate((mv?Math.sin(ph)*.07:0)+s*.22*o.face);c.scale(o.flip,1+s*.08+(mv?Math.abs(Math.sin(ph))*.04:0));if(o.flash>0)c.filter='brightness(4)';c.drawImage(im,-w/2,-h,w,h);c.restore()}
 function slash(x,y,face,p,col,reach){if(p<.08||p>.92)return;const c=ctx;c.save();c.translate(x,y);c.scale(face,1);c.strokeStyle=col;c.shadowColor=col;c.shadowBlur=16;c.globalAlpha=.8*(1-p);c.lineWidth=9;c.lineCap='round';c.beginPath();c.arc(-6,0,reach*.8,-1.25,-1.25+2.5*p);c.stroke();c.lineWidth=4;c.globalAlpha*=.8;c.beginPath();c.arc(-6,0,reach*.62,-1.1,-1.1+2.2*p);c.stroke();c.restore()}
 function drawEntities(){const list=[];
  demons.forEach(d=>{if(!d.alive)return;list.push({y:d.y,f:()=>{const T=d.d,im=spr('/sprites/demons/'+T.s+'.png'),face=player.x>=d.x?1:-1,p=d.atk>0?1-d.atk/.35:-1;
    if(im)drawSprite(im,d.x,d.y+10,T.h,{moving:d.mv,walk:d.walk,atk:p,face,flip:T.nd?face*T.nd:1,flash:d.flash,seed:d.phase});else fig({x:d.x,y:d.y+8,s:1,face,walk:d.walk,moving:d.mv,atk:p,skin:'#6a2a78',cloth:'#2b1236',legs:'#1b0c24',accent:'#ff639b',demon:1,flash:d.flash,seed:d.phase});
    if(T.slam&&p>=0){ctx.strokeStyle='rgba(255,140,60,'+(1-p)+')';ctx.lineWidth=5;ctx.beginPath();ctx.ellipse(d.x,d.y+10,20+p*70,8+p*26,0,0,7);ctx.stroke()}
    if(d.hp<d.max){ctx.fillStyle='#111';ctx.fillRect(d.x-16,d.y+10-T.h-8,32,4);ctx.fillStyle='#ff4d8d';ctx.fillRect(d.x-16,d.y+10-T.h-8,32*d.hp/d.max,4)}}})});
  if(boss&&!boss.dead)list.push({y:boss.y,f:()=>{const im=spr('/sprites/demons/'+boss.b.s+'.png'),face=player.x>=boss.x?1:-1,p=boss.atk>0?1-boss.atk/.4:-1;if(im)drawSprite(im,boss.x,boss.y+16,boss.b.h,{moving:boss.mv,walk:boss.walk,atk:p,face,flip:1,flash:boss.flash,seed:3});else fig({x:boss.x,y:boss.y+14,s:2.1,face,walk:boss.walk,moving:boss.mv,atk:p,skin:'#7c285c',cloth:'#2a0f2a',legs:'#1b0c24',accent:'#ffb347',demon:1,crown:1,flash:boss.flash,seed:3})}});
  list.push({y:player.y,f:()=>{ctx.save();if(player.inv>0&&Math.floor(time*18)%2===0)ctx.globalAlpha=.4;const p=player.atkT>0?1-player.atkT/.32:-1,face=player.face||1,im=spr('/sprites/'+heroId+'.png');
    if(im)drawSprite(im,player.x,player.y+12,84,{moving:player.mv,walk:player.walk,atk:p,face,flip:face,flash:0,seed:1});else fig({x:player.x,y:player.y+12,s:1,face,walk:player.walk,moving:player.mv,atk:p,skin:'#f4d2b6',cloth:'#263b5b',legs:'#1b2238',accent:'#ff4d91',hair:'#171622',blade:hero.color});
    if(p>=0)slash(player.x+face*8,player.y-26,face,p,hero.color,hero.reach);ctx.restore()}});
  list.sort((a,b)=>a.y-b.y).forEach(e=>e.f());
  shots.forEach(s=>{ctx.fillStyle=s.home?'#b46bff':'#ff4d6d';ctx.shadowColor=ctx.fillStyle;ctx.shadowBlur=14;ctx.beginPath();ctx.arc(s.x,s.y,7,0,7);ctx.fill();ctx.shadowBlur=0});
  ctx.textAlign='center';fx.forEach(n=>{ctx.globalAlpha=1-n.t*n.t;ctx.font='italic 900 '+(20+(typeof n.v==='number'?Math.min(12,n.v/40):0))+'px Arial';ctx.lineWidth=4;ctx.strokeStyle=n.heal?'#003b1a':'#4a1d00';ctx.strokeText(n.v,n.x,n.y-n.t*45);ctx.fillStyle=n.heal?'#6dff9c':'#ffb347';ctx.fillText(n.v,n.x,n.y-n.t*45)});ctx.globalAlpha=1}
 function post(){ctx.fillStyle='rgba(225,242,255,.6)';snow.forEach(s=>{ctx.fillRect((s.x*w+time*9*s.s)%w,(s.y*h+time*32*s.s)%h,2*s.s,2*s.s)});
  let g=ctx.createLinearGradient(0,0,0,h);g.addColorStop(0,'rgba(120,170,230,.3)');g.addColorStop(.45,'rgba(80,130,200,.06)');g.addColorStop(1,'rgba(10,20,50,.25)');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
  g=ctx.createRadialGradient(w/2,h/2,Math.min(w,h)*.35,w/2,h/2,Math.max(w,h)*.75);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(0,5,20,.65)');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
  ctx.textAlign='center';
  if(boss&&!boss.dead){const bw=Math.min(520,w*.55),bx=(w-bw)/2,pc=Math.max(0,boss.hp/boss.max);ctx.font='bold 14px Arial';ctx.fillStyle='#ff6f5e';ctx.fillText('LV. '+(player.level+2)+' '+(boss.n||'Gatekeeper'),w/2,18);ctx.fillStyle='rgba(0,0,0,.6)';ctx.fillRect(bx,24,bw,14);const bg=ctx.createLinearGradient(bx,0,bx+bw,0);bg.addColorStop(0,'#ff7a45');bg.addColorStop(1,'#e8283c');ctx.fillStyle=bg;ctx.fillRect(bx,24,bw*pc,14);ctx.strokeStyle='#d8c6a0';ctx.lineWidth=1;ctx.strokeRect(bx,24,bw,14);ctx.font='bold 11px Arial';ctx.fillStyle='#fff';ctx.fillText((pc*100).toFixed(2)+'%',w/2,35)}
  if(combo>1){ctx.save();ctx.translate(14,h*.4);ctx.fillStyle='rgba(190,20,30,.9)';ctx.beginPath();ctx.moveTo(0,10);ctx.lineTo(150,-4);ctx.lineTo(172,6);ctx.lineTo(10,24);ctx.fill();const s=1+comboPop*.35;ctx.scale(s,s);ctx.textAlign='left';ctx.font='italic 900 38px Arial';ctx.lineWidth=5;ctx.strokeStyle='#300';ctx.strokeText(combo,6,12);ctx.fillStyle='#fff';ctx.fillText(combo,6,12);const nw=ctx.measureText(combo).width;ctx.font='italic 900 22px Arial';ctx.strokeText('HITS',nw+14,12);ctx.fillText('HITS',nw+14,12);ctx.restore()}
  const bw=Math.min(300,w*.4),bx=(w-bw)/2,by=h-64,need=player.level*4;ctx.textAlign='left';ctx.font='bold 12px Arial';ctx.fillStyle='#fff';ctx.fillText('LV. '+player.level,bx,by-6);ctx.textAlign='right';ctx.fillText(Math.ceil(player.hp)+'/'+player.max,bx+bw,by-6);
  ctx.fillStyle='rgba(0,0,0,.55)';ctx.fillRect(bx,by,bw,9);ctx.fillRect(bx,by+12,bw,7);ctx.fillStyle='#6ddc4a';ctx.fillRect(bx,by,bw*Math.max(0,player.hp/player.max),9);ctx.fillStyle='#3aa6ff';ctx.fillRect(bx,by+12,bw*Math.min(1,player.xp/need),7);ctx.strokeStyle='rgba(255,255,255,.35)';ctx.strokeRect(bx,by,bw,9);ctx.strokeRect(bx,by+12,bw,7);ctx.textAlign='left';drawJoy()}
 function loop(ts){raf=0;if(!active)return;const dt=Math.min((ts-last)/1000||0,.04);last=ts;if(started)update(dt);draw();raf=requestAnimationFrame(loop)}
})();


