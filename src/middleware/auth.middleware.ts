import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../services/auth.service';

// Express middleware to authenticate requests using JWT.
export const authenticate = (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res
            .status(401)
            .json({ error: 'Access denied. No token provided.' });
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
        return res
            .status(401)
            .json({ error: 'Access denied. Malformed token.' });
    }

    const payload = verifyToken(token);

    if (!payload) {
        return res.status(401).json({ error: 'Access denied. Invalid token.' });
    }

    // Attach tenantId to the request object for use in controllers
    req.tenantId = payload.tenantId;

    // Pass control to the next handler
    next();
};