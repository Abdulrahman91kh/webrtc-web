class StorkyRTC {

    //usage

    /**
     *Creates an instance of StorkyRTC.
     * @param {*} {roomName, serversConfig, constraints, localVideoElement, remoteVideosClass}
     * roomName [String]
     * serverConfig [Object] iceServers:{urls: ''},{urls: '', credential: '', username: ''}
     * constraints [Object] {video: boolean, audio: boolean}
     * Socket events (pairs of keys and strings as following) should be provided or default should be used at server side
     * { roomCreated, roomFull, joinRoom, roomJoined, serverMessage, closeConnection }
     * @memberof StorkyRTC
     */
    constructor({ userData, roomName, socket, serversConfig, constraints, localVideoElement, remoteVideosClass, socketEvents, colorPallet }) {
        this.roomName = roomName;
        this.socket = socket;
        this.isChannelReady = false;
        this.isInitiator = false;
        this.isStarted = false;
        this.localStream = null;
        this.peerConnection = null;
        this.remoteStream = null;
        this.turnReady = null;
        this.isRoomFull = false;

        if (serversConfig !== null && serversConfig !== undefined)
            this.peerConnectionConfig = { ...serversConfig };

        if (constraints === null || constraints === undefined) {
            constraints = { video: true, audio: true }
        }

        this.constraints = { ...constraints };
        this.setSessionDescriptionPeerConstrains(constraints);

        this.localVideoElement = localVideoElement;
        this.remoteVideosClass = remoteVideosClass;

        // Getting Events Names
        if (socketEvents === null || socketEvents === undefined) {
            socketEvents = {
                createJoinRoom: 'rtc-room-create-join',
                roomCreated: 'rtc-room-created',
                roomFull: 'rtc-room-full',
                joinRoom: 'rtc-room-join',
                roomJoined: 'rtc-room-joined',
                serverMessage: 'rtc-server-message',
                closeConnection: 'rtc-server-close',
                ipaddr: 'rtc-ipaddr'
            }
        }
        this.socketEvents = socketEvents;

        // Set socket events
        socket.on(socketEvents.roomCreated, room => {
            this.isInitiator = true;
        });

        socket.on(socketEvents.roomFull, room => {
            console.warn('Error: Room is full');
            this.isRoomFull = true;
        });

        socket.on(socketEvents.joinRoom, room => {
            this.isChannelReady = true;
        });

        socket.on(socketEvents.roomJoined, room => {
            this.isChannelReady = true;
        });

        socket.on(socketEvents.serverMessage, message => {
            if (message === 'got user media') {
                this.tryStart();
            }
            else if (message.type === 'offer') {//getting an offer and aswering it
                if (!this.isInitiator && !this.isStarted) {
                    this.tryStart();
                }
                this.peerConnection.setRemoteDescription(new RTCSessionDescription(message));
                this.sendAnswer();
            }
            else if (message.type === 'answer' && this.isStarted) {// for initiator we don't answer
                this.peerConnection.setRemoteDescription(new RTCSessionDescription(message));
            }
            else if (message.type === 'candidate' && this.isStarted) {
                const candidate = new RTCIceCandidate({
                    sdpMLineIndex: message.label,
                    candidate: message.candidate
                });
                this.peerConnection.addIceCandidate(candidate);
            }
            else if (message === this.socketEvents.closeConnection && this.isStarted) {
                this.remoteHangup();
            }
        });

        const remoteElements = document.querySelectorAll('.remoteVideo');
        for (const i of remoteElements) {
            i.className = i.className + ' idleVideo ';
        }
        if (colorPallet === null || colorPallet === undefined)
            colorPallet = ['#283592', '#6d64e8', '#4e5663', '#e01c84'];
        this.colorPallet = colorPallet;
    }

    startMediaStreaming = async () => {
        this.socket.emit(this.socketEvents.createJoinRoom, 'got user media');
        try {
            //try video
            const localStream = await navigator.mediaDevices.getUserMedia(this.constraints);
            this.gotUserStream(localStream);
            this.requestTurn();
        }
        catch (err) {
            //try audio
            // const userThumbnail = this.createAlphabaticThumbnail('Abdulrahman Khallil');
            // console.log(this.localVideoElement);
            // this.localVideoElement.parentElement.appendChild(userThumbnail);
            // this.setConstrains({ audio: true, video: false });
            // try {
            //     const audioStream = await navigator.mediaDevices.getUserMedia(this.constraints);
            //     this.gotUserStream(audioStream);
            //     this.requestTurn();
            // }
            // catch (err) {
            //     //try nothing
            //     this.setConstrains({ audio: false, video: false });
            //     const noStream = await navigator.mediaDevices.getUserMedia(this.constraints);
            //     this.gotUserStream(noStream);
            //     this.requestTurn();
            // }
        }

        window.onbeforeunload = () => { this.sendServerMessage(this.socketEvents.closeConnection) };
    }

    gotUserStream = stream => {
        this.localStream = stream;
        this.localVideoElement.srcObject = stream;
        this.sendServerMessage('got user media');
        if (this.isInitiator) {
            this.tryStart();
        }
    }


    sendServerMessage = message => this.socket.emit(this.socketEvents.serverMessage, message);

    tryStart = () => {
        if (!this.isStarted && typeof this.localStream !== 'undefined' && this.isChannelReady) {
            this.CreatePeerConnection();
            //this method is depcracated for mozilla, should have some work arround
            this.peerConnection.addStream(this.localStream);
            this.isStarted = true;
            if (this.isInitiator)
                this.sendOffer();
        }
    }


    CreatePeerConnection = (peerConnectionConstrains) => {
        const pcConstrains = peerConnectionConstrains || null;
        try {
            this.peerConnection = new RTCPeerConnection(pcConstrains);
            this.peerConnection.onicecandidate = this.iceCandidateHandler;
            this.peerConnection.onaddstream = this.remoteStreamAddedHandler;
            this.peerConnection.onremovestream = this.remoteStreamRemovedHandler;
        }
        catch (err) {
            console.error('Error on creating peer connection', err)
        }
    }

    iceCandidateHandler = event => {
        if (event.candidate) {
            this.sendServerMessage({
                type: 'candidate',
                label: event.candidate.sdpMLineIndex,
                id: event.candidate.sdpMid,
                candidate: event.candidate.candidate
            });
        }
        else
            console.warn('Error No candidates to be added');
    }

    remoteStreamAddedHandler = event => {
        this.remoteStream = event.stream;
        this.setNextRemoteVideo(event.stream);
    }

    remoteStreamRemovedHandler = event => {
        // stop the users remoteVideo and free it for future use
    }

    setNextRemoteVideo = stream => {
        //getting the not working video and play set this stream to it
        const remoteVideos = document.querySelectorAll('.' + this.remoteVideosClass);
        for (const singleVideo of remoteVideos) {
            if (singleVideo.classList.contains('idleVideo')) {
                singleVideo.classList.remove('idleVideo');
                singleVideo.srcObject = stream;
                return;
            }
        }
    }

    sendOffer = () => {
        this.peerConnection.createOffer(this.setLocalSDPSendServer, error => {
            console.error('Error on creating an offer ', error);
        });
    }

    sendAnswer = () => {
        this.peerConnection.createAnswer().then(this.setLocalSDPSendServer).catch((error) => {
            console.error('Error on creating a response', err);
        });
    }

    setLocalSDPSendServer = (sessionDescription) => {
        this.peerConnection.setLocalDescription(sessionDescription);
        this.sendServerMessage(sessionDescription);
    }

    requestTurn(turnURL) {
        let turnExists = false;
        turnExists = true;
        let pcConfig = { ...this.peerConnectionConfig };
        for (let i in pcConfig.iceServers) {
            if (pcConfig.iceServers[i].urls.substr(0, 5) === 'turn:') {
                turnExists = true;
                this.turnReady = true;
                break;
            }
        }
        // generates error
        if (!turnExists) {
            let xhr = new XMLHttpRequest();
            xhr.onreadystatechange = () => {
                if (xhr.readyState === 4 && xhr.status === 200) {
                    var turnServer = JSON.parse(xhr.responseText);
                    pcConfig.iceServers.push({
                        'urls': 'turn:' + turnServer.username + '@' + turnServer.turn,
                        'credential': turnServer.password
                    });
                    turnReady = true;
                    this.pcConfig = { ...pcConfig };
                }
            };
            xhr.open('GET', turnURL, true);
            xhr.send();
        }
    }

    localHangup = () => {
        this.stop();
        this.sendServerMessage(this.socketEvents.closeConnection);
    }

    remoteHangup = user => {
        //which user to stop
        this.stop();
        this.isInitiator = false;
    }

    stop = () => {
        this.isStarted = false;
        this.peerConnection.close();
        this.peerConnection = null;
    }

    setSessionDescriptionPeerConstrains = constraints => {
        this.sessionDescriptionPeerConstrains = {
            offerToReceiveAduio: constraints.audio,
            offerToReceiveVideo: constraints.video
        }
    }

    addPeerConnectionConfServer = serverCongif => {
        this.peerConnectionConfig.iceServers.push({
            'urls': serverCongif.url,
            'credential': serverCongif.password
        });
    }

    setRoomName = name => this.roomName = name;


    //create image thumbnail
    createAlphabaticThumbnail = name => {
        const nameTokens = name.split(' ');
        let nameLetters = nameTokens[0].charAt(0).toUpperCase();
        nameLetters += nameTokens[1] ? nameTokens[1].charAt(0).toUpperCase() : '';
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        ctx.font = "30px Poppins";
        ctx.fillStyle = this.getRandomArrayItem(this.colorPallet);
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'white';
        ctx.fillText(nameLetters, ((canvas.width / 2) - 15), (canvas.height / 2));
        return canvas;
    }

    getRandomArrayItem = items => items[Math.floor(Math.random() * items.length)];

    setConstrains = constraints => {
        this.constraints = { ...constraints };
        this.setSessionDescriptionPeerConstrains(constraints)
    }

}