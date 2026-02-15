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

    console.log('Auth Debug: GOOGLE_CLIENT_ID present:', !!GOOGLE_CLIENT_ID);
    if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_ID.includes('your_google_client_id_here')) {
        console.warn('Auth Debug: GOOGLE_CLIENT_ID still has placeholder value!');
    }

    if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
        console.log('Auth Debug: Registering Google Strategy...');
        console.log('Auth Debug: GOOGLE_CLIENT_ID (first 5 chars):', GOOGLE_CLIENT_ID.substring(0, 5));
        
        const baseUrl = process.env.BASE_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:3000';
        const callbackURL = `${baseUrl}/auth/google/callback`;
        console.log('Auth Debug: Construction Callback URL:', callbackURL);
        
        const strategy = new GoogleStrategy({
            clientID: GOOGLE_CLIENT_ID,
            clientSecret: GOOGLE_CLIENT_SECRET,
            callbackURL: callbackURL,
            proxy: true // Crucial for Render/Heroku to keep the HTTPS protocol
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
                console.log('Auth Debug: User upserted successfully');
                return done(null, userData);
            } catch (error) {
                console.error('Auth Debug: Error in verify callback:', error);
                return done(error);
            }
        });

        passport.use('google', strategy);
        
        // Verify strategy is registered
        console.log('Auth Debug: Registered strategies:', passport._strategies ? Object.keys(passport._strategies) : 'none');

        // Auth Routes
        app.get('/auth/google', (req, res, next) => {
            console.log('Auth Debug: /auth/google called');
            passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
        });

        app.get('/auth/google/callback', (req, res, next) => {
            console.log('Auth Debug: /auth/google/callback called');
            passport.authenticate('google', { 
                failureRedirect: '/',
                failureFlash: false // Change to true if you have a flash plugin
            })(req, res, next);
        }, (req, res) => {
            console.log('Auth Debug: Redirecting to home after successful auth');
            res.redirect('/');
        });
    } else {
        console.warn('⚠️ Google OAuth credentials not found. Authentication will be disabled.');
        
        app.get('/auth/google', (req, res) => {
            res.status(501).send(`
                <h1>Authentication Not Configured</h1>
                <p>Google OAuth credentials (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET) are missing in the .env file.</p>
                <p>Please refer to the documentation to set up Google Authentication.</p>
                <a href="/">Back to Home</a>
            `);
        });
    }

    passport.serializeUser((user, done) => {
        console.log('Auth Debug: Serializing user:', user.id);
        done(null, user);
    });

    passport.deserializeUser((user, done) => {
        // console.log('Auth Debug: Deserializing user:', user.id);
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
