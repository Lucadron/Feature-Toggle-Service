import { Router, Request, Response } from 'express';
import prisma from '../prisma';
import { compareSecret, generateToken } from '../services/auth.service';

const router = Router();

/**
 * POST /auth/token
 * Authenticates a tenant and returns a JWT
 */
router.post('/token', async (req: Request, res: Response) => {
    const { apiKey, apiSecret } = req.body;

    if (!apiKey || !apiSecret) {
        return res
            .status(400)
            .json({ error: 'apiKey and apiSecret are required' });
    }

    try {
        // 1. Find tenant by their public apiKey
        const tenant = await prisma.tenant.findUnique({
            where: { apiKey },
        });

        if (!tenant) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // 2. Compare the provided secret with the hashed secret in DB
        const isMatch = await compareSecret(apiSecret, tenant.apiSecret);

        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // 3. Generate and return JWT
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