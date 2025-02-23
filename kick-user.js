const axios = require('axios');
const readline = require('readline');
require('dotenv').config(); // Load environment variables from .env file

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

rl.question('Enter username to kick: ', (username) => {
    const password = process.env.PASSWORD; // Read password from .env

    axios.post('http://localhost:3000/kick', { username, password })
        .then((response) => {
            console.log(response.data);
        })
        .catch((error) => {
            console.error('Error:', error.response ? error.response.data : error.message);
        })
        .finally(() => {
            rl.close();
        });
});