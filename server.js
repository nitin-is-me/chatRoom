const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const axios = require("axios");
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

async function getIp(){
    const response = await axios.get("https://api.ipify.org/?format=json");
    return response.data.ip;
}

// Middleware to log requests, alternative to morgan
// app.use((req, res, next) => {
//     console.log(`${req.method} ${req.url}`);
//     next();
// });

app.use(express.static(path.join(__dirname, 'public')));

// Store connected users
const connectedUsers = new Set();

io.on('connection', (socket) => {
    // console.log('a user connected');

    // Notify all users when someone joins
    socket.on('join', async (name) => {
        if (connectedUsers.has(name)) {
            // Notify the client that the name is already taken
            socket.emit('name taken', name);
            return;
        }

        // finding ip address of user
        const ip = await getIp();
        console.log(`${name} has joined. IP address: ${ip}`);

        // Add the user to the list of connected users
        connectedUsers.add(name);
        socket.username = name; // Store the username in the socket object
        io.emit('user joined', `${name} joined the room`);
    });

    // Handle chat messages
    socket.on('chat message', (msg) => {
        io.emit('chat message', msg);
    });

    // Notify all users when someone leaves
    socket.on('disconnect', async () => {
        // console.log('a user disconnected');
        const ip = await getIp();
        console.log(`${socket.username} has left. IP address: ${ip}`);
        if (socket.username) {
            connectedUsers.delete(socket.username); // Remove the user from the list
            io.emit('user left', `${socket.username} left the room`);
        }
    });
});

process.on('SIGINT', () => {
    console.log('Server is shutting down...');

    // Notify all clients that the server is shutting down
    io.emit('server shutdown', 'Admin has shut down the server');

    // Close the server
    server.close(() => {
        console.log('Server has been shut down.');
        process.exit(0); // Exit the process (0 means without errors)
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});