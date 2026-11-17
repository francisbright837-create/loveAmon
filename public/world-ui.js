/* world-ui.js — menus & prompts for the 3D town (style editor, shop, door/car/exit prompts).
   Requires world3d.js (W3) and world-glue.js (enterWorldRoom, exitWorldRoom, driveWorldCar, …). */
(function () {
  const $ = id => document.getElementById(id);
  const me = () => worldUsers[currentUser.id];
  const promptEl = () => $('world-portal-prompt');
  let openPanel = null;

  function showPrompt(html, onclick) {
    const p = promptEl(); if (!p) return;
    p.style.display = 'block';
    p.innerHTML = '';
    const b = document.createElement('button');
    b.textContent = html;
    b.style.cssText = 'background:none;border:none;color:#fff;font-size:15px;font-weight:600;cursor:pointer;padding:2px 6px;margin:0;white-space:nowrap;';
    b.onclick = onclick;
    p.appendChild(b);
  }
  const hidePrompt = () => { const p = promptEl(); if (p) p.style.display = 'none'; };

  /* ---------- floating panels ---------- */
  function makePanel(title) {
    closePanels();
    const d = document.createElement('div');
    d.className = 'w3panel';
    d.style.cssText = 'position:absolute;top:60px;left:50%;transform:translateX(-50%);width:min(94vw,460px);max-height:70vh;overflow-y:auto;background:#fff;border-radius:16px;box-shadow:0 8px 30px rgba(0,0,0,.4);z-index:6;text-align:left;';
    d.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:#ff4d8d;color:#fff;font-weight:700;border-radius:16px 16px 0 0;">' + title +
      '<button style="width:auto;margin:0;padding:2px 10px;background:transparent;border:none;color:#fff;font-size:18px;">✕</button></div><div class="w3body" style="padding:14px 16px;"></div>';
    d.querySelector('button').onclick = closePanels;
    $('world-stage').appendChild(d);
    W3.uiOpen = true; openPanel = d;
    return d.querySelector('.w3body');
  }
  function closePanels() { if (openPanel) { openPanel.remove(); openPanel = null; } W3.uiOpen = !!$('wchat-panel') && $('wchat-panel').style.display !== 'none'; }
  window.closeWorldPanels = closePanels;

  const row = (body, label) => { const w = document.createElement('div'); w.innerHTML = '<div style="font-weight:700;margin:10px 0 6px;">' + label + '</div>'; const r = document.createElement('div'); r.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;'; w.appendChild(r); body.appendChild(w); return r; };
  const chip = (r, txt, cb, active) => { const b = document.createElement('button'); b.textContent = txt; b.className = 'world-btn'; if (active) b.style.background = '#ff4d8d', b.style.color = '#fff'; b.onclick = cb; r.appendChild(b); return b; };
  const swatch = (r, color, cb, active) => { const b = document.createElement('button'); b.style.cssText = 'width:34px;height:34px;margin:0;padding:0;border-radius:50%;border:3px solid ' + (active ? '#ff4d8d' : '#fff') + ';box-shadow:0 0 0 1px #ccc;background:#' + color.toString(16).padStart(6, '0'); b.onclick = cb; r.appendChild(b); return b; };
  const coins = () => (window.myCoins | 0);

  /* ---------- 🎨 Style panel: boy/girl, skin, hair, clothes, hat, pet ---------- */
  window.openStylePanel = function () {
    const a = (me() && me().appearance) || {};
    const body = makePanel('🎨 My style');
    const R = (label, arr, cur, set, render) => { const r = row(body, label); arr.forEach((v, i) => render(r, v, () => { set(i); openStylePanel(); }, i === cur)); };
    R('I am a…', ['Boy', 'Girl'], a.gender === 'girl' ? 1 : 0, i => setMyLook({ gender: i ? 'girl' : 'boy' }), (r, v, cb, on) => chip(r, v, cb, on));
    R('Skin', W3.skins, a.skin || 0, i => setMyLook({ skin: i }), swatch);
    R('Hair colour', W3.hairColors, a.hairColor || 0, i => setMyLook({ hairColor: i }), swatch);
    R('Hair style', ['short', 'long', 'ponytail', 'bun', 'curly'], ['short', 'long', 'ponytail', 'bun', 'curly'].indexOf(a.hair) < 0 ? 0 : ['short', 'long', 'ponytail', 'bun', 'curly'].indexOf(a.hair), i => setMyLook({ hair: ['short', 'long', 'ponytail', 'bun', 'curly'][i] }), (r, v, cb, on) => chip(r, v, cb, on));
    [['top', '👕 Tops'], ['bottom', '👖 Bottoms'], ['shoes', '👟 Shoes'], ['hat', '🎩 Hats'], ['pet', '🐾 Pets']].forEach(([slot, label]) => {
      const r = row(body, label);
      const owned = (window.myItems || []).map(id => W3.items[id]).filter(it => it && it.slot === slot);
      if (slot === 'hat') chip(r, 'None', () => { setMyLook({ hat: null }); openStylePanel(); }, !a.hat);
      if (slot === 'pet') chip(r, 'No pet', () => { setMyLook({ pet: null }); openStylePanel(); }, !a.pet);
      if (!owned.length) r.innerHTML += '<span style="color:#999;font-size:13px;">Nothing owned yet — visit the mall! 🛍️</span>';
      owned.forEach(it => chip(r, it.name, () => { setMyLook({ [slot]: it.id }); openStylePanel(); }, a[slot] === it.id));
    });
    const hint = document.createElement('div'); hint.style.cssText = 'margin-top:12px;color:#888;font-size:12px;'; hint.textContent = 'Changes show instantly on your character.'; body.appendChild(hint);
  };

  /* ---------- 🛍️ Shop panel (mall zones) ---------- */
  window.openShopPanel = function (zone) {
    const body = makePanel(zone.label + ' · 🪙 ' + coins());
    const tabs = zone.tabs || ['top'];
    tabs.forEach(slot => {
      const r = row(body, { top: '👕 Tops', bottom: '👖 Bottoms', shoes: '👟 Shoes', hat: '🎩 Hats', pet: '🐾 Pets' }[slot] || slot);
      Object.values(W3.items).filter(it => it.slot === slot).forEach(it => {
        const owned = (window.myItems || []).includes(it.id);
        const b = chip(r, (owned ? '✓ ' : '🪙' + it.price + ' ') + it.name, () => {
          if (owned) { setMyLook({ [slot]: it.id }); }
          else if (confirm('Buy ' + it.name + ' for ' + it.price + ' coins?')) buyWorldItem(it.id);
        }, owned && me() && me().appearance && me().appearance[slot] === it.id);
        b.style.borderLeft = '14px solid #' + it.color.toString(16).padStart(6, '0');
      });
    });
    if (tabs.includes('pet')) { const n = document.createElement('div'); n.style.cssText = 'margin-top:10px;color:#888;font-size:12px;'; n.textContent = 'Pets follow you around town. Pick "No pet" in 🎨 My style to leave it home.'; body.appendChild(n); }
  };

  /* ---------- per-frame proximity prompts (W3.onFrame is called by world3d every frame) ---------- */
  W3.onFrame = function () {
    if (openPanel || W3.uiOpen) { hidePrompt(); return; }
    const u = me(); if (!u) return;
    const myCarSeat = (() => { for (let i = 0; i < WORLD_PARKED_CARS.length; i++) { const s = (WORLD_PARKED_CARS[i].riders || []).indexOf(currentUser.id); if (s >= 0) return { i, s }; } return null; })();

    if (W3.room() === 'town' && worldRoom === 'town') {
      // 1) parked car nearby?
      let best = null, bd = 70;
      WORLD_PARKED_CARS.forEach((c, i) => {
        const d = Math.hypot((c.cx || c.x) - u.x, (c.cy || c.y) - u.y);
        if (d < bd) { bd = d; best = { c, i }; }
      });
      if (best && !myCarSeat) {
        const riders = best.c.riders || [], drv = riders[0] && worldUsers[riders[0]];
        if (!drv) return showPrompt('🚗 Drive the ' + best.c.e, () => { driveWorldCar(best.i); hidePrompt(); });
        if (drv.userId === currentUser.id) return showPrompt('🚗 Your car — pick a spot, friends can ride along', () => hidePrompt());
        const free = riders.length < 4;
        return showPrompt('🚙 Ask ' + drv.name + ' for a ride' + (free ? '' : ' (full)'), () => { if (free) askWorldDriver(best.i); hidePrompt(); });
      }
      // 2) door nearby?
      const d = W3.doors.find(d => Math.hypot(d.x - u.x, d.y - u.y) < d.r);
      if (d) return showPrompt(d.sign + ' Enter ' + d.label, () => { enterWorldRoom(d.room); hidePrompt(); });
    } else {
      const rd = W3.getRoom(worldRoom);
      const z = rd.zones.find(z => Math.hypot(z.x - u.x, z.y - u.y) < z.r);
      if (z) {
        if (z.kind === 'exit') return showPrompt('🚪 Exit ' + rd.label, () => { exitWorldRoom(); hidePrompt(); });
        if (z.kind === 'shop') return showPrompt(z.label + ' — Browse', () => openShopPanel(z));
        if (z.kind === 'ticket') return showPrompt('🎟️ Buy a cinema ticket · 🪙5', () => { if (confirm('Buy a ticket for 5 coins?')) buyWorldItem('ticket_cinema'); hidePrompt(); });
      }
    }
    hidePrompt();
  };

  /* ---------- add the 🎨 button to the world topbar ---------- */
  const tb = document.getElementById('world-topbar');
  if (tb && !document.getElementById('world-style-btn')) {
    const b = document.createElement('button');
    b.id = 'world-style-btn'; b.className = 'world-btn'; b.textContent = '🎨 Style';
    b.onclick = openStylePanel;
    tb.insertBefore(b, tb.children[1] || null);
  }
})();
