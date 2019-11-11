'use strict';

const express = require('express');
const app = express();
const socketServer = require('http').Server(app);
const io = require('socket.io')(socketServer);
const os = require('os');

app.use( '/', express.static('./'));
// app.use('/static', express.static('./node_modules'))
// app.use('/assets', express.static('./public'))

// var os = require('os');
// var nodeStatic = require('node-static');
// var http = require('http');
// var socketIO = require('socket.io');
// var fileServer = new (nodeStatic.Server)();
// var app = http.createServer(function (req, res) {
//     fileServer.serve(req, res);
// }).listen(4000);
// var io = socketIO.listen(app);


const clientData = {
    ip: null
}

io.sockets.on('connection', function (socket) {

    // convenience function to log server messages on the client
    function log() {
        var array = ['Message from server:'];
        array.push.apply(array, arguments);
        console.log(array)
        socket.emit('log', array);
    }

    socket.on('message', function (message) {
        log('Client said: ', message);
        // for a real app, would be room-only (not broadcast)
        socket.broadcast.emit('message', message);
    });

    socket.on('create or join', function (room) {
        log('Received request to create or join room ' + room);

        var clientsInRoom = io.sockets.adapter.rooms[room];
        var numClients = clientsInRoom ? Object.keys(clientsInRoom.sockets).length : 0;
        log('Room ' + room + ' now has ' + numClients + ' client(s)');

        if (numClients === 0) {
            socket.join(room);
            log('Client ID ' + socket.id + ' created room ' + room);
            socket.emit('created', room, socket.id);

        } else if (numClients === 1) {
            log('Client ID ' + socket.id + ' joined room ' + room);
            io.sockets.in(room).emit('join', room);
            socket.join(room);
            socket.emit('joined', room, socket.id);
            io.sockets.in(room).emit('ready');
        } else { // max two clients
            socket.emit('full', room);
        }
    });

    socket.on('ipaddr', function () {
        var ifaces = os.networkInterfaces();
        for (var dev in ifaces) {
            ifaces[dev].forEach(function (details) {
                if (details.family === 'IPv4' && details.address !== '127.0.0.1') {
                    socket.emit('ipaddr', details.address);
                }
            });
        }
    });

    socket.on('bye', function () {
        console.log('received bye');
    });

});


// app.get('/', (req, res) => {
//     clientData.ip = req.connection.remoteAddress;
//     res.sendFile(__dirname + '/public/index.html');
// });
socketServer.listen(4000, () => {
    console.log('Running on port 4000');
});

