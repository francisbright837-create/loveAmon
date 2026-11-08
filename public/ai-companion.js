/* AI companion chat (Mia). Human-feeling pacing (typing dots, short messages), but always labelled "AI". */
(function () {
  const NAME = 'Mia';
  const GREETING = "Hey! I'm Mia, the AI companion here 😊 What should I call you?";
  let hist = [], busy = false;
  const $ = id => document.getElementById(id);
  const key = () => 'aiChat:' + (typeof currentUser !== 'undefined' && currentUser ? currentUser.id : 'guest');
  const wait = ms => new Promise(r => setTimeout(r, ms));

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
  #aic-note{text-align:center;font-size:12px;color:#888;padding:4px 10px 0}`;
  document.head.appendChild(st);

  const ov = document.createElement('div');
  ov.id = 'aic';
  ov.innerHTML = `<div class="h"><button id="aic-back" aria-label="Back">←</button><div class="av">M</div>
    <div style="flex:1"><b>${NAME}</b><span class="tag">AI</span><br><small>AI companion · here to chat</small></div>
    <button id="aic-clear" aria-label="Clear chat" title="Clear chat">🗑</button></div>
    <div id="aic-note">${NAME} is an AI. Don't share passwords or money details.</div>
    <div id="aic-list" aria-live="polite"></div>
    <div id="aic-form"><input id="aic-input" placeholder="Message ${NAME}…" maxlength="500" autocomplete="off"><button id="aic-send" aria-label="Send">➤</button></div>`;
  document.body.appendChild(ov);

  function bubble(text, cls) {
    const b = document.createElement('div');
    b.className = 'aicb ' + cls;
    b.textContent = text;
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
    busy = true; input.value = '';
    hist.push({ role: 'user', content: text }); save();
    bubble(text, 'me');
    let dots = typing();
    const started = Date.now();
    try {
      const res = await fetch(API_URL + '/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ messages: hist.slice(-20) })
      });
      if (typeof handleAuthFailure === 'function' && handleAuthFailure(res.status)) { dots.remove(); busy = false; return; }
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Something went wrong');
      const parts = String(data.reply).split(/\n\s*\n+/).map(s => s.trim()).filter(Boolean).slice(0, 3);
      for (let i = 0; i < parts.length; i++) {
        // like a person typing: a pause that grows with the length of what she is about to send
        const delay = Math.min(2600, 600 + parts[i].length * 28) - (i === 0 ? Date.now() - started : 0);
        if (delay > 0) await wait(delay);
        dots.remove();
        bubble(parts[i], 'bot');
        hist.push({ role: 'assistant', content: parts[i] });
        if (i < parts.length - 1) { await wait(350); dots = typing(); }
      }
      save();
    } catch (err) {
      dots.remove();
      bubble(err.message, 'sys');
    }
    busy = false;
    $('aic-input').focus();
  }

  $('aic-send').onclick = send;
  $('aic-input').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); send(); } });
  $('aic-back').onclick = () => { ov.style.display = 'none'; };
  $('aic-clear').onclick = () => { if (confirm('Clear this chat with ' + NAME + '?')) { hist = []; save(); open(); } };
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
