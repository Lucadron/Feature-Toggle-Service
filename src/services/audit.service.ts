import { Prisma } from '@prisma/client';
import prisma from '../prisma';

type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE';
type AuditEntity = 'FeatureFlag';

interface AuditLogOptions {
    tenantId: string;
    actor: string;
    action: AuditAction;
    entity: AuditEntity;
    entityId: string;
    before?: any;
    after?: any;
}

/**
 * Creates an audit log entry in the database.
 */
export const createAuditLog = async (options: AuditLogOptions) => {
    const { tenantId, actor, action, entity, entityId, before, after } = options;

    try {
        await prisma.auditLog.create({
            data: {
                tenantId,
                actor,
                action,
                entity,
                entityId,
                diff: {
                    before: before || null,
                    after: after || null
                },
            },
        });
    } catch (error) {
        console.error('Failed to create audit log:', error);
    }
};