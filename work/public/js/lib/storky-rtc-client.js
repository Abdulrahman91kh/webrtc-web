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
        this.localData = {
            IP: null,
            stream: null,
            socketID: null,
            pendingPeers: {},
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
            // console.log('New User is going to join', newUserData);
        });

        socket.on(socketEvents.roomJoined, data => {
            this.localData = {
                ...this.localData,
                IP: data.currentUser.userIP,
                socketID: data.currentUser.socketID
            }
            this.localData.pendingPeers = data.existingUsers;
            this.popPendingPeer();
        });

        socket.on(socketEvents.serverMessage, data => {
            // console.log('server is saying a message')
            // console.log(data);
            if (data.message.type === 'got user media') {
                if (this.localData.IP === data.targetIP){
                    this.createNewPeer({
                        userIP: data.userIP,
                        socketID: data.socketID,
                        initiator: false,
                    });
                }
            }
            
            else if (data.message.type === 'offer') {//getting an offer and aswering it
                if (this.localData.IP === data.targetIP) {
                    this.existingUsers[data.userIP].peerConnection.setRemoteDescription(new RTCSessionDescription(data.message));
                    this.sendAnswer(data.userIP);
                }
            }
            else if (data.message.type === 'answer' && data.userIP !== this.localData.IP) {// for initiator we don't answer
                if (this.localData.IP === data.targetIP) {
                    this.existingUsers[data.userIP].peerConnection.setRemoteDescription(new RTCSessionDescription(data.message));
                }
            }
            else if (data.message.type === 'candidate') {
                // console.log("candidate Thing");
                // console.log(data);
                // console.log(data.targetIP === this.localData.IP);
                if( data.targetIP === this.localData.IP){
                    const candidate = new RTCIceCandidate({
                        sdpMLineIndex: data.message.label,
                        candidate: data.message.candidate
                    });
                    this.existingUsers[data.userIP].peerConnection.addIceCandidate(candidate);
                    // console.log("candidate added");
                }
            }
            else if (data.message === this.socketEvents.closeConnection) {
                this.remoteHangup(data.userIP);
            }
        });

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
            // this.setConstrains({ audio: true, video: false });
            try {
                const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
                this.gotUserStream(audioStream);
            }
            catch (err) {
                console.log(err);
                //try nothing
                // this.setConstrains({ audio: false, video: false });
                const noStream = await navigator.mediaDevices.getUserMedia({ audio: false, video: false });
                this.gotUserStream(noStream);
            }
        }
        this.socket.emit(this.socketEvents.createJoinRoom, 'MyRoomName');

        window.onbeforeunload = () => { 
            this.socket.emit(this.socketEvents.closeConnection, {userIP: this.localData.IP});
            this.sendServerMessage(this.socketEvents.closeConnection) 
        };
    }

    gotUserStream = stream => {
        this.localData.stream = stream;
        this.localData.videoElement.srcObject = stream;
    }

    sendServerMessage = (message, extraParam = null) => {// send messages only if user can reconginze himself/herself
        // console.log('called. the ip is', this.localData.IP)
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
        let perparedMessage = {
            userIP: this.localData.IP,
            socketID: this.localData.socketID,
            message
        }
        if (extraParam)
            perparedMessage = { ...perparedMessage, ...extraParam};
        this.socket.emit(this.socketEvents.serverMessage, perparedMessage);
    };

    CreatePeerConnection = (peerConnectionConstrains) => {
        const pcConstrains = peerConnectionConstrains || null;
        try {
            const peerConnection = new RTCPeerConnection(pcConstrains);
            return peerConnection;
        }
        catch (err) {
            console.error('Error on creating peer connection', err)
            return null;
        }
    }

    iceCandidateHandler = (event, userIP) => {
        // console.log('New Candidate')
        if (event.candidate) {
            this.sendServerMessage({
                type: 'candidate',
                label: event.candidate.sdpMLineIndex,
                id: event.candidate.sdpMid,
                candidate: event.candidate.candidate,
                senderIP: this.localData.IP
            }, { targetIP: userIP });
        }
        else
            console.warn('Error No candidates to be added');
    }

    remoteStreamAddedHandler = (event, userIP) => {
        // console.log('New Stream added')
        this.existingUsers[userIP].stream = event.stream;
        this.setRemoteVideo(event.stream, userIP);
        this.popPendingPeer();
    }

    remoteStreamRemovedHandler = (event, userIP) => {
        // stop the users remoteVideo and free it for future use
    }

    setRemoteVideo = (stream, userIP) => {
        //getting the not working video and play set this stream to it
        const videoElement = document.createElement('video');
        const videoContainer = document.createElement('div');
        this.remoteVideosParent.appendChild(videoContainer);
        videoContainer.setAttribute('id', 'video-' + userIP.replace(/\./g, '-'));
        videoContainer.appendChild(videoElement);
        videoElement.setAttribute('autoplay', 'true');
        videoElement.setAttribute('poster', '/assets/images/avatar-placeholder.png')
        videoElement.srcObject = stream;
        this.existingUsers[userIP].videoElement = videoElement;
        //should we send server a copy ?
    }

    sendOffer = (userIP) => {
        // console.log('Sending Offer by' + this.localData.IP);
        // console.log('set the workaround target IP');
        this.existingUsers[userIP].peerConnection.createOffer( sessionDescription => { 
            sessionDescription.targetIP = userIP;
            this.setLocalSDPSendServer(userIP, sessionDescription)
        },
            error => {
            console.error('Error on creating an offer ', error);
        });
        // console.log('offerCompleted');
    }

    sendAnswer = (userIP) => {
        // console.log('sending Answer')
        this.existingUsers[userIP].peerConnection.createAnswer()
            .then( sessionDescription => { this.setLocalSDPSendServer(userIP, sessionDescription) } )
            .catch((error) => {
                console.error('Error on creating a response', error);
            });
    }

    setLocalSDPSendServer = (userIP, sessionDescription) => {
        // console.log('SettingLocal Description', sessionDescription);
        this.existingUsers[userIP].peerConnection.setLocalDescription(sessionDescription);
        // console.log('Should send candidate now This peer ', this.existingUsers[userIP]);
        // console.log('Should send candidate now Description', this.existingUsers[userIP].peerConnection);
        this.sendServerMessage(sessionDescription, {targetIP: userIP});
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
        //close all peer connections
        // this.peerConnection.close();
        // this.peerConnection = null;
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

    setConstrains = constraints => {
        this.constraints = { ...constraints };
        this.setSessionDescriptionPeerConstrains(constraints)
    }

    createNewPeer = ({ userIP, socketID, initiator }) => {
        if(this.existingUsers[userIP] !== undefined)
            this.destoryPeerConnection(userIP);
        // console.log('Creating Peer for', userIP, socketID, initiator);
        this.existingUsers[userIP] = {
            stream: null,
            videoElement: null,
            peerConnection: this.CreatePeerConnection(null),
            isInitiator: initiator,
            socketID,
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
        this.startPeeringFlow(userIP);

        // checkbox.onclick = () => {
        //     if (checkbox.checked) {
        //         videoSender = pc1.addTrack(videoTrack, stream);
        //     } else {
        //         pc1.removeTrack(videoSender);
        //     }
        // }
    };

    destoryPeerConnection = (userIP) => {
        try{
            this.existingUsers[userIP].peerConnection.close();
            this.existingUsers[userIP].peerConnection = null;
            this.existingUsers[userIP].videoElement.parentElement.remove();
            delete this.existingUsers[userIP];
        }
        catch(err){}
    }

    popPendingPeer = () => {
        // console.log('Starting Poping', this.localData.pendingPeers);
        const nextIP = Object.keys(this.localData.pendingPeers)[0];
        if (nextIP === undefined){
            // console.log('End of stack');
            return false;
        }
        if (nextIP === this.localData.IP){
            delete this.localData.pendingPeers[nextIP];
            this.popPendingPeer();
        }
        const tempPeer = {...this.localData.pendingPeers[nextIP]};
        // console.log(tempPeer);
        this.createNewPeer({
            userIP: nextIP,
            socketID: tempPeer.socketID,
            initiator: true
        });
        delete this.localData.pendingPeers[nextIP];
        this.sendServerMessage({ type: 'got user media' }, { targetIP: nextIP });
    }

    startPeeringFlow = userIP => {
        const watiingLocalStream = setInterval(() => {
            if (this.localData.stream !== undefined ){
                clearInterval(watiingLocalStream);
                this.localData.stream.getTracks().forEach(track => {
                    this.existingUsers[userIP].peerConnection.addTrack(track, this.localData.stream)
                });
            }
            if( this.existingUsers[userIP].isInitiator ){
                this.sendOffer(userIP);
            }
        }, 2);
    }

}