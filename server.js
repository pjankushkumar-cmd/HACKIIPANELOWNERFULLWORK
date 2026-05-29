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

// Production Storage Arrays
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

// ADVANCED AI TREND ANALYSIS MATRIXENGINE
function executePatternAnalysis(upcomingPeriodStr) {
    let targetOutputNumber = 5; // Default safe anchor
    let periodSeedValue = parseInt(upcomingPeriodStr) || 0;

    if (strictHistoryLog && strictHistoryLog.length >= 5) {
        // 1. Recency & Weighted Frequency Extraction
        let recentNumbers = strictHistoryLog.slice(0, 10).map(g => parseInt(g.number || 0));
        let recentResults = strictHistoryLog.slice(0, 10).map(g => (parseInt(g.number || 0) >= 5) ? "BIG" : "SMALL");

        let sumWeights = 0;
        recentNumbers.forEach((num, index) => {
            let weight = (10 - index) * 2; // Dynamic bias for closest rounds
            sumWeights += (num * weight);
        });

        // 2. Pattern Trend Matching (Dragon, Mirror, or Repetitive Break)
        let isDragonTrend = recentResults.slice(0, 3).every(r => r === recentResults[0]);
        let isAlternatingPattern = (recentResults[0] !== recentResults[1] && recentResults[1] === recentResults[2]);
        
        let dynamicTrendBias = 0;
        if (isDragonTrend) {
            // Continuation vector bias
            dynamicTrendBias = (recentResults[0] === "BIG") ? 8 : 2;
        } else if (isAlternatingPattern) {
            // Reversal pattern projection
            dynamicTrendBias = (recentResults[0] === "BIG") ? 1 : 7;
        } else {
            // Delta standard deviation balance
            dynamicTrendBias = (recentNumbers[0] + recentNumbers[1] + periodSeedValue) % 10;
        }

        // 3. Composite Algorithmic Node Evaluation
        let aiCalculatedSeed = Math.floor((sumWeights * 3) + (dynamicTrendBias * 11) + periodSeedValue);
        targetOutputNumber = Math.abs(aiCalculatedSeed) % 10;

        // Anti-clustering edge corrections
        if (isDragonTrend && ((targetOutputNumber >= 5 && recentResults[0] === "SMALL") || (targetOutputNumber < 5 && recentResults[0] === "BIG"))) {
            if (Math.random() > 0.3) { 
                targetOutputNumber = (targetOutputNumber + 5) % 10; // Forced trend correction
            }
        }
    } else {
        // Fallback seed calculation if history queue warms up
        targetOutputNumber = (periodSeedValue * 7 + 13) % 10;
    }

    // Final mapping extraction
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

// Operational runtime execution loop
setInterval(updatePrediction, 2000);
updatePrediction();

// Authorization Control Logic Routing
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
server.listen(PORT, () => console.log(`AI Enhanced Pattern Analytics system running on port ${PORT}`));
