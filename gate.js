import crypto from 'crypto';

const OPEN_PATHS = new Set(['/healthz', '/login', '/logout', '/api/log-client-error']);

function safeEqual(a, b) {
    const ab = Buffer.from(String(a));
    const bb = Buffer.from(String(b));
    if (ab.length !== bb.length) return false;
    return crypto.timingSafeEqual(ab, bb);
}

function loginPage(error) {
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Locked</title>
<style>
  body { font-family: -apple-system, system-ui, sans-serif; background: #111; color: #eee;
         display: grid; place-items: center; height: 100vh; margin: 0; }
  form { display: flex; flex-direction: column; gap: 12px; width: 280px; }
  input { padding: 12px; font-size: 16px; border-radius: 8px; border: 1px solid #444;
          background: #1c1c1c; color: #eee; }
  button { padding: 12px; font-size: 16px; border-radius: 8px; border: 0;
           background: #d9c494; color: #111; font-weight: 600; cursor: pointer; }
  .err { color: #e88; font-size: 13px; min-height: 16px; }
</style>
</head>
<body>
<form method="post" action="/login">
  <div class="err">${error ? 'Wrong password.' : ''}</div>
  <input type="password" name="password" placeholder="Password" autofocus autocomplete="current-password">
  <button type="submit">Unlock</button>
</form>
</body>
</html>`;
}

export function setupGate(app, io) {
    const PASSWORD = process.env.APP_PASSWORD;

    if (!PASSWORD) {
        console.warn('\x1b[33m⚠️  APP_PASSWORD not set — gate DISABLED, app is fully open\x1b[0m');
        return;
    }

    app.get('/login', (req, res) => {
        if (req.session?.unlocked) return res.redirect('/');
        res.type('html').send(loginPage(req.query.e === '1'));
    });

    app.post('/login', (req, res) => {
        if (safeEqual(req.body?.password || '', PASSWORD)) {
            req.session.unlocked = true;
            return res.redirect('/');
        }
        res.redirect('/login?e=1');
    });

    app.get('/logout', (req, res) => {
        req.session.destroy(() => res.redirect('/login'));
    });

    // HTTP gate — everything past here requires an unlocked session
    app.use((req, res, next) => {
        if (req.session?.unlocked) return next();
        if (OPEN_PATHS.has(req.path)) return next();
        if (req.method === 'GET' && req.accepts('html')) return res.redirect('/login');
        res.status(401).json({ error: 'locked' });
    });

    // Socket gate — reject handshakes without an unlocked session
    io.use((socket, next) => {
        if (socket.request.session?.unlocked) return next();
        next(new Error('locked'));
    });
}
