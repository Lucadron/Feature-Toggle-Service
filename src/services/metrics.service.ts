import { Request, Response, NextFunction } from 'express';
import { Registry, Counter } from 'prom-client';

// Create a central registry
export const registry = new Registry();

// --- HTTP Request Metric ---
// Counts total HTTP requests
export const httpRequestsTotal = new Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code'],
});
registry.registerMetric(httpRequestsTotal);

// --- Flag Evaluation Metric ---
// Counts feature flag evaluations (Case Requirement 7)
export const flagEvaluationsTotal = new Counter({
    name: 'flag_evaluations_total',
    help: 'Total number of feature flag evaluations',
    labelNames: ['tenant_id', 'feature_name', 'strategy'],
});
registry.registerMetric(flagEvaluationsTotal);

/**
 * Middleware to observe HTTP requests
 */
export const observeRequests = (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    res.on('finish', () => {
        // Exclude /metrics from being logged
        if (req.path !== '/metrics') {
            httpRequestsTotal.inc({
                method: req.method,
                route: req.path,
                status_code: res.statusCode,
            });
        }
    });
    next();
};