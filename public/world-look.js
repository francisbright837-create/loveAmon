/* Style editor: choose boy/girl, skin, hair, clothes, hat and an animal friend.
   The character in the world changes live while you choose; "Save" stores it and shows it to everyone. */
(function () {
  const LK = window.LOOK;
  if (!LK) return;

  const css = `
  #look-btn { }
  #look-panel { display:none; position:fixed; left:0; right:0; bottom:0; z-index:9650; max-height:46vh; overflow-y:auto;
    background:#fff; color:#222; border-radius:18px 18px 0 0; box-shadow:0 -6px 24px rgba(0,0,0,0.35);
    padding:10px 14px calc(12px + env(safe-area-inset-bottom, 0px)); box-sizing:border-box; text-align:left; font-family:Arial,sans-serif; }
  @media (min-width: 760px) { #look-panel { left:auto; right:16px; bottom:16px; width:360px; max-height:70vh; border-radius:18px; } }
  #look-panel .lk-head { display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; }
  #look-panel .lk-tabs { display:flex; gap:6px; margin-bottom:10px; }
  #look-panel button { width:auto; max-width:none; margin:0; font-size:14px; }
  #look-panel .lk-tab { flex:1; padding:8px 4px; border:none; border-radius:10px; background:#f0f0f4; color:#444; cursor:pointer; }
  #look-panel .lk-tab.on { background:#ff4d8d; color:#fff; }
  #look-panel .lk-row { margin:8px 0; }
  #look-panel .lk-label { font-size:12px; color:#777; margin-bottom:4px; }
  #look-panel .lk-pills, #look-panel .lk-sw { display:flex; flex-wrap:wrap; gap:6px; }
  #look-panel .lk-pill { padding:7px 12px; border-radius:16px; border:1px solid #ddd; background:#fff; color:#333; cursor:pointer; }
  #look-panel .lk-pill.on { background:#ff4d8d; border-color:#ff4d8d; color:#fff; }
  #look-panel .lk-dot { width:30px; height:30px; padding:0; border-radius:50%; border:2px solid #ddd; cursor:pointer; }
  #look-panel .lk-dot.on { border-color:#ff4d8d; box-shadow:0 0 0 2px #ffb3cf; }
  #look-panel .lk-foot { display:flex; gap:8px; margin-top:12px; }
  #look-panel .lk-foot button { flex:1; padding:11px; border:none; border-radius:12px; cursor:pointer; background:#eee; color:#333; font-weight:600; }
  #look-panel .lk-foot .lk-save { background:#25d366; color:#fff; }
  #look-panel .lk-x { background:transparent; border:none; font-size:20px; cursor:pointer; padding:4px 8px; }`;

  const LABELS = {
    gender: { boy: '👦 Boy', girl: '👧 Girl' },
    hairStyle: { short: 'Short', long: 'Long', bun: 'Bun', curly: 'Curly' },
    top: { tee: 'T-shirt', hoodie: 'Hoodie', tank: 'Tank top', dress: 'Dress' },
    bottom: { jeans: 'Jeans', shorts: 'Shorts', skirt: 'Skirt' },
    shoes: { sneakers: 'Sneakers', boots: 'Boots', sandals: 'Sandals' },
    hat: { none: 'No hat', cap: 'Cap', beanie: 'Beanie', crown: 'Crown 👑', sunhat: 'Sun hat' },
    pet: { none: 'No pet', dog: '🐶 Dog', cat: '🐱 Cat', rabbit: '🐰 Rabbit', chick: '🐥 Chick' }
  };
  const hex = n => '#' + n.toString(16).padStart(6, '0');

  let panel = null, working = null, tab = 'body', timer = null;

  function h(tag, props, ...kids) {
    const e = document.createElement(tag);
    Object.assign(e, props || {});
    kids.forEach(k => e.append(k));
    return e;
  }
  const authHeaders = json => { const o = { Authorization: 'Bearer ' + token }; if (json) o['Content-Type'] = 'application/json'; return o; };

  function preview() { window.__lookPreview = LK.cleanLook(working); render(); }

  function pills(label, key) {
    const row = h('div', { className: 'lk-row' }, h('div', { className: 'lk-label', textContent: label }));
    const box = h('div', { className: 'lk-pills' });
    LK.OPTIONS[key].forEach(opt => {
      const b = h('button', { className: 'lk-pill' + (working[key] === opt ? ' on' : ''), textContent: LABELS[key][opt] || opt });
      b.onclick = () => { working[key] = opt; preview(); };
      box.append(b);
    });
    row.append(box);
    return row;
  }
  function swatches(label, key, colors) {
    const row = h('div', { className: 'lk-row' }, h('div', { className: 'lk-label', textContent: label }));
    const box = h('div', { className: 'lk-sw' });
    colors.forEach((c, i) => {
      const b = h('button', { className: 'lk-dot' + (working[key] === i ? ' on' : ''), title: 'Colour ' + (i + 1) });
      b.style.background = hex(c);
      b.onclick = () => { working[key] = i; preview(); };
      box.append(b);
    });
    row.append(box);
    return row;
  }

  function render() {
    if (!panel) return;
    const body = panel.querySelector('.lk-body');
    body.textContent = '';
    panel.querySelectorAll('.lk-tab').forEach(t => t.classList.toggle('on', t.dataset.tab === tab));
    if (tab === 'body') {
      body.append(pills('I am a...', 'gender'), swatches('Skin', 'skin', LK.SKINS));
    } else if (tab === 'hair') {
      body.append(pills('Hair style', 'hairStyle'), swatches('Hair colour', 'hair', LK.HAIR));
    } else if (tab === 'clothes') {
      body.append(pills('Top', 'top'), swatches('Top colour', 'topColor', LK.COLORS));
      if (working.top !== 'dress') body.append(pills('Bottom', 'bottom'), swatches('Bottom colour', 'bottomColor', LK.COLORS));
      body.append(pills('Shoes', 'shoes'), swatches('Shoe colour', 'shoeColor', LK.COLORS));
    } else {
      body.append(pills('Hat', 'hat'));
      if (working.hat !== 'none' && working.hat !== 'crown') body.append(swatches('Hat colour', 'hatColor', LK.COLORS));
      body.append(pills('Animal friend', 'pet'));
      if (working.pet !== 'none') body.append(swatches('Animal colour', 'petColor', LK.PET_COLORS));
    }
  }

  function build() {
    if (panel) return;
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    panel = h('div', { id: 'look-panel' });
    const head = h('div', { className: 'lk-head' }, h('b', { textContent: '👗 Style your character' }));
    const x = h('button', { className: 'lk-x', textContent: '✕', title: 'Close' }); x.onclick = () => closeEditor(false);
    head.append(x);
    const tabs = h('div', { className: 'lk-tabs' });
    [['body', 'Body'], ['hair', 'Hair'], ['clothes', 'Clothes'], ['extras', 'Extras']].forEach(([id, name]) => {
      const b = h('button', { className: 'lk-tab', textContent: name }); b.dataset.tab = id;
      b.onclick = () => { tab = id; render(); };
      tabs.append(b);
    });
    const foot = h('div', { className: 'lk-foot' });
    const rnd = h('button', { textContent: '🎲 Random' }); rnd.onclick = randomLook;
    const save = h('button', { className: 'lk-save', textContent: 'Save ✔' }); save.onclick = saveLook;
    foot.append(rnd, save);
    panel.append(head, tabs, h('div', { className: 'lk-body' }), foot);
    document.body.appendChild(panel);
  }

  function randomLook() {
    const pick = a => a[Math.floor(Math.random() * a.length)];
    const next = {};
    Object.keys(LK.OPTIONS).forEach(k => { next[k] = pick(LK.OPTIONS[k]); });
    Object.keys(LK.RANGES).forEach(k => { next[k] = Math.floor(Math.random() * LK.RANGES[k]); });
    working = LK.cleanLook(next);
    preview();
  }

  async function openEditor() {
    if (typeof currentUser === 'undefined' || !currentUser) return;
    build();
    // start from what is saved (or what the character looks like right now)
    let start = null;
    try {
      const res = await fetch(API_URL + '/appearance', { headers: authHeaders(false) });
      const data = await res.json();
      if (res.ok && data.look) start = data.look;
    } catch (e) { /* use the current look */ }
    const me = typeof worldUsers !== 'undefined' ? worldUsers[currentUser.id] : null;
    working = LK.cleanLook(start || (me && me.look) || LK.defaultFor(currentUser.id, true));
    tab = 'body';
    panel.style.display = 'block';
    preview();
    if (window.W3D) window.W3D.focus(true);
    clearInterval(timer);
    timer = setInterval(() => {                       // close by itself if the player leaves the world
      const ws = document.getElementById('world-screen');
      if (!ws || ws.style.display === 'none') closeEditor(false);
    }, 600);
  }

  function closeEditor() {
    clearInterval(timer);
    window.__lookPreview = null;
    if (panel) panel.style.display = 'none';
    if (window.W3D) window.W3D.focus(false);
  }

  async function saveLook() {
    const look = LK.cleanLook(working);
    try {
      const res = await fetch(API_URL + '/appearance', { method: 'PUT', headers: authHeaders(true), body: JSON.stringify({ look }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Could not save your style');
      const me = worldUsers[currentUser.id];
      if (me) me.look = data.look;
      closeEditor();
      if (worldSocket && worldSocket.connected) worldSocket.emit('world:look');   // tell everyone in the world
      showMessage('✅ Your style was saved', 'success');
    } catch (err) {
      showMessage('❌ ' + err.message);
    }
  }

  // the 👗 button in the world's top bar
  function addButton() {
    const bar = document.getElementById('world-topbar');
    if (!bar || document.getElementById('look-btn')) return;
    const b = h('button', { id: 'look-btn', className: 'world-btn', textContent: '👗 Style' });
    b.onclick = openEditor;
    bar.insertBefore(b, document.getElementById('world-exit-car'));
  }
  addButton();
  window.openLookEditor = openEditor;
})();
