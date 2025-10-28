import request from 'supertest';
import express from 'express'; // We need express types for the app instance
import authRoutes from '../api/auth.routes'; // Import the router we want to test
import prisma from '../prisma'; // Import prisma for potential setup/teardown

// Mock the main app setup partially - only load the router we're testing
const app = express();
app.use(express.json());
app.use('/auth', authRoutes); // Mount the auth router

// Describe block groups tests for the authentication endpoint
describe('POST /auth/token', () => {
    // Test case 1: Successful authentication
    it('should return a JWT token for valid credentials', async () => {
        // Use the seeded tenant data (ensure seed script has run before tests)
        const response = await request(app)
            .post('/auth/token')
            .send({
                apiKey: 'zebra_api_key', // From seed.ts
                apiSecret: 'zebra_secret_123', // From seed.ts
            });

        // Assertions: Check the response
        expect(response.status).toBe(200); // Expect HTTP 200 OK
        expect(response.body).toHaveProperty('token'); // Expect 'token' in the body
        expect(typeof response.body.token).toBe('string'); // Expect token to be a string
        expect(response.body.token.length).toBeGreaterThan(50); // Expect token to be reasonably long
    });

    // Test case 2: Invalid API Key
    it('should return 401 for invalid apiKey', async () => {
        const response = await request(app)
            .post('/auth/token')
            .send({
                apiKey: 'invalid_key',
                apiSecret: 'zebra_secret_123',
            });

        expect(response.status).toBe(401); // Expect HTTP 401 Unauthorized
        expect(response.body).toHaveProperty('error', 'Invalid credentials');
    });

    // Test case 3: Invalid API Secret
    it('should return 401 for invalid apiSecret', async () => {
        const response = await request(app)
            .post('/auth/token')
            .send({
                apiKey: 'zebra_api_key',
                apiSecret: 'wrong_secret',
            });

        expect(response.status).toBe(401); // Expect HTTP 401 Unauthorized
        expect(response.body).toHaveProperty('error', 'Invalid credentials');
    });

    // Test case 4: Missing fields
    it('should return 400 if apiKey or apiSecret is missing', async () => {
        // Missing apiSecret
        let response = await request(app)
            .post('/auth/token')
            .send({ apiKey: 'zebra_api_key' });
        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('error', 'apiKey and apiSecret are required');

        // Missing apiKey
        response = await request(app)
            .post('/auth/token')
            .send({ apiSecret: 'zebra_secret_123' });
        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('error', 'apiKey and apiSecret are required');
    });

    afterAll(async () => {
      await prisma.$disconnect();
    });
});