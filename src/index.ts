import express, { Request, Response } from 'express';
import dotenv from 'dotenv';

// Import services
import './services/cache.service'; // Initializes Redis

// Import routes
import authRoutes from './api/auth.routes';
import featureRoutes from './api/features.routes';
import auditRoutes from './api/audit.routes';

// Import middlewares
import { tenantRateLimiter } from './middleware/rateLimit.middleware';

// Load .env file
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(express.json());

// --- API Routes ---

// Public route (no rate limit, no auth)
app.use('/auth', authRoutes);

// Health check (no rate limit, no auth)
app.get('/health', (req: Request, res: Response) => {
    res.status(200).json({ status: 'ok', timestamp: new Date() });
});

// --- Secured & Rate Limited Routes ---
// All routes below this line are protected by auth and rate limiting
app.use('/features', tenantRateLimiter, featureRoutes);
app.use('/audit', tenantRateLimiter, auditRoutes);

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});