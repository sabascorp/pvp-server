const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*' }
});

const PORT = process.env.PORT || 3000;

/**
 * rooms = {
 *   roomId: {
 *     players: [{ id: socketId, name: 'Usuario' }],
 *     ready: { socketId: true/false }
 *   }
 * }
 */
const rooms = {};

io.on('connection', (socket) => {
    // Unirse a una sala con nombre de usuario
    socket.on('joinRoom', ({ room, userName }) => {
        socket.join(room);

        if (!rooms[room]) rooms[room] = { players: [], ready: {} };
        rooms[room].players.push({ id: socket.id, name: userName });
        rooms[room].ready[socket.id] = false;

        const numPlayers = rooms[room].players.length;

        if (numPlayers === 2) {
            // Avisar rival a cada uno INMEDIATAMENTE
            const [p1, p2] = rooms[room].players;
            io.to(p1.id).emit('opponentInfo', { opponent: p2.name });
            io.to(p2.id).emit('opponentInfo', { opponent: p1.name });

            // Mensaje de estado
            io.to(room).emit('waiting', { message: 'Ambos jugadores conectados. Esperando que estén listos...' });
        } else {
            io.to(socket.id).emit('waiting', { message: 'Esperando contrincante...' });
        }
    });

    // Jugador marca "listo"
    socket.on('playerReady', ({ room }) => {
        if (!rooms[room]) return;

        rooms[room].ready[socket.id] = true;

        // ¿Están ambos listos?
        const allReady =
            rooms[room].players.length === 2 &&
            rooms[room].players.every(p => rooms[room].ready[p.id]);

        // Cuando ambos estén listos, se dispara la cuenta regresiva sincronizada
        if (allReady) {
            io.to(room).emit('startCountdown', { seconds: 5 });
        }
    });

    // Stats de un jugador: reenviar solo al rival
    socket.on('updateStats', (data) => {
        // data = { room, name, stats }
        socket.to(data.room).emit('opponentStats', { name: data.name, stats: data.stats });
    });

    // Limpieza al desconectar
    socket.on('disconnect', () => {
        for (const room in rooms) {
            const r = rooms[room];
            if (!r) continue;

            // quitar jugador
            r.players = r.players.filter(p => p.id !== socket.id);
            delete r.ready[socket.id];

            // avisar al que quede
            io.to(room).emit('waiting', { message: 'Un jugador se desconectó. Esperando rival...' });

            // Si la sala queda vacía, limpiarla
            if (r.players.length === 0) {
                delete rooms[room];
            }
        }
    });
});

server.listen(PORT, () => {
    console.log(`Servidor PVP corriendo en puerto ${PORT}`);
});
