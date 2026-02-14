import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { getProviders } from './providers.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// Track last provider result for health endpoint
let lastProviderResult = null;

app.use(morgan('dev'));
app.use(cors());

// Provider data endpoint
app.get('/api/providers', async (req, res) => {
  try {
    const data = await getProviders();
    lastProviderResult = data;
    res.json(data);
  } catch (err) {
    console.error('Provider endpoint error:', err);
    res.status(503).json({ error: 'Data temporarily unavailable' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    providerCount: lastProviderResult?.providers?.length ?? 'unknown'
  });
});

// Serve Vite build output (production)
const distPath = join(__dirname, '../dist');
app.use(express.static(distPath));

// SPA fallback: all non-API GET requests serve index.html
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    res.sendFile(join(distPath, 'index.html'), (err) => {
      if (err) next(err);
    });
  } else {
    next();
  }
});

app.listen(PORT, () => {
  console.log(`INSOS PrA Map server running on http://localhost:${PORT}`);
});
