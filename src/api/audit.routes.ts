import { Router, Request, Response } from 'express';
import prisma from '../prisma';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// Secure all audit routes
router.use(authenticate);

/**
 * @openapi
 * /audit:
 *   get:
 *     tags: [Audit]
 *     summary: Get audit logs
 *     description: Returns paginated audit logs for the authenticated tenant (newest first).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *     responses:
 *       '200':
 *         description: Paginated audit logs.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/AuditLog'
 *                 page:
 *                   type: integer
 *                 pageSize:
 *                   type: integer
 *                 total:
 *                   type: integer
 *       '401':
 *         description: Unauthorized.
 *       '500':
 *         description: Internal Server Error.
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