import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { upsertUser, claimLegacyDataIfFirstUser, seedDefaultPipelinesIfFirstUser } from './db.js';

const PgSession = connectPgSimple(session);

export function setupAuth(app) {
    const dbUrl = process.env.DATABASE_URL || '';
    const isLocalDb = /@(localhost|127\.0\.0\.1|::1)[:/]/.test(dbUrl) && !/sslmode=require/.test(dbUrl);

    // Session configuration
    const sessionMiddleware = session({
        store: new PgSession({
            conObject: {
                connectionString: dbUrl,
                ssl: isLocalDb ? false : { rejectUnauthorized: false }
            },
            createTableIfMissing: true
        }),
        secret: process.env.SESSION_SECRET || 'priority-task-manager-secret',
        resave: false,
        saveUninitialized: false,
        rolling: true, // Reset cookie expiration on every response
        cookie: {
            secure: process.env.NODE_ENV === 'production',
            maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
        }
    });
    app.use(sessionMiddleware);

    app.use(passport.initialize());
    app.use(passport.session());

    // Google Strategy
    const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
    const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

    if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
        console.log('--- CREDENTIAL CHECK ---');
        console.log('Client ID length:', GOOGLE_CLIENT_ID.trim().length);
        console.log('Client Secret length:', GOOGLE_CLIENT_SECRET.trim().length);
        console.log('--- END CHECK ---');

        console.log('Status: Registering Google Oauth Strategy...');
        
        // Construct callback URL
        // If BASE_URL is provided (production), use it. 
        // Otherwise, Passport will try to determine it from the request if we provide a relative path,
        // but Google requires an absolute URL in the config.
        const baseUrl = process.env.BASE_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:3000';
        const callbackURL = `${baseUrl}/auth/google/callback`;
        
        console.log('--------------------------------------------------');
        console.log('IMPORTANT: OAuth Callback Configuration');
        console.log('Callback URL being sent to Google:', callbackURL);
        console.log('Ensure this EXACT URL is in your Google Cloud Console');
        console.log('under "Authorized redirect URIs"');
        console.log('--------------------------------------------------');
        
        const strategy = new GoogleStrategy({
            clientID: GOOGLE_CLIENT_ID,
            clientSecret: GOOGLE_CLIENT_SECRET,
            callbackURL: callbackURL,
            proxy: true
        }, async (accessToken, refreshToken, profile, done) => {
            try {
                console.log('Auth Debug: Verify callback triggered for profile:', profile.id);
                const userData = {
                    id: profile.id,
                    email: profile.emails?.[0]?.value || '',
                    name: profile.displayName || '',
                    avatar: profile.photos?.[0]?.value || '',
                    provider: 'google'
                };
                
                // Critical: without this, the user can't be logged in at all.
                await upsertUser(userData);

                // Best-effort only — a slow/cold DB on these secondary, one-time
                // steps must never block or fail the actual login.
                try {
                    await claimLegacyDataIfFirstUser(userData.id);
                    await seedDefaultPipelinesIfFirstUser(userData.id);
                } catch (secondaryError) {
                    console.error('Auth Debug: non-critical post-login step failed (login still proceeds):', secondaryError);
                }

                return done(null, userData);
            } catch (error) {
                console.error('Auth Debug: Error in verify callback:', error);
                return done(error);
            }
        });

        passport.use('google', strategy);

        // Auth Routes
        app.get('/auth/google', (req, res, next) => {
            // Determine callback URL dynamically from request to avoid mismatches
            const host = req.get('host');
            const protocol = req.headers['x-forwarded-proto'] || req.protocol;
            const dynamicCallbackURL = `${protocol}://${host}/auth/google/callback`;
            
            console.log('Auth Debug: Initiating Google login');
            console.log('Auth Debug: Dynamic Callback URL:', dynamicCallbackURL);
            
            passport.authenticate('google', { 
                scope: ['profile', 'email'],
                callbackURL: dynamicCallbackURL
            })(req, res, next);
        });

        app.get('/auth/google/callback', (req, res, next) => {
            const host = req.get('host');
            const protocol = req.headers['x-forwarded-proto'] || req.protocol;
            const dynamicCallbackURL = `${protocol}://${host}/auth/google/callback`;

            console.log('Auth Debug: Handling Google callback');

            // Custom callback (instead of failureRedirect) so a failure is
            // logged with its actual reason and surfaced to the user, rather
            // than silently bouncing back to the sign-in gate with no
            // explanation — that silent bounce is what made repeated retries
            // look like "nothing happens" on Render's free-tier cold starts.
            passport.authenticate('google', { callbackURL: dynamicCallbackURL }, (err, user, info) => {
                if (err) {
                    console.error('Auth Debug: OAuth callback error:', err);
                    return res.redirect('/?login_error=' + encodeURIComponent(err.message || 'oauth_error'));
                }
                if (!user) {
                    console.warn('Auth Debug: OAuth callback returned no user:', info);
                    return res.redirect('/?login_error=' + encodeURIComponent((info && info.message) || 'denied'));
                }
                req.logIn(user, (loginErr) => {
                    if (loginErr) {
                        console.error('Auth Debug: req.logIn failed:', loginErr);
                        return res.redirect('/?login_error=' + encodeURIComponent('session_save_failed'));
                    }
                    res.redirect('/');
                });
            })(req, res, next);
        });
    } else {
        console.warn('⚠️ Google OAuth credentials not found.');
        app.get('/auth/google', (req, res) => {
            res.status(501).send('Authentication Not Configured');
        });
    }

    passport.serializeUser((user, done) => {
        done(null, user);
    });

    passport.deserializeUser((user, done) => {
        done(null, user);
    });

    app.get('/auth/logout', (req, res, next) => {
        req.logout((err) => {
            if (err) return next(err);
            res.redirect('/');
        });
    });

    app.get('/api/auth/user', (req, res) => {
        if (req.isAuthenticated()) {
            res.json(req.user);
        } else {
            res.status(401).json({ message: 'Not authenticated' });
        }
    });

    // Heartbeat endpoint to keep session alive
    app.get('/api/auth/heartbeat', (req, res) => {
        if (req.isAuthenticated()) {
            res.json({ authenticated: true, user: req.user.id });
        } else {
            res.status(401).json({ authenticated: false });
        }
    });

    app.get('/api/auth/config', (req, res) => {
        res.json({
            googleEnabled: !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET)
        });
    });

    return sessionMiddleware;
}

export function requireAuth(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.status(401).json({ error: 'Authentication required' });
}
