const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*' }
});

const PORT = process.env.PORT || 3000;

const rooms = {}; 
// rooms = { roomId: { players: [{id: socketId, name: 'Usuario'}], ready: {socketId: true/false}, reset: {socketId: true/false} } }

io.on('connection', (socket) => {

    socket.on('joinRoom', ({ room, userName }) => {
        socket.join(room);
        if (!rooms[room]) rooms[room] = { players: [], ready: {}, reset: {} };
        rooms[room].players.push({ id: socket.id, name: userName });
        rooms[room].ready[socket.id] = false;
        rooms[room].reset[socket.id] = false;

        if (rooms[room].players.length === 2) {
            io.to(room).emit('waiting', { message: 'Ambos jugadores conectados. Esperando que estén listos...' });
        } else {
            io.to(socket.id).emit('waiting', { message: 'Esperando contrincante...' });
        }
    });

    socket.on('playerReady', ({ room }) => {
        if (rooms[room]) {
            rooms[room].ready[socket.id] = true;

            const allReady = rooms[room].players.every(p => rooms[room].ready[p.id]);
            if (allReady) {
                io.to(room).emit('startCountdown', { message: '¡Comienza la cuenta regresiva de 5 segundos!' });
            }
        }
    });

    socket.on('playerReset', ({ room }) => {
        if (rooms[room]) {
            rooms[room].reset[socket.id] = true;
            rooms[room].ready[socket.id] = false; // Resetear el ready para la nueva partida

            const allReset = rooms[room].players.every(p => rooms[room].reset[p.id]);
            if (allReset) {
                // Avisar a ambos jugadores que pueden volver a presionar "Iniciar"
                io.to(room).emit('resetComplete', { message: 'Ambos jugadores listos para reiniciar. Pulsa Iniciar nuevamente.' });
            }
        }
    });

    socket.on('updateStats', (data) => {
        socket.to(data.room).emit('opponentStats', { stats: data.stats, name: data.name });
    });

    socket.on('disconnect', () => {
        for (const room in rooms) {
            rooms[room].players = rooms[room].players.filter(p => p.id !== socket.id);
            delete rooms[room].ready[socket.id];
            delete rooms[room].reset[socket.id];
        }
    });

});

server.listen(PORT, () => {
    console.log(`Servidor PVP corriendo en puerto ${PORT}`);
});
