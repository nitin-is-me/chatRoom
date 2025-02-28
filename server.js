const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const dotenv = require('dotenv');
const app = express();
const server = http.createServer(app);
const io = socketIo(server);
dotenv.config();

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

const connectedUsers = new Map();
const blockedIPs = new Set(); // Set to store banned IPs

io.on('connection', (socket) => {
    socket.on('join', async (data) => {
        const { name, ip } = data;

        // Check if the IP is banned
        if (blockedIPs.has(ip)) {
            socket.emit('banned', "You can't rejoin because you're already banned from the room.");
            socket.disconnect(true); // Forcefully disconnect the banned user
            return;
        }

        // Check if the name is already taken
        if (connectedUsers.has(name)) {
            socket.emit('name taken', name);
            socket.disconnect(true);
            return;
        }

        // Log the user's name and IP address
        console.log(`${name} has joined with IP: ${ip}. Time: ${new Date().toLocaleTimeString()}`);

        // Store the user in the connectedUsers map with their name and IP
        connectedUsers.set(name, { socketId: socket.id, ip });

        socket.username = name;
        socket.ip = ip;  // Store the user's IP in the socket object

        socket.emit('join success'); // let user interact after all checks
        io.emit('user joined', `${name} joined the room`);

         // Emit the updated online user count to all clients
         io.emit('update user count', connectedUsers.size);
    });

    socket.on('chat message', (msg) => {
        if(!connectedUsers.has(socket.username)){
            socket.emit('force refresh', "You were disconnected because of your network interruption, make sure background data is on if you're multitasking. Refreshing...");
            return;
        }
        io.emit('chat message', msg);
    });

    socket.on('disconnect', async () => {
        if (socket.username) {
            if (socket.kicked) {
                // already logging in "/kick" api
                // console.log(`${socket.username} has been kicked. Time: ${new Date().toLocaleTimeString()}`);
            } else {
                console.log(`${socket.username} has left. Time: ${new Date().toLocaleTimeString()}`);
                connectedUsers.delete(socket.username);
                io.emit('user left', `${socket.username} left the room`);

                // Emit the updated online user count to all clients
                io.emit('update user count', connectedUsers.size);
            }
        }
    });

    // socket.on('reconnect', () => {
    //     if (socket.username) {
    //         console.log(`${socket.username} has reconnected. New socket ID: ${socket.id}`);

    //         // Update the connectedUsers map with the new socket ID
    //         connectedUsers.set(socket.username, { socketId: socket.id, ip: socket.ip });

    //         // Notify other users
    //         io.emit('user rejoined', `${socket.username} has reconnected.`);
    //     }
    // });
});

app.get('/getUsers', (req, res)=>{
    console.log(connectedUsers);
    res.send("Logged all users in server shell");
    return;
})

// Kick user route
app.post('/kick', (req, res) => {
    const { username, password } = req.body;

    // Check if the password is correct
    if (password !== process.env.password) {
        return res.status(401).send('Unauthorized');
    }

    // Check if the user exists
    const userData = connectedUsers.get(username); // Get the user data object
    if (!userData) {
        return res.status(404).send('User not found');
    }

    const socketId = userData.socketId; // Extract the socketId from the user data
    const userIp = userData.ip; // Extract the IP from the user data

    // Kick the user
    const socketToKick = io.sockets.sockets.get(socketId);
    if (socketToKick) {
        // Mark the user as kicked
        socketToKick.kicked = true;

        // Add the user's IP to the blockedIPs Set
        blockedIPs.add(userIp);
        console.log(`${username} has been banned. Time: ${new Date().toLocaleTimeString()}`);

        // Notify the kicked user
        socketToKick.emit('kicked', 'You have been banned from the room.');

        // Notify all other users
        io.emit('user left', `${username} has been banned from the room.`);

        // Forcefully disconnect the user
        socketToKick.disconnect(true);

        // Remove the user from the connectedUsers map
        connectedUsers.delete(username);

        return res.status(200).send(`User ${username} has been banned.`);
    } else {
        return res.status(404).send('User not found');
    }
});

app.get('/warning', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'warning.html'));
});

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