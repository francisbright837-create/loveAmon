/* AI companion chat (Mia). Human-feeling pacing (typing dots, short messages), but always labelled "AI". */
(function () {
  const NAME = 'Mia';
  const GREETING = "Hey! I'm Mia, the AI companion here 😊 What should I call you?";
  let hist = [], busy = false;
  const $ = id => document.getElementById(id);
  const key = () => 'aiChat:' + (typeof currentUser !== 'undefined' && currentUser ? currentUser.id : 'guest');
  const wait = ms => new Promise(r => setTimeout(r, ms));

  // ---- Mia's voice: the browser's built-in text-to-speech (free, no key) ----
  const TTS = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  let voiceOn = true, voice = null;
  try { voiceOn = localStorage.getItem('aicVoice') !== '0'; } catch (e) {}
  function pickVoice() {
    if (!TTS) return;
    const all = speechSynthesis.getVoices();
    if (!all.length) return;
    const lang = (navigator.language || 'en').slice(0, 2).toLowerCase();
    const pool = all.filter(v => v.lang && v.lang.toLowerCase().startsWith(lang));
    const list = pool.length ? pool : all.filter(v => /^en/i.test(v.lang));
    voice = list.find(v => /(natural|neural|aria|jenny|samantha|zira|sonia|libby|karen|moira|tessa|victoria|female)/i.test(v.name))
         || list.find(v => /google/i.test(v.name)) || list[0] || null;
  }
  if (TTS) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
  const spokenText = t => t.replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\uFE0F\u200D]/gu, '').replace(/\s+/g, ' ').trim();
  function stopSpeech() { if (TTS) speechSynthesis.cancel(); }
  function speak(text) {          // resolves when she has finished talking (or after a safety timeout)
    return new Promise(resolve => {
      const clean = spokenText(text);
      if (!TTS || !voiceOn || !clean) return resolve();
      const u = new SpeechSynthesisUtterance(clean);
      if (voice) { u.voice = voice; u.lang = voice.lang; }
      u.rate = 1.02; u.pitch = 1.08;
      const done = () => { clearTimeout(t); resolve(); };
      const t = setTimeout(done, clean.length * 95 + 2500);
      u.onend = done; u.onerror = done;
      speechSynthesis.speak(u);
    });
  }

  const st = document.createElement('style');
  st.textContent = `
  #aic{display:none;position:fixed;inset:0;z-index:9500;background:#f6f1f4;flex-direction:column;text-align:left;font-family:inherit;height:100dvh}
  #aic .h{display:flex;align-items:center;gap:10px;padding:calc(10px + env(safe-area-inset-top,0px)) 12px 10px;background:#ff4d8d;color:#fff}
  #aic .h button{display:block;width:auto;max-width:none;margin:0;padding:6px 10px;background:#ffffff33;color:#fff;border:0;border-radius:8px;font-size:18px}
  #aic .av{width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,#7b61ff,#ff9ecb);display:grid;place-items:center;font-weight:700}
  #aic .tag{background:#fff;color:#ff4d8d;border-radius:5px;font-size:11px;font-weight:700;padding:1px 5px;margin-left:4px}
  #aic small{opacity:.9}
  #aic-list{flex:1;overflow-y:auto;padding:14px 12px;display:flex;flex-direction:column;gap:8px}
  .aicb{max-width:78%;padding:9px 13px;border-radius:16px;font-size:15px;line-height:1.35;white-space:pre-wrap;word-break:break-word}
  .aicb.bot{align-self:flex-start;background:#fff;color:#222;border-bottom-left-radius:4px;box-shadow:0 1px 2px #0002}
  .aicb.me{align-self:flex-end;background:#ff4d8d;color:#fff;border-bottom-right-radius:4px}
  .aicb.sys{align-self:center;background:transparent;color:#888;font-size:13px}
  .aicdots span{display:inline-block;width:7px;height:7px;margin:0 2px;border-radius:50%;background:#bbb;animation:aicd 1s infinite}
  .aicdots span:nth-child(2){animation-delay:.15s}.aicdots span:nth-child(3){animation-delay:.3s}
  @keyframes aicd{0%,60%,100%{transform:translateY(0);opacity:.5}30%{transform:translateY(-4px);opacity:1}}
  #aic-form{display:flex;gap:8px;padding:10px 12px calc(10px + env(safe-area-inset-bottom,0px));background:#fff;border-top:1px solid #eee}
  #aic-input{flex:1;margin:0;max-width:none;padding:11px 14px;border-radius:99px;border:1px solid #ddd;font-size:16px}
  #aic-send{width:46px;max-width:none;margin:0;padding:0;border-radius:50%;background:#ff4d8d;color:#fff;border:0;font-size:18px}
  #aic-mic{width:46px;max-width:none;margin:0;padding:0;border-radius:50%;background:#7b61ff;color:#fff;border:0;font-size:18px}
  #aic-mic.on{background:#e53935;animation:aicd 1s infinite}
  #aic .h button+button{margin-left:2px}
  #aic-note{text-align:center;font-size:12px;color:#888;padding:4px 10px 0}`;
  document.head.appendChild(st);

  const ov = document.createElement('div');
  ov.id = 'aic';
  ov.innerHTML = `<div class="h"><button id="aic-back" aria-label="Back">←</button><div class="av">M</div>
    <div style="flex:1"><b>${NAME}</b><span class="tag">AI</span><br><small>AI companion · here to chat</small></div>
    <button id="aic-voice" aria-label="Voice on or off" title="Voice on/off">🔊</button><button id="aic-clear" aria-label="Clear chat" title="Clear chat">🗑</button></div>
    <div id="aic-note">${NAME} is an AI. Don't share passwords or money details.</div>
    <div id="aic-list" aria-live="polite"></div>
    <div id="aic-form"><input id="aic-input" placeholder="Message ${NAME}…" maxlength="500" autocomplete="off"><button id="aic-mic" aria-label="Talk to Mia" title="Talk" style="display:none">🎤</button><button id="aic-send" aria-label="Send">➤</button></div>`;
  document.body.appendChild(ov);

  function bubble(text, cls) {
    const b = document.createElement('div');
    b.className = 'aicb ' + cls;
    b.textContent = text;
    if (cls === 'bot') { b.style.cursor = 'pointer'; b.title = 'Tap to hear this'; b.onclick = () => { stopSpeech(); speak(text); }; }
    $('aic-list').appendChild(b);
    $('aic-list').scrollTop = $('aic-list').scrollHeight;
    return b;
  }
  function typing() {
    const b = document.createElement('div');
    b.className = 'aicb bot aicdots';
    b.innerHTML = '<span></span><span></span><span></span>';
    $('aic-list').appendChild(b);
    $('aic-list').scrollTop = $('aic-list').scrollHeight;
    return b;
  }
  const save = () => { try { localStorage.setItem(key(), JSON.stringify(hist.slice(-40))); } catch (e) {} };

  function open() {
    try { hist = JSON.parse(localStorage.getItem(key()) || '[]'); } catch (e) { hist = []; }
    if (!hist.length) { hist = [{ role: 'assistant', content: GREETING }]; save(); }
    $('aic-list').innerHTML = '';
    hist.forEach(m => bubble(m.content, m.role === 'user' ? 'me' : 'bot'));
    ov.style.display = 'flex';
    setTimeout(() => $('aic-input').focus(), 100);
  }

  async function send() {
    const input = $('aic-input'), text = input.value.trim();
    if (!text || busy) return;
    stopSpeech();
    busy = true; input.value = '';
    hist.push({ role: 'user', content: text }); save();
    bubble(text, 'me');
    let dots = typing();
    const started = Date.now();
    try {
      const ctl = new AbortController();
      const killer = setTimeout(() => ctl.abort(), 60000);          // a sleeping server can take a while to wake up
      const res = await fetch(API_URL + '/ai/chat', {
        method: 'POST', signal: ctl.signal,
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ messages: hist.slice(-20) })
      });
      clearTimeout(killer);
      if (res.status === 401) throw new Error('Your login expired. Please log in again.');
      let data;
      try { data = await res.json(); } catch (e) { throw new Error('The server sent an unexpected answer (' + res.status + '). Try again in a minute.'); }
      if (!res.ok) throw new Error(data.message || 'Something went wrong');
      const parts = String(data.reply || '').split(/\n\s*\n+/).map(s => s.trim()).filter(Boolean).slice(0, 3);
      if (!parts.length) throw new Error(NAME + " didn't have anything to say. Try again.");
      for (let i = 0; i < parts.length; i++) {
        // like a person typing: a pause that grows with the length of what she is about to send
        const delay = Math.min(2600, 600 + parts[i].length * 28) - (i === 0 ? Date.now() - started : 0);
        if (delay > 0) await wait(delay);
        dots.remove();
        bubble(parts[i], 'bot');
        hist.push({ role: 'assistant', content: parts[i] });
        await speak(parts[i]);                       // she says it out loud before the next message
        if (i < parts.length - 1) { await wait(250); dots = typing(); }
      }
      save();
    } catch (err) {
      console.error('Mia chat error:', err);
      dots.remove();
      bubble(err.name === 'AbortError' ? 'Mia took too long to answer. Please try again.' : err.message, 'sys');
    }
    busy = false;
    $('aic-input').focus();
  }

  $('aic-send').onclick = send;
  $('aic-input').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); send(); } });
  $('aic-back').onclick = () => { stopSpeech(); ov.style.display = 'none'; };
  $('aic-clear').onclick = () => { if (confirm('Clear this chat with ' + NAME + '?')) { hist = []; save(); open(); } };
  // speaker switch (also "unlocks" speech on iPhones, which need a tap first)
  const vbtn = $('aic-voice');
  const paintVoice = () => { vbtn.textContent = voiceOn ? '🔊' : '🔇'; if (!TTS) vbtn.style.display = 'none'; };
  vbtn.onclick = () => { voiceOn = !voiceOn; try { localStorage.setItem('aicVoice', voiceOn ? '1' : '0'); } catch (e) {} if (!voiceOn) stopSpeech(); paintVoice(); };
  paintVoice();

  // talk instead of type (Chrome, Edge, Safari)
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SR) {
    const mic = $('aic-mic');
    mic.style.display = 'block';
    let rec = null;
    mic.onclick = () => {
      if (rec) { rec.stop(); return; }
      stopSpeech();
      rec = new SR();
      rec.lang = navigator.language || 'en-US';
      rec.interimResults = true;
      rec.onresult = e => { $('aic-input').value = Array.from(e.results).map(r => r[0].transcript).join(' '); };
      rec.onend = () => { rec = null; mic.classList.remove('on'); if ($('aic-input').value.trim()) send(); };
      rec.onerror = () => { rec = null; mic.classList.remove('on'); };
      mic.classList.add('on');
      rec.start();
    };
  }
  window.openAiCompanion = open;

  // pinned entry at the top of the Messages screen
  const list = $('groups-list');
  if (list && !$('aic-pin')) {
    const item = document.createElement('div');
    item.id = 'aic-pin';
    item.className = 'conversation-item';
    item.onclick = open;
    item.innerHTML = `<div style="width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,#7b61ff,#ff9ecb);display:grid;place-items:center;color:#fff;font-weight:700;flex:none">M</div>
      <div style="flex:1"><strong>${NAME}</strong> <span style="background:#ff4d8d;color:#fff;border-radius:5px;font-size:11px;font-weight:700;padding:1px 5px">AI</span>
      <p style="margin:0;color:#666;font-size:14px">Your AI companion · tap to chat anytime 💬</p></div>`;
    list.parentNode.insertBefore(item, list);
  }
})();
