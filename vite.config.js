import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Development-only RSVP backend: POST /api/rsvp appends the answer to
 * rsvp-data/rsvps.json and replies { ok: true } only after the write
 * succeeded. `?fail=1` simulates a server error (used by ?rsvpTest=fail).
 * Production uses VITE_RSVP_ENDPOINT instead (see src/game/mario/rsvp.js).
 */
function devRsvpApi() {
  const dir = path.resolve('rsvp-data');
  const file = path.join(dir, 'rsvps.json');
  const install = (server) => {
      server.middlewares.use('/api/rsvp', (req, res) => {
        const send = (code, body) => {
          res.statusCode = code;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify(body));
        };
        if (req.method !== 'POST') return send(405, { ok: false, error: 'method' });
        if ((req.url || '').includes('fail=1')) return send(500, { ok: false, error: 'simulated failure' });
        let raw = '';
        req.setEncoding('utf8');
        req.on('data', (c) => { raw += c; if (raw.length > 10000) req.destroy(); });
        req.on('end', () => {
          let data;
          try { data = JSON.parse(raw); } catch { return send(400, { ok: false, error: 'json' }); }
          const name = String(data.name || '').trim().slice(0, 40);
          if (!name || typeof data.attending !== 'boolean') return send(400, { ok: false, error: 'invalid' });
          try {
            fs.mkdirSync(dir, { recursive: true });
            const list = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
            const entry = {
              guestId: String(data.guestId || '').slice(0, 64), name, attending: data.attending,
              rsvp: data.attending ? 'Attending' : 'Declined', linkType: data.linkType || '',
              submittedAt: data.submittedAt, receivedAt: new Date().toISOString(),
            };
            // one current answer per guest id (same as docs/apps-script/Code.gs)
            const i = entry.guestId ? list.findIndex((r) => r.guestId === entry.guestId) : -1;
            if (i >= 0) list[i] = entry; else list.push(entry);
            fs.writeFileSync(file, JSON.stringify(list, null, 2));
            return send(200, { ok: true, updated: i >= 0, count: list.length });
          } catch (e) {
            return send(500, { ok: false, error: 'storage' });
          }
        });
        return undefined;
      });
  };
  return {
    name: 'local-rsvp-api',
    apply: 'serve', // `vite` and `vite preview` only — never part of a build
    configureServer: install,
    configurePreviewServer: install,
  };
}

/**
 * Dev-only art (old story preview scenes, ?preview=… on the dev server) is not
 * used by the invitation and its licence forbids redistributing the raw files,
 * so it is left out of the published site.
 */
function dropDevOnlyAssets() {
  const devOnly = ['assets/images/fantasy-lands', 'assets/images/kenney-dungeon', 'assets/licenses/fantasy-lands-LICENSE.txt'];
  return {
    name: 'drop-dev-only-assets',
    apply: 'build',
    closeBundle() {
      devOnly.forEach((p) => fs.rmSync(path.resolve('dist', p), { recursive: true, force: true }));
    },
  };
}

export default defineConfig({
  // Relative base: the same build works at https://thuythanh-lab.github.io/digital-wedding-invite/
  // (GitHub Pages sub-path), on localhost and in `vite preview`. Phaser/audio/photo
  // paths are relative ('assets/…') too, so nothing bypasses the repository prefix.
  base: './',
  plugins: [devRsvpApi(), dropDevOnlyAssets()],
  server: { host: true, port: 5174, strictPort: true },
  build: {
    target: 'es2019',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: { manualChunks: { phaser: ['phaser'] } },
    },
  },
});
