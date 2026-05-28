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

// App Storage Systems
let uids = {}; 
let strictHistoryLog = []; 
let globalPrediction = { period: "Fetching Live...", result: "-", color: "-", number: "-", timestamp: "" };

const GAME_API = "https://draw.ar-lottery01.com/WinGo/WinGo_1M/GetHistoryIssuePage.json?pageNo=1&pageSize=50&gameId=1";

// SAFE LARGE PERIOD INCREMENT ENGINE
function calculateNextBigPeriod(currentPeriodStr) {
    if (!currentPeriodStr) return "Error";
    // Splitting the last 4 digits safely to handle Large Integer issues in Javascript
    let basePart = currentPeriodStr.slice(0, -4); 
    let lastFourDigits = currentPeriodStr.slice(-4); 
    let incrementedDigits = parseInt(lastFourDigits) + 1;
    
    // Formatting back to maintain strict character padding rules
    let finalFormattedDigits = incrementedDigits.toString().padStart(4, '0');
    return basePart + finalFormattedDigits;
}

function executePatternAnalysis(upcomingPeriodStr) {
    if (strictHistoryLog.length === 0) return;

    let totalWeightedSum = 0;
    let recencyBiasValue = 0;
    
    // Extracting safe deterministic seed out of the massive string sequence safely
    let periodSeedValue = parseInt(upcomingPeriodStr.slice(-6)) || 0;

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

    globalPrediction = {
        period: upcomingPeriodStr, // EXACT UNTOUCHED FULL LENGTH RAW API STRING VALUE
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
            timeout: 4500
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

            // PURE STRING ASSIGNMENT: Prevents any JS parse integer mathematical rounding corruption
            let rawApiPeriodStr = strictHistoryLog[0].issueNumber.toString();
            let upcomingUpcomingPeriodStr = calculateNextBigPeriod(rawApiPeriodStr);

            executePatternAnalysis(upcomingUpcomingPeriodStr);
        }
    } catch (networkError) {
        console.log("Telemetry Update Notice: API Request Handshake dropped/waiting.");
        if (globalPrediction && globalPrediction.period !== "Fetching Live...") {
            io.emit('predictionUpdate', globalPrediction);
        }
    }
}

setInterval(updatePrediction, 2000);
updatePrediction();

// Authorizations Core Systems
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
server.listen(PORT, () => console.log(`Pure String Processing system alive on port ${PORT}`));
