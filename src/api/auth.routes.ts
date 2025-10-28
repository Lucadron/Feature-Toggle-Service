import { Router, Request, Response } from 'express';
import prisma from '../prisma';
import { compareSecret, generateToken } from '../services/auth.service';

const router = Router();

/**
 * @openapi
 * /auth/token:
 *   post:
 *     tags: [Authentication]
 *     summary: Authenticate and get JWT
 *     description: Authenticates a tenant using apiKey and apiSecret, returning a JWT.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [apiKey, apiSecret]
 *             properties:
 *               apiKey:
 *                 type: string
 *                 description: Public API key of the tenant.
 *                 example: zebra_api_key
 *               apiSecret:
 *                 type: string
 *                 description: Secret key for the tenant (used only for authentication).
 *                 example: zebra_secret_123
 *     responses:
 *       '200':
 *         description: Authentication successful, JWT returned.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Authentication successful
 *                 token:
 *                   type: string
 *                   description: JWT token for API access.
 *                   example: eyJhbGciOiJIUzI1NiIsIn...
 *       '400':
 *         description: Bad Request - Missing apiKey or apiSecret.
 *       '401':
 *         description: Unauthorized - Invalid credentials.
 *       '500':
 *         description: Internal Server Error.
 */



router.post('/token', async (req: Request, res: Response) => {
    const { apiKey, apiSecret } = req.body;

    if (!apiKey || !apiSecret) {
        return res
            .status(400)
            .json({ error: 'apiKey and apiSecret are required' });
    }

    try {
        const tenant = await prisma.tenant.findUnique({
            where: { apiKey },
        });

        if (!tenant) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const isMatch = await compareSecret(apiSecret, tenant.apiSecret);

        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = generateToken(tenant);
        return res.status(200).json({
            message: 'Authentication successful',
            token: token,
        });
    } catch (error) {
        console.error('Auth error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;