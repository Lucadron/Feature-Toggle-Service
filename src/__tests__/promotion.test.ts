import request from 'supertest';
import express, { Express } from 'express';
import promotionRoutes from '../api/promotion.routes'; // Router being tested
import authRoutes from '../api/auth.routes'; // Needed for token
import prisma from '../prisma';
import { Environment, EvaluationStrategy } from '@prisma/client';
import { createCacheKey, deleteFromCache, getFromCache } from '../services/cache.service';
// Import Redis clients to close handles
import { redisClient as cacheRedisClient } from '../services/cache.service';
import { rateLimitClient } from '../middleware/rateLimit.middleware';

let app: Express;
let jwtToken: string;
let testTenantId: string;
let feature1Id: string;

// Setup: Create app, get token, ensure prerequisite data
beforeAll(async () => {
    app = express();
    app.use(express.json());
    app.use('/auth', authRoutes);
    app.use('/promote', promotionRoutes); // The router we are testing

    // Ensure tenant and feature exist (similar to features.test.ts)
    const tenant = await prisma.tenant.findUnique({ where: { apiKey: 'zebra_api_key' } });
    const feature1 = await prisma.feature.findUnique({ where: { name: 'new-dashboard' } });
    if (!tenant || !feature1) {
        throw new Error('Seed data (tenant/feature1) missing for promotion tests.');
    }
    testTenantId = tenant.id;
    feature1Id = feature1.id;

    // Get token
    const tokenResponse = await request(app)
        .post('/auth/token')
        .send({ apiKey: 'zebra_api_key', apiSecret: 'zebra_secret_123' });
    if (tokenResponse.status !== 200 || !tokenResponse.body.token) {
        throw new Error('Failed to get JWT token for promotion tests.');
    }
    jwtToken = tokenResponse.body.token;

    // Ensure staging env has a flag to promote, and prod env is clean (or predictable)
    await prisma.featureFlag.deleteMany({ where: { tenantId: testTenantId, featureId: feature1Id, env: Environment.prod } });
    await prisma.featureFlag.upsert({
        where: { tenantId_featureId_env: { tenantId: testTenantId, featureId: feature1Id, env: Environment.staging } },
        update: { enabled: true, strategy: EvaluationStrategy.BOOLEAN },
        create: { tenantId: testTenantId, featureId: feature1Id, env: Environment.staging, enabled: true, strategy: EvaluationStrategy.BOOLEAN },
    });

    // Clear relevant caches
    await deleteFromCache(createCacheKey(testTenantId, Environment.staging));
    await deleteFromCache(createCacheKey(testTenantId, Environment.prod));
});

// Teardown: Clean up created flags and disconnect clients
afterAll(async () => {
    await prisma.featureFlag.deleteMany({
        where: { tenantId: testTenantId, featureId: feature1Id, env: { in: [Environment.staging, Environment.prod] } },
    });
    await prisma.$disconnect();
    // Close Redis connections if they are open
    if (cacheRedisClient.isOpen) await cacheRedisClient.quit();
    if (rateLimitClient.isOpen) await rateLimitClient.quit();
});

describe('/promote API', () => {

    describe('Authentication', () => {
        it('POST /promote should return 401 without a token', async () => {
            const response = await request(app).post('/promote').send({ sourceEnv: 'staging', targetEnv: 'prod' });
            expect(response.status).toBe(401);
        });
    });

    describe('POST /promote', () => {
        // Clear prod cache before each specific promotion test
        beforeEach(async () => {
            await deleteFromCache(createCacheKey(testTenantId, Environment.prod));
        });

        it('should promote flags from staging to prod', async () => {
            const response = await request(app)
                .post('/promote')
                .set('Authorization', `Bearer ${jwtToken}`)
                .send({ sourceEnv: Environment.staging, targetEnv: Environment.prod });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('message', 'Promotion successful.');
            expect(response.body.promotedCount).toBeGreaterThanOrEqual(1); // Expect at least the one we created

            // Verify the flag now exists in prod in the DB
            const prodFlag = await prisma.featureFlag.findUnique({
                where: { tenantId_featureId_env: { tenantId: testTenantId, featureId: feature1Id, env: Environment.prod } },
            });
            expect(prodFlag).not.toBeNull();
            expect(prodFlag?.enabled).toBe(true); // Should match the source flag

            // Verify cache for target env was invalidated (next read should be from DB)
            // This requires testing GET /features which is complex here. We trust deleteFromCache worked.
        });

        it('should return 400 for invalid environments', async () => {
            const response = await request(app)
                .post('/promote')
                .set('Authorization', `Bearer ${jwtToken}`)
                .send({ sourceEnv: 'staging', targetEnv: 'invalid' });
            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error');
        });

        it('should return 400 if source and target environments are the same', async () => {
            const response = await request(app)
                .post('/promote')
                .set('Authorization', `Bearer ${jwtToken}`)
                .send({ sourceEnv: 'staging', targetEnv: 'staging' });
            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error');
        });

        it('should return 404 if source environment has no flags', async () => {
            // Promote from 'dev' which we didn't seed for this feature
            const response = await request(app)
                .post('/promote')
                .set('Authorization', `Bearer ${jwtToken}`)
                .send({ sourceEnv: Environment.dev, targetEnv: Environment.prod });
            expect(response.status).toBe(404);
            expect(response.body).toHaveProperty('message', 'No flags found in the source environment.');
        });
    });
});