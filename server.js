const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(express.static(path.join(__dirname, "public")));

const rooms = new Map();
const TOTAL_QUESTIONS = 20;
const QUESTIONS = [
  {q:"Qual è il pianeta più vicino al Sole?", a:["Venere","Mercurio","Marte","Terra"], correct:1},
  {q:"Quanti giorni ha un anno bisestile?", a:["364","365","366","367"], correct:2},
  {q:"Qual è la capitale della Francia?", a:["Lione","Marsiglia","Parigi","Nizza"], correct:2},
  {q:"Quale animale è conosciuto come il re della savana?", a:["Tigre","Leone","Elefante","Ghepardo"], correct:1},
  {q:"Quanti lati ha un esagono?", a:["5","6","7","8"], correct:1},
  {q:"Quale gas respirano principalmente gli esseri umani?", a:["Ossigeno","Elio","Idrogeno","Neon"], correct:0},
  {q:"In quale continente si trova il Brasile?", a:["Europa","Asia","Sud America","Africa"], correct:2},
  {q:"Qual è il risultato di 9 × 7?", a:["56","63","72","69"], correct:1},
  {q:"Quale strumento misura la temperatura?", a:["Barometro","Termometro","Anemometro","Igrometro"], correct:1},
  {q:"Quale mare bagna la costa orientale della Puglia?", a:["Tirreno","Adriatico","Ionio soltanto","Ligure"], correct:1},
  {q:"Qual è il simbolo chimico dell'acqua?", a:["CO2","O2","H2O","NaCl"], correct:2},
  {q:"Quante ore ci sono in due giorni?", a:["24","36","48","72"], correct:2},
  {q:"Quale di questi è un mammifero?", a:["Squalo","Delfino","Trota","Polpo"], correct:1},
  {q:"Quale stagione viene dopo l'estate?", a:["Primavera","Inverno","Autunno","Estate"], correct:2},
  {q:"Qual è la lingua ufficiale del Brasile?", a:["Spagnolo","Portoghese","Francese","Inglese"], correct:1},
  {q:"Quale colore si ottiene mescolando blu e giallo?", a:["Viola","Arancione","Verde","Marrone"], correct:2},
  {q:"Quanti minuti ci sono in un'ora e mezza?", a:["60","75","90","120"], correct:2},
  {q:"Quale città è famosa per la Torre pendente?", a:["Pisa","Siena","Firenze","Lucca"], correct:0},
  {q:"Qual è il più grande oceano della Terra?", a:["Atlantico","Indiano","Artico","Pacifico"], correct:3},
  {q:"Quanti giocatori per squadra sono in campo in una partita di calcio?", a:["9","10","11","12"], correct:2}
];

function code() {
  return crypto.randomBytes(3).toString("hex").toUpperCase();
}
function publicState(room) {
  return {
    code: room.code,
    status: room.status,
    questionIndex: room.questionIndex,
    total: TOTAL_QUESTIONS,
    question: room.status === "question" ? QUESTIONS[room.questionIndex] : null,
    players: [...room.players.values()].map(p => ({id:p.id, name:p.name, score:p.score, answered:p.answered})),
    leaderboard: [...room.players.values()].map(p => ({name:p.name, score:p.score}))
      .sort((a,b)=>b.score-a.score).slice(0,10),
    answerCount: [...room.players.values()].filter(p=>p.answered).length,
    playerCount: room.players.size,
    reveal: room.status === "reveal" ? QUESTIONS[room.questionIndex].correct : null
  };
}
function broadcast(room) { io.to(room.code).emit("state", publicState(room)); }

io.on("connection", socket => {
  socket.on("createRoom", ({maxPlayers=50, questionSeconds=20}={}) => {
    let c = code();
    while (rooms.has(c)) c = code();
    const room = {code:c, host:socket.id, maxPlayers:Math.max(2,Math.min(200,Number(maxPlayers)||50)),
      questionSeconds:Math.max(5,Math.min(90,Number(questionSeconds)||20)), status:"lobby",
      questionIndex:-1, players:new Map(), timer:null, startedAt:0};
    rooms.set(c, room);
    socket.join(c);
    socket.data.room=c; socket.data.role="host";
    socket.emit("roomCreated", {code:c});
    broadcast(room);
  });

  socket.on("joinRoom", ({code, name}) => {
    code = String(code||"").trim().toUpperCase();
    name = String(name||"").trim().slice(0,18);
    const room = rooms.get(code);
    if (!room) return socket.emit("joinError","Codice partita non valido.");
    if (room.status !== "lobby") return socket.emit("joinError","La partita è già iniziata.");
    if (!name) return socket.emit("joinError","Inserisci un nome.");
    if (room.players.size >= room.maxPlayers) return socket.emit("joinError","La partita è piena.");
    const duplicate = [...room.players.values()].some(p=>p.name.toLowerCase()===name.toLowerCase());
    if (duplicate) return socket.emit("joinError","Questo nome è già utilizzato.");
    room.players.set(socket.id,{id:socket.id,name,score:0,answered:false});
    socket.join(code); socket.data.room=code; socket.data.role="player";
    socket.emit("joined",{code,name});
    broadcast(room);
  });

  socket.on("watchRoom", ({code}) => {
    code = String(code||"").trim().toUpperCase();
    const room=rooms.get(code);
    if (!room) return socket.emit("joinError","Codice partita non valido.");
    socket.join(code); socket.data.room=code; socket.data.role="tv";
    socket.emit("state",publicState(room));
  });

  socket.on("startGame", () => {
    const room=rooms.get(socket.data.room);
    if (!room || room.host!==socket.id || room.status!=="lobby") return;
    room.questionIndex=0;
    beginQuestion(room);
  });
  socket.on("nextQuestion", () => {
    const room=rooms.get(socket.data.room);
    if (!room || room.host!==socket.id || room.status!=="reveal") return;
    if (room.questionIndex>=TOTAL_QUESTIONS-1) {
      room.status="finished"; broadcast(room); return;
    }
    room.questionIndex++;
    beginQuestion(room);
  });
  socket.on("showAnswer", () => {
    const room=rooms.get(socket.data.room);
    if (!room || room.host!==socket.id || room.status!=="question") return;
    clearTimeout(room.timer); room.status="reveal"; broadcast(room);
  });
  socket.on("answer", ({choice}) => {
    const room=rooms.get(socket.data.room);
    if (!room || room.status!=="question") return;
    const p=room.players.get(socket.id);
    if (!p || p.answered) return;
    p.answered=true;
    const correct=Number(choice)===QUESTIONS[room.questionIndex].correct;
    if (correct) {
      const elapsed=(Date.now()-room.startedAt)/1000;
      const timeLeft=Math.max(0,room.questionSeconds-elapsed);
      p.score+=1000+Math.round(timeLeft*50);
    }
    socket.emit("answerResult",{correct,score:p.score});
    broadcast(room);
    if ([...room.players.values()].every(x=>x.answered)) {
      clearTimeout(room.timer); room.status="reveal"; broadcast(room);
    }
  });

  socket.on("disconnect", () => {
    const room=rooms.get(socket.data.room);
    if (!room) return;
    if (room.players.has(socket.id)) { room.players.delete(socket.id); broadcast(room); }
    if (room.host===socket.id) {
      clearTimeout(room.timer);
      io.to(room.code).emit("hostLeft");
      rooms.delete(room.code);
    }
  });
});

function beginQuestion(room) {
  room.status="question";
  room.startedAt=Date.now();
  for (const p of room.players.values()) p.answered=false;
  broadcast(room);
  clearTimeout(room.timer);
  room.timer=setTimeout(()=>{ if(room.status==="question"){room.status="reveal";broadcast(room);} },room.questionSeconds*1000);
}

const PORT=process.env.PORT||3000;
server.listen(PORT,()=>console.log(`Quiz Live attivo su http://localhost:${PORT}`));
