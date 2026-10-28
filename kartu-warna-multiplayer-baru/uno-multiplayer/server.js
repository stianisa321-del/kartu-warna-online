const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;
app.use(express.static("public"));

const rooms = new Map();
const COLORS = ["red", "blue", "green", "yellow"];
const VALUES = ["0","1","2","3","4","5","6","7","8","9","Skip","Reverse","+2"];
const uid = () => crypto.randomBytes(5).toString("hex");
const shuffle = a => { for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; };
function makeDeck() {
  const d=[];
  for(const color of COLORS) {
    d.push({id:uid(),color,value:"0"});
    for(let n=1;n<=9;n++){d.push({id:uid(),color,value:String(n)},{id:uid(),color,value:String(n)});}
    for(const value of ["Skip","Reverse","+2"]) d.push({id:uid(),color,value},{id:uid(),color,value});
  }
  for(let i=0;i<4;i++){d.push({id:uid(),color:"wild",value:"Wild"},{id:uid(),color:"wild",value:"+4"});}
  return shuffle(d);
}
function top(room){return room.discard[room.discard.length-1];}
function current(room){return room.players[room.turn];}
function activeColor(room){return room.chosenColor || top(room).color;}
function legal(room, card) {
  const t=top(room);
  return card.color==="wild" || card.color===activeColor(room) || card.value===t.value;
}
function drawOne(room, player) {
  if(!room.deck.length && room.discard.length>1) {
    const t=room.discard.pop(); room.deck=shuffle(room.discard); room.discard=[t];
  }
  if(room.deck.length) player.hand.push(room.deck.pop());
}
function publicState(room, socketId) {
  const me=room.players.find(p=>p.id===socketId);
  return {
    code:room.code, status:room.status, hostId:room.hostId, turn:room.turn,
    direction:room.direction, chosenColor:room.chosenColor,
    top:top(room), deckCount:room.deck.length,
    players:room.players.map(p=>({id:p.id,name:p.name,count:p.hand.length,host:p.id===room.hostId})),
    hand:me ? me.hand : [], winner:room.winner,
    message:room.message || ""
  };
}
function broadcast(room) {
  for(const p of room.players) io.to(p.id).emit("state",publicState(room,p.id));
}
function announce(room, text) { room.message=text; broadcast(room); }
function startGame(room) {
  room.deck=makeDeck(); room.discard=[]; room.turn=0; room.direction=1;
  room.chosenColor=null; room.winner=null; room.status="playing";
  room.players.forEach(p=>p.hand=[]);
  for(let i=0;i<7;i++) room.players.forEach(p=>drawOne(room,p));
  let first=room.deck.pop();
  while(first.color==="wild"){room.deck.unshift(first); first=room.deck.pop();}
  room.discard.push(first);
  room.message="Permainan dimulai! Cocokkan warna atau angka kartu.";
  broadcast(room);
}
function next(room, steps=1) {
  room.turn=(room.turn+room.direction*steps+room.players.length*2)%room.players.length;
}
function applyPlay(room, player, cardId, chosenColor) {
  if(room.status!=="playing") return {error:"Permainan belum dimulai atau sudah selesai."};
  const p=current(room);
  if(!p || p.id!==player.id) return {error:"Belum giliranmu."};
  const idx=p.hand.findIndex(c=>c.id===cardId);
  if(idx<0) return {error:"Kartu tidak ditemukan."};
  const card=p.hand[idx];
  if(!legal(room,card)) return {error:"Kartu tidak cocok dengan warna atau angka di meja."};
  if(card.color==="wild" && !COLORS.includes(chosenColor)) return {error:"Pilih warna untuk kartu Joker."};
  p.hand.splice(idx,1); room.discard.push(card);
  room.chosenColor=card.color==="wild"?chosenColor:null;
  let skip=0, draw=0;
  if(card.value==="Skip") skip=1;
  if(card.value==="Reverse") {room.direction*=-1; if(room.players.length===2) skip=1;}
  if(card.value==="+2"){skip=1;draw=2;}
  if(card.value==="+4"){skip=1;draw=4;}
  if(p.hand.length===0) {
    room.status="finished"; room.winner=p.id; room.message=`${p.name} menang!`; broadcast(room); return {};
  }
  next(room);
  if(draw) { const target=current(room); for(let i=0;i<draw;i++)drawOne(room,target); }
  if(skip) next(room);
  room.message=`${p.name} memainkan ${card.value==="Wild"?"Joker":card.value}${card.color==="wild"?" dan memilih "+chosenColor:""}.`;
  broadcast(room); return {};
}
io.on("connection", socket=>{
  socket.on("createRoom", ({name}, cb)=>{
    name=String(name||"Pemain").trim().slice(0,18)||"Pemain";
    let code; do {code=crypto.randomBytes(3).toString("hex").toUpperCase();} while(rooms.has(code));
    const room={code,hostId:socket.id,status:"lobby",players:[{id:socket.id,name,hand:[]}],deck:[],discard:[],turn:0,direction:1,chosenColor:null,winner:null,message:"Bagikan kode ruangan kepada temanmu."};
    rooms.set(code,room); socket.join(code); cb?.({ok:true,code}); broadcast(room);
  });
  socket.on("joinRoom", ({name,code}, cb)=>{
    code=String(code||"").trim().toUpperCase(); name=String(name||"Pemain").trim().slice(0,18)||"Pemain";
    const room=rooms.get(code);
    if(!room) return cb?.({ok:false,error:"Kode ruangan tidak ditemukan."});
    if(room.status!=="lobby") return cb?.({ok:false,error:"Permainan sudah dimulai."});
    if(room.players.length>=4) return cb?.({ok:false,error:"Ruangan sudah penuh (maksimal 4 pemain)."});
    if(room.players.some(p=>p.id===socket.id)) return cb?.({ok:true,code});
    room.players.push({id:socket.id,name,hand:[]}); socket.join(code);
    room.message=`${name} bergabung ke ruangan.`; cb?.({ok:true,code}); broadcast(room);
  });
  socket.on("startGame", ({code}, cb)=>{
    const room=rooms.get(String(code||"").toUpperCase());
    if(!room) return cb?.({ok:false,error:"Ruangan tidak ditemukan."});
    if(room.hostId!==socket.id) return cb?.({ok:false,error:"Hanya host yang bisa memulai."});
    if(room.players.length<2) return cb?.({ok:false,error:"Butuh minimal 2 pemain."});
    startGame(room); cb?.({ok:true});
  });
  socket.on("playCard", ({code,cardId,color}, cb)=>{
    const room=rooms.get(String(code||"").toUpperCase());
    if(!room) return cb?.({ok:false,error:"Ruangan tidak ditemukan."});
    const result=applyPlay(room,room.players.find(p=>p.id===socket.id)||{},cardId,color);
    if(result.error) return cb?.({ok:false,error:result.error});
    cb?.({ok:true});
  });
  socket.on("drawCard", ({code}, cb)=>{
    const room=rooms.get(String(code||"").toUpperCase());
    if(!room || room.status!=="playing") return cb?.({ok:false,error:"Permainan tidak aktif."});
    const p=current(room);
    if(!p || p.id!==socket.id) return cb?.({ok:false,error:"Belum giliranmu."});
    drawOne(room,p); next(room); room.message=`${p.name} mengambil satu kartu dan melewatkan giliran.`;
    broadcast(room); cb?.({ok:true});
  });
  socket.on("disconnect",()=>{
    for(const [code,room] of rooms) {
      const idx=room.players.findIndex(p=>p.id===socket.id);
      if(idx<0) continue;
      const [gone]=room.players.splice(idx,1);
      if(!room.players.length){rooms.delete(code);continue;}
      if(room.hostId===socket.id) room.hostId=room.players[0].id;
      if(room.status==="playing" && idx<room.turn) room.turn--;
      if(room.status==="playing" && room.turn>=room.players.length) room.turn=0;
      room.message=`${gone.name} terputus dari permainan.`;
      broadcast(room);
    }
  });
});
server.listen(PORT,()=>console.log(`UNO multiplayer listening on ${PORT}`));
