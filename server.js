const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*' }
});

const PORT = process.env.PORT || 3000;

// ===== 5 SALAS FIJAS =====
const rooms = {
    room1: { players: [], ready: {} },
    room2: { players: [], ready: {} },
    room3: { players: [], ready: {} },
    room4: { players: [], ready: {} },
    room5: { players: [], ready: {} },
};

io.on('connection', (socket) => {

    // ===== UNIRSE A UNA SALA =====
    socket.on('joinRoom', ({ userName }) => {
        // Buscar primera sala con menos de 2 jugadores
        let assignedRoom = null;
        for (const room in rooms) {
            if (rooms[room].players.length < 2) {
                assignedRoom = room;
                break;
            }
        }

        if (!assignedRoom) {
            socket.emit('waiting', { message: 'Todas las salas están llenas. Espera un momento...', room: null });
            return;
        }

        socket.join(assignedRoom);
        rooms[assignedRoom].players.push({ id: socket.id, name: userName });
        rooms[assignedRoom].ready[socket.id] = false;

        // Avisar al jugador sobre su sala
        socket.emit('waiting', { 
            message: `Te has unido a ${assignedRoom}. Esperando rival...`,
            room: assignedRoom 
        });

        // Avisar a los demás jugadores en la sala
        if (rooms[assignedRoom].players.length === 2) {
            const [player1, player2] = rooms[assignedRoom].players;
            io.to(player1.id).emit('waiting', { message: `Tu rival ${player2.name} está conectado, esperando inicio...`, room: assignedRoom });
            io.to(player2.id).emit('waiting', { message: `Tu rival ${player1.name} está conectado, esperando inicio...`, room: assignedRoom });
        }
    });

    // ===== JUGADOR LISTO =====
    socket.on('playerReady', ({ room }) => {
        if (room && rooms[room]) {
            rooms[room].ready[socket.id] = true;

            const allReady = rooms[room].players.every(p => rooms[room].ready[p.id]);
            if (allReady) {
                io.to(room).emit('startCountdown', { message: '¡Ambos listos! Inicia el conteo...' });

                // Reiniciar ready para próxima partida
                for (const id in rooms[room].ready) {
                    rooms[room].ready[id] = false;
                }
            }
        }
    });

    // ===== ENVIAR RESULTADOS AL RIVAL =====
    socket.on('sendResultsToRival', (data) => {
        // data: { room, results, name }
        socket.to(data.room).emit('receiveRivalResults', {
            results: data.results,
            name: data.name
        });
    });

    // ===== ACTUALIZAR ESTADÍSTICAS DEL RIVAL =====
    socket.on('updateStats', (data) => {
        socket.to(data.room).emit('opponentStats', { stats: data.stats, name: data.name });
    });

    // ===== DESCONECTAR =====
    socket.on('disconnect', () => {
        for (const room in rooms) {
            const roomData = rooms[room];
            const player = roomData.players.find(p => p.id === socket.id);
            if (player) {
                roomData.players = roomData.players.filter(p => p.id !== socket.id);
                delete roomData.ready[socket.id];

                // Avisar a los demás jugadores
                socket.to(room).emit('opponentLeft', { message: `${player.name} se ha desconectado.` });
            }
        }
    });
});

server.listen(PORT, () => {
    console.log(`Servidor PVP corriendo en puerto ${PORT}`);
});
