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
// rooms = { roomId: { players: [{id: socketId, name: 'Usuario'}], ready: {socketId: true/false} } }

io.on('connection', (socket) => {

    socket.on('joinRoom', ({ room, userName }) => {
        socket.join(room);
        if (!rooms[room]) rooms[room] = { players: [], ready: {} };
        rooms[room].players.push({ id: socket.id, name: userName });
        rooms[room].ready[socket.id] = false;
        
        // Avisar a los jugadores
        if (rooms[room].players.length === 2) {
            const [player1, player2] = rooms[room].players;

            // Avisar a player1 sobre player2
            io.to(player1.id).emit('waiting', { message: `Tu rival ${player2.name} está conectado, esperando inicio...` });

            // Avisar a player2 sobre player1
            io.to(player2.id).emit('waiting', { message: `Tu rival ${player1.name} está conectado, esperando inicio...` });

        } else {
            socket.emit('waiting', { message: 'Esperando a que se conecte tu rival...' });
        }
    });

    socket.on('playerReady', ({ room }) => {
        if (rooms[room]) {
            rooms[room].ready[socket.id] = true;

            // Comprobar si ambos están listos
            const allReady = rooms[room].players.every(p => rooms[room].ready[p.id]);
            if (allReady) {
                io.to(room).emit('startCountdown', { message: '¡Ambos listos! Inicia el conteo...' });

                // Reiniciar los ready para la siguiente partida
                for (const id in rooms[room].ready) {
                    rooms[room].ready[id] = false;
                }
            }
        }
    });

    // ✅ Aquí afuera, no dentro de joinRoom
    socket.on('sendResultsToRival', (data) => {
        // Solo enviar al rival en la misma sala
        socket.to(data.room).emit('receiveRivalResults', data.results);
    });

    socket.on('updateStats', (data) => {
        // Enviar stats solo al rival
        socket.to(data.room).emit('opponentStats', { stats: data.stats, name: data.name });
    });

    socket.on('disconnect', () => {
        for (const room in rooms) {
            const roomData = rooms[room];
            const player = roomData.players.find(p => p.id === socket.id);
            if (player) {
                // Quitar al jugador
                roomData.players = roomData.players.filter(p => p.id !== socket.id);
                delete roomData.ready[socket.id];

                // Avisar a los demás jugadores
                socket.to(room).emit('opponentLeft', { message: `${player.name} se ha desconectado.` });

                // Eliminar la sala si quedó vacía
                if (roomData.players.length === 0) delete rooms[room];
            }
        }
    });

});

server.listen(PORT, () => {
    console.log(`Servidor PVP corriendo en puerto ${PORT}`);
});
