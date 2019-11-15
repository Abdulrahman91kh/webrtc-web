const socket = io('http://192.168.1.2:4000');

storkyRTC = new StorkyRTC({
    roomName: 'foo',
    serverConfig: {
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
    },
    socket: socket,
    constraints: {
        video: true,
        audio: true
    },
    localVideoElement: document.getElementById('localVideo'),
    remoteVideosClass: 'remoteVideo',
});

storkyRTC.startMediaStreaming();