import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';

// Import services
import './services/cache.service'; // Initializes Redis
import {
    registry,
    observeRequests,
} from './services/metrics.service'; // Metrikleri import et

// Import routes
import authRoutes from './api/auth.routes';
import featureRoutes from './api/features.routes';
import auditRoutes from './api/audit.routes';
import promotionRoutes from './api/promotion.routes';

// Import middlewares
import { tenantRateLimiter } from './middleware/rateLimit.middleware';

// Import Swagger setup
import { setupSwagger } from './swagger'; // Swagger kurulumunu import et

// Load .env file
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(observeRequests);

// --- API Routes ---

// Public routes
app.use('/auth', authRoutes);
app.get('/health', (req: Request, res: Response) => {
    res.status(200).json({ status: 'ok', timestamp: new Date() });
});

// Metrics endpoint (public)
app.get('/metrics', async (req: Request, res: Response) => {
    res.set('Content-Type', registry.contentType);
    res.end(await registry.metrics());
});

// --- Secured & Rate Limited Routes ---
app.use('/features', tenantRateLimiter, featureRoutes);
app.use('/audit', tenantRateLimiter, auditRoutes);
app.use('/promote', tenantRateLimiter, promotionRoutes);

// --- API Documentation Route ---
setupSwagger(app); // Call the Swagger setup function

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});