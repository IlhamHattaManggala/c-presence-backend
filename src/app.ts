import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import apiRouter from './routes/api';

dotenv.config();

const app = express();

// Configure CORS
const rawFrontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
const frontendUrl = rawFrontendUrl.replace(/\/$/, '');
app.use(cors({
  origin: [frontendUrl, `${frontendUrl}/`, 'http://localhost:3000', 'http://localhost:3002'],
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// API health check
app.get('/api', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'C-Presence Backend API is running successfully.' });
});

// Integrasi Rute API utama
app.use('/api', apiRouter);

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
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

export default app;
