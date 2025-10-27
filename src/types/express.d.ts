// Import the core types
import 'express-serve-static-core';

// Augment the module
declare module 'express-serve-static-core' {
    interface Request {
        tenantId?: string;
    }
}