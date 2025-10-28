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
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination.
 *       - in: query
 *         name: pageSize
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Items per page.
 *     responses:
 *       '200':
 *         description: Paginated audit logs.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/AuditLog'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total: { type: integer }
 *                     page: { type: integer }
 *                     limit: { type: integer }
 *                     totalPages: { type: integer }
 *       '400':
 *         description: Bad Request - Invalid page or pageSize.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       '401':
 *         description: Unauthorized - Invalid or missing JWT.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       '500':
 *         description: Internal Server Error.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
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