'use strict';

const path = require('path');
const fs = require('fs');
const express = require('express');

const db = require('./db');
const transfer = require('./transfer');
const publicRoutes = require('./routes/public');
const adminRoutes = require('./routes/admin');
const auth = require('./auth');

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';

function bootstrapData() {
  db.connect();
  if (!transfer.isEmpty()) return;
  const jsonPath = path.join(db.DATA_DIR, 'db.json');
  if (fs.existsSync(jsonPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      transfer.load(data);
      console.log('[LeagueLive] Loaded data/db.json into SQLite.');
      return;
    } catch (err) {
      console.error('[LeagueLive] Could not read data/db.json:', err.message);
    }
  }
  // Nothing to load → build a demo dataset so the app is never empty.
  try {
    const { seedDatabase } = require('../scripts/seed');
    seedDatabase();
    console.log('[LeagueLive] Seeded a fresh demo database.');
  } catch (err) {
    console.error('[LeagueLive] Seeding failed:', err.message);
  }
}

function createServer() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '12mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.use((req, res, next) => {
    res.set('Cache-Control', req.path.startsWith('/api') ? 'no-store' : 'public, max-age=60');
    next();
  });

  app.use('/api', publicRoutes);
  app.use('/api/admin', adminRoutes);

  app.use(
    express.static(path.join(db.ROOT, 'public'), {
      index: 'index.html',
      extensions: ['html'],
      setHeaders(res, filePath) {
        if (filePath.endsWith('.json')) res.set('Cache-Control', 'no-store');
      },
    })
  );

  app.get('/admin', (req, res) => res.sendFile(path.join(db.ROOT, 'public', 'admin.html')));

  app.use((req, res) => {
    if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Not found' });
    return res.sendFile(path.join(db.ROOT, 'public', 'index.html'));
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error('[LeagueLive]', err);
    res.status(500).json({ error: err.message || 'Internal error' });
  });

  return app;
}

if (require.main === module) {
  bootstrapData();
  const app = createServer();
  app.listen(PORT, HOST, () => {
    const pw = auth.adminPassword();
    console.log('');
    console.log('  LeagueLive is running');
    console.log(`  ▸ Website      http://localhost:${PORT}`);
    console.log(`  ▸ Admin login  http://localhost:${PORT}/admin`);
    console.log(`  ▸ Admin password: ${pw}${process.env.ADMIN_PASSWORD ? '' : '  (set ADMIN_PASSWORD to change)'}`);
    console.log('');
  });
}

module.exports = { createServer, bootstrapData };
