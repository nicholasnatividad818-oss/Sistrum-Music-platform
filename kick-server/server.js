import { createServer } from 'node:http';
import { createApp } from './src/app.js';
import { loadConfig } from './src/config.js';
import { openDatabase } from './src/db.js';
import { log } from './src/log.js';

const config = loadConfig();
const db = openDatabase(config.databasePath);
const server = createServer(createApp({ db, config }));
server.requestTimeout = 30_000;
server.headersTimeout = 15_000;
server.listen(config.port, () => {
  log('info', 'ViewerWorks listening', { port: config.port, baseUrl: config.baseUrl, kickConfigured: config.kickConfigured });
  if (!config.kickConfigured) log('warn', 'KICK login disabled; set the missing variables to enable it', { missing: config.missingKickVars });
});
const shutdown = () => server.close(() => { db.close(); process.exit(0); });
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
