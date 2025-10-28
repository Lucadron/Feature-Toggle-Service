import request from 'supertest';
import express, { Express } from 'express';
import featureRoutes from '../api/features.routes'; // Router being tested
import authRoutes from '../api/auth.routes'; // Needed to get a token
import prisma from '../prisma';
import { Environment, EvaluationStrategy } from '@prisma/client'; // Import enums
import { createCacheKey, deleteFromCache } from '../services/cache.service'; // For cache cleanup

let app: Express;
let jwtToken: string; // To store the auth token for tests
let testTenantId: string;
let feature1Id: string; // To store ID of a seeded feature
let feature2Id: string; // To store ID of another seeded feature

// Setup: Create app instance and get a valid JWT token before running tests
beforeAll(async () => {
    app = express();
    app.use(express.json());
    // Mount necessary routers for testing
    app.use('/auth', authRoutes);
    app.use('/features', featureRoutes);

    // Get a token for the 'Zebra' tenant (assuming seed script ran)
    const response = await request(app)
        .post('/auth/token')
        .send({ apiKey: 'zebra_api_key', apiSecret: 'zebra_secret_123' });

    if (response.status !== 200 || !response.body.token) {
        throw new Error('Failed to get JWT token for testing. Ensure seed script ran.');
    }
    jwtToken = response.body.token;

    // Get tenant and feature IDs needed for tests directly from DB
    const tenant = await prisma.tenant.findUnique({ where: { apiKey: 'zebra_api_key' } });
    const feature1 = await prisma.feature.findUnique({ where: { name: 'new-dashboard' } });
    const feature2 = await prisma.feature.findUnique({ where: { name: 'beta-checkout' } });

    if (!tenant || !feature1 || !feature2) {
        throw new Error('Required seed data (tenant/features) not found.');
    }
    testTenantId = tenant.id;
    feature1Id = feature1.id;
    feature2Id = feature2.id;

    // Clean cache before tests start for predictable results
    await deleteFromCache(createCacheKey(testTenantId, Environment.prod));
    await deleteFromCache(createCacheKey(testTenantId, Environment.staging));
    await deleteFromCache(createCacheKey(testTenantId, Environment.dev));
});

// Teardown: Disconnect Prisma after all tests in this file
afterAll(async () => {
    await prisma.$disconnect();
    // Optional: Close Redis connection if cache service keeps it open globally
});

// Group tests for /features endpoint
describe('/features API', () => {

    // --- Authentication Tests ---
    describe('Authentication', () => {
        it('GET /features should return 401 without a token', async () => {
            const response = await request(app).get('/features?env=prod');
            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('error', 'Access denied. No token provided.');
        });

        it('POST /features should return 401 without a token', async () => {
            const response = await request(app).post('/features').send({});
            expect(response.status).toBe(401);
        });

        it('DELETE /features/:id should return 401 without a token', async () => {
            const response = await request(app).delete('/features/some-id');
            expect(response.status).toBe(401);
        });

        it('GET /features should return 401 with an invalid token', async () => {
            const response = await request(app)
                .get('/features?env=prod')
                .set('Authorization', 'Bearer invalidtoken');
            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('error', 'Access denied. Invalid token.');
        });
    });

    // --- GET /features Tests ---
    describe('GET /features', () => {
        it('should return feature flags for a valid tenant and env', async () => {
            const response = await request(app)
                .get('/features?env=prod')
                .set('Authorization', `Bearer ${jwtToken}`); // Use valid token

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('data');
            expect(response.body).toHaveProperty('pagination');
            expect(Array.isArray(response.body.data)).toBe(true);
            // Check if the seeded 'new-dashboard' flag is present
            expect(response.body.data.some((flag: any) => flag.name === 'new-dashboard')).toBe(true);
            expect(response.body.source).toBe('database'); // First request should hit DB
        });

        it('should return cached results on the second request (for page 1, no filter)', async () => {
            // First request (already tested, but ensures cache is warm)
            await request(app)
                .get('/features?env=prod')
                .set('Authorization', `Bearer ${jwtToken}`);

            // Second request
            const response = await request(app)
                .get('/features?env=prod')
                .set('Authorization', `Bearer ${jwtToken}`);

            expect(response.status).toBe(200);
            expect(response.body.source).toBe('cache'); // Second request should hit cache
            expect(response.body.data.some((flag: any) => flag.name === 'new-dashboard')).toBe(true);
        });

        it('should filter results by name', async () => {
            const response = await request(app)
                .get('/features?env=prod&filter=dash') // Filter for 'dash'
                .set('Authorization', `Bearer ${jwtToken}`);

            expect(response.status).toBe(200);
            expect(response.body.data.length).toBeGreaterThan(0);
            expect(response.body.data.every((flag: any) => flag.name.toLowerCase().includes('dash'))).toBe(true);
            expect(response.body.data.some((flag: any) => flag.name === 'beta-checkout')).toBe(false); // Should not include beta-checkout
            expect(response.body.source).toBe('database'); // Filtered requests bypass cache
        });

        it('should handle pagination', async () => {
            // Get page 1, limit 1
            const response = await request(app)
                .get('/features?env=prod&page=1&limit=1')
                .set('Authorization', `Bearer ${jwtToken}`);

            expect(response.status).toBe(200);
            // Check that the returned number of items matches the limit
            expect(response.body.data.length).toBe(1); // Keep this assertion
            expect(response.body.pagination.page).toBe(1);
            expect(response.body.pagination.limit).toBe(1);
            // Get total count to ensure totalPages calculation is reasonable
            const totalCountResponse = await prisma.featureFlag.count({ where: { tenantId: testTenantId, env: 'prod' } });
            expect(response.body.pagination.total).toBe(totalCountResponse);
            expect(response.body.pagination.totalPages).toBe(Math.ceil(totalCountResponse / 1));
        });
        it('should return 400 if env parameter is missing', async () => {
            const response = await request(app)
                .get('/features')
                .set('Authorization', `Bearer ${jwtToken}`);
            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error');
        });

        it('should return 400 if env parameter is invalid', async () => {
            const response = await request(app)
                .get('/features?env=invalid')
                .set('Authorization', `Bearer ${jwtToken}`);
            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error');
        });
    });

    // --- POST /features Tests ---
    describe('POST /features', () => {
        const newFlagData = {
            featureId: feature2Id, // Use 'beta-checkout' feature ID
            env: Environment.dev, // Target 'dev' environment
            enabled: true,
            strategy: EvaluationStrategy.BOOLEAN,
            strategyValue: null
        };

        // Clean up potential leftovers before each POST test
        beforeEach(async () => {
            await prisma.featureFlag.deleteMany({
                where: {
                    tenantId: testTenantId,
                    featureId: newFlagData.featureId,
                    env: newFlagData.env,
                },
            });
            // Clear cache for the specific env being tested
            await deleteFromCache(createCacheKey(testTenantId, newFlagData.env));
        });

        // Clean up the flag created in this test block
        afterAll(async () => {
            await prisma.featureFlag.deleteMany({
                where: {
                    tenantId: testTenantId,
                    featureId: newFlagData.featureId,
                    env: newFlagData.env,
                },
            });
            // Clear cache for dev env
            await deleteFromCache(createCacheKey(testTenantId, newFlagData.env));
        });

        it('should create a new feature flag', async () => {
            const response = await request(app)
                .post('/features')
                .set('Authorization', `Bearer ${jwtToken}`)
                .send(newFlagData);

            expect(response.status).toBe(201); // Expect HTTP 201 Created
            expect(response.body).toHaveProperty('id');
            expect(response.body.featureId).toBe(newFlagData.featureId);
            expect(response.body.env).toBe(newFlagData.env);
            expect(response.body.enabled).toBe(newFlagData.enabled);
            expect(response.body.strategy).toBe(newFlagData.strategy);

            // Verify it's in the database
            const dbFlag = await prisma.featureFlag.findUnique({ where: { id: response.body.id } });
            expect(dbFlag).not.toBeNull();
        });

        it('should update an existing feature flag (upsert)', async () => {
            // First, ensure the flag exists (create it via API)
            await request(app)
                .post('/features')
                .set('Authorization', `Bearer ${jwtToken}`)
                .send(newFlagData);

            // Now, update it
            const updatedData = { ...newFlagData, enabled: false, strategy: EvaluationStrategy.PERCENTAGE, strategyValue: { percentage: 30 } };
            const response = await request(app)
                .post('/features')
                .set('Authorization', `Bearer ${jwtToken}`)
                .send(updatedData);

            expect(response.status).toBe(201); // Upsert might return 201 or 200, depends on impl. Let's stick to 201 as per our route.
            expect(response.body.enabled).toBe(false);
            expect(response.body.strategy).toBe(EvaluationStrategy.PERCENTAGE);
            expect(response.body.strategyValue).toEqual({ percentage: 30 });

            // Verify the update in the database
            const dbFlag = await prisma.featureFlag.findUnique({
                where: {
                    tenantId_featureId_env: {
                        tenantId: testTenantId,
                        featureId: updatedData.featureId,
                        env: updatedData.env
                    }
                }
            });
            expect(dbFlag?.enabled).toBe(false);
            expect(dbFlag?.strategy).toBe(EvaluationStrategy.PERCENTAGE);
        });

        it('should return 400 for missing required fields', async () => {
            const badData = { featureId: feature1Id, env: Environment.dev }; // Missing enabled, strategy
            const response = await request(app)
                .post('/features')
                .set('Authorization', `Bearer ${jwtToken}`)
                .send(badData);
            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error');
        });

        it('should return 400 for invalid featureId', async () => {
            const badData = { ...newFlagData, featureId: 'invalid-feature-id' };
            const response = await request(app)
                .post('/features')
                .set('Authorization', `Bearer ${jwtToken}`)
                .send(badData);
            expect(response.status).toBe(400); // Because of foreign key constraint
            expect(response.body).toHaveProperty('error');
        });
    });

    // --- DELETE /features/:id Tests ---
    describe('DELETE /features/:id', () => {
        let flagToDeleteId: string;

        // Create a flag specifically for deletion tests
        beforeEach(async () => {
            // Clean cache just in case
            await deleteFromCache(createCacheKey(testTenantId, Environment.dev));

            const flag = await prisma.featureFlag.create({
                data: {
                    tenantId: testTenantId,
                    featureId: feature1Id, // Use 'new-dashboard'
                    env: Environment.dev,
                    enabled: true,
                    strategy: EvaluationStrategy.BOOLEAN,
                },
            });
            flagToDeleteId = flag.id;
        });

        // Clean up after each test in this block
        afterEach(async () => {
            await prisma.featureFlag.deleteMany({ where: { id: flagToDeleteId } });
            await deleteFromCache(createCacheKey(testTenantId, Environment.dev));
        });

        it('should delete an existing feature flag', async () => {
            const response = await request(app)
                .delete(`/features/${flagToDeleteId}`)
                .set('Authorization', `Bearer ${jwtToken}`);

            expect(response.status).toBe(204); // Expect HTTP 204 No Content

            // Verify it's gone from the database
            const dbFlag = await prisma.featureFlag.findUnique({ where: { id: flagToDeleteId } });
            expect(dbFlag).toBeNull();
        });

        it('should return 404 if the feature flag id does not exist', async () => {
            const nonExistentId = 'cl_non_existent_id_123'; // Use a plausible but non-existent CUID format if needed
            const response = await request(app)
                .delete(`/features/${nonExistentId}`)
                .set('Authorization', `Bearer ${jwtToken}`);

            expect(response.status).toBe(404);
            expect(response.body).toHaveProperty('error');
        });

        it('should return 404 if trying to delete a flag belonging to another tenant', async () => {
            // We need another tenant and flag for this test
            const otherTenant = await prisma.tenant.create({ data: { name: 'OtherTenant', apiKey: 'other_key', apiSecret: 'other_secret' } });
            const otherFlag = await prisma.featureFlag.create({
                data: {
                    tenantId: otherTenant.id,
                    featureId: feature1Id,
                    env: Environment.dev,
                    enabled: true,
                    strategy: EvaluationStrategy.BOOLEAN,
                },
            });

            // Try deleting otherFlag using Zebra's token
            const response = await request(app)
                .delete(`/features/${otherFlag.id}`)
                .set('Authorization', `Bearer ${jwtToken}`); // Zebra's token

            expect(response.status).toBe(404); // Should not find it because tenantId mismatch in query

            // Cleanup
            await prisma.featureFlag.delete({ where: { id: otherFlag.id } });
            await prisma.tenant.delete({ where: { id: otherTenant.id } });
        });
    });

});