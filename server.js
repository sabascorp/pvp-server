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
// rooms = { roomId: { players: [{id: socketId, name: 'Usuario', finalStats}], ready: {socketId: true/false} } }

io.on('connection', (socket) => {

    socket.on('joinRoom', ({ room, userName }) => {
        socket.join(room);
        if (!rooms[room]) rooms[room] = { players: [], ready: {} };
        rooms[room].players.push({ id: socket.id, name: userName });
        rooms[room].ready[socket.id] = false;

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
                io.to(room).emit('startCountdown', { message: '¡Ambos listos! Inicia el conteo...' });
                for (const id in rooms[room].ready) rooms[room].ready[id] = false;
            }
        }
    });

    socket.on('updateStats', (data) => {
        socket.to(data.room).emit('opponentStats', { stats: data.stats, name: data.name });
    });

    // NUEVO: recibir stats finales de cada jugador
    socket.on('finishPractice', ({ room, stats }) => {
        if (!rooms[room]) return;
        const player = rooms[room].players.find(p => p.id === socket.id);
        if (!player) return;

        player.finalStats = stats;

        // Si ambos terminaron, calcular ganador
        if (rooms[room].players.every(p => p.finalStats)) {
            const [p1, p2] = rooms[room].players;
            let winner = null;
            if (p1.finalStats.correct > p2.finalStats.correct) winner = p1.name;
            else if (p2.finalStats.correct > p1.finalStats.correct) winner = p2.name;
            else winner = 'Empate';

            io.to(room).emit('gameOver', { winner, stats: { [p1.name]: p1.finalStats, [p2.name]: p2.finalStats } });

            // Limpiar para próxima partida
            rooms[room].players.forEach(p => delete p.finalStats);
        }
    });

    socket.on('disconnect', () => {
        for (const room in rooms) {
            const roomData = rooms[room];
            const player = roomData.players.find(p => p.id === socket.id);
            if (player) {
                roomData.players = roomData.players.filter(p => p.id !== socket.id);
                delete roomData.ready[socket.id];
                socket.to(room).emit('opponentLeft', { message: `${player.name} se ha desconectado.` });
                if (roomData.players.length === 0) delete rooms[room];
            }
        }
    });

});

server.listen(PORT, () => {
    console.log(`Servidor PVP corriendo en puerto ${PORT}`);
});
