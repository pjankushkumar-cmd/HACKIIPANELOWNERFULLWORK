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
    // Agar aapki file ka naam index.html hai toh yahan badal sakte hain
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
let globalPrediction = { period: "Loading...", result: "-", number: "-", color: "-", timestamp: "" };

const GAME_API = "https://draw.ar-lottery01.com/WinGo/WinGo_1M/GetHistoryIssuePage.json?pageNo=1&pageSize=20&gameId=1";

async function updatePrediction() {
    let nextPeriodStr = "";
    let baseSeed = 0;

    // 1. HARDCODED CORRECT TIME OFFSET CALCULATION (IST / Game Sync)
    // Server ka time jo bhi ho, hum use directly exact minute metrics par convert karenge
    const now = new Date();
    
    // Indian Standard Time (IST) offset manual adjustments (+5:30)
    const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
    const currentHour = istTime.getUTCHours();
    const currentMinute = istTime.getUTCMinutes();
    
    // Total minutes calculated from start of the day to keep numbers highly aligned
    const totalDayMinutes = (currentHour * 60) + currentMinute;
    
    // Game sequence formatting mapping rules
    // Agar 5:51 PM par sequence mismatch ho raha hai, toh hum specific dynamic offset sequence adjust karenge
    let basePeriodNumber = 29666000 + totalDayMinutes;
    
    // Strict Verification check for upcoming structure (+1 incrementation override)
    let finalUpcomingPeriod = basePeriodNumber + 1; 
    nextPeriodStr = finalUpcomingPeriod.toString();
    baseSeed = finalUpcomingPeriod;

    // 2. LIVE DATA SYNC WITH API (IF ACCESSIBLE)
    try {
        const response = await axios.get(GAME_API, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Origin': 'https://draw.ar-lottery01.com'
            },
            timeout: 3500
        });

        if (response.data && response.data.data && response.data.data.list && response.data.data.list.length > 0) {
            const list = response.data.data.list;
            const latestGame = list[0];
            
            // Strictly fetch latest round and make it UPCOMING (+1)
            let apiNextPeriod = parseInt(latestGame.issueNumber) + 1;
            
            // Check validation parameter safety bounds
            if (apiNextPeriod > finalUpcomingPeriod) {
                nextPeriodStr = apiNextPeriod.toString();
                baseSeed = apiNextPeriod;
            }
        }
    } catch (error) {
        // Safe fail-safe execution metrics
    }

    // === CRITICAL MATH SEED LOCK: Ek round mein sirf ek baar execution ===
    let periodInt = parseInt(nextPeriodStr) || baseSeed;
    
    // Unique linear deterministic mapping formula to ensure numbers don't change mid-round
    let finalHash = (periodInt * 53 + 29) % 1000;
    let predictedNumber = Math.abs(finalHash) % 10; // strictly 0-9 single digit block
    
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
        period: nextPeriodStr,
        result: predictedResult,
        number: predictedNumber.toString(),
        color: colorSuggestion,
        timestamp: istTime.toLocaleTimeString()
    };

    io.emit('predictionUpdate', globalPrediction);
}

// Fixed interval scheduling loop execution Matrix
setInterval(updatePrediction, 2500);
updatePrediction();

// Authorization Access control routers
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
server.listen(PORT, () => console.log(`Active server operating fine on port ${PORT}`));
