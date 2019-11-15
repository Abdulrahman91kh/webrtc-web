'use strict'
class StorkyRTC {

    constructor({io, socket, socketEvents }){
        if( socket !== null && socket !== undefined )
            this.socket = socket;
        if(socketEvents === null || socketEvents !== undefined){
            socketEvents = {
                createJoinRoom: 'rtc-room-create-join',
                roomCreated: 'rtc-room-created',
                roomFull: 'rtc-room-full',
                joinRoom: 'rtc-room-join',
                roomJoined: 'rtc-room-joined',
                serverMessage: 'rtc-server-message',
                closeConnection: 'rtc-server-close',
                ipaddr: 'rtc-ipaddr'
            };
        }
        this.socketEvents = {...socketEvents};
    }
    
    initializer = (io, socket) => {
       
        this.socket = socket;

        const thisClass = this;
        
        socket.on(this.socketEvents.serverMessage, function (message) {
            thisClass.logger('Client said: ', message);
            // for a real app, would be room-only (not broadcast)
            socket.broadcast.emit(thisClass.socketEvents.serverMessage, message);
        });

        socket.on(this.socketEvents.createJoinRoom, function (room) {
            thisClass.logger('Received request to create or join room ' + room);

            let clientsInRoom = io.sockets.adapter.rooms[room];
            let numClients = clientsInRoom ? Object.keys(clientsInRoom.sockets).length : 0;
            thisClass.logger('Room ' + room + ' now has ' + numClients + ' client(s)');

            if (numClients === 0) {
                socket.join(room);
                thisClass.logger('Client ID ' + socket.id + ' created room ' + room);
                socket.emit(thisClass.socketEvents.roomCreated, room, socket.id);

            } else if (numClients === 1) {
                thisClass.logger('Client ID ' + socket.id + ' joined room ' + room);
                io.sockets.in(room).emit(thisClass.socketEvents.joinRoom, room);
                socket.join(room);
                socket.emit(thisClass.socketEvents.roomJoined, room, socket.id);
            } else { // max two clients
                socket.emit(thisClass.socketEvents.roomFull, room);
            }
        });

        socket.on(this.socketEvents.ipaddr, function () {
            var ifaces = os.networkInterfaces();
            for (var dev in ifaces) {
                ifaces[dev].forEach(function (details) {
                    if (details.family === 'IPv4' && details.address !== '127.0.0.1') {
                        socket.emit(thisClass.socketEvents.ipaddr, details.address);
                    }
                });
            }
        });

        socket.on(this.socketEvents.closeConnection, function () {
            thisClass.logger('Client ID ' + socket.id +' said bye');
        });

    };

    logger = message =>{
        if(this.noLog) return false;
        var array = ['Message from server:'];
        array.push(array, message);
        console.log(array)
    }
}

module.exports = new StorkyRTC({
    io: null,
    socket: null,
    socketEvents: null
});