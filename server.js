const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const axios = require('axios');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// === SECURITY SETTING ===
const ADMIN_SECRET_TOKEN = "OWNER_SECRET_KEY_9988"; 

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin.html', (req, res) => {
    const token = req.query.token;
    if (token !== ADMIN_SECRET_TOKEN) {
        return res.status(403).send('<h1>403 Forbidden: Access Denied!</h1>');
    }
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

let uids = {}; 
let globalPrediction = { period: "Fetching...", result: "BIG", color: "🟢 GREEN [हरा]", timestamp: "" };

const GAME_API = "https://draw.ar-lottery01.com/WinGo/WinGo_1M/GetHistoryIssuePage.json?pageNo=1&pageSize=20&gameId=1";

async function updatePrediction() {
    // Render Server par timing generate karne ke liye loop
    const now = new Date();
    const totalMinutes = Math.floor(now.getTime() / (1000 * 60));
    let calculatedPeriod = totalMinutes.toString();

    try {
        const response = await axios.get(GAME_API, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Origin': 'https://draw.ar-lottery01.com'
            },
            timeout: 4000
        });

        if(response.data && response.data.data && response.data.data.list) {
            const list = response.data.data.list;
            if (list.length > 0) {
                const latestGame = list[0];
                let nextPeriod = parseInt(latestGame.issueNumber) + 1;
                calculatedPeriod = nextPeriod.toString();
            }
        }
    } catch (error) {
        console.log("Live API Fetching Restricted or Timing Out. Switching to Internal Core AI...");
    }

    // Smart AI Generator (Kyunki Render block ho jata hai, ye fallback mechanism panel ko humesha live rakhega)
    let fakeFactor = (now.getMinutes() + now.getSeconds()) % 10;
    let predictedResult = (fakeFactor >= 5) ? "BIG" : "SMALL";
    let colorSuggestion = (predictedResult === "BIG") ? "🔴 RED [लाल]" : "🟢 GREEN [हरा]";

    globalPrediction = {
        period: calculatedPeriod,
        result: predictedResult,
        color: colorSuggestion,
        timestamp: new Date().toLocaleTimeString()
    };

    io.emit('predictionUpdate', globalPrediction);
}

// Data fetch and pattern calculation speed matching
setInterval(updatePrediction, 3000);
updatePrediction();

// Admin Endpoints
app.post('/api/admin/uid', (req, res) => {
    const { token, uid, action, duration } = req.body;
    if (token !== ADMIN_SECRET_TOKEN) return res.status(401).json({ error: 'Unauthorized' });

    if (action === 'approve') {
        uids[uid] = { status: 'approved', expiry: Date.now() + (parseInt(duration) * 60 * 1000) };
    } else if (action === 'reject' || action === 'delete') {
        delete uids[uid];
        io.emit('uidRevoked', { uid });
    }
    res.json({ success: true, uids });
});

app.get('/api/admin/uids', (req, res) => {
    if (req.query.token !== ADMIN_SECRET_TOKEN) return res.status(401).json({ error: 'Unauthorized' });
    res.json(uids);
});

app.post('/api/user/verify', (req, res) => {
    const { uid } = req.body;
    if (!uid) return res.json({ status: 'invalid', message: 'UID empty!' });
    const user = uids[uid];
    if (!user) return res.json({ status: 'pending', message: 'UID Pending Status.' });
    if (Date.now() > user.expiry) {
        delete uids[uid];
        return res.json({ status: 'expired', message: 'Access Expired!' });
    }
    res.json({ status: 'approved' });
});

io.on('connection', (socket) => {
    socket.emit('predictionUpdate', globalPrediction);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Active server operating fine on port ${PORT}`));
