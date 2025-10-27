import { Router, Request, Response } from 'express';
import prisma from '../prisma';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// Secure all audit routes
router.use(authenticate);

/**
 * GET /audit
 * Retrieves paginated audit logs for the authenticated tenant.
 */
router.get('/', async (req: Request, res: Response) => {
    const tenantId = req.tenantId as string;
    const { page = '1', limit = '20' } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);

    try {
        const where = { tenantId };

        const [logs, totalCount] = await prisma.$transaction([
            prisma.auditLog.findMany({
                where,
                orderBy: {
                    createdAt: 'desc',
                },
                skip: (pageNum - 1) * limitNum,
                take: limitNum,
            }),
            prisma.auditLog.count({ where }),
        ]);

        res.status(200).json({
            data: logs,
            pagination: {
                total: totalCount,
                page: pageNum,
                limit: limitNum,
                totalPages: Math.ceil(totalCount / limitNum),
            },
        });
    } catch (error) {
        console.error('GET /audit error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;