import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import session from 'express-session';
import { upsertUser } from './db.js';

export function setupAuth(app) {
    // Session configuration
    app.use(session({
        secret: process.env.SESSION_SECRET || 'priority-task-manager-secret',
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: process.env.NODE_ENV === 'production',
            maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
        }
    }));

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
        
        // Fix: Restore baseUrl definition
        const baseUrl = process.env.BASE_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:3000';
        const callbackURL = `${baseUrl}/auth/google/callback`;
        console.log('Auth Debug: Construction Callback URL:', callbackURL);
        
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
                
                await upsertUser(userData);
                return done(null, userData);
            } catch (error) {
                console.error('Auth Debug: Error in verify callback:', error);
                return done(error);
            }
        });

        passport.use('google', strategy);

        // Auth Routes
        app.get('/auth/google', (req, res, next) => {
            console.log('Auth Debug: /auth/google called');
            passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
        });

        app.get('/auth/google/callback', (req, res, next) => {
            console.log('Auth Debug: /auth/google/callback called');
            passport.authenticate('google', { failureRedirect: '/' })(req, res, next);
        }, (req, res) => {
            res.redirect('/');
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

    app.get('/api/auth/config', (req, res) => {
        res.json({
            googleEnabled: !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET)
        });
    });
}

export function requireAuth(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.status(401).json({ error: 'Authentication required' });
}
