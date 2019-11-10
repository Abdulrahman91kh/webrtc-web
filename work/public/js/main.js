'use strict';
// Sockets Configuration
// WEBRTC Things
let isInitiator;

const socket = io('http://localhost:4000');
socket.on('serverMessage', function (data) {
    console.log(data);
    socket.emit('serverMessage', { ...data  });
});

// Getting Room Name
document.getElementById('create-room').addEventListener('click', () =>{
    window.roomName = document.getElementById('roomName').value;
    if(window.roomName.trim() === '')
        alert('What the heck? **ck off');
    else{
        document.getElementById('roomNameContainer').remove();
        document.getElementById('videoChat').className = '';
        document.querySelector('.roomName').innerHTML = window.roomName;
        socket.emit('create or join', roomName);// initiating a room
    }
});

socket.on('roomCreated', ()=> isInitiator = true );
socket.on('joined', ()=> isInitiator = false );

socket.on('full', () => {
    alert('The Room is Full haHAhaHaAhAhahahah');
    window.location.href ='/'
});

socket.on('ipaddr', ip =>{
    console.log('Your IP is '+ ip);
})