require('dotenv').config();

const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const { init } = require('./db');

const app = express();

app.use(cors({
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);

const port = process.env.PORT || 8082;

init()
    .then(() => {
        app.listen(port, () => {
            console.log(`auth-service listening on ${port}`);
        });
    })
    .catch((err) => {
        console.error('failed to initialize database', err);
        process.exit(1);
    });