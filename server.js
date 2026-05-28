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

// === SECURITY SETTOKEN ===
const ADMIN_SECRET_TOKEN = "OWNER_SECRET_KEY_9988"; 

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/admin.html', (req, res) => {
    const token = req.query.token;
    if (token !== ADMIN_SECRET_TOKEN) {
        return res.status(403).send('<h1>403 Forbidden: Access Denied!</h1>');
    }
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

let uids = {}; 
let globalPrediction = { period: "Waiting...", result: "-", number: "-", color: "-", timestamp: "" };
let historicalDataCache = [];

const GAME_API = "https://draw.ar-lottery01.com/WinGo/WinGo_1M/GetHistoryIssuePage.json?pageNo=1&pageSize=50&gameId=1";

async function updatePrediction() {
    try {
        const response = await axios.get(GAME_API, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Origin': 'https://draw.ar-lottery01.com',
                'Referer': 'https://draw.ar-lottery01.com/'
            },
            timeout: 5000
        });

        if (response.data && response.data.data && response.data.data.list && response.data.data.list.length > 0) {
            const list = response.data.data.list;
            
            // 1. Store last 50 games from official api list
            historicalDataCache = [];
            for (let i = 0; i < Math.min(list.length, 50); i++) {
                historicalDataCache.push({
                    issue: list[i].issueNumber,
                    num: parseInt(list[i].number || 0)
                });
            }

            // 2. STRICTLY USE API PERIOD & ADD 1 FOR UPCOMING
            const latestGame = historicalDataCache[0];
            let rawNextPeriod = parseInt(latestGame.issue) + 1;
            
            // Get exact last 2 digits from the calculated upcoming period
            let nextPeriodStr = rawNextPeriod.toString();
            let lastTwoDigits = nextPeriodStr.slice(-2); 

            // 3. BACKGROUND HIGH ENGINE CALCULATIONS (NO AI SHOW ON UI)
            let logicWeight = 0;
            let patternTrend = 0;

            historicalDataCache.forEach((game, index) => {
                let impactFactor = Math.max(1, 10 - Math.floor(index / 5));
                logicWeight += (game.num * impactFactor);
                if(index < 10) patternTrend += game.num; 
            });

            // Strict Seed generation locked per period to avoid changes mid-round
            let advanceSeed = (logicWeight * 3 + patternTrend * 7 + rawNextPeriod * 23) % 10000;
            let predictedNumber = Math.abs(advanceSeed) % 10; // Strictly 0 to 9 number evaluation
            
            let predictedResult = (predictedNumber >= 5) ? "BIG" : "SMALL";
            
            let colorSuggestion = "";
            if (predictedNumber === 0) {
                colorSuggestion = "🔴 RED [लाल] + 🔮 VIOLET";
            } else if (predictedNumber === 5) {
                colorSuggestion = "🟢 GREEN [हरा] + 🔮 VIOLET";
            } else if ([1, 3, 7, 9].includes(predictedNumber)) {
                colorSuggestion = "🟢 GREEN [हरा]";
            } else {
                colorSuggestion = "🔴 RED [लाल]";
            }

            globalPrediction = {
                period: lastTwoDigits, // ONLY DISPLAYING ORIGINAL API + 1 LAST 2 DIGITS
                result: predictedResult,
                number: predictedNumber.toString(),
                color: colorSuggestion,
                timestamp: new Date().toLocaleTimeString()
            };

            io.emit('predictionUpdate', globalPrediction);
        }
    } catch (error) {
        console.log("API connection error or request timed out.");
    }
}

// Check real API response regularly every 2.5 seconds
setInterval(updatePrediction, 2500);
updatePrediction();

// Authorization routers
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
    if (!user) return res.json({ status: 'pending', message: 'UID Status: PENDING!' });
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
server.listen(PORT, () => console.log(`Server instance active on port ${PORT}`));
