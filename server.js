const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*"
    }
});

const rooms = {};

io.on('connection', (socket) => {
    console.log('Un jugador se ha conectado:', socket.id);

    socket.on('joinRoom', ({ room, name }) => {
        socket.join(room);

        if (!rooms[room]) {
            rooms[room] = { players: [], readyCount: 0 };
        }

        rooms[room].players.push({ id: socket.id, name });
        const numPlayers = rooms[room].players.length;

        if (numPlayers === 2) {
            // Ambos jugadores conectados → enviar info de rival de inmediato
            const [p1, p2] = rooms[room].players;
            io.to(p1.id).emit('opponentInfo', { opponent: p2.name });
            io.to(p2.id).emit('opponentInfo', { opponent: p1.name });

            // Mensaje de espera hasta que ambos den iniciar
            io.to(room).emit('waiting', { message: 'Ambos jugadores conectados. Esperando que estén listos...' });
        } else {
            io.to(socket.id).emit('waiting', { message: 'Esperando contrincante...' });
        }
    });

    socket.on('ready', ({ room }) => {
        if (!rooms[room]) return;

        rooms[room].readyCount++;

        if (rooms[room].readyCount === 2) {
            let countdown = 3;
            const countdownInterval = setInterval(() => {
                io.to(room).emit('countdown', { countdown });
                countdown--;

                if (countdown < 0) {
                    clearInterval(countdownInterval);
                    io.to(room).emit('startGame', { message: '¡Comienza el juego!' });
                }
            }, 1000);
        }
    });

    socket.on('playerAnswer', ({ room, player, answer }) => {
        socket.to(room).emit('opponentAnswer', { player, answer });
    });

    socket.on('statsUpdate', ({ room, stats }) => {
        socket.to(room).emit('opponentStats', { stats });
    });

    socket.on('disconnect', () => {
        console.log('Jugador desconectado:', socket.id);

        for (const room in rooms) {
            rooms[room].players = rooms[room].players.filter(p => p.id !== socket.id);

            if (rooms[room].players.length === 0) {
                delete rooms[room];
            } else {
                io.to(room).emit('waiting', { message: 'Tu oponente se desconectó. Esperando nuevo jugador...' });
            }
        }
    });
});

server.listen(3000, () => {
    console.log('Servidor corriendo en http://localhost:3000');
});
