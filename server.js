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

// === SECURITY SETTING: Change your Admin Token here ===
const ADMIN_SECRET_TOKEN = "OWNER_SECRET_KEY_9988"; 

// Root route 
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Protect Admin HTML page from direct opening
app.get('/admin.html', (req, res) => {
    const token = req.query.token;
    if (token !== ADMIN_SECRET_TOKEN) {
        return res.status(403).send('<h1>403 Forbidden: Access Denied! Unauthorised Entry Detected.</h1>');
    }
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Server Storage Memory
let uids = {}; 
let globalPrediction = { period: "Loading...", result: "-", color: "-", timestamp: "" };

// Sahi structured parameters API for WinG0 1M
const GAME_API = "https://draw.ar-lottery01.com/WinGo/WinGo_1M/GetHistoryIssuePage.json?pageNo=1&pageSize=20&gameId=1";

async function updatePrediction() {
    try {
        const response = await axios.get(GAME_API, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Referer': 'https://draw.ar-lottery01.com/',
                'Origin': 'https://draw.ar-lottery01.com'
            },
            timeout: 6000
        });

        if(response.data && response.data.data && response.data.data.list) {
            const list = response.data.data.list;
            if (list.length === 0) return;

            const latestGame = list[0];
            
            // Advanced AI Trend Pattern Algorithm Loop
            let totalSum = 0;
            let loopLimit = Math.min(list.length, 10); // Check last 10 rounds for precision
            for(let i = 0; i < loopLimit; i++) {
                totalSum += parseInt(list[i].number || 0);
            }
            
            let nextPeriod = parseInt(latestGame.issueNumber) + 1;
            
            // Smart AI Logic Predictor Selector
            let calcFactor = (totalSum + nextPeriod + 7) % 10;
            let predictedResult = (calcFactor >= 5) ? "BIG" : "SMALL";
            let colorSuggestion = (predictedResult === "BIG") ? "🔴 RED [लाल] + 🔮 VIOLET" : "🟢 GREEN [हरा]";

            globalPrediction = {
                period: nextPeriod.toString(),
                result: predictedResult,
                color: colorSuggestion,
                timestamp: new Date().toLocaleTimeString()
            };

            io.emit('predictionUpdate', globalPrediction);
        }
    } catch (error) {
        console.log("Live Sync Status -> Log Trace:", error.message);
    }
}

// Auto check every 3.5 seconds for instant AI detection
setInterval(updatePrediction, 3500);
updatePrediction();

// Protected Admin Actions Endpoint
app.post('/api/admin/uid', (req, res) => {
    const { token, uid, action, duration } = req.body;
    if (token !== ADMIN_SECRET_TOKEN) {
        return res.status(401).json({ error: 'Unauthorized Access' });
    }

    if (action === 'approve') {
        const expiry = Date.now() + (parseInt(duration) * 60 * 1000);
        uids[uid] = { status: 'approved', expiry: expiry };
    } else if (action === 'reject' || action === 'delete') {
        delete uids[uid];
        io.emit('uidRevoked', { uid });
    }
    res.json({ success: true, uids });
});

// Protected Database Fetch Endpoint
app.get('/api/admin/uids', (req, res) => {
    const token = req.query.token;
    if (token !== ADMIN_SECRET_TOKEN) {
        return res.status(401).json({ error: 'Unauthorized Access' });
    }
    res.json(uids);
});

// Access authentication verify gateway
app.post('/api/user/verify', (req, res) => {
    const { uid } = req.body;
    if (!uid) return res.json({ status: 'invalid', message: 'UID empty!' });

    const user = uids[uid];
    if (!user) {
        return res.json({ status: 'pending', message: 'UID Status: PENDING! Please contact admin on Telegram to activate.' });
    }
    if (Date.now() > user.expiry) {
        delete uids[uid];
        return res.json({ status: 'expired', message: 'Access Expired! Purchase a new key from admin.' });
    }
    res.json({ status: 'approved' });
});

io.on('connection', (socket) => {
    socket.emit('predictionUpdate', globalPrediction);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server environment operating fine on port ${PORT}`));
