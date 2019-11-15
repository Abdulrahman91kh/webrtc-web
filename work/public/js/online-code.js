let pc1 = new RTCPeerConnection(), pc2 = new RTCPeerConnection(), stream, videoTrack, videoSender;

(async () => {
    try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        videoTrack = stream.getVideoTracks()[0];
        pc1.addTrack(stream.getAudioTracks()[0], stream);
    } catch (e) {
        console.log(e);
    }
})();

checkbox.onclick = () => {
    if (checkbox.checked) {
        videoSender = pc1.addTrack(videoTrack, stream);
    } else {
        pc1.removeTrack(videoSender);
    }
}

pc2.ontrack = e => {
    video.srcObject = e.streams[0];
    e.track.onended = e => video.srcObject = video.srcObject; // Chrome/Firefox bug
}

pc1.onicecandidate = e => pc2.addIceCandidate(e.candidate);
pc2.onicecandidate = e => pc1.addIceCandidate(e.candidate);
pc1.onnegotiationneeded = async e => {
    try {
        await pc1.setLocalDescription(await pc1.createOffer());
        await pc2.setRemoteDescription(pc1.localDescription);
        await pc2.setLocalDescription(await pc2.createAnswer());
        await pc1.setRemoteDescription(pc2.localDescription);
    } catch (e) {
        console.log(e);
    }
}