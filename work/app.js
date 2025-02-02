'use strict';

const express = require('express');
const app = express();
const socketServer = require('http').Server(app);
const io = require('socket.io')(socketServer);
const rtc = require('./src/storky-rtc/storky-rtc');

app.use('/static', express.static('./node_modules'));
app.use('/assets', express.static('./public'));

io.sockets.on('connection', function (socket) {
    // convenience function to log server messages on the client
    rtc.initializer(app, io, socket);
});

app.get('/', (req, res) => {
    app.set('ip', req.connection.remoteAddress );
    res.sendFile(__dirname + '/public/index.html');
});

socketServer.listen(4000, () => {
    console.log('Running on port 4000');
});

