/* AI tab: a feed of AI-generated videos.
   These are normal video uploads (same /api/videos routes as the Home feed) whose caption carries the tag
   #AI plus one category tag (#Generated, #AIart or #Tutorials). The Home feed hides them; this tab shows them. */
(function () {
  const CATS = [['All', ''], ['Generated', '#Generated'], ['AI art', '#AIart'], ['Tutorials', '#Tutorials']];
  let list = [], cat = 'All', io = null, viewed = new Set();
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  const isAi = v => /(^|\s)#AI\b/i.test(v.caption || '');
  const catOf = v => { const c = CATS.find(c => c[1] && new RegExp(c[1] + '\\b', 'i').test(v.caption || '')); return c ? c[0] : 'Generated'; };
  const clean = v => (v.caption || '').replace(/#(AI|Generated|AIart|Tutorials)\b/gi, '').replace(/\s+/g, ' ').trim();
  const auth = () => ({ 'Authorization': 'Bearer ' + token });

  function fit() {
    const nav = $('bottom-nav'), h = nav ? nav.offsetHeight : 70;
    $('ai-screen').style.bottom = h + 'px';
    $('ai-feed').style.setProperty('--ai-h', Math.max(300, innerHeight - h) + 'px');
  }
  window.addEventListener('resize', () => { if ($('ai-screen') && $('ai-screen').style.display === 'block') fit(); });

  function chips() {
    const box = $('ai-chips');
    box.innerHTML = '';
    CATS.forEach(c => {
      const b = document.createElement('button');
      b.className = 'ai-chip';
      b.textContent = c[0];
      b.setAttribute('aria-pressed', c[0] === cat);
      b.onclick = () => { cat = c[0]; chips(); render(); };
      box.appendChild(b);
    });
  }

  function render() {
    const feed = $('ai-feed');
    const items = list.filter(v => cat === 'All' || catOf(v) === cat);
    if (io) io.disconnect();
    if (!items.length) {
      feed.innerHTML = '<div class="ai-empty">No AI videos here yet.<br>Tap “+ Add” to share the first one.</div>';
      return;
    }
    feed.innerHTML = items.map(v => {
      const liked = (v.likes || []).includes(currentUser.id);
      return `<section class="ai-card" data-id="${esc(v._id)}">
        <video src="${esc(v.url)}" loop playsinline preload="metadata" crossorigin="anonymous" onclick="toggleSlidePlay(this)"></video>
        <div class="ai-badge">✨ AI-generated</div>
        <div class="ai-info"><b data-user="${esc(v.user?._id || '')}">${esc(v.user?.name || 'Unknown')}</b>
          ${clean(v) ? esc(clean(v)) + '<br>' : ''}<span>${esc(catOf(v))}</span></div>
        <div class="ai-rail">
          <div><button data-like aria-pressed="${liked}" aria-label="Like">♥</button><small>${(v.likes || []).length}</small></div>
          <div><button data-comment aria-label="Comments">💬</button><small>${v.comments?.length || 0}</small></div>
          <div><button data-share aria-label="Share">↗</button><small>Share</small></div>
        </div></section>`;
    }).join('');

    io = new IntersectionObserver(entries => entries.forEach(e => {
      const vid = e.target.querySelector('video'), id = e.target.dataset.id;
      if (!vid) return;
      if (e.isIntersecting) {
        const p = vid.play();
        if (p && p.catch) p.catch(() => { vid.muted = true; vid.play().catch(() => {}); });
        if (!viewed.has(id)) { viewed.add(id); fetch(API_URL + '/videos/view/' + id, { method: 'POST', headers: auth() }).catch(() => {}); }
      } else vid.pause();
    }), { root: feed, threshold: .7 });
    feed.querySelectorAll('.ai-card').forEach(c => io.observe(c));
  }

  // one click handler for every button inside the feed
  $('ai-feed').addEventListener('click', async e => {
    const card = e.target.closest('.ai-card');
    if (!card) return;
    const id = card.dataset.id, v = list.find(x => x._id === id);
    if (e.target.closest('[data-like]')) {
      try {
        const res = await fetch(API_URL + '/videos/like/' + id, { method: 'POST', headers: auth() });
        if (handleAuthFailure(res.status)) return;
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to like video');
        v.likes = (v.likes || []).filter(u => u !== currentUser.id);
        if (data.liked) v.likes.push(currentUser.id);
        const btn = card.querySelector('[data-like]');
        btn.setAttribute('aria-pressed', !!data.liked);
        btn.parentNode.querySelector('small').textContent = v.likes.length;
      } catch (err) { showMessage('❌ ' + err.message); }
    } else if (e.target.closest('[data-comment]')) {
      window.aiReturn = true;                 // closing the comments screen comes back to this tab
      openVideoDetail(id);
    } else if (e.target.closest('[data-share]')) {
      shareVideo(v.url);
    } else if (e.target.closest('[data-user]')) {
      const uid = e.target.closest('[data-user]').dataset.user;
      if (uid) openPublicProfile(uid);
    }
  });

  window.openAiTab = async function () {
    fit();
    chips();
    $('ai-feed').innerHTML = '<div class="ai-empty">Loading AI videos…</div>';
    try {
      const res = await fetch(API_URL + '/videos/feed', { headers: auth() });
      if (handleAuthFailure(res.status)) return;
      const videos = await res.json();
      if (!res.ok) throw new Error(videos.message || 'Failed to load videos');
      list = videos.filter(isAi);
      render();
    } catch (err) {
      $('ai-feed').innerHTML = '<div class="ai-empty">Could not load AI videos.</div>';
    }
  };

  // ---- upload ----
  $('ai-add').onclick = () => { $('ai-upload').style.display = 'flex'; $('ai-status').textContent = ''; };
  $('ai-cancel').onclick = () => { $('ai-upload').style.display = 'none'; };
  $('ai-send').onclick = async () => {
    const file = $('ai-file').files[0], status = $('ai-status');
    if (!file) { status.textContent = '❌ Please choose a video first'; return; }
    const tag = CATS.find(c => c[0] === $('ai-cat').value)?.[1] || '#Generated';
    const text = $('ai-caption').value.trim();
    status.textContent = 'Uploading… this may take a moment ⏳';
    try {
      const fd = new FormData();
      fd.append('video', file);
      fd.append('caption', ('#AI ' + tag + ' ' + text).trim());
      const res = await fetch(API_URL + '/videos/upload', { method: 'POST', headers: auth(), body: fd });
      if (handleAuthFailure(res.status)) return;
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Upload failed');
      status.textContent = '✅ Uploaded!';
      $('ai-file').value = ''; $('ai-caption').value = '';
      setTimeout(() => { $('ai-upload').style.display = 'none'; openAiTab(); }, 900);
    } catch (err) { status.textContent = '❌ ' + err.message; }
  };
})();
