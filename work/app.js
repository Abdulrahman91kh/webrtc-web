const express = require('express');
const app = express();
const socketServer = require('http').Server(app);
const io = require('socket.io')(socketServer);
const os = require('os');

app.use('/static', express.static('./node_modules'))
app.use('/assets', express.static('./public'));


const clientData = {
    ip: null
}

io.on('connection', socket =>{
    socket.emit('serverMessage', { message: 'New Connection', ip: clientData.ip});
    socket.on('serverMessage', data => {
        // console.trace('New Message:' + data.message + 'from Ip: ' + data.ip)
    });

    // Room Create and join
    socket.on('create or join', room =>{
        const clientsInRoom = io.sockets.adapter.rooms[room];
        const numClients = clientsInRoom ? Object.keys(clientsInRoom.sockets).length : 0;

        if (numClients === 0) {
            socket.join(room);
            socket.emit('roomCreated', { room, id: socket.id });
            console.log('Creating Room: ' + room);
        }
        else if (numClients === 1) {
            socket.join(room);
            socket.emit('joined', { room, id: socket.id });
            console.log('New User Joined Room: ' + room);
        }
        else{
            socket.emit('full');
        }

        socket.on('ipaddr', ()=>{
            const ifaces = os.networkInterfaces();
            for(let dev in ifaces){
                ifaces[dev].forEach(details =>{
                    if(details.family === 'IPv4' && details.address !== '127.0.0.1')
                        socket.emit('ipaddr', details.address);
                });
            }
        });

    });


});

app.get('/', (req, res) => {
    clientData.ip = req.connection.remoteAddress;
    res.sendFile(__dirname + '/public/index.html');
});
socketServer.listen(4000, () => {
    console.log('Running on port 4000');
});
