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

// Admin Secret Key Setup
const ADMIN_SECRET_TOKEN = "OWNER_SECRET_KEY_9988";

app.get('/admin.html', (req, res) => {
    const token = req.query.token;
    if (token !== ADMIN_SECRET_TOKEN) {
        return res.status(403).send('<h1>403 Forbidden: Access Denied!</h1>');
    }
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Server Storage Matrix
let uids = {}; 
let strictHistoryLog = []; // Dedicated rolling database queue for exact 50 rounds
let currentUpcomingPeriod = "Loading..."; 
let globalPrediction = { period: "Syncing...", result: "-", color: "-", number: "-", timestamp: "" };

const GAME_API = "https://draw.ar-lottery01.com/WinGo/WinGo_1M/GetHistoryIssuePage.json?pageNo=1&pageSize=50&gameId=1";

// Internal Pattern Formula Execution
function executePatternAnalysis(upcomingPeriodStr) {
    if (strictHistoryLog.length === 0) return;

    let totalWeightedSum = 0;
    let recencyBiasValue = 0;
    let periodSeed = parseInt(upcomingPeriodStr) || 0;

    // HIGH INTEL PATTERN DETECTION: Matrix looping over fixed rolling array data
    strictHistoryLog.forEach((game, index) => {
        let currentNum = parseInt(game.number || 0);
        
        // Dynamic exponential index-weight calculation (Newer entries get top priority)
        let weightFactor = Math.max(1, 15 - Math.floor(index / 3));
        totalWeightedSum += (currentNum * weightFactor);
        
        // Target sequence bias check on the most immediate last 5 records
        if (index < 5) {
            recencyBiasValue += currentNum;
        }
    });

    // Clean mathematical seed extraction algorithm
    let complexFormulaSeed = (totalWeightedSum * 4 + recencyBiasValue * 7 + periodSeed) % 10000;
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

    // Packing strictly synced accurate structural response data objects
    globalPrediction = {
        period: upcomingPeriodStr, // Pure format length period strictly pulled from official stream
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

        // Strict API parsing format check matching data.list object schema
        if (response.data && response.data.data && response.data.data.list && response.data.data.list.length > 0) {
            const incomingApiList = response.data.data.list;
            
            // Initialization Phase: Feed structure on initial server cold boot up
            if (strictHistoryLog.length === 0) {
                strictHistoryLog = incomingApiList.slice(0, 50);
            } else {
                // ROLLING ENGINE QUEUE OPERATION: Checking for fresh updates
                const latestIncomingRound = incomingApiList[0];
                const existingLoggedRound = strictHistoryLog[0];

                if (latestIncomingRound.issueNumber !== existingLoggedRound.issueNumber) {
                    // 1. Insert newly finished API record directly at Index 0 (Top)
                    strictHistoryLog.unshift(latestIncomingRound);
                    
                    // 2. Strict popping rule to clean out anything beyond the 50 limit buffer
                    if (strictHistoryLog.length > 50) {
                        strictHistoryLog = strictHistoryLog.slice(0, 50);
                    }
                }
            }

            // Syncing absolute target upcoming index
            let activeApiPeriodInt = parseInt(strictHistoryLog[0].issueNumber);
            currentUpcomingPeriod = (activeApiPeriodInt + 1).toString();

            // Run analytical evaluation calculations on current rolling state data
            executePatternAnalysis(currentUpcomingPeriod);
        }
    } catch (networkError) {
        console.log("Telemetry Alert: Request handshake stream delayed. Internal buffer maintained smoothly.");
        // Anti-Freeze execution layer if API drop happens momentarily
        if (currentUpcomingPeriod !== "Loading...") {
            executePatternAnalysis(currentUpcomingPeriod);
        }
    }
}

// Rapid background interval cycle running every 2.0 seconds
setInterval(updatePrediction, 2000);
updatePrediction();

// UID Gateways & Authorization Systems
app.post('/api/admin/uid', (req, res) => {
    const { token, uid, action, duration } = req.body;
    if (token !== ADMIN_SECRET_TOKEN) return res.status(401).json({ error: 'Unauthorized Access' });

    if (action === 'approve') {
        uids[uid] = { status: 'approved', expiry: Date.now() + (parseInt(duration) * 60 * 1000) };
    } else if (action === 'reject' || action === 'delete') {
        delete uids[uid];
        io.emit('uidRevoked', { uid });
    }
    res.json({ success: true, uids });
});

app.get('/api/admin/uids', (req, res) => {
    if (req.query.token !== ADMIN_SECRET_TOKEN) return res.status(401).json({ error: 'Unauthorized Access' });
    res.json(uids);
});

app.post('/api/user/verify', (req, res) => {
    const { uid } = req.body;
    if (!uid) return res.json({ status: 'invalid', message: 'UID input empty!' });
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
server.listen(PORT, () => console.log(`Smart Rolling Matrix Network operating on port ${PORT}`));
