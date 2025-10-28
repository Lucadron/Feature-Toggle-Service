import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';

const options: swaggerJSDoc.Options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Zebra Feature Toggle Service API',
            version: '1.0.0',
            description:
                'API documentation for the Zebra Engineering Assignment.',
        },
        servers: [
            {
                url: 'http://localhost:3000',
                description: 'Development server',
            },
        ],
        // Define reusable components (schemas, security)
        components: {
            // Define schemas for request/response bodies
            schemas: {
                Tenant: {
                    type: 'object',
                    properties: {
                        id: { type: 'string' },
                        name: { type: 'string' },
                        apiKey: { type: 'string' },
                    },
                },
                Feature: {
                    type: 'object',
                    properties: {
                        id: { type: 'string' },
                        name: { type: 'string' },
                        description: { type: 'string' },
                    },
                },
                FeatureFlag: {
                    type: 'object',
                    properties: {
                        id: { type: 'string' },
                        tenantId: { type: 'string' },
                        featureId: { type: 'string' },
                        env: { type: 'string', enum: ['dev', 'staging', 'prod'] },
                        enabled: { type: 'boolean' },
                        strategy: {
                            type: 'string',
                            enum: ['BOOLEAN', 'PERCENTAGE', 'USER'],
                        },
                        strategyValue: { type: 'object', nullable: true },
                    },
                    required: ['featureId', 'env', 'enabled', 'strategy']
                },
                AuditLog: {
                    type: 'object',
                    properties: {
                        id: { type: 'string' },
                        tenantId: { type: 'string' },
                        actor: { type: 'string' },
                        action: { type: 'string' },
                        entity: { type: 'string' },
                        entityId: { type: 'string' },
                        diff: { type: 'object', nullable: true },
                        createdAt: { type: 'string', format: 'date-time' },
                    },
                },
                Error: {
                    type: 'object',
                    properties: {
                        error: { type: 'string' },
                    },
                },
            },
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                },
            },
        },
    },
    apis: ['./src/api/*.routes.ts'], // Target TS files in the api directory
};

const swaggerSpec = swaggerJSDoc(options);

export function setupSwagger(app: Express) {
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}