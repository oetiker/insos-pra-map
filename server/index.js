import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(morgan('dev'));
app.use(cors());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
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
