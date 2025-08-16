const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Guardamos salas y estados
let rooms = {};

io.on('connection', (socket) => {
    console.log('Nuevo cliente conectado:', socket.id);

    // Unirse a una sala
    socket.on('joinRoom', ({ room, username }) => {
        socket.join(room);
        if (!rooms[room]) rooms[room] = { players: {}, ready: {} };
        rooms[room].players[socket.id] = username;
        rooms[room].ready[socket.id] = false;

        console.log(`Jugador ${username} se unió a la sala ${room}`);
    });

    // Indica que el jugador está listo
    socket.on('ready', ({ room }) => {
        if (!rooms[room]) return;
        rooms[room].ready[socket.id] = true;

        // Verificamos si todos los jugadores están listos
        const allReady = Object.values(rooms[room].ready).every(v => v);
        if (allReady) {
            console.log(`Sala ${room}: ambos jugadores listos. Iniciando conteo...`);
            io.to(room).emit('startCountdown');
        } else {
            socket.emit('waiting', { message: 'Esperando a tu rival...' });
        }
    });

    // Recibir estadísticas de un jugador y reenviar al otro
    socket.on('updateStats', ({ room, stats }) => {
        socket.to(room).emit('opponentStats', { stats });
    });

    // Manejo de desconexión
    socket.on('disconnect', () => {
        for (let room in rooms) {
            if (rooms[room].players[socket.id]) {
                console.log(`Jugador ${rooms[room].players[socket.id]} se desconectó de la sala ${room}`);
                delete rooms[room].players[socket.id];
                delete rooms[room].ready[socket.id];
            }
        }
    });
});

server.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
});

