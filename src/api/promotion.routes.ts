import { Router, Request, Response } from 'express';
import { Environment, Prisma } from '@prisma/client';
import prisma from '../prisma';
import { authenticate } from '../middleware/auth.middleware';
import {
    deleteFromCache,
    createCacheKey,
} from '../services/cache.service';
import { createAuditLog } from '../services/audit.service';

const router = Router();

// Secure all routes in this file
router.use(authenticate);

/**
 * @openapi
 * /promote:
 *   post:
 *     tags: [Promotion]
 *     summary: Promote flags between environments
 *     description: Promotes all feature flags from a source environment to a target environment using upsert. Invalidates target environment cache and writes an audit log.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sourceEnv, targetEnv]
 *             properties:
 *               sourceEnv:
 *                 type: string
 *                 enum: [dev, staging, prod]
 *                 description: The source environment to promote flags from.
 *               targetEnv:
 *                 type: string
 *                 enum: [dev, staging, prod]
 *                 description: The target environment to promote flags to (must be different from source).
 *     responses:
 *       '200':
 *         description: Promotion successful.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Promotion successful.
 *                 promotedCount:
 *                   type: integer
 *                   description: Number of flags processed.
 *                   example: 5
 *       '400':
 *         description: Bad Request (invalid env, same env, or promotion failure).
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
 *       '404':
 *         description: Not Found - No source flags found in the specified environment for this tenant.
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


router.post('/', async (req: Request, res: Response) => {
    const tenantId = req.tenantId as string;
    const { sourceEnv, targetEnv } = req.body;

    // 1. Validation
    const validEnvs = Object.values(Environment);
    if (
        !sourceEnv ||
        !targetEnv ||
        sourceEnv === targetEnv ||
        !validEnvs.includes(sourceEnv as Environment) ||
        !validEnvs.includes(targetEnv as Environment)
    ) {
        return res.status(400).json({
            error:
                'Valid and different "sourceEnv" and "targetEnv" are required.',
        });
    }

    try {
        // 2. Get all flags from the source environment
        const sourceFlags = await prisma.featureFlag.findMany({
            where: {
                tenantId: tenantId,
                env: sourceEnv as Environment,
            },
        });

        if (sourceFlags.length === 0) {
            return res
                .status(404)
                .json({ message: 'No flags found in the source environment.' });
        }

        // 3. Prepare 'upsert' operations for the transaction
        const upsertOperations = sourceFlags.map((flag) => {
            // Destructure to remove fields we don't want to copy directly
            const { id, createdAt, updatedAt, env, ...flagData } = flag;

            // Data to be created or updated in the target env
            // Handle 'null' for JSON strategyValue
            const commonData = {
                enabled: flagData.enabled,
                strategy: flagData.strategy,
                strategyValue:
                    flagData.strategyValue === null
                        ? Prisma.JsonNull // Use Prisma.JsonNull for null
                        : flagData.strategyValue,
            };

            return prisma.featureFlag.upsert({
                where: {
                    tenantId_featureId_env: {
                        tenantId: flagData.tenantId,
                        featureId: flagData.featureId,
                        env: targetEnv as Environment,
                    },
                },
                create: {
                    tenantId: flagData.tenantId,
                    featureId: flagData.featureId,
                    env: targetEnv as Environment,
                    ...commonData, // Apply common data
                },
                update: commonData, // Apply common data
            });
        });

        // 4. Execute all operations in a single, safe transaction
        const result = await prisma.$transaction(upsertOperations);

        // 5. Invalidate the cache for the target environment
        const cacheKey = createCacheKey(tenantId, targetEnv);
        await deleteFromCache(cacheKey);

        // 6. Create one high-level audit log for the promotion event
        await createAuditLog({
            tenantId,
            actor: tenantId,
            action: 'PROMOTE',
            entity: 'Environment',
            entityId: targetEnv, // Log against the environment
            diff: {
                source: sourceEnv,
                target: targetEnv,
                promotedCount: result.length,
            },
        });

        return res.status(200).json({
            message: 'Promotion successful.',
            promotedCount: result.length,
        });
    } catch (error) {
        console.error('POST /promote error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;