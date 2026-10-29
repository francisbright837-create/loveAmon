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
 const demons=[];function spawn(x,y,brute=false){demons.push({x,y,hp:brute?8:3,max:brute?8:3,r:brute?20:12,brute,alive:true,cd:0,phase:Math.random()*6})}
 [[350,150],[500,350],[720,300],[1040,320],[1230,600],[1450,300],[1600,500],[1740,750],[1000,1000],[450,1120],[1700,1150],[800,700]].forEach((v,i)=>spawn(v[0],v[1],i%4===0));
 function resize(){const d=Math.min(devicePixelRatio||1,2);w=screen.clientWidth;h=screen.clientHeight;canvas.width=w*d;canvas.height=h*d;ctx.setTransform(d,0,0,d,0,0)}
 function inWater(x,y){return rivers.some(r=>x>r.x&&x<r.x+r.w&&y>r.y&&y<r.y+r.h)}
 function toast(s){document.getElementById('sg-objective').textContent=s}
 window.openShadowGame=function(){if(typeof window.showTab==='function'){try{document.querySelectorAll('#app > div').forEach(el=>{if(el.id!=='shadow-game-screen'&&el.id!=='bottom-nav')el.style.display='none'})}catch(e){}}screen.style.display='block';document.getElementById('bottom-nav').style.display='none';resize();active=true;if(!raf){last=0;raf=requestAnimationFrame(loop)}};
 window.closeShadowGame=function(){active=false;screen.style.display='none';document.getElementById('bottom-nav').style.display='flex';if(typeof window.showTab==='function'){try{window.showTab('videos')}catch(e){}}};
 window.startShadowGame=function(){started=true;document.getElementById('sg-start').style.display='none';toast('Explore the ruins and find the shrine in the east')};
 function attack(){if(!active||!started||player.cd>0)return;player.cd=.32;let hit=false;for(const d of demons){if(!d.alive)continue;let dx=d.x-player.x,dy=d.y-player.y,dist=Math.hypot(dx,dy)||1;if(dist<58&&(dx*player.fx+dy*player.fy)/dist>-.45){d.hp-=player.power*weapons[equipped].damage;hit=true;if(d.hp<=0){d.alive=false;player.kills++;player.xp++;if(Math.random()<.55){let wi=Math.random()<.72?1:2;drops.push({x:d.x,y:d.y,wi})}if(player.xp>=player.level*4){player.xp=0;player.level++;player.power++;player.max+=10;player.hp=Math.min(player.max,player.hp+25);toast('LEVEL UP! Ren is now level '+player.level)}else toast('Demon defeated · essence absorbed')}break}}
 if(boss&&!boss.dead){let dist=Math.hypot(boss.x-player.x,boss.y-player.y);if(dist<75){boss.hp-=player.power*weapons[equipped].damage*1.3;hit=true;if(boss.hp<=0){boss.dead=true;bossDead=true;weapons[3].owned=true;drops.push({x:boss.x,y:boss.y,wi:3});toast('Gatekeeper defeated! Moon Edge unlocked')}}}if(!hit)toast('Strike toward a nearby demon');}
 function interact(){let i=drops.findIndex(d=>Math.hypot(d.x-player.x,d.y-player.y)<55);if(i>=0){let d=drops.splice(i,1)[0];weapons[d.wi].owned=true;equipped=d.wi;document.getElementById('sg-weapon').textContent=weapons[equipped].icon+' '+weapons[equipped].name;toast('Collected '+weapons[equipped].name);return}if(Math.hypot(1730-player.x,1120-player.y)<100){if(bossDead){toast('The gate is open — more dimensions await!')}else if(!boss){boss={x:1730,y:1120,hp:40,max:40,dead:false};toast('THE GATEKEEPER HAS AWAKENED!')}else toast('Defeat the Gatekeeper!')}else toast('Find glowing weapon drops or travel east to the shrine')}
 function keydown(e){let k=e.key.toLowerCase();if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(k))e.preventDefault();keys[k]=true;if(k===' ')attack();if(k==='e')interact();if('1234'.includes(k)&&weapons[+k-1].owned){equipped=+k-1;document.getElementById('sg-weapon').textContent=weapons[equipped].icon+' '+weapons[equipped].name}}
 function keyup(e){keys[e.key.toLowerCase()]=false}window.addEventListener('keydown',keydown);window.addEventListener('keyup',keyup);
 document.querySelectorAll('#sg-dpad button').forEach(b=>{let k={up:'w',down:'s',left:'a',right:'d'}[b.dataset.move];const on=e=>{e.preventDefault();keys[k]=true},off=e=>{e.preventDefault();keys[k]=false};b.addEventListener('pointerdown',on);['pointerup','pointercancel','pointerleave'].forEach(n=>b.addEventListener(n,off))});document.getElementById('sg-attack').addEventListener('click',attack);document.getElementById('sg-pickup').addEventListener('click',interact);window.addEventListener('resize',resize);
 function update(dt){time+=dt;player.cd=Math.max(0,player.cd-dt);player.inv=Math.max(0,player.inv-dt);let dx=0,dy=0;if(keys.w||keys.arrowup)dy--;if(keys.s||keys.arrowdown)dy++;if(keys.a||keys.arrowleft)dx--;if(keys.d||keys.arrowright)dx++;let l=Math.hypot(dx,dy)||1;dx/=l;dy/=l;if(dx||dy){player.fx=dx;player.fy=dy}let sp=inWater(player.x,player.y)?1.25:2.4,nx=Math.max(15,Math.min(world.w-15,player.x+dx*sp)),ny=Math.max(15,Math.min(world.h-15,player.y+dy*sp));if(!buildings.some(b=>nx>b.x-12&&nx<b.x+b.w+12&&ny>b.y-12&&ny<b.y+b.h+12)){player.x=nx;player.y=ny}
 demons.forEach(d=>{if(!d.alive)return;let x=player.x-d.x,y=player.y-d.y,dist=Math.hypot(x,y)||1;if(dist<270){d.x+=x/dist*(d.brute?.55:.8);d.y+=y/dist*(d.brute?.55:.8)}d.cd=Math.max(0,d.cd-dt);if(dist<26&&d.cd===0){d.cd=.9;if(player.inv===0){player.hp-=d.brute?12:5;player.inv=.55}}});if(boss&&!boss.dead){let x=player.x-boss.x,y=player.y-boss.y,dist=Math.hypot(x,y)||1;if(dist>75){boss.x+=x/dist*.45;boss.y+=y/dist*.45}boss.cd=(boss.cd||0)-dt;if(dist<48&&boss.cd<=0){boss.cd=1.2;if(!player.inv){player.hp-=15;player.inv=.6}}}if(player.hp<=0){player.hp=player.max;player.x=110;player.y=120;toast('Ren recovered at the shrine')}
 document.getElementById('sg-stats').textContent=`Level ${player.level} · Power ${player.power} · Demons ${player.kills}`;document.getElementById('sg-health').style.width=100*player.hp/player.max+'%';document.getElementById('sg-objective').textContent=bossDead?'Gate opened — keep exploring':boss?'Defeat the Gatekeeper':'Find the shrine in the east';}
 function draw(){ctx.clearRect(0,0,w,h);camX=Math.max(0,Math.min(world.w-w,player.x-w/2));camY=Math.max(0,Math.min(world.h-h,player.y-h/2));ctx.save();ctx.translate(-camX,-camY);ctx.fillStyle='#292e35';ctx.fillRect(0,0,world.w,world.h);for(let y=0;y<world.h;y+=60)for(let x=0;x<world.w;x+=60){ctx.fillStyle=(x+y)%120?'#292e35':'#30343a';ctx.fillRect(x,y,60,60)}ctx.fillStyle='#484047';ctx.fillRect(0,360,world.w,65);ctx.fillRect(600,0,65,world.h);
 rivers.forEach(r=>{ctx.fillStyle='#11677d';ctx.fillRect(r.x,r.y,r.w,r.h);ctx.strokeStyle='#54d7e7';ctx.lineWidth=2;ctx.strokeRect(r.x,r.y,r.w,r.h);for(let i=0;i<5;i++){ctx.fillStyle='#8debf2';ctx.globalAlpha=.5;ctx.fillRect(r.x+(time*25+i*77)%r.w,r.y+15+i*11,26,2)}ctx.globalAlpha=1});buildings.forEach(b=>{ctx.fillStyle='#17191e';ctx.fillRect(b.x+6,b.y+8,b.w,b.h);ctx.fillStyle='#625b64';ctx.fillRect(b.x,b.y,b.w,b.h);ctx.fillStyle='#874b45';ctx.beginPath();ctx.moveTo(b.x-8,b.y);ctx.lineTo(b.x+b.w/2,b.y-22);ctx.lineTo(b.x+b.w+8,b.y);ctx.fill()});cars.forEach(car=>{ctx.save();ctx.translate(car.x,car.y);ctx.rotate(car.a);ctx.fillStyle='#101318';ctx.fillRect(-26,-14,52,28);ctx.fillStyle='#5c5a53';ctx.fillRect(-21,-10,42,20);ctx.strokeStyle='#a86754';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-22,-12);ctx.lineTo(9,9);ctx.lineTo(20,-8);ctx.stroke();ctx.restore()});trees.forEach(a=>{ctx.save();ctx.translate(a.x,a.y);ctx.scale(a.s,a.s);ctx.fillStyle='#59443b';ctx.fillRect(-3,-5,6,20);if(a.dead){ctx.strokeStyle='#76504a';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(-15,-24);ctx.moveTo(0,0);ctx.lineTo(15,-17);ctx.stroke()}else{[['#244b3b',-9,-14,17],['#356448',8,-22,18],['#214636',0,-34,17]].forEach(v=>{ctx.fillStyle=v[0];ctx.beginPath();ctx.arc(v[1],v[2],v[3],0,7);ctx.fill()})}ctx.restore()});
 ctx.save();ctx.translate(1730,1120);ctx.strokeStyle=bossDead?'#66ffd1':'#ff754d';ctx.lineWidth=6;ctx.strokeRect(-30,-40,60,80);ctx.fillStyle='#241629';ctx.fillRect(-18,-27,36,52);ctx.fillStyle='#fff';ctx.font='12px Arial';ctx.textAlign='center';ctx.fillText('SHRINE',0,55);ctx.restore();drops.forEach(d=>{ctx.fillStyle='#ffd36b';ctx.shadowColor='#ffd36b';ctx.shadowBlur=15;ctx.beginPath();ctx.arc(d.x,d.y+Math.sin(time*4)*3,10,0,7);ctx.fill();ctx.shadowBlur=0;ctx.font='15px Arial';ctx.textAlign='center';ctx.fillText(weapons[d.wi].icon,d.x,d.y+5)});
 demons.forEach(d=>{if(!d.alive)return;ctx.save();ctx.translate(d.x,d.y+Math.sin(time*4+d.phase)*2);ctx.fillStyle=d.brute?'#69286c':'#482052';ctx.shadowColor='#c47aff';ctx.shadowBlur=13;ctx.beginPath();ctx.ellipse(0,0,d.r,d.r*1.2,0,0,7);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='#29132f';ctx.beginPath();ctx.moveTo(-8,-7);ctx.lineTo(-d.r,-d.r-8);ctx.lineTo(-2,-d.r/2);ctx.fill();ctx.beginPath();ctx.moveTo(8,-7);ctx.lineTo(d.r,-d.r-8);ctx.lineTo(2,-d.r/2);ctx.fill();ctx.fillStyle='#ff639b';ctx.fillRect(-7,-3,4,3);ctx.fillRect(3,-3,4,3);ctx.restore();if(d.hp<d.max){ctx.fillStyle='#111';ctx.fillRect(d.x-13,d.y-d.r-10,26,3);ctx.fillStyle='#ff4d8d';ctx.fillRect(d.x-13,d.y-d.r-10,26*d.hp/d.max,3)}});
 if(boss&&!boss.dead){ctx.fillStyle='#7c285c';ctx.shadowColor='#ff4d8d';ctx.shadowBlur=20;ctx.beginPath();ctx.arc(boss.x,boss.y,31,0,7);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='#fff';ctx.fillText('GATEKEEPER',boss.x,boss.y-42);ctx.fillStyle='#3b1730';ctx.fillRect(boss.x-28,boss.y-36,56,5);ctx.fillStyle='#ff4d8d';ctx.fillRect(boss.x-28,boss.y-36,56*Math.max(0,boss.hp/boss.max),5)}
 ctx.save();ctx.translate(player.x,player.y);if(player.inv>0&&Math.floor(time*18)%2===0)ctx.globalAlpha=.4;ctx.fillStyle='#171421';ctx.beginPath();ctx.ellipse(0,10,13,6,0,0,7);ctx.fill();ctx.fillStyle='#263b5b';ctx.fillRect(-10,-8,20,24);ctx.fillStyle='#f4d2b6';ctx.beginPath();ctx.arc(0,-14,8,0,7);ctx.fill();ctx.fillStyle='#171622';ctx.beginPath();ctx.moveTo(-9,-14);ctx.lineTo(-5,-25);ctx.lineTo(2,-21);ctx.lineTo(10,-25);ctx.lineTo(8,-10);ctx.fill();ctx.fillStyle='#8de8ff';ctx.fillRect(-5,-15,4,2);ctx.fillRect(3,-15,4,2);ctx.strokeStyle='#ff4d91';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(-6,-3);ctx.lineTo(-13,12);ctx.stroke();ctx.save();ctx.rotate(Math.atan2(player.fy,player.fx));ctx.strokeStyle='#f0edff';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(7,0);ctx.lineTo(27,0);ctx.stroke();ctx.restore();ctx.restore();ctx.restore();}
 function loop(ts){raf=0;if(!active)return;const dt=Math.min((ts-last)/1000||0,.04);last=ts;if(started)update(dt);draw();raf=requestAnimationFrame(loop)}
})();
