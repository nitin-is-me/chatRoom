const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const axios = require('axios');
const dotenv = require('dotenv');
const app = express();
const server = http.createServer(app);
const io = socketIo(server);
dotenv.config();

async function getIp() {
    const response = await axios.get('https://api.ipify.org/?format=json');
    return response.data.ip;
}

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

const connectedUsers = new Map();

io.on('connection', (socket) => {
    socket.on('join', async (name) => {
        if (connectedUsers.has(name)) {
            socket.emit('name taken', name);
            return;
        }

        const ip = await getIp();
        console.log(`${name} has joined. IP address: ${ip}`);

        connectedUsers.set(name, socket.id);
        socket.username = name;
        io.emit('user joined', `${name} joined the room`);
    });

    socket.on('chat message', (msg) => {
        io.emit('chat message', msg);
    });

    socket.on('disconnect', async () => {
        if (socket.username) {
            const ip = await getIp();
            if (socket.kicked) {
                console.log(`${socket.username} has been kicked. IP address: ${ip}`);
            } else {
                console.log(`${socket.username} has left. IP address: ${ip}`);
                connectedUsers.delete(socket.username);
                io.emit('user left', `${socket.username} left the room`);
            }
        }
    });
});

// Kick user route
app.post('/kick', (req, res) => {
    const { username, password } = req.body;

    // Check if the password is correct
    if (password !== process.env.password) {
        return res.status(401).send('Unauthorized');
    }

    // Check if the user exists
    const socketId = connectedUsers.get(username);
    if (!socketId) {
        return res.status(404).send('User not found');
    }

    // Kick the user
    const socketToKick = io.sockets.sockets.get(socketId);
    if (socketToKick) {
        // Mark the user as kicked
        socketToKick.kicked = true;

        // Notify the kicked user
        socketToKick.emit('kicked', 'You have been kicked from the room.');

        // Notify all other users
        io.emit('user left', `${username} has been kicked from the room.`);

        // Forcefully disconnect the user
        socketToKick.disconnect(true);

        // Remove the user from the connectedUsers map
        connectedUsers.delete(username);

        return res.status(200).send(`User ${username} has been kicked.`);
    } else {
        return res.status(404).send('User not found');
    }
});

app.get("/warning", (req, res)=>{
    res.send("Don't do stuffs which land you out of the room. You've been warned");
})

process.on('SIGINT', () => {
    console.log('Server is shutting down...');
    io.emit('server shutdown', 'Admin has shut down the server');
    server.close(() => {
        console.log('Server has been shut down.');
        process.exit(0);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});