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

/* 3D Fortress launcher (the old 2D Shadow Dimension game was removed) */
window.openFortress=function(){
  if(document.getElementById('fortress-frame'))return;
  const f=document.createElement('iframe');f.id='fortress-frame';f.src='/fortress.html';f.allow='fullscreen';
  f.style.cssText='position:fixed;inset:0;width:100%;height:100%;border:0;z-index:2147483000;background:#000';
  document.body.appendChild(f);f.addEventListener('load',()=>{try{f.contentWindow.focus()}catch(x){}});f.focus();
  const off=m=>{if(m.data==='fortress-exit'){f.remove();removeEventListener('message',off)}};addEventListener('message',off);
};




