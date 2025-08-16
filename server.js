// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Ajusta según tu dominio en producción
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

// Cola de jugadores esperando
let waitingPlayers = [];

// Guardar la info de cada sala
let rooms = {};

io.on('connection', (socket) => {
    console.log(`Nuevo jugador conectado: ${socket.id}`);

    socket.on('joinPVP', (data) => {
        const username = data.username;
        socket.username = username;

        if (waitingPlayers.length > 0) {
            // Emparejar con el primer jugador en la cola
            const opponentSocket = waitingPlayers.shift();
            const roomName = `room-${socket.id}-${opponentSocket.id}`;

            // Guardar la info de la sala
            rooms[roomName] = {
                players: [socket.id, opponentSocket.id],
                usernames: [username, opponentSocket.username]
            };

            // Unirse a la sala
            socket.join(roomName);
            opponentSocket.join(roomName);

            // Notificar a ambos jugadores
            socket.emit('start', { room: roomName, opponent: opponentSocket.username, message: 'Partida iniciada' });
            opponentSocket.emit('start', { room: roomName, opponent: username, message: 'Partida iniciada' });

            console.log(`Sala creada: ${roomName} entre ${username} y ${opponentSocket.username}`);
        } else {
            // No hay jugador esperando, se agrega a la cola
            waitingPlayers.push(socket);
            socket.emit('waiting', { message: 'Esperando un contrincante...' });
        }
    });

    socket.on('updateStats', (data) => {
        const roomName = data.room;
        if (!rooms[roomName]) return;

        // Enviar stats al otro jugador
        rooms[roomName].players.forEach(playerId => {
            if (playerId !== socket.id) {
                io.to(playerId).emit('opponentStats', { stats: data.stats });
            }
        });
    });

    socket.on('disconnect', () => {
        console.log(`Jugador desconectado: ${socket.id}`);
        // Quitar de la cola si estaba esperando
        waitingPlayers = waitingPlayers.filter(p => p.id !== socket.id);

        // Notificar a los jugadores de su sala si estaban en una
        for (const roomName in rooms) {
            if (rooms[roomName].players.includes(socket.id)) {
                rooms[roomName].players.forEach(playerId => {
                    if (playerId !== socket.id) {
                        io.to(playerId).emit('opponentStats', { stats: { correct: 0, wrong: 0, attempts: 0, effectiveness: 0 }, message: 'Tu rival se desconectó.' });
                    }
                });
                delete rooms[roomName];
            }
        }
    });
});

server.listen(PORT, () => {
    console.log(`Servidor PVP escuchando en puerto ${PORT}`);
});
