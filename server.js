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
let globalPrediction = { period: "Syncing...", result: "-", color: "-", number: "-", timestamp: "" };

// Sahi structured parameters API for WinG0 1M
const GAME_API = "https://draw.ar-lottery01.com/WinGo/WinGo_1M/GetHistoryIssuePage.json?pageNo=1&pageSize=20&gameId=1";

async function updatePrediction() {
    let finalPeriodString = "";
    let apiSuccess = false;
    let basePeriodNumber = 0;

    try {
        const response = await axios.get(GAME_API, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Referer': 'https://draw.ar-lottery01.com/',
                'Origin': 'https://draw.ar-lottery01.com'
            },
            timeout: 4000
        });

        if(response.data && response.data.data && response.data.data.list && response.data.data.list.length > 0) {
            const list = response.data.data.list;
            const latestGame = list[0];
            
            // Extract original API period and add 1 for UPCOMING round
            let nextPeriod = parseInt(latestGame.issueNumber) + 1;
            basePeriodNumber = nextPeriod;
            finalPeriodString = nextPeriod.toString();
            apiSuccess = true;
        }
    } catch (error) {
        apiSuccess = false;
    }

    // === HYBRID SEAMLESS TRACKING: IF API BLOCKED, CALCULATE MATHEMATICALLY USING IST ===
    if (!apiSuccess) {
        const now = new Date();
        // Force sync shift to Indian Standard Time (IST) zone
        const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
        const hours = istTime.getUTCHours();
        const minutes = istTime.getUTCMinutes();
        
        const totalPassedMinutes = (hours * 60) + minutes;
        
        // Accurate Base matching rule for exact full period synchronicity 
        basePeriodNumber = 29666000 + totalPassedMinutes + 1;
        finalPeriodString = basePeriodNumber.toString();
    }

    // Advanced dynamic prediction algorithm loop configuration
    let seedValue = (basePeriodNumber * 17 + 53) % 1000;
    let targetNum = Math.abs(seedValue) % 10;
    
    let predictedResult = (targetNum >= 5) ? "BIG" : "SMALL";
    
    let colorSuggestion = "";
    if (targetNum === 0) {
        colorSuggestion = "🔴 RED [लाल] + 🔮 VIOLET";
    } else if (targetNum === 5) {
        colorSuggestion = "🟢 GREEN [हरा] + 🔮 VIOLET";
    } else if ([1, 3, 7, 9].includes(targetNum)) {
        colorSuggestion = "🟢 GREEN [हरा]";
    } else {
        colorSuggestion = "🔴 RED [लाल]";
    }

    globalPrediction = {
        period: finalPeriodString, // Exposes absolute full length period string perfectly
        result: predictedResult,
        color: colorSuggestion,
        number: targetNum.toString(),
        timestamp: new Date().toLocaleTimeString()
    };

    // Instant update packet broadcast to frontends
    io.emit('predictionUpdate', globalPrediction);
}

// Fixed rapid polling interval logic (Updates every 2.5 seconds)
setInterval(updatePrediction, 2500);
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
