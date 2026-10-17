import http from 'node:http';
import {randomBytes} from 'node:crypto';
import {WebSocketServer,WebSocket} from 'ws';
export function startRelay(port=Number(process.env.PORT||8787),host='0.0.0.0'){
 const rooms=new Map(),ips=new Map();const server=http.createServer((req,res)=>{res.writeHead(req.url==='/health'?200:404,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify({service:'umbral-relay',protocol:5,ready:true}));});
 const wss=new WebSocketServer({server,maxPayload:16000,perMessageDeflate:false});
 const send=(socket,text)=>{if(socket.readyState===WebSocket.OPEN){if(socket.bufferedAmount>256000){socket.close(1013,'Slow connection');return;}socket.send(text);}};
 const fail=(socket,text)=>{send(socket,'ERROR|'+text);socket.close(1008);};
 wss.on('connection',(socket,request)=>{const ip=request.socket.remoteAddress;const count=(ips.get(ip)||0)+1;ips.set(ip,count);let room,code='',isHost=false,identity='',windowAt=Date.now(),messages=0,bytes=0;socket.alive=true;
  socket.once('close',()=>ips.set(ip,Math.max(0,(ips.get(ip)||1)-1)));const handshake=setTimeout(()=>fail(socket,'Tiempo de conexión agotado'),8000);if(count>16){fail(socket,'Demasiadas conexiones');return;}
  socket.on('error',()=>{});socket.on('pong',()=>socket.alive=true);
  socket.on('message',(raw,binary)=>{if(binary)return fail(socket,'Usa mensajes de texto');const text=raw.toString();const a=text.split('|');const now=Date.now();if(now-windowAt>1000){windowAt=now;messages=0;bytes=0;}messages++;bytes+=raw.length;if(messages>120||bytes>150000)return fail(socket,'Límite de tráfico excedido');
   if(!room){if(a[0]==='CREATE'&&a[1]==='05'){if(rooms.size>=200)return fail(socket,'Servidor lleno');do{code=randomBytes(5).toString('hex').slice(0,8).toUpperCase();}while(rooms.has(code));room={host:socket,peers:new Set([socket]),identities:new Map()};rooms.set(code,room);isHost=true;}
    else if(a[0]==='JOIN'&&/^[A-F0-9]{8}$/.test(a[1]||'')){code=a[1];room=rooms.get(code);if(!room)return fail(socket,'La sala no existe o ha terminado');if(room.peers.size>=4){room=null;return fail(socket,'La sala está llena');}room.peers.add(socket);}else return fail(socket,'Versión o código de sala inválido');clearTimeout(handshake);send(socket,'WELCOME|'+code);return;}
   if(!isHost&&!['P','V','R','M','I'].includes(a[0]))return;
   if(['P','V','R','M','I'].includes(a[0])){if(a[0]==='P'&&!identity){if(!/^[a-zA-Z0-9]{1,16}$/.test(a[1]||'')||room.identities.has(a[1]))return fail(socket,'Identidad inválida');identity=a[1];room.identities.set(identity,socket);}if(!identity||a[1]!==identity)return;}
   for(const peer of room.peers)if(peer!==socket)send(peer,text);
  });
  socket.on('close',()=>{clearTimeout(handshake);if(!room)return;room.peers.delete(socket);if(identity)room.identities.delete(identity);if(isHost){rooms.delete(code);for(const peer of room.peers){send(peer,'ERROR|Se perdió la conexión con el anfitrión');peer.close(1001);}}});
 });
 const heartbeat=setInterval(()=>{for(const socket of wss.clients){if(!socket.alive){socket.terminate();continue;}socket.alive=false;socket.ping();}},15000);heartbeat.unref();
 server.listen(port,host,()=>console.log('UMBRAL_RELAY_LISTENING '+server.address().port));return {server,wss,close:()=>new Promise(resolve=>{clearInterval(heartbeat);for(const s of wss.clients)s.terminate();wss.close();server.close(resolve);})};
}
if(process.argv[1]&&new URL(import.meta.url).pathname.replace(/^\//,'').replaceAll('%20',' ')===process.argv[1].replaceAll('\\','/'))startRelay();
