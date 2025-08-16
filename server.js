// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*', // Permitir cualquier origen por simplicidad
        methods: ['GET', 'POST']
    }
});

const PORT = process.env.PORT || 3000;

let waitingPlayers = []; // Cola de espera de jugadores

// Map de room -> { player1, player2 }
let rooms = {};

io.on('connection', (socket) => {
    console.log(`Jugador conectado: ${socket.id}`);

    // Añadir a la cola
    waitingPlayers.push(socket.id);

    // Si hay al menos dos jugadores, emparejarlos
    if (waitingPlayers.length >= 2) {
        const player1 = waitingPlayers.shift();
        const player2 = waitingPlayers.shift();
        const room = `room-${Date.now()}`;

        rooms[room] = { player1, player2 };

        // Unir a cada jugador a la sala
        io.sockets.sockets.get(player1).join(room);
        io.sockets.sockets.get(player2).join(room);

        // Avisar a cada jugador que la partida inicia
        io.to(player1).emit('start', { room, message: '¡Partida iniciada! Tienes un rival.' });
        io.to(player2).emit('start', { room, message: '¡Partida iniciada! Tienes un rival.' });
    } else {
        // Si no hay rival, avisar que está en espera
        socket.emit('waiting', { message: 'Esperando contrincante...' });
    }

    // Escuchar estadísticas de un jugador y enviarlas al rival
    socket.on('updateStats', (data) => {
        const room = data.room;
        if (!rooms[room]) return;

        const { player1, player2 } = rooms[room];
        const rivalId = socket.id === player1 ? player2 : player1;

        io.to(rivalId).emit('opponentStats', {
            stats: data.stats
        });
    });

    // Manejar desconexión
    socket.on('disconnect', () => {
        console.log(`Jugador desconectado:
