import request from 'supertest';
import { expect } from 'chai';
import express from 'express';
import { setupAuth } from '../auth.js';

describe('Authentication API', () => {
    let app;

    beforeEach(() => {
        app = express();
        app.use(express.json());
        setupAuth(app);
        
        // Mock root for redirects
        app.get('/', (req, res) => res.send('Home'));
    });

    describe('GET /api/auth/user', () => {
        it('should return 401 when not authenticated', async () => {
            const res = await request(app).get('/api/auth/user');
            expect(res.status).to.equal(401);
            expect(res.body.message).to.equal('Not authenticated');
        });
    });

    describe('Auth Routes Existence', () => {
        it('should have a /auth/google route', async () => {
            const res = await request(app).get('/auth/google');
            // If credentials are missing, we return 501. 
            // If present, Passport initiates redirect (302).
            expect(res.status).to.be.oneOf([302, 501]); 
        });

        it('should have a /auth/logout route', async () => {
            const res = await request(app).get('/auth/logout');
            expect(res.status).to.equal(302);
            expect(res.header.location).to.equal('/');
        });
    });
});
