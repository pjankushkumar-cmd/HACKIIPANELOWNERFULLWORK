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

// Server Memory Configurations
let uids = {}; 
let globalPrediction = { period: "Waiting for API...", result: "-", color: "-", number: "-", timestamp: "" };

const GAME_API = "https://draw.ar-lottery01.com/WinGo/WinGo_1M/GetHistoryIssuePage.json?pageNo=1&pageSize=50&gameId=1";

async function updatePrediction() {
    try {
        // Strict Browser Simulation to prevent Cloudflare/Render Network block
        const response = await axios.get(GAME_API, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Referer': 'https://draw.ar-lottery01.com/',
                'Origin': 'https://draw.ar-lottery01.com',
                'Connection': 'keep-alive'
            },
            timeout: 5000
        });

        // VALIDATION: Agar API ka data bilkul sahi milega, tabhi aage badhega
        if (response.data && response.data.data && response.data.data.list && response.data.data.list.length > 0) {
            const list = response.data.data.list;
            const latestFinishedGame = list[0];
            
            // STRICT API RULE: Official API ke number se strict full-length period nikala
            let apiLatestPeriod = parseInt(latestFinishedGame.issueNumber);
            let nextUpcomingPeriod = apiLatestPeriod + 1; // Strict addition for upcoming
            let finalFullLengthPeriodStr = nextUpcomingPeriod.toString();

            // HIGH INTELLIGENCE PATTERN DETECTOR MATRIX (Using all 50 rounds from API)
            let weightSum = 0;
            let positionalBias = 0;
            
            list.forEach((game, index) => {
                let currentNum = parseInt(game.number || 0);
                // Trend matrix distribution analysis
                let multiplier = Math.max(1, 15 - Math.floor(index / 3));
                weightSum += (currentNum * multiplier);
                if (index < 5) positionalBias += currentNum;
            });

            // Clean pattern formula lock
            let dynamicCoreSeed = (weightSum * 3 + positionalBias * 7 + nextUpcomingPeriod) % 10000;
            let targetOutputNumber = Math.abs(dynamicCoreSeed) % 10;
            
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

            // Sync structural payload state
            globalPrediction = {
                period: finalFullLengthPeriodStr, // Strictly the exact absolute string from official API
                result: patternResultString,
                color: descriptiveColorData,
                number: targetOutputNumber.toString(),
                timestamp: new Date().toLocaleTimeString('en-US', { hour12: false })
            };

            // Socket client dynamic distribution
            io.emit('predictionUpdate', globalPrediction);
        }
    } catch (apiError) {
        // No local fallback calculation anymore. If API fails, it will just log to console.
        console.log("API Connection waiting/blocked. Status code logged.");
    }
}

// Request processing loop mapped to 2.5 seconds response windows
setInterval(updatePrediction, 2500);
updatePrediction();

// Management Controls
app.post('/api/admin/uid', (req, res) => {
    const { uid, action, duration } = req.body;
    if (action === 'approve') {
        uids[uid] = { status: 'approved', expiry: Date.now() + (parseInt(duration) * 60 * 1000) };
    } else if (action === 'reject' || action === 'delete') {
        delete uids[uid];
        io.emit('uidRevoked', { uid });
    }
    res.json({ success: true, uids });
});

app.get('/api/admin/uids', (req, res) => res.json(uids));

app.post('/api/user/verify', (req, res) => {
    const { uid } = req.body;
    if (!uid) return res.json({ status: 'invalid', message: 'UID input empty!' });
    const match = uids[uid];
    if (!match) return res.json({ status: 'pending', message: 'UID Status: PENDING! Access activation needed.' });
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
server.listen(PORT, () => console.log(`Pure API Sync server live on port ${PORT}`));
