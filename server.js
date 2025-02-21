const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', (socket) => {
    console.log('a user connected');

    // Notify all users when someone joins
    socket.on('join', (name) => {
        socket.username = name; // Store the username in the socket object
        io.emit('user joined', `${name} joined the room`);
    });

    // Handle chat messages
    socket.on('chat message', (msg) => {
        io.emit('chat message', msg);
    });

    // Notify all users when someone leaves
    socket.on('disconnect', () => {
        console.log('user disconnected');
        io.emit('user left', `${socket.username || 'A user'} left the room`);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});