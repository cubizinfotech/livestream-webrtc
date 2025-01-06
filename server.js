const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const webrtc = require("wrtc");
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const multer = require('multer');

// Set up multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, './record'); // Path where recordings will be stored
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname)); // Unique filename
    }
});

const upload = multer({ storage: storage });

// Route to handle video saving
app.post('/save-recording', upload.single('video'), (req, res) => {
    res.send({ message: 'Recording saved successfully', filePath: req.file.path });
});

let senderStream;
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*", // Allows any origin, you can restrict it to specific domains like "http://yourdomain.com"
        methods: ["GET", "POST"],
    }
});

app.use(express.static('public'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));


// WebSocket to handle chat messages
io.on('connection', socket => {
    socket.on('chat-message', message => {
        io.emit('chat-message', message);
    });

    // ICE Candidate handling
    socket.on('ice-candidate', (candidate) => {
        console.log("Received ICE Candidate from client:", candidate);
        socket.broadcast.emit('ice-candidate', candidate);
    });
});

app.post("/consumer", async (req, res) => {
    const peer = new webrtc.RTCPeerConnection({
        iceServers: [{ urls: "stun:stunprotocol.org" }]
    });

    const desc = new webrtc.RTCSessionDescription(req.body.sdp);
    await peer.setRemoteDescription(desc);
    
    if (senderStream) {
        senderStream.getTracks().forEach(track => peer.addTrack(track, senderStream));
    } else {
        console.error("senderStream is not available");
    }

    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);

    const payload = { sdp: peer.localDescription };
    res.json(payload);
});

app.post('/broadcast', async (req, res) => {
    const peer = new webrtc.RTCPeerConnection({
        iceServers: [{ urls: "stun:stunprotocol.org" }]
    });

    peer.ontrack = (e) => handleTrackEvent(e, peer);

    const desc = new webrtc.RTCSessionDescription(req.body.sdp);
    await peer.setRemoteDescription(desc);

    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);

    const payload = { sdp: peer.localDescription };
    res.json(payload);
});

function handleTrackEvent(e, peer) {
    console.log("iceConnectionState: ", peer.iceConnectionState);
    console.log("localDescription: ", peer.localDescription);

    if (e.streams && e.streams[0]) {
        senderStream = e.streams[0];
    } else {
        console.error('No stream available in the track event');
    }
}

// Serve the broadcaster and viewer pages
app.get('/', (req, res) => 
    res.sendFile(path.join(__dirname, 'public', 'index.html'))
);

app.get('/broadcaster', (req, res) =>
    res.sendFile(path.join(__dirname, 'public', 'broadcaster.html'))
);
app.get('/viewer', (req, res) =>
    res.sendFile(path.join(__dirname, 'public', 'viewer.html'))
);

server.listen(3069, () => console.log('Server started on port 3069.'));
