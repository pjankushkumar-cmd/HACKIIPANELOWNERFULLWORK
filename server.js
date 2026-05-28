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

// System Runtime Data Variables
let uids = {}; 
let strictHistoryLog = []; 

// Dynamic Smart Fallback Initializer (No more static 0001)
let lastKnownValidPeriod = (() => {
    const now = new Date();
    const totalMinutes = now.getHours() * 60 + now.getMinutes();
    return totalMinutes.toString().padStart(4, '0');
})();

let globalPrediction = { 
    period: lastKnownValidPeriod, 
    result: "SMALL", 
    color: "🔴 RED [लाल]", 
    number: "2", 
    timestamp: "00:00:00" 
};

const GAME_API = "https://draw.ar-lottery01.com/WinGo/WinGo_1M/GetHistoryIssuePage.json?pageNo=1&pageSize=50&gameId=1";

function parseAndIncrementLastFour(currentPeriodStr) {
    if (!currentPeriodStr) return lastKnownValidPeriod;
    let lastFourDigits = currentPeriodStr.slice(-4); 
    let incrementedValue = parseInt(lastFourDigits) + 1;
    if (incrementedValue > 9999) { incrementedValue = 0; }
    lastKnownValidPeriod = incrementedValue.toString().padStart(4, '0');
    return lastKnownValidPeriod;
}

function executePatternAnalysis(trimmedUpcomingPeriod) {
    // Structural analysis payload creation
    let totalWeightedSum = 0;
    let recencyBiasValue = 0;
    let periodSeedValue = parseInt(trimmedUpcomingPeriod) || 0;

    if (strictHistoryLog.length > 0) {
        strictHistoryLog.forEach((game, index) => {
            let currentNum = parseInt(game.number || 0);
            let weightFactor = Math.max(1, 15 - Math.floor(index / 3));
            totalWeightedSum += (currentNum * weightFactor);
            if (index < 5) { recencyBiasValue += currentNum; }
        });
    } else {
        // Pseudo-deterministic variance engine if api connection drops
        totalWeightedSum = periodSeedValue * 3;
        recencyBiasValue = 15;
    }

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
        period: trimmedUpcomingPeriod, 
        result: patternResultString,
        color: descriptiveColorData,
        number: targetOutputNumber.toString(),
        timestamp: new Date().toLocaleTimeString('en-US', { hour12: false })
    };

    io.emit('predictionUpdate', globalPrediction);
}

async function updatePrediction() {
    try {
        // High-Mimic Anti-Block Request Matrix
        const response = await axios.get(GAME_API, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'en-IN,en-GB;q=0.9,en;q=0.8,hi;q=0.7',
                'Referer': 'https://draw.ar-lottery01.com/',
                'Origin': 'https://draw.ar-lottery01.com',
                'Sec-Fetch-Dest': 'empty',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Site': 'same-origin',
                'Priority': 'u=1, i',
                'Connection': 'keep-alive'
            },
            timeout: 5000
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
        } else {
            // Dropthrough execution if API layout breaks
            let incrementalPeriod = (parseInt(lastKnownValidPeriod) + 1).toString().padStart(4, '0');
            executePatternAnalysis(incrementalPeriod);
        }
    } catch (networkError) {
        // Active tracking cycle loop verification layer
        let timeCheckedPeriod = (parseInt(lastKnownValidPeriod) + 1).toString().padStart(4, '0');
        executePatternAnalysis(timeCheckedPeriod);
    }
}

// 2-second structural polling interval loop
setInterval(updatePrediction, 2000);
updatePrediction();

// Authorization Routing Layouts
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
server.listen(PORT, () => console.log(`Bypass Core System running fine on port ${PORT}`));
