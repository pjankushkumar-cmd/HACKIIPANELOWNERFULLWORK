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

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const ADMIN_SECRET_TOKEN = "OWNER_SECRET_KEY_9988";

app.get('/admin.html', (req, res) => {
    const token = req.query.token;
    if (token !== ADMIN_SECRET_TOKEN) {
        return res.status(403).send('<h1>403 Forbidden: Access Denied!</h1>');
    }
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// App Storage Telemetry Systems
let uids = {}; 
let strictHistoryLog = []; 

// Anti-Freeze Baseline Config (Screen will display this instantly instead of "Loading...")
let globalPrediction = { 
    period: "0001", 
    result: "BIG", 
    color: "🟢 GREEN [हरा]", 
    number: "7", 
    timestamp: "00:00:00" 
};

const GAME_API = "https://draw.ar-lottery01.com/WinGo/WinGo_1M/GetHistoryIssuePage.json?pageNo=1&pageSize=50&gameId=1";

// STRICT LAST 4 DIGITS SEPARATOR ENGINE
function parseAndIncrementLastFour(currentPeriodStr) {
    if (!currentPeriodStr) return "0000";
    
    // Cutting last 4 characters explicitly from the large string object
    let lastFourDigits = currentPeriodStr.slice(-4); 
    let incrementedValue = parseInt(lastFourDigits) + 1;
    
    // Normalizing loop edge cases if system crosses 9999
    if (incrementedValue > 9999) {
        incrementedValue = 0;
    }
    
    return incrementedValue.toString().padStart(4, '0');
}

function executePatternAnalysis(trimmedUpcomingPeriod) {
    if (strictHistoryLog.length === 0) return;

    let totalWeightedSum = 0;
    let recencyBiasValue = 0;
    let periodSeedValue = parseInt(trimmedUpcomingPeriod) || 0;

    strictHistoryLog.forEach((game, index) => {
        let currentNum = parseInt(game.number || 0);
        let weightFactor = Math.max(1, 15 - Math.floor(index / 3));
        totalWeightedSum += (currentNum * weightFactor);
        
        if (index < 5) {
            recencyBiasValue += currentNum;
        }
    });

    let complexFormulaSeed = (totalWeightedSum * 4 + recencyBiasValue * 7 + periodSeedValue) % 10000;
    let targetOutputNumber = Math.abs(complexFormulaSeed) % 10;
    
    let patternResultString = (targetOutputNumber >= 5) ? "BIG" : "SMALL";
    
    let descriptiveColorData = "";
    if (targetOutputNumber === 0) {
        descriptiveColorData = "🔴 RED [लाल] + 🔮 VIOLET";
    } else if (targetOutputNumber === 5) {
        descriptiveColorData = "🟢 GREEN [हरा] + 🔮 VIOLET";
    } else if ([1, 3, 7, 9].includes(targetOutputNumber)) {
        descriptiveColorData = "🟢 GREEN [हरा]";
    } else {
        descriptiveColorData = "🔴 RED [लाल]";
    }

    // Overwriting memory variables seamlessly without any structural breaks
    globalPrediction = {
        period: trimmedUpcomingPeriod, // FORWARDING ONLY THE 4 DIGIT VALUE
        result: patternResultString,
        color: descriptiveColorData,
        number: targetOutputNumber.toString(),
        timestamp: new Date().toLocaleTimeString('en-US', { hour12: false })
    };

    io.emit('predictionUpdate', globalPrediction);
}

async function updatePrediction() {
    try {
        const response = await axios.get(GAME_API, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Referer': 'https://draw.ar-lottery01.com/',
                'Origin': 'https://draw.ar-lottery01.com',
                'Connection': 'keep-alive'
            },
            timeout: 4000
        });

        if (response.data && response.data.data && response.data.data.list && response.data.data.list.length > 0) {
            const incomingApiList = response.data.data.list;
            
            if (strictHistoryLog.length === 0) {
                strictHistoryLog = incomingApiList.slice(0, 50);
            } else {
                const latestIncomingRound = incomingApiList[0];
                const existingLoggedRound = strictHistoryLog[0];

                if (latestIncomingRound.issueNumber !== existingLoggedRound.issueNumber) {
                    strictHistoryLog.unshift(latestIncomingRound);
                    if (strictHistoryLog.length > 50) {
                        strictHistoryLog = strictHistoryLog.slice(0, 50);
                    }
                }
            }

            let rawApiPeriodStr = strictHistoryLog[0].issueNumber.toString();
            let safeFourDigitUpcomingPeriod = parseAndIncrementLastFour(rawApiPeriodStr);

            executePatternAnalysis(safeFourDigitUpcomingPeriod);
        }
    } catch (networkError) {
        // Network drops handled internally, stream is never disrupted on dashboard
        if (globalPrediction && globalPrediction.period !== "0001") {
            io.emit('predictionUpdate', globalPrediction);
        }
    }
}

// Fixed rapid cycle system interval check loop
setInterval(updatePrediction, 2000);
updatePrediction();

// User Access Systems
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
    const match = uids[uid];
    if (!match) return res.json({ status: 'pending', message: 'UID Status: PENDING!' });
    if (Date.now() > match.expiry) {
        delete uids[uid];
        return res.json({ status: 'expired', message: 'Access Expired!' });
    }
    res.json({ status: 'approved' });
});

io.on('connection', (socket) => {
    socket.emit('predictionUpdate', globalPrediction);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Engine processing strictly 4-digits array matrix on port ${PORT}`));
