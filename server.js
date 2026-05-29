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

// Production Storage Arrays (Strict Max 50 Limits)
let uids = {}; 
let strictHistoryLog = []; 

function getCurrentWallclockPeriod() {
    const now = new Date();
    const totalMinutes = now.getHours() * 60 + now.getMinutes();
    return totalMinutes.toString().padStart(4, '0');
}

let globalPrediction = { 
    period: getCurrentWallclockPeriod(), 
    result: "BIG", 
    color: "🟢 GREEN [हरा]", 
    number: "7", 
    timestamp: "00:00:00" 
};

const GAME_API = "https://draw.ar-lottery01.com/WinGo/WinGo_1M/GetHistoryIssuePage.json?pageNo=1&pageSize=50&gameId=1";

function calculateUpcomingPeriod(currentApiPeriodStr) {
    let targetFourDigits = "";
    if (currentApiPeriodStr && currentApiPeriodStr.length >= 4) {
        targetFourDigits = currentApiPeriodStr.slice(-4);
    } else {
        targetFourDigits = getCurrentWallclockPeriod();
    }
    let incrementedValue = parseInt(targetFourDigits) + 1;
    if (incrementedValue > 9999) { incrementedValue = 0; }
    return incrementedValue.toString().padStart(4, '0');
}

// ==========================================
// ULTRA-HEAVY AI MULTI-LAYER PATTERN MATRIX
// ==========================================
function executePatternAnalysis(upcomingPeriodStr) {
    let targetOutputNumber = 5; 
    let periodSeedValue = parseInt(upcomingPeriodStr) || 0;

    if (strictHistoryLog && strictHistoryLog.length >= 6) {
        let numbers = strictHistoryLog.map(g => parseInt(g.number || 0));
        let results = numbers.map(n => (n >= 5) ? "BIG" : "SMALL");
        
        // Pattern Weights Counters
        let bigScore = 0;
        let smallScore = 0;

        // 1. DRAGON / STREAK DETECTOR (Continuous Trend Weighting)
        let consecutiveCount = 1;
        for (let i = 0; i < results.length - 1; i++) {
            if (results[i] === results[i + 1]) { consecutiveCount++; } else { break; }
        }
        if (consecutiveCount >= 3) {
            // Strong trend continuation logic (Chase / Follow Pattern)
            if (results[0] === "BIG") bigScore += 45; else smallScore += 45;
        }

        // 2. ALTERNATE / ZIG-ZAG DETECTOR (B -> S -> B -> S)
        let isAlternate = (results[0] !== results[1] && results[1] === results[2] && results[2] !== results[3]);
        if (isAlternate) {
            // Predict inversion trend smoothly
            if (results[0] === "BIG") smallScore += 40; else bigScore += 40;
        }

        // 3. MIRROR / SNAKE REVERSAL PATTERN SCANNER (e.g. B -> B -> S -> S -> B -> B)
        let isMirrorPair = (results[0] === results[1] && results[1] !== results[2] && results[2] === results[3]);
        if (isMirrorPair) {
            if (results[0] === "BIG") smallScore += 35; else bigScore += 35;
        }

        // 4. HISTORICAL OVERALL DOMINANCE CALCULATOR (Full 50 Records Scan)
        let totalBigs = results.filter(r => r === "BIG").length;
        let totalSmalls = results.length - totalBigs;
        if (totalBigs > totalSmalls) bigScore += 10; else smallScore += 10;

        // 5. STATISTICAL FREQUENCY INTEGRATION (Hot / Cold Node)
        let frequencyMap = Array(10).fill(0);
        numbers.forEach(num => frequencyMap[num]++);
        let hotNumber = frequencyMap.indexOf(Math.max(...frequencyMap));

        // Final Decision Array Allocation
        let aiTargetResult = "SMALL";
        if (bigScore === smallScore) {
            // Tie breaker via period variance seed
            aiTargetResult = (periodSeedValue % 2 === 0) ? "BIG" : "SMALL";
        } else {
            aiTargetResult = (bigScore > smallScore) ? "BIG" : "SMALL";
        }

        // Mapping candidate group index with exact Hot/Cold balance
        let candidatePool = (aiTargetResult === "BIG") ? [5, 6, 7, 8, 9] : [0, 1, 2, 3, 4];
        let selectionIndex = (numbers[0] + numbers[1] + hotNumber + periodSeedValue) % candidatePool.length;
        targetOutputNumber = candidatePool[selectionIndex];

        // Anti-Opposite Re-verification Lock
        let finalCheck = (targetOutputNumber >= 5) ? "BIG" : "SMALL";
        if (finalCheck !== aiTargetResult) {
            targetOutputNumber = (aiTargetResult === "BIG") ? 8 : 3;
        }

    } else {
        targetOutputNumber = (periodSeedValue * 7 + 13) % 10;
    }

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
        period: upcomingPeriodStr,
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
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'en-IN,en-GB;q=0.9,hi;q=0.7',
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
            let safeUpcomingPeriod = calculateUpcomingPeriod(rawApiPeriodStr);
            executePatternAnalysis(safeUpcomingPeriod);
        } else {
            let backupWallclockPeriod = calculateUpcomingPeriod(null);
            executePatternAnalysis(backupWallclockPeriod);
        }
    } catch (networkError) {
        let backupWallclockPeriod = calculateUpcomingPeriod(null);
        executePatternAnalysis(backupWallclockPeriod);
    }
}

setInterval(updatePrediction, 2000);
updatePrediction();

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
server.listen(PORT, () => console.log(`Ultra Advanced Weight Matrix Engine running on port ${PORT}`));
