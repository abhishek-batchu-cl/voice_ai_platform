import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/AuthService';
import { Database } from '../db/database';

export interface UserAuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    orgIds: string[];
    is_superuser: boolean;
  };
  currentOrg?: {
    id: string;
    name: string;
    role: string;
    permissions: string[];
    tier?: 'free' | 'pro' | 'enterprise' | 'custom';
    rate_limit_per_minute?: number;
    rate_limit_per_day?: number;
    concurrent_sessions?: number;
  };
}

/**
 * Middleware to authenticate user via JWT token
 */
export async function authenticateUser(
  req: UserAuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const payload = AuthService.verifyToken(token);

    if (payload.type !== 'access') {
      return res.status(401).json({ error: 'Invalid token type' });
    }

    // Get user from database
    const userResult = await Database.query(
      `SELECT id, email, is_active, is_superuser FROM users WHERE id = $1`,
      [payload.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    if (!user.is_active) {
      return res.status(401).json({ error: 'User account is inactive' });
    }

    // Attach user to request
    req.user = {
      id: user.id,
      email: user.email,
      orgIds: payload.orgIds || [],
      is_superuser: user.is_superuser,
    };

    next();
  } catch (error: any) {
    if (error.message === 'Invalid or expired token') {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    console.error('Authentication error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
}

/**
 * Middleware to set current organization context
 * Should be used after authenticateUser
 */
export async function setOrganizationContext(
  req: UserAuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Get org_id from query, body, or params
    const orgId =
      req.query.org_id ||
      req.body.org_id ||
      req.params.org_id ||
      req.headers['x-organization-id'];

    if (!orgId) {
      return res.status(400).json({ error: 'Organization ID required' });
    }

    // Verify user has access to this organization
    const orgResult = await Database.query(
      `SELECT uo.org_id, o.name, o.tier, o.rate_limit_per_minute, o.rate_limit_per_day, o.concurrent_sessions,
              r.name as role_name, r.permissions, uo.permissions as user_permissions
       FROM user_organizations uo
       JOIN organizations o ON uo.org_id = o.id
       LEFT JOIN roles r ON uo.role_id = r.id
       WHERE uo.user_id = $1 AND uo.org_id = $2 AND uo.is_active = true`,
      [req.user.id, orgId]
    );

    if (orgResult.rows.length === 0) {
      return res.status(403).json({ error: 'Access to organization denied' });
    }

    const org = orgResult.rows[0];

    // Merge role permissions with user-specific permissions
    const rolePermissions = org.permissions || [];
    const userPermissions = org.user_permissions || [];
    const allPermissions = [...new Set([...rolePermissions, ...userPermissions])];

    req.currentOrg = {
      id: org.org_id,
      name: org.name,
      role: org.role_name || 'custom',
      permissions: allPermissions,
      tier: org.tier,
      rate_limit_per_minute: org.rate_limit_per_minute,
      rate_limit_per_day: org.rate_limit_per_day,
      concurrent_sessions: org.concurrent_sessions,
    };

    next();
  } catch (error) {
    console.error('Organization context error:', error);
    res.status(500).json({ error: 'Failed to set organization context' });
  }
}

/**
 * Middleware to check if user has required permission
 */
export function requirePermission(...requiredPermissions: string[]) {
  return (req: UserAuthRequest, res: Response, next: NextFunction) => {
    if (!req.currentOrg) {
      return res.status(403).json({ error: 'No organization context' });
    }

    // Superusers have all permissions
    if (req.user?.is_superuser) {
      return next();
    }

    // Check if user has wildcard permission
    if (req.currentOrg.permissions.includes('*')) {
      return next();
    }

    // Check if user has all required permissions
    const hasPermission = requiredPermissions.every((permission) =>
      req.currentOrg!.permissions.includes(permission)
    );

    if (!hasPermission) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        required: requiredPermissions,
        current: req.currentOrg.permissions,
      });
    }

    next();
  };
}

/**
 * Middleware to require email verification
 */
export async function requireEmailVerification(
  req: UserAuthRequest,
  res: Response,
  next: NextFunction
) {
  if (!req.user) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  const userResult = await Database.query(
    `SELECT email_verified FROM users WHERE id = $1`,
    [req.user.id]
  );

  if (userResult.rows.length === 0 || !userResult.rows[0].email_verified) {
    return res.status(403).json({
      error: 'Email verification required',
      message: 'Please verify your email address to continue',
    });
  }

  next();
}
