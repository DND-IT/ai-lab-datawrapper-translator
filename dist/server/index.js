import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import translateRouter from './routes/translate.js';
const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = parseInt(process.env.PORT || '3000');
const isDev = process.env.NODE_ENV === 'development';
app.use(cors());
app.use(express.json());
// API routes
app.use('/api/translate', translateRouter);
async function start() {
    if (isDev) {
        const { createServer } = await import('vite');
        const vite = await createServer({
            server: { middlewareMode: true },
            appType: 'spa',
        });
        app.use(vite.middlewares);
    }
    else {
        const clientDir = resolve(__dirname, '../client');
        app.use(express.static(clientDir));
        app.get('*', (_req, res) => {
            res.sendFile(resolve(clientDir, 'index.html'));
        });
    }
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
        if (isDev)
            console.log('Development mode with Vite HMR');
    });
}
start().catch(console.error);
