/* World menus and wiring (loads after script.js and world3d.js):
   - 👕 Style: choose boy/girl, hair, clothes, hat and a pet (with a live 3D preview)
   - 🛍️ Mall shops: buy clothes and pets with coins
   - Enter / Exit buttons for buildings, Sit buttons, cinema tickets
   - Cars: one driver, invited passengers
   It talks to sockets/world.js on the server. Nothing here changes how walking/chat/emotes work. */
(function () {
  if (!window.W3 || typeof window.openWorld !== 'function') return;
  const W3 = window.W3, T = window.THREE;
  const P = { appearance: null, coins: 0, owned: new Set(), ticketUntil: 0, ticketPrice: 8, loaded: false };
  let uiBuilt = false, lastTick = 0, promptKey = '', carKey = '';
  const $ = id => document.getElementById(id);
  const toast = (t, type) => { if (typeof showMessage === 'function') showMessage(t, type || 'success'); };
  const meUser = () => worldUsers[currentUser.id];
  const hex = n => '#' + (n >>> 0).toString(16).padStart(6, '0');
  const el = (tag, css, text, onclick) => { const e = document.createElement(tag); if (css) e.className = css; if (text !== undefined) e.textContent = text; if (onclick) e.onclick = onclick; return e; };

  /* ---------------- which car am I in? ---------------- */
  function myCar() {
    const id = currentUser && currentUser.id;
    for (let i = 0; i < WORLD_PARKED_CARS.length; i++) { const c = WORLD_PARKED_CARS[i], s = (c.riders || []).indexOf(id); if (s >= 0) return { car: c, seat: s, idx: i }; }
    return null;
  }
  function onCarsChanged() {
    const mc = myCar(), me = meUser();
    worldVehicle = mc ? mc.car.e : null;
    if (mc) worldTarget = null;
    Object.values(worldUsers).forEach(u => {
      let e = null, cid = null;
      WORLD_PARKED_CARS.forEach((c, i) => { if ((c.riders || []).includes(u.userId)) { e = c.e; cid = i; } });
      u.vehicle = e; u.carId = cid;
    });
    const ex = $('world-exit-car'); if (ex) ex.style.display = mc ? 'inline-block' : 'none';
    carKey = ''; renderCarPanel();
  }

  /* ---------------- socket events ---------------- */
  function hook() {
    const s = worldSocket; if (!s || s._wui) return; s._wui = true;
    s.on('world:profile', d => {
      W3.setCatalog(d.catalog);
      P.appearance = d.appearance; P.coins = d.coins; P.owned = new Set(d.owned || []); P.ticketUntil = d.ticketUntil || 0; P.ticketPrice = d.ticketPrice || 8; P.loaded = true;
      const me = meUser(); if (me) me.appearance = d.appearance;
      updateCoins(); if (d.isNew) openStyle({ first: true });
    });
    s.on('world:cars', list => { WORLD_PARKED_CARS.length = 0; list.forEach(c => WORLD_PARKED_CARS.push(c)); onCarsChanged(); });
    s.on('world:carMoved', ({ id, x, y }) => {
      const c = WORLD_PARKED_CARS[id]; if (!c) return; c.x = x; c.y = y;
      (c.riders || []).forEach((uid, seat) => { const u = worldUsers[uid]; if (!u || (uid === currentUser.id && seat === 0)) return; u.x = x; u.y = y; });
    });
    s.on('world:appearance', ({ userId, appearance }) => { const u = worldUsers[userId]; if (u) u.appearance = appearance; if (userId === currentUser.id) P.appearance = appearance; });
    s.on('world:coins', ({ coins }) => { P.coins = coins; updateCoins(); });
    s.on('world:bought', ({ itemId, coins, owned }) => { P.coins = coins; P.owned = new Set(owned); updateCoins(); const it = W3.items[itemId]; toast('🛍️ You bought ' + (it ? it.name : 'it') + '!'); if (styleOpen) renderStyle(); });
    s.on('world:ticket', ({ until, coins }) => { P.ticketUntil = until; P.coins = coins; updateCoins(); toast('🎟️ Ticket bought! Pick any seat. Enjoy the show 🍿'); promptKey = ''; });
    s.on('world:notice', ({ text }) => toast(text));
    s.on('world:carInvited', ({ carId, fromName, e }) => showInvite(fromName, e));
    s.on('world:state', () => { onCarsChanged(); });
  }

  /* ---------------- wrap script.js functions ---------------- */
  const _open = window.openWorld;
  window.openWorld = function () { _open.apply(this, arguments); hook(); buildUI(); };
  const _leave = window.leaveWorld;
  window.leaveWorld = function () { closeStyle(true); hideInvite(); hidePrompt(); const cp = $('wui-car'); if (cp) cp.style.display = 'none'; promptKey = ''; _leave.apply(this, arguments); };

  window.enterWorldCar = function (car) {
    const me = meUser(); if (!me || !worldSocket) return;
    if (worldRoom !== 'town') return;
    if (Math.hypot(me.x - car.x, me.y - car.y) > 170) return toast('🚗 Walk closer to the car first', 'error');
    worldTarget = null; worldSocket.emit('world:carEnter', { carId: WORLD_PARKED_CARS.indexOf(car) });
  };
  window.exitWorldCar = function () { if (worldSocket) worldSocket.emit('world:carExit'); };

  const _move = window.updateWorldMovement;
  window.updateWorldMovement = function (now) {
    const mc = myCar();
    if (mc && mc.seat > 0) { worldTarget = null; return; }        // passengers ride along, only the driver steers
    return _move.apply(this, arguments);
  };

  const _goTo = window.goToPlace;
  window.goToPlace = function (key) {
    const me = meUser(), p = WORLD_PLACES[key];
    if (!me || !p || !worldSocket) return;
    if (myCar()) return toast('🚗 Get out of the car first', 'error');
    if (worldRoom !== 'town') {                                   // leave the building first
      worldTarget = null; worldCamSnap = true;
      worldSocket.emit('world:switchRoom', { room: 'town', x: p.x + Math.random() * 60 - 30, y: p.y + Math.random() * 30 - 15 });
      return;
    }
    return _goTo.apply(this, arguments);
  };

  /* ---------------- UI shell: buttons, prompt, panels ---------------- */
  function buildUI() {
    if (uiBuilt) return; uiBuilt = true;
    const css = document.createElement('style'); css.textContent = `
      .wui-btn{width:auto;max-width:none;margin:0;padding:8px 14px;border:0;border-radius:12px;font-size:14px;cursor:pointer;background:#ff4d8d;color:#fff}
      .wui-btn.alt{background:rgba(255,255,255,.18)} .wui-btn.green{background:#1fbf5b} .wui-btn.sm{padding:5px 10px;font-size:12px}
      #wui-prompt{display:none;position:absolute;bottom:150px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,#143b6b,#1f6fa2);color:#fff;padding:10px 16px;border-radius:16px;box-shadow:0 4px 16px rgba(0,0,0,.45);white-space:nowrap;z-index:4;font-size:14px;align-items:center;gap:10px}
      #wui-car{display:none;position:absolute;left:10px;bottom:150px;z-index:4;background:rgba(0,0,0,.62);color:#fff;border-radius:14px;padding:10px 12px;max-width:min(78vw,300px);font-size:13px;text-align:left}
      #wui-car .row{display:flex;align-items:center;gap:6px;margin-top:6px;justify-content:space-between}
      #wui-invite{display:none;position:absolute;top:120px;left:50%;transform:translateX(-50%);z-index:6;background:#fff;color:#222;border-radius:16px;padding:12px 16px;box-shadow:0 6px 24px rgba(0,0,0,.4);text-align:center;max-width:90vw}
      #wui-coins{background:rgba(255,255,255,.92);color:#333;border-radius:10px;padding:7px 11px;font-size:14px;font-weight:600}
      #wui-style{display:none;position:fixed;inset:0;z-index:9800;background:rgba(14,12,26,.96);color:#fff;flex-direction:column;text-align:left}
      #wui-style .hd{display:flex;align-items:center;gap:10px;padding:12px 14px;background:rgba(255,255,255,.08)}
      #wui-style .hd b{flex:1;font-size:17px}
      #wui-style .bd{flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden}
      #wui-prev-wrap{display:flex;justify-content:center;padding:6px 0 0;background:radial-gradient(circle at 50% 40%,#3b2f6b,#14112a)}
      #wui-prev{width:min(60vw,220px);height:min(34vh,250px)}
      #wui-tabs{display:flex;gap:6px;padding:8px 10px;overflow-x:auto;scrollbar-width:none}
      #wui-grid{flex:1;overflow-y:auto;padding:6px 10px 10px;display:grid;grid-template-columns:repeat(auto-fill,minmax(104px,1fr));gap:8px;align-content:start}
      .wui-card{position:relative;border:2px solid rgba(255,255,255,.18);border-radius:14px;padding:8px 6px;text-align:center;background:rgba(255,255,255,.06);cursor:pointer;font-size:12px;color:#fff}
      .wui-card.sel{border-color:#ff4d8d;background:rgba(255,77,141,.22)} .wui-card.lock{opacity:.75}
      .wui-card .sw{height:34px;border-radius:10px;margin:0 auto 5px;width:60%;display:flex;align-items:center;justify-content:center;font-size:22px}
      .wui-card .pr{display:block;margin-top:3px;color:#ffd54f;font-weight:600}
      #wui-style .ft{display:flex;gap:8px;padding:10px 14px calc(10px + env(safe-area-inset-bottom,0px));background:rgba(255,255,255,.08)}
      #wui-style .lbl{grid-column:1/-1;font-size:12px;opacity:.75;margin-top:6px}`;
    document.head.appendChild(css);

    const bar = $('world-topbar'), mapBtn = bar && Array.from(bar.children).find(b => /openMapFromWorld/.test(b.getAttribute('onclick') || ''));
    const mk = (txt, fn) => { const b = el('button', 'world-btn', txt, fn); bar.insertBefore(b, mapBtn || $('world-exit-car')); return b; };
    mk('🛍️ Mall', () => goToPlace('mall')); mk('🎬 Cinema', () => goToPlace('cinema'));
    mk('👕 Style', () => openStyle({}));
    const coins = el('span', '', '🪙 …'); coins.id = 'wui-coins'; bar.insertBefore(coins, mapBtn || $('world-exit-car'));

    const stage = $('world-stage');
    const pr = el('div'); pr.id = 'wui-prompt'; stage.appendChild(pr);
    const cp = el('div'); cp.id = 'wui-car'; stage.appendChild(cp);
    const inv = el('div'); inv.id = 'wui-invite'; stage.appendChild(inv);

    const st = el('div'); st.id = 'wui-style';
    st.innerHTML = '<div class="hd"><b id="wui-title">👕 Style</b><span id="wui-coins2" class="wui-btn alt sm" style="pointer-events:none"></span><button class="wui-btn alt sm" id="wui-x">✕</button></div>' +
      '<div class="bd"><div id="wui-prev-wrap"><canvas id="wui-prev"></canvas></div><div id="wui-tabs"></div><div id="wui-grid"></div></div>' +
      '<div class="ft"><button class="wui-btn alt" id="wui-cancel" style="flex:1">Cancel</button><button class="wui-btn green" id="wui-save" style="flex:2">Save</button></div>';
    document.body.appendChild(st);
    $('wui-x').onclick = $('wui-cancel').onclick = () => closeStyle();
    $('wui-save').onclick = saveStyle;
    updateCoins();
    W3.onFrame = tick;
  }
  const updateCoins = () => { ['wui-coins', 'wui-coins2'].forEach(id => { const e = $(id); if (e) e.textContent = '🪙 ' + P.coins; }); };

  /* ---------------- prompts: doors, seats, shops, tickets ---------------- */
  function hidePrompt() { const p = $('wui-prompt'); if (p) p.style.display = 'none'; }
  function showPrompt(key, label, btn, fn) {
    const p = $('wui-prompt'); if (!p) return;
    if (promptKey === key) return; promptKey = key;
    p.textContent = ''; const l = el('span', '', label); p.append(l);
    if (btn) { const b = el('button', 'wui-btn sm', btn, fn); p.append(b); }
    p.style.display = 'flex';
  }
  function sitAt(s) {
    const me = meUser(); if (!me || !worldSocket) return;
    if (worldRoom === 'cinema' && P.ticketUntil < Date.now()) return toast('🎟️ Buy a ticket at the counter first (' + P.ticketPrice + ' 🪙)', 'error');
    worldTarget = null; me.x = s.x; me.y = s.y; worldSocket.emit('world:move', { x: s.x, y: s.y }); promptKey = '';
  }
  function tick(now) {
    if (now - lastTick < 120) return; lastTick = now;
    renderCarPanel();
    const me = meUser(); if (!me || styleOpen || !W3.ready()) return hidePrompt();
    if (myCar()) { promptKey = ''; return hidePrompt(); }
    let best = null, bd = 1e9;
    const consider = (o, x, y, r) => { const d = Math.hypot(me.x - x, me.y - y); if (d < r && d < bd) { best = o; bd = d; } };
    const seated = W3.seatAt(worldRoom, me.x, me.y);
    if (worldRoom === 'town') {
      W3.doors.forEach(d => consider({ k: 'door' + d.room, label: d.sign + ' ' + d.label, btn: 'Enter', fn: () => { worldTarget = null; worldSocket.emit('world:switchRoom', { room: d.room }); } }, d.x, d.y, d.r));
      W3.seats.town.forEach((s, i) => { if (!seated) consider({ k: 'ts' + i, label: '🪑 Seat', btn: 'Sit', fn: () => sitAt(s) }, s.x, s.y, 45); });
    } else {
      const rd = W3.getRoom(worldRoom);
      rd.zones.forEach(z => {
        if (z.kind === 'exit') consider({ k: 'exit', label: '🚪 Leave ' + rd.label.replace(/^\S+\s/, ''), btn: 'Exit', fn: () => { worldTarget = null; worldSocket.emit('world:switchRoom', { room: 'town' }); } }, z.x, z.y, z.r);
        else if (z.kind === 'shop') consider({ k: 'shop' + z.id, label: z.label, btn: 'Browse', fn: () => openStyle({ shop: z }) }, z.x, z.y, z.r);
        else if (z.kind === 'ticket') {
          const has = P.ticketUntil > Date.now();
          consider({ k: 'tk' + has, label: has ? '🎟️ You have a ticket. Pick a seat!' : z.label + ' · ' + P.ticketPrice + ' 🪙', btn: has ? null : 'Buy', fn: () => worldSocket.emit('world:buyTicket') }, z.x, z.y, z.r);
        }
      });
      rd.seats.forEach((s, i) => { if (!seated) consider({ k: 'seat' + i, label: '🪑 Free seat', btn: 'Sit', fn: () => sitAt(s) }, s.x, s.y, 40); });
    }
    if (best) showPrompt(best.k, best.label, best.btn, best.fn); else { promptKey = ''; hidePrompt(); }
  }

  /* ---------------- cars: driver + invited passengers ---------------- */
  function showInvite(name, e) {
    const b = $('wui-invite'); if (!b) return; b.textContent = '';
    b.append(el('div', '', e + ' ' + name + ' invites you for a ride!'));
    const row = el('div'); row.style.cssText = 'display:flex;gap:8px;justify-content:center;margin-top:8px';
    row.append(el('button', 'wui-btn green sm', 'Join', () => { worldSocket.emit('world:carAccept'); hideInvite(); }), el('button', 'wui-btn alt sm', 'No thanks', () => { worldSocket.emit('world:carDecline'); hideInvite(); }));
    b.append(row); b.style.display = 'block'; clearTimeout(b._t); b._t = setTimeout(hideInvite, 58000);
  }
  function hideInvite() { const b = $('wui-invite'); if (b) b.style.display = 'none'; }

  function renderCarPanel() {
    const p = $('wui-car'); if (!p) return; const mc = myCar();
    if (!mc) { p.style.display = 'none'; carKey = ''; return; }
    const { car, seat } = mc, nm = uid => (worldUsers[uid] && worldUsers[uid].name) || 'Someone';
    const near = seat === 0 ? Object.values(worldUsers).filter(u => u.userId !== currentUser.id && !(car.riders || []).includes(u.userId) && Math.hypot(u.x - (car.cx || car.x), u.y - (car.cy || car.y)) < 300).map(u => u.userId) : [];
    const key = JSON.stringify([car.riders, near, seat, Object.keys(worldUsers).length]);
    if (key === carKey) return; carKey = key;
    p.textContent = ''; p.style.display = 'block';
    p.append(el('b', '', seat === 0 ? car.e + ' You are driving' : car.e + ' Riding with ' + (car.riders[0] ? nm(car.riders[0]) : 'nobody (driver left)')));
    (car.riders || []).forEach((uid, i) => { if (!uid || uid === currentUser.id) return; const r = el('div', 'row'); r.append(el('span', '', (i === 0 ? '🧑‍✈️ ' : '🙋 ') + nm(uid))); if (seat === 0 && i > 0) r.append(el('button', 'wui-btn alt sm', 'Get out', () => worldSocket.emit('world:carKick', { userId: uid }))); p.append(r); });
    if (seat === 0) {
      const free = (car.riders || []).some((r, i) => i > 0 && !r);
      if (!near.length) p.append(el('div', '', free ? 'Stand a player next to the car to invite them 👋' : 'Your car is full'));
      else if (free) near.forEach(uid => { const r = el('div', 'row'); r.append(el('span', '', '➕ ' + nm(uid))); r.append(el('button', 'wui-btn sm', 'Invite', () => worldSocket.emit('world:carInvite', { userId: uid }))); p.append(r); });
    } else if (!car.riders[0]) p.append(el('button', 'wui-btn green sm', '🚗 Take the wheel', () => worldSocket.emit('world:carWheel')));
  }

  /* ---------------- style + shop panel ---------------- */
  let styleOpen = false, draft = null, tab = 'body', shopCtx = null, firstTime = false, prev = null;
  const PET_EMOJI = { dog: '🐶', cat: '🐱', bunny: '🐰', fox: '🦊', panda: '🐼', penguin: '🐧' };
  const TAB_NAMES = { body: '🧍 Body', top: '👕 Tops', bottom: '👖 Bottoms', shoes: '👟 Shoes', hat: '🎩 Hats', pet: '🐾 Pet' };
  const has = id => { const it = W3.items[id]; return !!it && (it.price === 0 || P.owned.has(id)); };

  function openStyle(o) {
    if (!W3.ready()) return toast('The 3D town is needed for this', 'error');
    if (!P.loaded) return toast('One moment, loading your wardrobe…', 'error');
    shopCtx = o.shop || null; firstTime = !!o.first; draft = Object.assign({}, P.appearance);
    tab = shopCtx ? shopCtx.tabs[0] : 'body'; styleOpen = true; W3.uiOpen = true; hidePrompt(); promptKey = '';
    $('wui-style').style.display = 'flex';
    $('wui-title').textContent = firstTime ? '✨ Create your character' : shopCtx ? shopCtx.label : '👕 Style';
    $('wui-save').textContent = firstTime ? 'Start' : 'Save look'; $('wui-cancel').style.display = firstTime ? 'none' : '';
    renderStyle(); startPreview();
  }
  function closeStyle(silent) { if (!styleOpen && !silent) return; styleOpen = false; W3.uiOpen = false; const s = $('wui-style'); if (s) s.style.display = 'none'; stopPreview(); }
  function saveStyle() {
    const out = Object.assign({}, draft);
    ['top', 'bottom', 'shoes', 'hat', 'pet'].forEach(k => { if (out[k] && !has(out[k])) out[k] = P.appearance[k]; });   // can't wear what you haven't bought
    if (out.top !== draft.top || out.bottom !== draft.bottom || out.shoes !== draft.shoes || out.hat !== draft.hat || out.pet !== draft.pet) toast('Some items are not bought yet, so they were skipped', 'error');
    worldSocket.emit('world:saveAppearance', { appearance: out });
    P.appearance = out; const me = meUser(); if (me) me.appearance = out;
    closeStyle();
  }

  function renderStyle() {
    const tabs = $('wui-tabs'); tabs.textContent = '';
    (shopCtx ? shopCtx.tabs : ['body', 'top', 'bottom', 'shoes', 'hat', 'pet']).forEach(t => { const b = el('button', 'wui-btn sm' + (t === tab ? '' : ' alt'), TAB_NAMES[t], () => { tab = t; renderStyle(); }); b.style.flex = 'none'; tabs.append(b); });
    const grid = $('wui-grid'); grid.textContent = '';
    updateCoins();
    if (tab === 'body') {
      grid.append(el('div', 'lbl', 'I am a…'));
      [['boy', '👦 Boy'], ['girl', '👧 Girl']].forEach(([g, t]) => grid.append(card(t, '', draft.gender === g, () => { draft.gender = g; renderStyle(); refreshPreview(); })));
      grid.append(el('div', 'lbl', 'Skin'));
      W3.skins.forEach((c, i) => grid.append(card('', hex(c), draft.skin === i, () => { draft.skin = i; renderStyle(); refreshPreview(); })));
      grid.append(el('div', 'lbl', 'Hair style'));
      [['short', 'Short'], ['long', 'Long'], ['ponytail', 'Ponytail'], ['bun', 'Bun'], ['curly', 'Curly']].forEach(([h, t]) => grid.append(card(t, '', draft.hair === h, () => { draft.hair = h; renderStyle(); refreshPreview(); })));
      grid.append(el('div', 'lbl', 'Hair colour'));
      W3.hairColors.forEach((c, i) => grid.append(card('', hex(c), draft.hairColor === i, () => { draft.hairColor = i; renderStyle(); refreshPreview(); })));
      return;
    }
    if (tab === 'hat' || tab === 'pet') grid.append(card(tab === 'pet' ? 'No pet' : 'No hat', '', !draft[tab], () => { draft[tab] = null; renderStyle(); refreshPreview(); }, '✖'));
    Object.values(W3.items).filter(i => i.slot === tab).forEach(it => {
      const own = has(it.id), pick = () => { draft[tab] = it.id; renderStyle(); refreshPreview(); };
      const c = card(it.name, hex(it.color), draft[tab] === it.id, pick, tab === 'pet' ? PET_EMOJI[it.style] : '', own ? '' : '🪙 ' + it.price, !own);
      if (!own) {
        if (shopCtx) { const b = el('button', 'wui-btn green sm', 'Buy', e => { e.stopPropagation(); worldSocket.emit('world:buy', { itemId: it.id }); }); b.style.marginTop = '4px'; c.append(b); }
        else c.append(el('span', 'pr', '🔒 Mall'));
      }
      grid.append(c);
    });
  }
  function card(text, color, sel, fn, glyph, price, lock) {
    const c = el('div', 'wui-card' + (sel ? ' sel' : '') + (lock ? ' lock' : ''), '', fn);
    const sw = el('div', 'sw', glyph || ''); if (color) sw.style.background = color; else if (!glyph) sw.style.display = 'none'; c.append(sw);
    if (text) c.append(el('div', '', text)); if (price) c.append(el('span', 'pr', price));
    return c;
  }

  /* ---------------- live 3D preview (turntable) ---------------- */
  function startPreview() {
    try {
      if (!prev) {
        const canvas = $('wui-prev'), r = new T.WebGLRenderer({ canvas, antialias: true, alpha: true });
        r.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); r.outputEncoding = T.sRGBEncoding;
        const sc = new T.Scene(), cam = new T.PerspectiveCamera(34, 1, .1, 50);
        sc.add(new T.HemisphereLight(0xffffff, 0x8a7aa8, .9)); const dl = new T.DirectionalLight(0xffffff, .8); dl.position.set(2, 4, 3); sc.add(dl);
        const floor = new T.Mesh(new T.CircleGeometry(1.3, 32), new T.MeshBasicMaterial({ color: 0x3a2f66 })); floor.rotation.x = -Math.PI / 2; sc.add(floor);
        prev = { r, sc, cam, group: null, raf: 0 };
      }
      refreshPreview(); const loop = () => { if (!styleOpen) return; sizePreview(); prev.group.rotation.y += .012; prev.r.render(prev.sc, prev.cam); prev.raf = requestAnimationFrame(loop); }; loop();
    } catch (e) { console.warn('Preview unavailable', e); const w = $('wui-prev-wrap'); if (w) w.style.display = 'none'; }
  }
  function sizePreview() {
    const c = prev.r.domElement, w = c.clientWidth, h = c.clientHeight;
    if (c._w !== w || c._h !== h) { c._w = w; c._h = h; prev.r.setSize(w, h, false); prev.cam.aspect = w / h; prev.cam.updateProjectionMatrix(); const d = h < 200 ? 4.9 : 4.3; prev.cam.position.set(0, 1.25, d); prev.cam.lookAt(0, .95, 0); }
  }
  function refreshPreview() {
    if (!prev) return; if (prev.group) prev.sc.remove(prev.group);
    const g = new T.Group(), A = W3.buildAvatar(draft, currentUser.id, true); g.add(A.g);
    if (A.look.pet) { const pet = W3.makePet(A.look.pet); pet.g.position.set(.85, 0, .35); pet.g.rotation.y = -.5; g.add(pet.g); }
    prev.group = g; prev.sc.add(g);
  }
  function stopPreview() { if (prev) cancelAnimationFrame(prev.raf); }
})();
