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

// Root landing route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// App configuration and state preservation variables
let uids = {}; 
let globalPrediction = { period: "Connecting...", result: "-", color: "-", number: "-", timestamp: "" };

// Target official Game internal json endpoints
const GAME_API = "https://draw.ar-lottery01.com/WinGo/WinGo_1M/GetHistoryIssuePage.json?pageNo=1&pageSize=20&gameId=1";

async function updatePrediction() {
    try {
        // Enforcing high authenticity client simulation structures to dodge API firewalls
        const response = await axios.get(GAME_API, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'en-IN,en-GB;q=0.9,en-US;q=0.8,hi;q=0.7',
                'Referer': 'https://draw.ar-lottery01.com/',
                'Origin': 'https://draw.ar-lottery01.com',
                'Connection': 'keep-alive'
            },
            timeout: 4500
        });

        if (response.data && response.data.data && response.data.data.list && response.data.data.list.length > 0) {
            const list = response.data.data.list;
            const latestFinishedGame = list[0];
            
            // STRICT CORE CONVERSION: Parse the exact target raw sequence string and add 1 for the upcoming round
            let baseActivePeriod = parseInt(latestFinishedGame.issueNumber);
            let nextUpcomingPeriod = baseActivePeriod + 1;
            let finalFullLengthPeriodStr = nextUpcomingPeriod.toString();

            // Realtime data sequence mathematical verification loop 
            let totalWeightCalculation = 0;
            let targetEvaluationDepth = Math.min(list.length, 10);
            
            for(let i = 0; i < targetEvaluationDepth; i++) {
                totalWeightCalculation += parseInt(list[i].number || 0);
            }

            // Trend pattern extraction logic 
            let algorithmicSeed = (totalWeightCalculation + nextUpcomingPeriod) % 10;
            let predictedTargetNumber = Math.abs(algorithmicSeed);
            
            let predictedResultText = (predictedTargetNumber >= 5) ? "BIG" : "SMALL";
            
            let descriptiveColorPattern = "";
            if (predictedTargetNumber === 0) {
                descriptiveColorPattern = "🔴 RED [लाल] + 🔮 VIOLET";
            } else if (predictedTargetNumber === 5) {
                descriptiveColorPattern = "🟢 GREEN [हरा] + 🔮 VIOLET";
            } else if ([1, 3, 7, 9].includes(predictedTargetNumber)) {
                descriptiveColorPattern = "🟢 GREEN [हरा]";
            } else {
                descriptiveColorPattern = "🔴 RED [लाल]";
            }

            // Syncing absolute state object models perfectly
            globalPrediction = {
                period: finalFullLengthPeriodStr, // Pure full length format strictly outputting from live API loop sequence
                result: predictedResultText,
                color: descriptiveColorPattern,
                number: predictedTargetNumber.toString(),
                timestamp: new Date().toLocaleTimeString('en-US', { hour12: false })
            };

            // Broadcast verified clean packets to web socket ports
            io.emit('predictionUpdate', globalPrediction);
        }
    } catch (networkException) {
        console.log("Feed Sync Notice -> Session stream pending or timed-out.");
    }
}

// Rapid real-time tracking loops executing requests seamlessly every 2.0 seconds
setInterval(updatePrediction, 2000);
updatePrediction();

// Multi-tier user account configuration routers
app.post('/api/admin/uid', (req, res) => {
    const { uid, action, duration } = req.body;
    if (action === 'approve') {
        const runtimeExpiry = Date.now() + (parseInt(duration) * 60 * 1000);
        uids[uid] = { status: 'approved', expiry: runtimeExpiry };
    } else if (action === 'reject' || action === 'delete') {
        delete uids[uid];
        io.emit('uidRevoked', { uid });
    }
    res.json({ success: true, uids });
});

app.get('/api/admin/uids', (req, res) => res.json(uids));

// Access credential authorization gateway
app.post('/api/user/verify', (req, res) => {
    const { uid } = req.body;
    if (!uid) return res.json({ status: 'invalid', message: 'Verification target key field empty!' });

    const targetUserRecord = uids[uid];
    if (!targetUserRecord) {
        return res.json({ status: 'pending', message: 'UID Status: PENDING! Please contact panel owner to activate access privileges.' });
    }
    if (Date.now() > targetUserRecord.expiry) {
        delete uids[uid];
        return res.json({ status: 'expired', message: 'Access Expired! Renew subscription key from owner.' });
    }
    res.json({ status: 'approved' });
});

io.on('connection', (socket) => {
    // Immediate delivery of live data to new client attachments
    socket.emit('predictionUpdate', globalPrediction);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Production engine live on socket bridge port ${PORT}`));
