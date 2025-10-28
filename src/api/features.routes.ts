import { Router, Request, Response } from 'express';
import { Environment, Prisma } from '@prisma/client';
import prisma from '../prisma';
import { authenticate } from '../middleware/auth.middleware';
import {
    getFromCache,
    setInCache,
    deleteFromCache,
    createCacheKey,
} from '../services/cache.service';
import { createAuditLog } from '../services/audit.service';
import { flagEvaluationsTotal } from '../services/metrics.service';

const router = Router();
router.use(authenticate);

/**
 * @openapi
 * /features:
 *   get:
 *     tags: [Features]
 *     summary: Get evaluated feature flags
 *     description: Retrieves evaluated feature flags for the authenticated tenant in the given environment. Supports caching, pagination and optional name filter.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: env
 *         required: true
 *         schema:
 *           type: string
 *           enum: [dev, staging, prod]
 *         description: Target environment.
 *       - in: query
 *         name: page
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number.
 *       - in: query
 *         name: pageSize
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Items per page.
 *       - in: query
 *         name: filter
 *         required: false
 *         schema:
 *           type: string
 *         description: Case-insensitive substring filter by feature name.
 *     responses:
 *       '200':
 *         description: Paginated evaluated feature flags.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 source:
 *                   type: string
 *                   description: "'cache' or 'database'"
 *                   example: cache
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string }
 *                       name: { type: string }
 *                       description: { type: string, nullable: true }
 *                       enabled: { type: boolean }
 *                       env: { type: string }
 *                       strategy: { type: string }
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total: { type: integer }
 *                     page: { type: integer }
 *                     limit:
 *                       type: integer
 *                       description: Same as pageSize
 *                     totalPages: { type: integer }
 *       '400':
 *         description: Bad Request - Missing/invalid env.
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
 *   post:
 *     tags: [Features]
 *     summary: Create or update a feature flag (Upsert)
 *     description: Creates or updates the flag for the tenant+feature+environment. Invalidates relevant cache and writes an audit log.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/FeatureFlag'
 *     responses:
 *       '201':
 *         description: Created/Updated. Returns the full feature flag object.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FeatureFlag'
 *       '400':
 *         description: Bad Request - Validation error.
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
 *       '409':
 *         description: Conflict - Unique constraint violation (rare with upsert).
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
 * /features/{id}:
 *   delete:
 *     tags: [Features]
 *     summary: Delete a feature flag by ID
 *     description: Deletes a specific feature flag by its unique instance ID. Invalidates cache and writes an audit log.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: cuid
 *         description: The unique CUID of the FeatureFlag instance.
 *     responses:
 *       '204':
 *         description: No Content - Successfully deleted.
 *       '401':
 *         description: Unauthorized - Invalid or missing JWT.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       '404':
 *         description: Not Found - FeatureFlag not found for this tenant.
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
    const {
        env,
        page = '1',
        limit = '20',
        filter, // Optional: filter by feature name
    } = req.query;

    if (!env || !(Object.values(Environment).includes(env as Environment))) {
        return res
            .status(400)
            .json({
                error: 'Valid "env" query param (dev, staging, prod) is required.',
            });
    }

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const cacheKey = createCacheKey(tenantId, env as string);

    try {
        // 1. Check Cache (Only for the first page, no filter)
        if (pageNum === 1 && !filter) {
            const cachedData = await getFromCache(cacheKey);
            if (cachedData) {
                return res.status(200).json({
                    source: 'cache',
                    ...JSON.parse(cachedData),
                });
            }
        }

        // 2. Build Prisma Query
        const where: Prisma.FeatureFlagWhereInput = {
            tenantId: tenantId,
            env: env as Environment,
            ...(filter && {
                feature: {
                    name: {
                        contains: filter as string,
                        mode: 'insensitive',
                    },
                },
            }),
        };

        const [featureFlags, totalCount] = await prisma.$transaction([
            prisma.featureFlag.findMany({
                where,
                include: {
                    feature: true, // Include feature details
                },
                skip: (pageNum - 1) * limitNum,
                take: limitNum,
            }),
            prisma.featureFlag.count({ where }),
        ]);

        // 3. Evaluate Flags (Case Requirement 1: Evaluation Strategy)
        const evaluatedFlags = featureFlags.map((flag) => {
            let isEnabled = flag.enabled;

            // --- Metrics ---
            flagEvaluationsTotal.inc({
                tenant_id: tenantId,
                feature_name: flag.feature.name,
                strategy: flag.strategy,
            });
            // -------------

            if (isEnabled) {
                switch (flag.strategy) {
                    case 'PERCENTAGE':
                        const percentage =
                            ((flag.strategyValue as Prisma.JsonObject)?.percentage as number) ||
                            0;
                        isEnabled = Math.random() < percentage / 100;
                        break;
                    case 'USER':
                        break;
                    case 'BOOLEAN':
                    default:
                        break;
                }
            }

            return {
                id: flag.id,
                name: flag.feature.name,
                description: flag.feature.description,
                enabled: isEnabled, // The final evaluated value
                env: flag.env,
                strategy: flag.strategy,
            };
        });

        const responsePayload = {
            data: evaluatedFlags,
            pagination: {
                total: totalCount,
                page: pageNum,
                limit: limitNum,
                totalPages: Math.ceil(totalCount / limitNum),
            },
        };

        // 4. Set Cache (Only for the first page, no filter)
        if (pageNum === 1 && !filter) {
            await setInCache(cacheKey, responsePayload);
        }

        return res.status(200).json({
            source: 'database',
            ...responsePayload,
        });
    } catch (error) {
        console.error('POST /features error:', error);
        // Directly check the error code for P2003
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
            // Make sure featureId is accessible here or use a generic message
            // Let's use a generic message for safety
            return res.status(400).json({ error: 'Invalid reference: The specified featureId does not exist.' });
        }
        // Keep the P2002 check if needed (though upsert handles unique constraints)
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            return res.status(409).json({ error: 'Conflict: This feature flag already exists.' });
        }
        return res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/', async (req: Request, res: Response) => {
    const tenantId = req.tenantId as string;
    const { featureId, env, enabled, strategy, strategyValue } =
        req.body as Prisma.FeatureFlagCreateInput & { featureId: string };

    if (!featureId || !env || typeof enabled !== 'boolean' || !strategy) {
        return res
            .status(400)
            .json({
                error: 'Missing required fields: featureId, env, enabled, strategy',
            });
    }

    const environment = env as Environment;

    try {
        const data = {
            tenantId,
            featureId,
            env: environment,
            enabled,
            strategy,
            strategyValue: strategyValue || Prisma.JsonNull,
        };

        // Find existing flag to log "before" state
        const existingFlag = await prisma.featureFlag.findUnique({
            where: {
                tenantId_featureId_env: {
                    tenantId: tenantId,
                    featureId: featureId,
                    env: environment,
                },
            },
        });

        const upsertedFlag = await prisma.featureFlag.upsert({
            where: {
                tenantId_featureId_env: {
                    tenantId: tenantId,
                    featureId: featureId,
                    env: environment,
                },
            },
            update: data,
            create: data,
        });

        // --- Audit Logging ---
        await createAuditLog({
            tenantId,
            actor: tenantId, // Actor is the tenant itself
            action: existingFlag ? 'UPDATE' : 'CREATE',
            entity: 'FeatureFlag',
            entityId: upsertedFlag.id,
            // Pass 'before' and 'after' inside the 'diff' object
            diff: {
                before: existingFlag || null,
                after: upsertedFlag,
            },
        });

        // --- Cache Invalidation ---
        const cacheKey = createCacheKey(tenantId, environment);
        await deleteFromCache(cacheKey);

        return res.status(201).json(upsertedFlag);
    } catch (error) {
        console.error('POST /features error:', error);
        if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2002'
        ) {
            return res
                .status(409)
                .json({ error: 'Conflict: This feature flag already exists.' });
        }
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @swagger
 * /features/{id}:
 * delete:
 * summary: Delete a feature flag
 * description: Deletes a specific feature flag by its ID. Invalidates cache and creates an audit log.
 * tags: [Features]
 * security:
 * - BearerAuth: []
 * parameters:
 * - in: path
 * name: id
 * schema:
 * type: string
 * required: true
 * description: The unique ID of the feature flag.
 * responses:
 * "204":
 * description: Feature flag deleted successfully.
 * "401":
 * description: Unauthorized
 * "404":
 * description: Feature flag not found.
 */
router.delete('/:id', async (req: Request, res: Response) => {
    const tenantId = req.tenantId as string;
    const { id } = req.params; // Get ID from URL param

    try {
        // Find the flag first to get its 'env' for cache invalidation
        const flagToDelete = await prisma.featureFlag.findUnique({
            where: { id: id, tenantId: tenantId }, // Ensure tenant owns this flag
        });

        if (!flagToDelete) {
            return res
                .status(404)
                .json({ error: 'Feature flag not found or you do not have permission.' });
        }

        // --- Audit Logging (Log *before* deleting) ---
        await createAuditLog({
            tenantId,
            actor: tenantId,
            action: 'DELETE',
            entity: 'FeatureFlag',
            entityId: flagToDelete.id,
            // Pass 'before' and 'after' inside the 'diff' object
            diff: {
                before: flagToDelete,
                after: null,
            },
        });

        // Now delete it
        await prisma.featureFlag.delete({
            where: { id: id },
        });

        // --- Cache Invalidation ---
        const cacheKey = createCacheKey(tenantId, flagToDelete.env);
        await deleteFromCache(cacheKey);

        return res.status(204).send(); // 204 No Content - successful deletion
    } catch (error) {
        console.error('DELETE /features/:id error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;