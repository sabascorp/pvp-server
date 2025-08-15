const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" }
});

let waitingPlayer = null;

io.on('connection', (socket) => {
  console.log('Jugador conectado:', socket.id);

  // Emparejar jugadores
  if (!waitingPlayer) {
    waitingPlayer = socket;
    socket.emit('waiting', { message: 'Esperando contrincante...' });
  } else {
    const roomName = `room-${waitingPlayer.id}-${socket.id}`;
    socket.join(roomName);
    waitingPlayer.join(roomName);

    io.to(roomName).emit('start', { message: '¡Partida iniciada!', room: roomName });

    waitingPlayer = null;
  }

  // Escuchar estadísticas
  socket.on('updateStats', (data) => {
    if (data.room) {
      socket.to(data.room).emit('opponentStats', data);
    }
  });

  socket.on('disconnect', () => {
    console.log('Jugador desconectado:', socket.id);
    if (waitingPlayer && waitingPlayer.id === socket.id) {
      waitingPlayer = null;
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor PVP corriendo en puerto ${PORT}`);
});
