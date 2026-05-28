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

// Root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Server Storage Memory
let uids = {}; 
let globalPrediction = { period: "Loading...", result: "-", color: "-", timestamp: "" };

// Target Official API URL
const GAME_API = "https://draw.ar-lottery01.com/WinGo/WinGo_1M/GetHistoryIssuePage.json?pageNo=1&pageSize=20&gameId=1";

async function updatePrediction() {
    try {
        const response = await axios.get(GAME_API, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Referer': 'https://draw.ar-lottery01.com/',
                'Origin': 'https://draw.ar-lottery01.com'
            },
            timeout: 5000
        });

        if(response.data && response.data.data && response.data.data.list) {
            const list = response.data.data.list;
            if (list.length === 0) return;

            // 1. Fetching the exact latest raw period from API
            const latestGame = list[0];
            
            // 2. Add 1 to target the exact UPCOMING current active period
            let nextPeriodRaw = parseInt(latestGame.issueNumber) + 1;
            
            // 3. Keep full length string exactly as it is (No truncation, No slice)
            let finalPeriodString = nextPeriodRaw.toString();

            // Core Pattern Algorithm loop calculation
            let totalSum = 0;
            let loopLimit = Math.min(list.length, 7); 
            for(let i = 0; i < loopLimit; i++) {
                totalSum += parseInt(list[i].number || 0);
            }
            
            let calcFactor = (totalSum + nextPeriodRaw) % 10;
            let predictedResult = (calcFactor >= 5) ? "BIG" : "SMALL";
            let colorSuggestion = (predictedResult === "BIG") ? "🔴 RED [लाल] + 🔮 VIOLET" : "🟢 GREEN [हरा]";

            // Binding exact values to global object
            globalPrediction = {
                period: finalPeriodString, // Enforcing original absolute full length period string
                result: predictedResult,
                color: colorSuggestion,
                timestamp: new Date().toLocaleTimeString()
            };

            // Instant push to all active user dashboards
            io.emit('predictionUpdate', globalPrediction);
        }
    } catch (error) {
        console.log("Live Sync Status -> Log Trace:", error.message);
    }
}

// Fixed interval loop (Checking feed updates cleanly)
setInterval(updatePrediction, 3000);
updatePrediction();

// Admin Routing Controls
app.post('/api/admin/uid', (req, res) => {
    const { uid, action, duration } = req.body;
    if (action === 'approve') {
        const expiry = Date.now() + (parseInt(duration) * 60 * 1000);
        uids[uid] = { status: 'approved', expiry: expiry };
    } else if (action === 'reject' || action === 'delete') {
        delete uids[uid];
        io.emit('uidRevoked', { uid });
    }
    res.json({ success: true, uids });
});

app.get('/api/admin/uids', (req, res) => res.json(uids));

// Access Gateway Verification
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
server.listen(PORT, () => console.log(`Server operating on port ${PORT}`));
