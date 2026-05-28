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

// Render par default dashboard load karne ke liye
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
// Default data starting mein blank nahi rahega
let globalPrediction = { period: "29666170", result: "BIG", number: "7", color: "🔴 RED [लाल]", timestamp: "" };

const GAME_API = "https://draw.ar-lottery01.com/WinGo/WinGo_1M/GetHistoryIssuePage.json?pageNo=1&pageSize=20&gameId=1";

async function updatePrediction() {
    let nextPeriodStr = "";
    let baseSeed = 0;

    const now = new Date();
    // Fallback default structure
    const totalMinutes = Math.floor(now.getTime() / (1000 * 60));
    nextPeriodStr = "2966" + (totalMinutes % 10000).toString();
    baseSeed = totalMinutes;

    try {
        const response = await axios.get(GAME_API, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Origin': 'https://draw.ar-lottery01.com'
            },
            timeout: 4000
        });

        if (response.data && response.data.data && response.data.data.list && response.data.data.list.length > 0) {
            const list = response.data.data.list;
            const latestGame = list[0];
            let nextPeriod = parseInt(latestGame.issueNumber) + 1;
            nextPeriodStr = nextPeriod.toString();

            for (let i = 0; i < Math.min(list.length, 5); i++) {
                baseSeed += parseInt(list[i].number || 0);
            }
            baseSeed += nextPeriod;
        }
    } catch (error) {
        // API block hone par logs crash nahi honge
    }

    // === ABSOLUTE MATHEMATICAL LOCK LOGIC ===
    // Is formula se data pure minute tak same rahega, baar-baar change nahi hoga
    let periodInt = parseInt(nextPeriodStr) || baseSeed;
    let finalHash = (periodInt * 31 + 17) % 100;
    let predictedNumber = Math.abs(finalHash) % 10; // Strictly 0 to 9
    
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
        timestamp: new Date().toLocaleTimeString()
    };

    io.emit('predictionUpdate', globalPrediction);
}

// 3 second mein client-server data synchronization matrix
setInterval(updatePrediction, 3000);
updatePrediction();

// Admin Panel APIs
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
server.listen(PORT, () => console.log(`Server environment operating fine on port ${PORT}`));
