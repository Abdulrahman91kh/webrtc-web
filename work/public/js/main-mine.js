'use strict';

let isChannelReady = false;
let isInitiator = false;
let isStarted = false;
let localStream;
let pc;
let remoteStream;
let turnReady;

var pcConfig = {
    'iceServers': [
        {
            'urls': 'stun:stun.l.google.com:19302'
        },
        {
            urls: 'turn:192.158.29.39:3478?transport=tcp',
            credential: 'JZEOEt2V3Qb0y27GRntt2u2PAYA=',
            username: '28224511:1379330808'
        },
    ]
};

let sdpConstrains = {
    offerToReceiveAudio: true,
    offerToReceiveVideo: true
}

// Sockets Configuration
const socket = io('http://192.168.1.10:4000');
socket.on('serverMessage', function (data) {
    console.log(data);
    socket.emit('serverMessage', { ...data });
});

socket.on('created', room => {
    isInitiator = true;
});

socket.on('full', room => {
    alert('Go out, Room is full');
});

socket.on('join', room => {
    isChannelReady = true;
});

function sendMessage(message) {
    console.log('Sending a Message to Server', message);
    socket.emit('message', message);
}

socket.on('message', message => {
    console.log('Receiveng Server Message', message);
    if (message === 'got user media') {
        maybeStart();
    }
    else if (message.type === 'offer') {//getting an offer and aswering it
        if (!isInitiator && !isStarted) {
            maybeStart();
        }
        pc.setRemoteDescription(new RTCSessionDescription(message));
        doAnswer();
    }
    else if (message.type === 'answer' && isStarted) {// for initiator we don't answer
        pc.setRemoteDescription(new RTCSessionDescription(message));
    }
    else if (message === 'bye' && isStarted) {
        handleRemoteHangup();
    }
});

const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');

// create or join room
document.getElementById('create-room').addEventListener('click', createJoinRoomHandler);

function createJoinRoomHandler() {

    window.room = document.getElementById('roomName').value;
    if (window.room.trim() === '')
        alert('What the heck? **ck off');
    else {
        document.getElementById('roomNameContainer').remove();
        document.getElementById('videoChat').className = '';
        document.querySelector('.roomName').innerHTML = window.room;
        socket.emit('create or join', room);// initiating a room
        navigator.mediaDevices.getUserMedia({
            video: true,
        }).then(gotStream).catch(err => alert(err));
    }

}

function gotStream(stream) {
    localStream = stream;
    localVideo.srcObject = stream;
    sendMessage('got user media');
    if (isInitiator)
        maybeStart();
}

const constraints = {
    video: true,
    audio: true
}

console.log('Getting user media with constraints', constraints);

if (location.hostname !== 'localhost') {
    requestTurn(
        'https://computeengineondemand.appspot.com/turn?username=41784574&key=4080218913'
    );
}

function maybeStart() {
    console.log('>>>> maybeStart()', isStarted, localStream, isChannelReady, isInitiator);
    if (!isStarted && typeof localStream !== 'undefined' && isChannelReady) {
        console.log('>>>>> create peer connection');
        createPeerConnection();
        pc.addStream(localStream);
        isStarted = true;
        console.log('isInitiator', isInitiator);
        if (isInitiator) {
            sendOffer();
        }
    }
}

window.onbeforeunload = () => {
    sendMessage('bye');
}

function createPeerConnection() {
    try {
        pc = new RTCPeerConnection(null);
        pc.onicecandidate = handleIceCandidate;
        pc.onaddstream = handleRemoteStreamAdded;
        pc.onremovestream = handleRemoteStreamRemoved;
        console.log('Created Peer Connection');
    }
    catch (e) { alert('error on creating peer connection') };
}

function handleIceCandidate(event) {
    console.log('icecandidate event', event);
    if (event.candidate) {
        sendMessage({
            type: 'candidate',
            label: event.candidate.sdpMLineIndex,
            id: event.candidate.sdpMid,
            candidate: event.candidate.candidate
        });
    }
    else
        alert('No Candidates');
}

function sendOffer() {
    console.log('Sending Offer to peer');
    pc.createOffer(setLocalAndSendMessage, err => alert('Error on creating offer'));
}

function doAnswer() {
    console.log('Sending Answer to peer');
    pc.createAnswer().then(setLocalAndSendMessage).catch(error => alert('Error on creating Asnwer'));
}

function setLocalAndSendMessage(sessionDescription) {
    pc.setLocalDescription(sessionDescription);
    console.log('LocalDescription is set and sending message', sessionDescription);
    sendMessage(sessionDescription);
}

function requestTurn(turnURL) {
    var turnExists = false;
    for (var i in pcConfig.iceServers) {
        if (pcConfig.iceServers[i].urls.substr(0, 5) === 'turn:') {
            turnExists = true;
            turnReady = true;
            break;
        }
    }
    if (!turnExists) {
        console.log('Getting TURN server from ', turnURL);
        // No TURN server. Get one from computeengineondemand.appspot.com:
        var xhr = new XMLHttpRequest();
        xhr.onreadystatechange = function () {
            if (xhr.readyState === 4 && xhr.status === 200) {
                var turnServer = JSON.parse(xhr.responseText);
                console.log('Got TURN server: ', turnServer);
                pcConfig.iceServers.push({
                    'urls': 'turn:' + turnServer.username + '@' + turnServer.turn,
                    'credential': turnServer.password
                });
                turnReady = true;
            }
        };
        xhr.open('GET', turnURL, true);
        xhr.send();
    }
}

function handleRemoteStreamAdded(event) {
    console.log('Remote stream added.');
    remoteStream = event.stream;
    remoteVideo.srcObject = remoteStream;
}

function handleRemoteStreamRemoved(event) {
    console.log('Remote stream removed. Event: ', event);
}

function hangup() {
    console.log('Hanging up.');
    stop();
    sendMessage('bye');
}

function handleRemoteHangup() {
    console.log('Session terminated.');
    stop();
    isInitiator = false;
}

function stop() {
    isStarted = false;
    pc.close();
    pc = null;
}