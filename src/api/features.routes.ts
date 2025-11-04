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
 *     tags:
 *       - Features
 *     summary: List feature flags
 *     description: Returns paginated feature flags.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 20
 *       - in: query
 *         name: filter
 *         required: false
 *         schema:
 *           type: string
 *           description: Filter by key or name
 *       - in: query
 *         name: env
 *         required: false
 *         schema:
 *           type: string
 *           enum: [DEV, TEST, STAGE, PROD]
 *     responses:
 *       '200':
 *         description: Paginated feature flags
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
 *                     $ref: '#/components/schemas/FeatureFlag'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       '400':
 *         $ref: '#/components/responses/BadRequest'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 *
 *   post:
 *     tags:
 *       - Features
 *     summary: Create a feature flag
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateFeatureFlagDto'
 *     responses:
 *       '201':
 *         description: Created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FeatureFlag'
 *       '400':
 *         $ref: '#/components/responses/BadRequest'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */


/**
 * @openapi
 * /features/{id}:
 *   parameters:
 *     - in: path
 *       name: id
 *       required: true
 *       schema:
 *         type: string
 *       description: Feature flag identifier (UUID)
 *
 *   get:
 *     tags:
 *       - Features
 *     summary: Get a feature flag
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FeatureFlag'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '404':
 *         $ref: '#/components/responses/NotFound'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 *
 *   put:
 *     tags:
 *       - Features
 *     summary: Update a feature flag
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateFeatureFlagDto'
 *     responses:
 *       '200':
 *         description: Updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FeatureFlag'
 *       '400':
 *         $ref: '#/components/responses/BadRequest'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '404':
 *         $ref: '#/components/responses/NotFound'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 *
 *   delete:
 *     tags:
 *       - Features
 *     summary: Delete a feature flag
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '204':
 *         description: Deleted
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '404':
 *         $ref: '#/components/responses/NotFound'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */


/**
 * @openapi
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *
 *   schemas:
 *     FeatureFlag:
 *       type: object
 *       required: [id, key, enabled, environment]
 *       properties:
 *         id: { type: string, format: uuid }
 *         key: { type: string }
 *         name: { type: string }
 *         description: { type: string, nullable: true }
 *         enabled: { type: boolean }
 *         environment: { type: string, enum: [DEV, TEST, STAGE, PROD] }
 *         variants:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               weight: { type: number }
 *     Pagination:
 *       type: object
 *       properties:
 *         page: { type: integer, minimum: 1 }
 *         limit: { type: integer, minimum: 1 }
 *         total: { type: integer, minimum: 0 }
 *
 *     CreateFeatureFlagDto:
 *       type: object
 *       required: [key, name, environment]
 *       properties:
 *         key: { type: string }
 *         name: { type: string }
 *         description: { type: string, nullable: true }
 *         environment: { type: string, enum: [DEV, TEST, STAGE, PROD] }
 *         enabled: { type: boolean, default: false }
 *
 *     UpdateFeatureFlagDto:
 *       type: object
 *       properties:
 *         name: { type: string }
 *         description: { type: string, nullable: true }
 *         enabled: { type: boolean }
 *         variants:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               weight: { type: number }
 *
 *   responses:
 *     BadRequest:
 *       description: Bad request
 *     Unauthorized:
 *       description: Unauthorized
 *     NotFound:
 *       description: Not found
 *     ServerError:
 *       description: Internal server error
 */



router.get('/', async (req: Request, res: Response) => {
    const tenantId = req.tenantId as string;
    const {
        env,
        page = '1',
        limit = '20',
        filter,
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
                featureId: flag.featureId,
                name: flag.feature.name,
                description: flag.feature.description,
                enabled: isEnabled,
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