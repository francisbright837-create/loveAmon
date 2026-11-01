/* Replace `src` with your real video URLs. Cards without src show a placeholder visual. */
let videos=[
 {t:"Neon city, generated in 10 seconds",by:"@lmzy",cat:"Generated",a:"#ff4d8d",b:"#3b6cff",likes:128},
 {t:"How I prompt for cinematic shots",by:"@promptlab",cat:"Tutorials",a:"#ffb84d",b:"#ff4d8d",likes:76},
 {t:"AI painting turns into a short film",by:"@artbyai",cat:"AI art",a:"#37d6b0",b:"#3b6cff",likes:203},
 {t:"Fix your AI video flicker",by:"@clipcraft",cat:"Tutorials",a:"#9b6bff",b:"#37d6b0",likes:41},
 {t:"Dreamlike ocean loop",by:"@waves.ai",cat:"Generated",a:"#3bd0ff",b:"#9b6bff",likes:164}
];
const cats=["All","Generated","AI art","Tutorials"];
let cat="All";
const $=id=>document.getElementById(id);
function chips(){
  $("chips").innerHTML="";
  cats.forEach(c=>{
    const b=document.createElement("button");
    b.className="chip";b.textContent=c;b.setAttribute("aria-pressed",c===cat);
    b.onclick=()=>{cat=c;chips();render()};
    $("chips").appendChild(b);
  });
}
function esc(s){return s.replace(/[&<>"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]))}
function render(){
  const list=videos.filter(v=>cat==="All"||v.cat===cat);
  const f=$("feed");
  if(!list.length){f.innerHTML='<div class="empty">No videos in this category yet. Tap Upload to add the first one.</div>';return}
  f.innerHTML=list.map((v,i)=>`
   <section class="card" data-i="${i}">
     ${v.src?`<video src="${v.src}" loop muted playsinline></video>`:`<div class="art" style="--a:${v.a};--b:${v.b}"></div>`}
     <div class="badge">✨ AI-generated</div>
     <div class="info"><b>${esc(v.t)}</b><span>${esc(v.by)} · ${esc(v.cat)}</span></div>
     <div class="rail">
       <div><button aria-pressed="false" aria-label="Like" data-like>♥</button><small>${v.likes}</small></div>
       <div><button aria-label="Comment">💬</button><small>0</small></div>
       <div><button aria-label="Share" data-share>↗</button><small>Share</small></div>
     </div>
   </section>`).join("");
  f.querySelectorAll("[data-like]").forEach(b=>b.onclick=()=>{
    const on=b.getAttribute("aria-pressed")==="true";
    b.setAttribute("aria-pressed",!on);
    const s=b.parentNode.querySelector("small");s.textContent=+s.textContent+(on?-1:1);
  });
  f.querySelectorAll("[data-share]").forEach(b=>b.onclick=()=>{
    if(navigator.share)navigator.share({title:"AI video",url:location.href}).catch(()=>{});
  });
  const io=new IntersectionObserver(es=>es.forEach(e=>{
    const v=e.target.querySelector("video");if(!v)return;
    e.isIntersecting?v.play().catch(()=>{}):v.pause();
  }),{threshold:.7});
  f.querySelectorAll(".card").forEach(c=>io.observe(c));
}
chips();render();
