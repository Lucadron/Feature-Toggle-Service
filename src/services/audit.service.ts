import { Prisma } from '@prisma/client';
import prisma from '../prisma';

type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'PROMOTE';
type AuditEntity = 'FeatureFlag' | 'Environment';

interface AuditLogOptions {
    tenantId: string;
    actor: string;
    action: AuditAction;
    entity: AuditEntity;
    entityId: string;
    diff?: any; // Changed from 'before' and 'after' to 'diff'
}

/**
 * Creates an audit log entry in the database.
 */
export const createAuditLog = async (options: AuditLogOptions) => {
    // Use 'diff' directly from options
    const { tenantId, actor, action, entity, entityId, diff } = options;

    try {
        await prisma.auditLog.create({
            data: {
                tenantId,
                actor,
                action,
                entity,
                entityId,
                diff: diff || null, // Pass the diff object directly
            },
        });
    } catch (error) {
        console.error('Failed to create audit log:', error);
        // We don't block the main request if logging fails
    }
};