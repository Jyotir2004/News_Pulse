const express = require('express');
const fs = require('node:fs');
const path = require('node:path');

const app = express();
const port = Number(process.env.PORT) || 3000;
const dataDirectory = path.join(__dirname, 'data');
const dataFile = path.join(dataDirectory, 'channels.json');
const dataNote = 'Illustrative demo ratings only. They are not official BARC data.';

const seedChannels = [
    { id: 1, name: 'Aaj Tak', category: 'Hindi News', trp: 4.5, viewers: 1200000, week: '2026 demo' },
    { id: 2, name: 'India TV', category: 'Hindi News', trp: 3.9, viewers: 950000, week: '2026 demo' },
    { id: 3, name: 'Zee News', category: 'Hindi News', trp: 3.7, viewers: 880000, week: '2026 demo' },
    { id: 4, name: 'News18 India', category: 'Hindi News', trp: 3.6, viewers: 840000, week: '2026 demo' },
    { id: 5, name: 'TV9 Bharatvarsh', category: 'Hindi News', trp: 3.5, viewers: 810000, week: '2026 demo' },
    { id: 6, name: 'Republic Bharat', category: 'Hindi News', trp: 3.4, viewers: 790000, week: '2026 demo' },
    { id: 7, name: 'NDTV India', category: 'Hindi News', trp: 3.2, viewers: 750000, week: '2026 demo' },
    { id: 8, name: 'Times Now', category: 'English News', trp: 2.9, viewers: 690000, week: '2026 demo' },
    { id: 9, name: 'CNN-News18', category: 'English News', trp: 2.8, viewers: 650000, week: '2026 demo' },
    { id: 10, name: 'WION', category: 'English News', trp: 2.6, viewers: 610000, week: '2026 demo' },
];

function loadChannels() {
    if (!fs.existsSync(dataFile)) {
        fs.mkdirSync(dataDirectory, { recursive: true });
        fs.writeFileSync(dataFile, `${JSON.stringify(seedChannels, null, 2)}\n`);
        return seedChannels;
    }

    const savedChannels = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    if (!Array.isArray(savedChannels)) {
        throw new Error(`Expected an array of channels in ${dataFile}`);
    }
    return savedChannels;
}

let channels = loadChannels();

function saveChannels() {
    fs.mkdirSync(dataDirectory, { recursive: true });
    fs.writeFileSync(dataFile, `${JSON.stringify(channels, null, 2)}\n`);
}

app.use(express.json({ limit: '10kb' }));
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
    next();
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', year: 2026, totalChannels: channels.length });
});

app.get('/api/channels', (req, res) => {
    const search = String(req.query.search || '').trim().toLowerCase();
    const category = String(req.query.category || '').trim().toLowerCase();
    const filteredChannels = channels.filter((channel) =>
        channel.name.toLowerCase().includes(search)
        && channel.category.toLowerCase().includes(category)
    );

    res.json({
        total: filteredChannels.length,
        dataNote,
        channels: filteredChannels,
    });
});

app.get('/api/channels/:id', (req, res) => {
    const id = Number(req.params.id);
    const channel = channels.find((item) => item.id === id);

    if (!channel) {
        return res.status(404).json({ message: 'Channel not found' });
    }

    return res.json(channel);
});

function validateChannel(body) {
    const { name, category, trp, viewers, week } = body;
    if (
        typeof name !== 'string' || !name.trim()
        || typeof category !== 'string' || !category.trim()
        || typeof week !== 'string' || !week.trim()
        || typeof trp !== 'number' || !Number.isFinite(trp) || trp < 0 || trp > 100
        || !Number.isSafeInteger(viewers) || viewers < 0
    ) {
        return null;
    }

    return {
        name: name.trim(),
        category: category.trim(),
        trp,
        viewers,
        week: week.trim(),
    };
}

app.post('/api/channels', (req, res) => {
    const details = validateChannel(req.body);
    if (!details) {
        return res.status(400).json({
            message: 'Provide a name, category, week, TRP from 0 to 100, and a non-negative whole-number viewer count.',
        });
    }

    const newChannel = {
        id: channels.reduce((maxId, channel) => Math.max(maxId, channel.id), 0) + 1,
        ...details,
    };
    channels.push(newChannel);
    saveChannels();

    return res.status(201).json({
        message: 'Channel added successfully',
        channel: newChannel,
    });
});

app.put('/api/channels/:id', (req, res) => {
    const id = Number(req.params.id);
    const channel = channels.find((item) => item.id === id);
    if (!channel) {
        return res.status(404).json({ message: 'Channel not found' });
    }

    const details = validateChannel(req.body);
    if (!details) {
        return res.status(400).json({
            message: 'Provide a name, category, week, TRP from 0 to 100, and a non-negative whole-number viewer count.',
        });
    }

    Object.assign(channel, details);
    saveChannels();
    return res.json({ message: 'Channel updated successfully', channel });
});

app.delete('/api/channels/:id', (req, res) => {
    const id = Number(req.params.id);
    const originalLength = channels.length;
    channels = channels.filter((channel) => channel.id !== id);

    if (channels.length === originalLength) {
        return res.status(404).json({ message: 'Channel not found' });
    }

    saveChannels();
    return res.json({ message: 'Channel deleted successfully' });
});

app.get('/api/rankings', (req, res) => {
    const rankings = [...channels]
        .sort((a, b) => b.trp - a.trp)
        .map((channel, index) => ({ rank: index + 1, ...channel }));
    res.json(rankings);
});

app.get('/api/top-channel', (req, res) => {
    if (channels.length === 0) {
        return res.status(404).json({ message: 'No channels available' });
    }

    const channel = channels.reduce((top, current) => current.trp > top.trp ? current : top);
    return res.json({ message: 'Highest TRP News Channel', channel });
});

app.get('/api/average-trp', (req, res) => {
    const average = channels.length
        ? channels.reduce((sum, channel) => sum + channel.trp, 0) / channels.length
        : 0;

    res.json({
        totalChannels: channels.length,
        averageTRP: Number(average.toFixed(2)),
    });
});

app.use((req, res) => {
    res.status(404).json({ message: 'Route not found' });
});

app.use((error, req, res, next) => {
    if (res.headersSent) {
        return next(error);
    }

    if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
        return res.status(400).json({ message: 'Request body must contain valid JSON' });
    }

    console.error('Request failed:', error);
    return res.status(500).json({ message: 'Internal server error' });
});

app.listen(port, () => {
    console.log(`News TRP dashboard running at http://localhost:${port}`);
});
