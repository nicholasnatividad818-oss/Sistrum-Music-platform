// Deploy this separately from the current static Nginx container.
// Configure an HTTPS reverse proxy for /api/soundcloud/* to this service.
import express from 'express';
import { createSoundCloudRouter } from './router.mjs';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use('/api/soundcloud', createSoundCloudRouter());
app.get('/healthz', (_req, res) => res.json({ ok: true }));
const port = Number(process.env.PORT || 8081);
app.listen(port, '0.0.0.0', () => console.info(`SoundCloud integration listening on ${port}`));
