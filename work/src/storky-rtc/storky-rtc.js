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
                newPeerNegotiation: 'rtc-new-peer-negotiation',
                ipaddr: 'rtc-ipaddr'
            };
        }
        this.socketEvents = {...socketEvents};

        this.clientsData = {};
    }
    
    initializer = (app, io, socket) => {
       
        this.socket = socket;

        const thisClass = this;
        
        socket.on(this.socketEvents.serverMessage, message => {
            console.log('called 1')
            thisClass.logger('Client said: ', message);
            if(message === thisClass.socketEvents.closeConnection){
                socket.broadcast.emit(thisClass.socketEvents.serverMessage, message);
            }
            else{
                console.log(
                    'Should send this event', message
                )
                try{
                    io.to(thisClass.clientsData[message.targetIP].socketID).emit(thisClass.socketEvents.serverMessage, message);
                }
                catch(err){}
            }
        });

        // The Address used is local one. Need to use a public one.
        
        socket.on(this.socketEvents.createJoinRoom, room => {
            console.log('called 2')
            thisClass.logger(' Received request to create or join room ' + room);
        
            let clientsInRoom = io.sockets.adapter.rooms[room];
            let numClients = clientsInRoom ? Object.keys(clientsInRoom.sockets).length : 0;
            thisClass.logger('Room ' + room + ' now has ' + numClients + ' client(s)');

            if (numClients === 0) {// room created

                let address = app.get('ip');
                address = address.split(':');
                address = address[3] || 'localhost';
                thisClass.clientsData[address] = { socketID: socket.id, room };
                console.log(`Cleints in this ${room} room`, thisClass.clientsData);
                socket.join(room);
                thisClass.logger('Client ID ' + socket.id + ' created room ' + room);

                socket.emit(thisClass.socketEvents.roomCreated, {
                    socketID: socket.id,
                    userIP: address,
                    room
                });

            } else if (numClients < 5 ) {
                
                let address = app.get('ip');
                address = address.split(':');
                address = address[3] || 'localhost';
                console.log(`Cleints in this ${room} room`, thisClass.clientsData);

                thisClass.logger('Client ID ' + socket.id + ' joined room ' + room);
               
                io.sockets.in(room).emit(thisClass.socketEvents.joinRoom, {
                    socketID: socket.id,
                    userIP: address,
                    room
                });

                socket.join(room);

                io.to(socket.id).emit(thisClass.socketEvents.roomJoined, {
                    existingUsers: thisClass.clientsData,
                    currentUser: {
                        userIP: address,
                        socketID: socket.id,
                        room
                    }
                });
                console.log('existing users before adding',thisClass.clientsData)
                thisClass.clientsData[address] = { socketID: socket.id, room: room };

            } else { // max two clients
                socket.emit(thisClass.socketEvents.roomFull, room);
            }
        });

        //initiate new peer connection
        socket.on(this.socketEvents.newPeerNegotiation, usersIPs => {
            thisClass.logger(('Client IP ' + usersIPs.sender.IP + ' wants to negotiate ' + usersIPs.receiverIP));
            socket.emit(thisClass.socketEvents.newPeerNegotiation, usersIPs);
        });

        socket.on(this.socketEvents.ipaddr, () => {
            const userIP = getuserIP();
            socket.emit(thisClass.socketEvents.ipaddr, userIP);
        });

        socket.on(this.socketEvents.closeConnection, data => {
            
            delete this.clientsData[data.userIP]
            
            thisClass.logger('Client ID ' + socket.id +' said bye');
        });

    };

    logger = (message, otherParameter) =>{
        if(this.noLog) return false;
        let array = ['Message from server:'];
        array.push(array, message);
        if (otherParameter)
            array.push(array, otherParameter);
        console.log(array);
    }
}

function getuserIP(){
    let ifaces = os.networkInterfaces();
    for (let dev in ifaces) {
        ifaces[dev].forEach(details => {
            if (details.family === 'IPv4' && details.address !== '127.0.0.1') {
                return details.address;
            }
        });
    }
}

module.exports = new StorkyRTC({
    io: null,
    socket: null,
    socketEvents: null
});