class StorkyRTC {



    /**
     *Creates an instance of StorkyRTC.
     * @param {*} {roomName, serversConfig, constraints, localVideoElement, remoteVideosParent}
     * roomName [String]
     * serverConfig [Object] iceServers:{urls: ''},{urls: '', credential: '', username: ''}
     * constraints [Object] {video: boolean, audio: boolean}
     * Socket events (pairs of keys and strings as following) should be provided or default should be used at server side
     * { roomCreated, roomFull, joinRoom, roomJoined, serverMessage, closeConnection }
     * @memberof StorkyRTC
     */
    constructor({ userData, roomName, socket, serversConfig, constraints, localVideoElement, remoteVideosParent, socketEvents, colorPallet }) {
        const roomConfig = { ...arguments[0] };
        this.roomConfig = roomConfig;
        this.existingUsers = {};
        this.roomName = roomName;
        this.socket = socket;
        // this.isChannelReady = false;
        // this.isInitiator = false;
        // this.isStarted = false;
        // this.localStream = null;//localdata
        // this.peerConnection = null;
        // this.remoteStream = null;
        this.localData = {
            IP: null,
            stream: null,
            socketID: null,
            pendingPeers: null,
            videoElement: localVideoElement
        };

        this.turnReady = null;

        if (serversConfig !== null && serversConfig !== undefined)
            this.peerConnectionConfig = { ...serversConfig };

        if (constraints === null || constraints === undefined) {
            constraints = { video: true, audio: true }
        }

        this.constraints = { ...constraints };
        this.setSessionDescriptionPeerConstrains(constraints);

        // this.localVideoElement = localVideoElement;
        this.remoteVideosParent = remoteVideosParent;

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
                newPeerNegotiation: 'rtc-new-peer-negotiation',
                ipaddr: 'rtc-ipaddr'
            }
        }
        this.socketEvents = socketEvents;

        // Set socket events
        socket.on(socketEvents.roomCreated, userData => {
            // this.isInitiator = true;
            this.localData = {
                ...this.localData,
                IP: userData.userIP,
                socketID: userData.socketID
            }
        });

        socket.on(socketEvents.roomFull, room => {
            console.warn('Error: Room is full');
            alert('Room is full, get out');
        });

        socket.on(socketEvents.joinRoom, newUserData => {
            // this.isChannelReady = true;
            // this.createNewPeer({
            //     userIP: newUserData.userIP,
            //     socketID: newUserData.socketID,
            //     initiator: true
            // });
            // console.log(newUserData)
            // console.log('New User is going to join', newUserData);
        });

        socket.on(socketEvents.roomJoined, data => {
            console.log('New User Joined')
            // console.log(data)
            this.localData = {
                ...this.localData,
                IP: data.currentUser.userIP,
                socketID: data.currentUser.socketID
            }
            // this.localData.pendingPeers = data.existingUsers;
            console.log(data.existingUsers)
            for (let userIP in data.existingUsers) {
                if (userIP === this.localData.IP)
                    continue;
                this.createNewPeer({
                    userIP,
                    socketID: data.existingUsers[userIP].socketID,
                    initiator: true
                });
                this.sendServerMessage({ type: 'got user media', targetIP: userIP });
            }
            // this.isChannelReady = true;
            // console.log('New User join', room);
            // console.log(room)
        });

        socket.on(socketEvents.serverMessage, data => {
            console.log(data);
            if (data.message.type === 'got user media') {
                if (this.localData.IP === data.message.targetIP) {
                    this.createNewPeer({
                        userIP: data.userIP,
                        socketID: data.socketID,
                        initiator: false,
                    });
                    this.tryStart(data.userIP, 2);
                    this.sendServerMessage({
                        type: 'ready to negotiate',
                        targetIP: data.userIP
                    });
                }
            }
            else if (data.message.type === 'ready to negotiate') {// asking for offer
                if (this.localData.IP === data.message.targetIP) {
                    console.log(data.userIP + ' User is ready to established new connection', this.existingUsers);
                    this.tryStart(data.userIP, 5);
                }
            }
            else if (data.message.type === 'send me offer') {// asking for offer
                if (this.localData.IP === data.message.targetIP) {
                    this.tryStart(data.message.userIP, 4);
                    console.log('should Send some offer to ', data.message.userIP)
                    this.sendOffer(data.message.userIP);
                }
            }
            else if (data.message.type === 'offer') {//getting an offer and aswering it
                if (this.localData.IP === data.targetIP) {
                    console.log('%c Getting Offer', 'background: #FFF; color: #0A0');
                    // alert('Got Offer from' + data.userIP);
                    this.tryStart(data.userIP, 3);
                    this.existingUsers[data.userIP].peerConnection.setRemoteDescription(new RTCSessionDescription(data.message));
                    this.sendAnswer(data.userIP);
                }
            }
            else if (data.message.type === 'answer' && data.userIP !== this.localData.IP) {// for initiator we don't answer
                if (this.localData.IP === data.targetIP) {
                    console.log('%c Getting Answer', 'background: #0A0; color: #FFF');
                    this.existingUsers[data.userIP].peerConnection.setRemoteDescription(new RTCSessionDescription(data.message));
                }
            }
            else if (data.message.type === 'candidate') {
                console.log(data.message.targetIP, this.localData.IP);
                if (this.localData.IP === data.message.targetIP) {
                    console.log("candidate Thing");
                    const candidate = new RTCIceCandidate({
                        sdpMLineIndex: data.message.label,
                        candidate: data.message.candidate
                    });
                    this.existingUsers[data.userIP].peerConnection.addIceCandidate(candidate);
                }
            }
            else if (data.message === this.socketEvents.closeConnection) {
                this.remoteHangup(data.userIP);
            }
        });

        // const remoteElements = document.querySelectorAll('.remoteVideo');
        // for (const i of remoteElements) {
        //     i.className = i.className + ' idleVideo ';
        // }
        if (colorPallet === null || colorPallet === undefined)
            colorPallet = ['#283592', '#6d64e8', '#4e5663', '#e01c84'];
        this.colorPallet = colorPallet;

    }// end of constructor

    startMediaStreaming = async () => {
        try {
            //try video
            const localStream = await navigator.mediaDevices.getUserMedia(this.constraints);
            this.gotUserStream(localStream);
        }
        catch (err) {
            console.log(err);

            //try audio
            // const userThumbnail = this.createAlphabaticThumbnail('Abdulrahman Khallil');
            // this.localVideoElement.parentElement.appendChild(userThumbnail);
            this.setConstrains({ audio: true, video: false });
            try {
                const audioStream = await navigator.mediaDevices.getUserMedia(this.constraints);
                this.gotUserStream(audioStream);
            }
            catch (err) {
                console.log(err);
                //try nothing
                this.setConstrains({ audio: false, video: false });
                const noStream = await navigator.mediaDevices.getUserMedia(this.constraints);
                this.gotUserStream(noStream);
            }
        }
        this.socket.emit(this.socketEvents.createJoinRoom, 'got user media');

        window.onbeforeunload = () => {
            this.socket.emit(this.socketEvents.closeConnection, { userIP: this.localData.IP });
            this.sendServerMessage(this.socketEvents.closeConnection)
        };
    }

    gotUserStream = stream => {
        this.localData.stream = stream;
        this.localData.videoElement.srcObject = stream;
        // console.log(this.localData.pendingPeers )
        // for (let userIP in this.localData.pendingPeers) {
        //     if (userIP === this.localData.IP)
        //         continue;
        //     this.createNewPeer({
        //         userIP,
        //         socketID: data.existingUsers[userIP].socketID,
        //         initiator: false
        //     });
        //     this.sendServerMessage({ type: 'got user media', target: this.localData.userIP });
        // }
        // this.localData.pendingPeers = null;
        // this.sendServerMessage({ type: 'got user media', target: this.localData.currentlyPeering });
        // if (this.isInitiator) {
        //     this.tryStart();
        // }
        // this.requestTurn();
    }



    sendServerMessage = (message, extraParam = null) => {// send messages only if user can reconginze himself/herself
        console.log('called. the ip is', this.localData.IP)
        if (this.localData.IP) {
            this.internalSendMessage(message, extraParam);
        }
        else {
            const waitingIP = setInterval(() => {
                if (this.localData.IP) {
                    clearInterval(waitingIP);
                    internalSendMessage(message, extraParam);
                }
            }, 5);
        }
    };

    internalSendMessage = (message, extraParam) => {
        const perparedMessage = {
            userIP: this.localData.IP,
            socketID: this.localData.socketID,
            message
        }
        if (extraParam)
            perparedMessage.targetIP = extraParam;
        this.socket.emit(this.socketEvents.serverMessage, perparedMessage);
    }

    tryStart = (userIP, param) => {
        console.log('Trying to start', param, this.existingUsers[userIP])
        console.log('Condition is', !this.existingUsers[userIP].isStarted, typeof this.localData.stream !== 'undefined', !this.existingUsers[userIP].isStarted && typeof this.localData.stream !== 'undefined')

        if (!this.existingUsers[userIP].isStarted && typeof this.localData.stream !== 'undefined') {
            console.log('We are good but not started yet', param)
            this.localData.stream.getTracks().forEach(track => {
                this.existingUsers[userIP].peerConnection.addTrack(track, this.localData.stream)
            });
            console.log('just sent video, audio tracks', param)
            this.existingUsers[userIP].isStarted = true;
            console.log('should start now', param)
            if (this.existingUsers[userIP].isInitiator) {
                console.log('Going to send offer now', param)
                this.sendOffer(userIP);
            }
            else {
                // this.sendServerMessage({ type: 'send me offer', targetIP: userIP, userIP: this.localData.IP});
            }
        }
        else if (this.existingUsers[userIP].peerConnection.getReceivers().length !== 0 && this.existingUsers[userIP].isInitiator) {
            console.log('Going to send special offer now', param)
            this.sendOffer(userIP);
        }
    }


    CreatePeerConnection = (peerConnectionConstrains, peerConnection) => {
        const pcConstrains = peerConnectionConstrains || null;
        try {
            peerConnection = new RTCPeerConnection(pcConstrains);
            // peerConnection.onicecandidate = this.iceCandidateHandler;
            // peerConnection.onaddstream = this.remoteStreamAddedHandler;
            // peerConnection.onremovestream = this.remoteStreamRemovedHandler;
            return peerConnection;
        }
        catch (err) {
            console.error('Error on creating peer connection', err)
            return null;
        }
    }

    iceCandidateHandler = (event, userIP) => {
        console.log('New Candidate')
        if (event.candidate) {
            this.sendServerMessage({
                type: 'candidate',
                label: event.candidate.sdpMLineIndex,
                id: event.candidate.sdpMid,
                candidate: event.candidate.candidate,
                targetIP: userIP,
                senderIP: this.localData.IP
            });
        }
        else
            console.warn('Error No candidates to be added');
    }

    remoteStreamAddedHandler = (event, userIP) => {
        console.log('New Stream added')
        this.existingUsers[userIP].stream = event.stream;
        this.setNextRemoteVideo(event.stream, userIP);
    }

    remoteStreamRemovedHandler = (event, userIP) => {
        // stop the users remoteVideo and free it for future use
    }

    setNextRemoteVideo = (stream, userIP) => {
        //getting the not working video and play set this stream to it
        const videoElement = document.createElement('video');
        const videoContainer = document.createElement('div');
        this.remoteVideosParent.appendChild(videoContainer);
        videoContainer.setAttribute('id', 'video-' + userIP.replace(/\./g, '-'));
        videoContainer.appendChild(videoElement);
        videoElement.setAttribute('autoplay', 'true');
        videoElement.setAttribute('muted', 'muted');
        videoElement.setAttribute('volume', '0');
        videoElement.setAttribute('contorls', 'contorls');
        videoElement.setAttribute('poster', '/assets/images/avatar-placeholder.png')
        videoElement.srcObject = stream;
        this.existingUsers[userIP].videoElement = videoElement;
        //should we send server a copy ?
    }

    sendOffer = (userIP) => {
        console.log('The Local Description is', this.existingUsers[userIP].peerConnection, this.existingUsers[userIP].peerConnection.localDescription)
        if (this.existingUsers[userIP].peerConnection.localDescription)
            return;
        console.log('Sending Offer by' + this.localData.IP);
        // this.localData.tempTarget = userIP;// work arround to set a target fo each offer
        console.log('set the workaround target IP');
        this.existingUsers[userIP].peerConnection.createOffer(sessionDescription => {
            sessionDescription.targetIP = userIP;
            this.setLocalSDPSendServer(userIP, sessionDescription)
        },
            error => {
                console.error('Error on creating an offer ', error);
            });
        console.log('offerCompleted');
    }

    sendAnswer = (userIP) => {
        console.log('sending Answer')
        this.localData.tempTarget = userIP;// work arround to set a target fo each offer
        this.existingUsers[userIP].peerConnection.createAnswer()
            .then(sessionDescription => { this.setLocalSDPSendServer(userIP, sessionDescription) })
            .catch((error) => {
                console.error('Error on creating a response', error);
            });
    }

    setLocalSDPSendServer = (userIP, sessionDescription) => {
        console.log('SettingLocal Description', sessionDescription);
        this.existingUsers[userIP].peerConnection.setLocalDescription(sessionDescription);
        console.log('Should send candidate now This peer ', this.existingUsers[userIP]);
        console.log('Should send candidate now Description', this.existingUsers[userIP].peerConnection);
        this.sendServerMessage(sessionDescription, { targetIP: userIP });
        this.localData.tempTarget = null;
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

    remoteHangup = userIP => {
        //which user to stop
        console.log(userIP);
        this.destoryPeerConnection(userIP);
    }

    stop = () => {
        // this.isStarted = false;
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

    createNewPeer = ({ userIP, socketID, initiator }) => {
        if (this.existingUsers[userIP] !== undefined)
            this.destoryPeerConnection(userIP);
        console.log('Creating Peer for', userIP, socketID, initiator);
        this.existingUsers = {
            ...this.existingUsers,
            [userIP]: {
                stream: null,
                videoElement: null,
                peerConnection: this.CreatePeerConnection(null, null),
                isInitiator: initiator,
                isStarted: false,
                socketID,
            }
        };
        this.existingUsers[userIP].peerConnection.onicecandidate = event => {
            this.iceCandidateHandler(event, userIP)
        };
        this.existingUsers[userIP].peerConnection.onaddstream = event => {
            this.remoteStreamAddedHandler(event, userIP)
        };
        this.existingUsers[userIP].peerConnection.onremovestream = event => {
            this.remoteStreamRemovedHandler(event, userIP)
        };
        // if initiator start   
        if (initiator)
            this.tryStart(userIP, 1);

        // checkbox.onclick = () => {
        //     if (checkbox.checked) {
        //         videoSender = pc1.addTrack(videoTrack, stream);
        //     } else {
        //         pc1.removeTrack(videoSender);
        //     }
        // }
    };

    destoryPeerConnection = (userIP) => {
        try {
            this.existingUsers[userIP].peerConnection.close();
            this.existingUsers[userIP].peerConnection = null;
            this.existingUsers[userIP].videoElement.parentElement.remove();
            delete this.existingUsers[userIP];
        }
        catch (err) { }
    }

}