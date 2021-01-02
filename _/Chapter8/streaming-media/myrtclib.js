
    var chunkSize = 1024;

    var receiverBuffer = null;
    var recvMediaSource = null;

    var RTCPeerConnection = null;

    var room = null;
    var initiator;

    var pc = null;
    var signalingURL;
    var remoteVideo = null;

    var data_channel = null;

    var channelReady;
    var channel;

    var chunks = 0;
    var queue = [];

    window.MediaSource = window.MediaSource || window.WebKitMediaSource;

    var pc_config = {"iceServers":
       [{url:'stun:23.21.150.121'},
        {url:'stun:stun.l.google.com:19302'}]};

    function myrtclibinit(sURL, rv) {
        signalingURL = sURL;
        remoteVideo = rv;
        openChannel();
    };

    function openChannel() {
        channelReady = false;
        channel = new WebSocket(signalingURL);
        channel.onopen = onChannelOpened;
        channel.onmessage = onChannelMessage;
        channel.onclose = onChannelClosed;
    };

    function onChannelOpened() {
        channelReady = true;
        createPeerConnection();

        if(location.search.substring(1,5) == "room") {
            room = location.search.substring(6);
            sendMessage({"type" : "ENTERROOM", "value" : room * 1});
            initiator = true;
            doCall();
        } else {
            sendMessage({"type" : "GETROOM", "value" : ""});
            initiator = false;
        }
    };

    function onChannelMessage(message) {
        processSignalingMessage(message.data);
    };

    function onChannelClosed() {
        channelReady = false;
    };

    function sendMessage(message) {
        var msgString = JSON.stringify(message);
        channel.send(msgString);
    };

    function processSignalingMessage(message) {
        var msg = JSON.parse(message);

        if (msg.type === 'offer') {
            pc.setRemoteDescription(new RTCSessionDescription(msg), function() {}, failureCallback);
            doAnswer();
        } else if (msg.type === 'answer') {
            pc.setRemoteDescription(new RTCSessionDescription(msg), function() {}, failureCallback);
        } else if (msg.type === 'candidate') {
            var candidate = new RTCIceCandidate({sdpMLineIndex:msg.label, candidate:msg.candidate});
            pc.addIceCandidate(candidate, function() {}, failureCallback);
        } else if (msg.type === 'GETROOM') {
            room = msg.value;
            onRoomReceived(room);
        } else if (msg.type === 'WRONGROOM') {
            window.location.href = "/";
        }
    };

    function createPeerConnection() {
        try {
            pc = new RTCPeerConnection(pc_config, null);
            pc.onicecandidate = onIceCandidate;
            pc.ondatachannel = onDataChannel;
        } catch (e) {
            console.log(e);
            pc = null;
            return;
        }
    };

    function onDataChannel(evt) {
        console.log('Received data channel creating request');
        data_channel = evt.channel;
        initDataChannel();
    }

    function createDataChannel(role) {
        try {
            data_channel = pc.createDataChannel("datachannel_"+room+role, null);
        } catch (e) {
            console.log('error creating data channel ' + e);
            return;
        }
        initDataChannel();
    }

    function initDataChannel() {
        data_channel.onopen = onChannelStateChange;
        data_channel.onclose = onChannelStateChange;
        data_channel.onmessage = onReceiveMessageCallback;
    }

    function onIceCandidate(event) {
        if (event.candidate)
            sendMessage({type: 'candidate', label: event.candidate.sdpMLineIndex, id: event.candidate.sdpMid,
                candidate: event.candidate.candidate});
    };

    function failureCallback(e) {
        console.log("failure callback "+ e.message);
    }

    function doCall() {
        createDataChannel("caller");
        pc.createOffer(setLocalAndSendMessage, failureCallback, null);
    };

    function doAnswer() {
        pc.createAnswer(setLocalAndSendMessage, failureCallback, null);
    };

    function setLocalAndSendMessage(sessionDescription) {
        sessionDescription.sdp = setBandwidth(sessionDescription.sdp);
        pc.setLocalDescription(sessionDescription, function() {}, failureCallback);
        sendMessage(sessionDescription);
    };

    function sendDataMessage(data) {
        data_channel.send(data);
    };

    function onChannelStateChange() {
        console.log('Data channel state is: ' + data_channel.readyState);
    }

    function onReceiveMessageCallback(event) {
        try {
            var msg = JSON.parse(event.data);
            if (msg.type === 'chunk') {
                onChunk(msg.data);
            }
        }
        catch (e) {}
    };

    var streamBlob = null;
    var streamIndex = 0;
    var streamSize = 0;

    function doStreamMedia(fileName) {
        var fileReader = new window.FileReader();
        fileReader.onload = function (e) {
            streamBlob = new window.Blob([new window.Uint8Array(e.target.result)]);
            streamSize = streamBlob.size;
            streamIndex = 0;
            streamChunk();
        };
        fileReader.readAsArrayBuffer(fileName);
    }

    function streamChunk() {
        if (streamIndex >= streamSize) sendDataMessage({end: true});
        var fileReader = new window.FileReader();
        fileReader.onload = function (e) {
            var chunk = new window.Uint8Array(e.target.result);
            streamIndex += chunkSize;
            pushChunk(chunk);
            window.requestAnimationFrame(streamChunk);
        };
        fileReader.readAsArrayBuffer(streamBlob.slice(streamIndex, streamIndex + chunkSize));
    }

    function doReceiveStreaming() {

        recvMediaSource = new MediaSource();

        remoteVideo.src = window.URL.createObjectURL(recvMediaSource);

        recvMediaSource.addEventListener('sourceopen', function (e) {
            remoteVideo.play();

            receiverBuffer = recvMediaSource.addSourceBuffer('video/webm; codecs="vorbis,vp8"');

            receiverBuffer.addEventListener('error', function(e) { console.log('error: ' + receiverBuffer.readyState); });
            receiverBuffer.addEventListener('abort', function(e) { console.log('abort: ' + receiverBuffer.readyState); });
            receiverBuffer.addEventListener('update', function(e) {
                if (queue.length > 0 && !receiverBuffer.updating) doAppendStreamingData(queue.shift());
            });
            console.log('media source state: ', this.readyState);
            doAppendStreamingData(queue.shift());
        }, false);

        recvMediaSource.addEventListener('sourceended', function(e) { console.log('sourceended: ' + this.readyState); });
        recvMediaSource.addEventListener('sourceclose', function(e) { console.log('sourceclose: ' + this.readyState); });
        recvMediaSource.addEventListener('error', function(e) { console.log('error: ' + this.readyState); });
    };

    function doAppendStreamingData(data) {
        var uint8array = new window.Uint8Array(data);
        receiverBuffer.appendBuffer(uint8array);
    };

    function doEndStreamingData() {
        recvMediaSource.endOfStream();
    };

    function pushChunk(data) {
        var msg = JSON.stringify({"type" : "chunk", "data" : Array.apply(null, data)});
        sendDataMessage(msg);
    };

    function onChunk(data) {
        chunks++;
        if (chunks == 1) {
            console.log("first frame");
            queue.push(data);
            doReceiveStreaming();
            return;
        }
        if (data.end) {
            console.log("last frame");
            doEndStreamingData();
            return;
        }
        if (receiverBuffer.updating || queue.length > 0) queue.push(data);
        else doAppendStreamingData(data);
    };

    function setBandwidth(sdp) {
        sdp = sdp.replace( /a=mid:data\r\n/g , 'a=mid:data\r\nb=AS:1638400\r\n');
        return sdp;
    }