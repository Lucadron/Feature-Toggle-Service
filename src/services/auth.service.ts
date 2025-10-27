import { Tenant } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../prisma';

const JWT_SECRET = process.env.JWT_SECRET as string;

if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is not defined in the environment variables');
}

/**
 * Hashes a plain text secret
 * @param secret The plain text secret
 * @returns A hashed secret
 */
export const hashSecret = async (secret: string): Promise<string> => {
    const saltRounds = 10;
    return bcrypt.hash(secret, saltRounds);
};

/**
 * Compares a plain text secret with a hash
 * @param plainSecret The plain text secret
 * @param hash The hashed secret
 * @returns True if secrets match
 */
export const compareSecret = async (
    plainSecret: string,
    hash: string,
): Promise<boolean> => {
    return bcrypt.compare(plainSecret, hash);
};

/**
 * Generates a JWT for a given tenant
 * @param tenant The tenant object
 * @returns A JWT string
 */
export const generateToken = (tenant: Tenant): string => {
    const payload = {
        tenantId: tenant.id,
        name: tenant.name,
        apiKey: tenant.apiKey,
    };

    // Set token to expire in 1 day for this case
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '1d' });
};

/**
 * Verifies a JWT
 * @param token The JWT string
 * @returns The decoded payload or null
 */
export const verifyToken = (token: string): jwt.JwtPayload | null => {
    try {
        return jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
    } catch (error) {
        console.error('Invalid token', error);
        return null;
    }
};