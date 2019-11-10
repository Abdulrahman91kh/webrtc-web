'use strict';

const mediaStreamConstrains = {
    video: {
        width: {
            min: 1280
        },
        height: {
            min: 720
        }
    }
};

const localVideo = document.getElementById('localVideo');

let localStream;

const getLocalMediaStream = mediaStream =>{
    localStream = mediaStream;
    localVideo.srcObject = mediaStream;
};

const localMediaStreamErrHandler = err => console.error('Navigator.mediaDevices.getUserMedia error' + err);


//initiating video
navigator.mediaDevices.getUserMedia(mediaStreamConstrains)
    .then(getLocalMediaStream)
    .catch(localMediaStreamErrHandler);