import { PrismaClient } from '@prisma/client';
import { hashSecret } from '../src/services/auth.service';

const prisma = new PrismaClient();

async function main() {
    console.log('Start seeding ...');

    const plainTextSecret = 'zebra_secret_123';
    const hashedSecret = await hashSecret(plainTextSecret);

    // 1. Create the 'Zebra' Tenant
    // We use upsert to avoid creating duplicates on re-runs
    const zebraTenant = await prisma.tenant.upsert({
        where: { name: 'Zebra' },
        update: {},
        create: {
            name: 'Zebra',
            apiKey: 'zebra_api_key', // This is public
            apiSecret: hashedSecret,  // This is the hashed secret
        },
    });

    // 2. Create the 'Acme' Tenant (for testing multi-tenancy)
    const acmeTenant = await prisma.tenant.upsert({
        where: { name: 'Acme' },
        update: {},
        create: {
            name: 'Acme',
            apiKey: 'acme_api_key',
            apiSecret: await hashSecret('acme_secret_456'),
        },
    });

    // 3. Create common features
    const feature1 = await prisma.feature.upsert({
        where: { name: 'new-dashboard' },
        update: {},
        create: {
            name: 'new-dashboard',
            description: 'The new and improved analytics dashboard.',
        },
    });

    const feature2 = await prisma.feature.upsert({
        where: { name: 'beta-checkout' },
        update: {},
        create: {
            name: 'beta-checkout',
            description: '2-step checkout process (beta).',
        },
    });

    // 4. Enable 'new-dashboard' for Zebra in prod
    await prisma.featureFlag.upsert({
        where: {
            tenantId_featureId_env: {
                tenantId: zebraTenant.id,
                featureId: feature1.id,
                env: 'prod',
            },
        },
        update: {},
        create: {
            tenantId: zebraTenant.id,
            featureId: feature1.id,
            env: 'prod',
            enabled: true,
            strategy: 'BOOLEAN',
        },
    });

    // 5. Enable 'beta-checkout' for Zebra in staging (percentage rollout)
    await prisma.featureFlag.upsert({
        where: {
            tenantId_featureId_env: {
                tenantId: zebraTenant.id,
                featureId: feature2.id,
                env: 'staging',
            },
        },
        update: {},
        create: {
            tenantId: zebraTenant.id,
            featureId: feature2.id,
            env: 'staging',
            enabled: true,
            strategy: 'PERCENTAGE',
            strategyValue: { percentage: 50 }, // Prisma handles JSON
        },
    });

    // 6. Enable 'new-dashboard' for Acme in prod
    await prisma.featureFlag.upsert({
        where: {
            tenantId_featureId_env: {
                tenantId: acmeTenant.id,
                featureId: feature1.id,
                env: 'prod',
            },
        },
        update: {},
        create: {
            tenantId: acmeTenant.id,
            featureId: feature1.id,
            env: 'prod',
            enabled: false, // Disabled for Acme
            strategy: 'BOOLEAN',
        },
    });

    console.log('Seeding finished.');
    console.log('--- Created Tenants ---');
    console.log(`Zebra Tenant: apiKey='zebra_api_key', apiSecret='zebra_secret_123'`);
    console.log(`Acme Tenant:  apiKey='acme_api_key',  apiSecret='acme_secret_456'`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });