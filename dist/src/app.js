"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const api_1 = __importDefault(require("./routes/api"));
dotenv_1.default.config();
const app = (0, express_1.default)();
// Configure CORS
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
app.use((0, cors_1.default)({
    origin: [frontendUrl, 'http://localhost:3000', 'http://localhost:3002'],
    credentials: true
}));
app.use(express_1.default.json({ limit: '50mb' }));
app.use(express_1.default.urlencoded({ limit: '50mb', extended: true }));
// API health check
app.get('/api', (req, res) => {
    res.status(200).json({ status: 'ok', message: 'C-Presence Backend API is running successfully.' });
});
// Integrasi Rute API utama
app.use('/api', api_1.default);
// Global Error Handler
app.use((err, req, res, next) => {
    console.error('Unhandled Error:', err);
    res.status(500).json({ error: err.message || 'Internal Server Error' });
});
// Local dev server listener
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    const port = process.env.PORT || 3001;
    app.listen(port, () => {
        console.log(`[Server] Running locally on http://localhost:${port}`);
    });
}
exports.default = app;
