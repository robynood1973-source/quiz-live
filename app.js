const socket=io();
const $=id=>document.getElementById(id);
const sections=["home","hostSetup","joinSetup","tvSetup","game"];
let role="",roomCode="",latestState=null,answered=false;
function show(id){sections.forEach(s=>$(s).classList.toggle("hidden",s!==id));}
function toast(msg){$("toast").textContent=msg;$("toast").style.display="block";setTimeout(()=>$("toast").style.display="none",3000);}
$("hostBtn").onclick=()=>show("hostSetup");$("joinBtn").onclick=()=>show("joinSetup");$("tvBtn").onclick=()=>show("tvSetup");
document.querySelectorAll(".back").forEach(b=>b.onclick=()=>show("home"));
$("createBtn").onclick=()=>{role="host";socket.emit("createRoom",{maxPlayers:$("maxPlayers").value,questionSeconds:$("seconds").value});};
$("joinSubmit").onclick=()=>{role="player";socket.emit("joinRoom",{code:$("joinCode").value,name:$("playerName").value});};
$("tvSubmit").onclick=()=>{role="tv";roomCode=$("tvCode").value.toUpperCase();socket.emit("watchRoom",{code:roomCode});};
socket.on("roomCreated",({code})=>{roomCode=code;show("game");renderHostLobby();});
socket.on("joined",({code,name})=>{roomCode=code;show("game");$("game").innerHTML=`<h2>Sei dentro, ${escapeHtml(name)}!</h2><div class="code">${code}</div><p class="status">Guarda la TV e aspetta che il presentatore inizi.</p>`;});
socket.on("joinError",toast);
socket.on("answerResult",r=>toast(r.correct?"Risposta esatta!":"Risposta sbagliata"));
socket.on("state",s=>{latestState=s;if(role==="tv")renderTV(s);else if(role==="host")renderHost(s);else if(role==="player")renderPlayer(s);});
socket.on("hostLeft",()=>{toast("Il presentatore ha chiuso la partita.");show("home");});
function renderHostLobby(){ $("game").innerHTML=`<h2>Lobby · Codice partita</h2><div class="code">${roomCode}</div><p class="status">Gli ospiti entrano da quizlive e inseriscono il codice.</p><div id="players"></div><button class="primary" id="start">Avvia 20 domande</button>`; }
function renderHost(s){
  if(s.status==="lobby"){
    if(!$("start"))renderHostLobby();
    $("players").innerHTML=s.players.map(p=>`<div class="rank">${escapeHtml(p.name)}<span>Pronto</span></div>`).join("")||"<p class='status'>In attesa dei giocatori…</p>";
    $("start").onclick=()=>socket.emit("startGame");return;
  }
  let html=`<div class="topline"><span>Partita ${s.code}</span><span>Domanda ${Math.max(1,s.questionIndex+1)} / ${s.total}</span><span>Risposte ${s.answerCount}/${s.playerCount}</span></div>`;
  if(s.status==="question")html+=`<div class="bigQuestion">${escapeHtml(s.question.q)}</div><p class="status">La domanda è visibile sulla TV. Le risposte arrivano dai telefoni.</p><button class="primary" id="reveal">Mostra risposta</button>`;
  else if(s.status==="reveal")html+=`<h2 class="bigQuestion">Risposta corretta: ${escapeHtml(s.question.a[s.reveal])}</h2><div class="controls"><button class="primary" id="next">${s.questionIndex===s.total-1?"Classifica finale":"Prossima domanda"}</button></div>`;
  else html+=`<h1>Partita terminata!</h1><h2>Classifica finale</h2>${rankHtml(s.leaderboard)}`;
  $("game").innerHTML=html;
  if($("reveal"))$("reveal").onclick=()=>socket.emit("showAnswer");
  if($("next"))$("next").onclick=()=>socket.emit("nextQuestion");
}
function renderPlayer(s){
  if(s.status==="lobby")return;
  if(s.status==="question"){
    if(answered)return;
    answered=false;
    $("game").innerHTML=`<div class="topline"><span>Domanda ${s.questionIndex+1}/${s.total}</span><span>${s.answerCount} risposte inviate</span></div><div class="bigQuestion">${escapeHtml(s.question.q)}</div><div class="answers">${s.question.a.map((a,i)=>`<button class="answer" data-choice="${i}">${escapeHtml(a)}</button>`).join("")}</div><p class="status">Scegli una risposta. Dopo l'invio non potrai modificarla.</p>`;
    document.querySelectorAll("[data-choice]").forEach(b=>b.onclick=()=>{if(answered)return;answered=true;document.querySelectorAll("[data-choice]").forEach(x=>x.disabled=true);socket.emit("answer",{choice:Number(b.dataset.choice)});$("game").innerHTML=`<h2 class="bigQuestion">Risposta inviata!</h2><p class="status">Aspetta la classifica sulla TV.</p>`;});
  }else if(s.status==="reveal"){$("game").innerHTML=`<h2 class="bigQuestion">Risposta corretta</h2><p class="status">Guarda la TV per sapere il punteggio.</p>`;answered=false;}
  else $("game").innerHTML=`<h1>Quiz terminato!</h1><p>Grazie per aver giocato.</p>${rankHtml(s.leaderboard)}`;
}
function renderTV(s){
  document.body.classList.add("tvMode");
  if(s.status==="lobby"){$("game").innerHTML=`<div class="topline"><span>QUIZ LIVE</span><span>${s.playerCount} giocatori</span></div><h1 class="bigQuestion">Scansiona il QR o inserisci il codice</h1><div class="code">${s.code}</div><p class="status">quizlive · In attesa del presentatore</p><div class="tiles">${s.players.map(p=>`<div class="rank">${escapeHtml(p.name)}<span>Pronto</span></div>`).join("")}</div>`;show("game");return;}
  let html=`<div class="topline"><span>QUIZ LIVE</span><span>DOMANDA ${Math.min(s.questionIndex+1,s.total)} / ${s.total}</span><span>Giocatori: ${s.playerCount}</span></div>`;
  if(s.status==="question")html+=`<div class="bigQuestion">${escapeHtml(s.question.q)}</div><div class="answers">${s.question.a.map((a,i)=>`<div class="answer">${["🔴","🔵","🟢","🟡"][i]} &nbsp; ${escapeHtml(a)}</div>`).join("")}</div><p class="status">${s.answerCount} / ${s.playerCount} hanno risposto</p>`;
  else if(s.status==="reveal")html+=`<h2 class="bigQuestion">La risposta è…</h2><div class="answer" style="background:#269c72;text-align:center">${escapeHtml(s.question.a[s.reveal])}</div><h2>Classifica provvisoria</h2>${rankHtml(s.leaderboard)}`;
  else html+=`<h1>🏆 Quiz terminato!</h1><h2>Classifica finale</h2>${rankHtml(s.leaderboard)}`;
  $("game").innerHTML=html;show("game");
}
function rankHtml(list){return `<div>${list.map((p,i)=>`<div class="rank"><span>${i+1}. ${escapeHtml(p.name)}</span><span>${p.score} pt</span></div>`).join("")||"<p>Nessun giocatore</p>"}</div>`;}
function escapeHtml(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
