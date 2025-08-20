const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const PORT = process.env.PORT || 3000;

// ===== 5 SALAS FIJAS =====
const MAX_PLAYERS_PER_ROOM = 2;
const FIXED_ROOMS = ['room1', 'room2', 'room3', 'room4', 'room5'];
const rooms = {}; 
// rooms = { roomId: { players: [{id: socketId, name: 'Usuario'}], ready: {socketId: true/false} } }

// Inicializamos las 5 salas
FIXED_ROOMS.forEach(r => {
    rooms[r] = { players: [], ready: {} };
});

io.on('connection', (socket) => {

    socket.on('joinRoom', ({ userName }) => {
        // Buscar la primera sala disponible
        const availableRoom = FIXED_ROOMS.find(r => rooms[r].players.length < MAX_PLAYERS_PER_ROOM);

        if (!availableRoom) {
            socket.emit('waiting', { message: 'Todas las salas están llenas. Intenta más tarde.' });
            return;
        }

        socket.join(availableRoom);
        rooms[availableRoom].players.push({ id: socket.id, name: userName });
        rooms[availableRoom].ready[socket.id] = false;

        // Avisar al jugador
        if (rooms[availableRoom].players.length === 2) {
            const [player1, player2] = rooms[availableRoom].players;
            io.to(player1.id).emit('waiting', { message: `Tu rival ${player2.name} está conectado, esperando inicio...` });
            io.to(player2.id).emit('waiting', { message: `Tu rival ${player1.name} está conectado, esperando inicio...` });
        } else {
            socket.emit('waiting', { message: 'Esperando a que se conecte tu rival...' });
        }

        // Guardar la sala asignada en el socket
        socket.data.room = availableRoom;
    });

    socket.on('playerReady', () => {
        const room = socket.data.room;
        if (!room) return;

        rooms[room].ready[socket.id] = true;

        // Comprobar si ambos están listos
        const allReady = rooms[room].players.every(p => rooms[room].ready[p.id]);
        if (allReady) {
            io.to(room).emit('startCountdown', { message: '¡Ambos listos! Inicia el conteo...' });

            // Reiniciar ready para la siguiente partida
            for (const id in rooms[room].ready) rooms[room].ready[id] = false;
        }
    });

    socket.on('sendResultsToRival', (data) => {
        const room = socket.data.room;
        if (!room) return;
        socket.to(room).emit('receiveRivalResults', {
            results: data.results,
            name: data.name
        });
    });

    socket.on('updateStats', (data) => {
        const room = socket.data.room;
        if (!room) return;
        socket.to(room).emit('opponentStats', { stats: data.stats, name: data.name });
    });

    socket.on('disconnect', () => {
        const room = socket.data.room;
        if (!room || !rooms[room]) return;

        const player = rooms[room].players.find(p => p.id === socket.id);
        if (player) {
            rooms[room].players = rooms[room].players.filter(p => p.id !== socket.id);
            delete rooms[room].ready[socket.id];

            socket.to(room).emit('opponentLeft', { message: `${player.name} se ha desconectado.` });
        }
    });

});

server.listen(PORT, () => {
    console.log(`Servidor PVP corriendo en puerto ${PORT}`);
});
