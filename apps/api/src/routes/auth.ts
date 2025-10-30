import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { Database } from '../db/database';
import { AuthService } from '../services/AuthService';
import { authenticateUser, UserAuthRequest } from '../middleware/userAuth';

const router = Router();

// Validation schemas
const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100),
  first_name: z.string().min(1).max(100).optional(),
  last_name: z.string().min(1).max(100).optional(),
  org_name: z.string().min(1).max(255).optional(),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const RefreshTokenSchema = z.object({
  refresh_token: z.string(),
});

const PasswordResetRequestSchema = z.object({
  email: z.string().email(),
});

const PasswordResetSchema = z.object({
  token: z.string(),
  password: z.string().min(8).max(100),
});

const EmailVerificationSchema = z.object({
  token: z.string(),
});

// POST /api/v1/auth/register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const validated = RegisterSchema.parse(req.body);

    // Check if user already exists
    const existingUser = await Database.query(
      'SELECT id FROM users WHERE email = $1',
      [validated.email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const passwordHash = await AuthService.hashPassword(validated.password);

    // Create user
    const userResult = await Database.query(
      `INSERT INTO users (email, password_hash, first_name, last_name)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, first_name, last_name, email_verified, created_at`,
      [validated.email, passwordHash, validated.first_name || null, validated.last_name || null]
    );

    const user = userResult.rows[0];

    // Create organization if org_name provided
    let orgId: string | null = null;
    if (validated.org_name) {
      // Generate API key
      const apiKey = `vapi_${Buffer.from(require('crypto').randomBytes(32)).toString('base64url')}`;

      const orgResult = await Database.query(
        `INSERT INTO organizations (name, api_key)
         VALUES ($1, $2)
         RETURNING id, name`,
        [validated.org_name, apiKey]
      );

      orgId = orgResult.rows[0].id;

      // Get owner role
      const roleResult = await Database.query(
        `SELECT id FROM roles WHERE name = 'owner' LIMIT 1`
      );

      const roleId = roleResult.rows.length > 0 ? roleResult.rows[0].id : null;

      // Link user to organization as owner
      await Database.query(
        `INSERT INTO user_organizations (user_id, org_id, role_id)
         VALUES ($1, $2, $3)`,
        [user.id, orgId, roleId]
      );
    }

    // Generate email verification token
    const verificationToken = await AuthService.generateEmailVerificationToken(user.id);

    // TODO: Send verification email
    console.log('Verification token:', verificationToken);
    console.log('Verification URL:', `${process.env.BASE_URL}/verify-email?token=${verificationToken}`);

    // Generate auth tokens
    const tokens = await AuthService.generateTokens(
      user.id,
      user.email,
      req.headers['user-agent'],
      req.ip
    );

    // Log action
    await AuthService.logAction({
      userId: user.id,
      action: 'user_registered',
      details: { email: user.email },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        email_verified: user.email_verified,
        created_at: user.created_at,
      },
      organization: orgId ? { id: orgId } : null,
      tokens,
      message: 'Registration successful. Please check your email to verify your account.',
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/v1/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const validated = LoginSchema.parse(req.body);

    // Get user by email
    const userResult = await Database.query(
      `SELECT id, email, password_hash, first_name, last_name, email_verified, is_active, is_superuser
       FROM users WHERE email = $1`,
      [validated.email]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = userResult.rows[0];

    // Check if user is active
    if (!user.is_active) {
      return res.status(401).json({ error: 'Account is inactive' });
    }

    // Verify password
    const passwordValid = await AuthService.verifyPassword(
      validated.password,
      user.password_hash
    );

    if (!passwordValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Update last login
    await Database.query(
      'UPDATE users SET last_login_at = NOW() WHERE id = $1',
      [user.id]
    );

    // Generate tokens
    const tokens = await AuthService.generateTokens(
      user.id,
      user.email,
      req.headers['user-agent'],
      req.ip
    );

    // Get user's organizations
    const orgsResult = await Database.query(
      `SELECT uo.org_id, o.name, r.name as role
       FROM user_organizations uo
       JOIN organizations o ON uo.org_id = o.id
       LEFT JOIN roles r ON uo.role_id = r.id
       WHERE uo.user_id = $1 AND uo.is_active = true`,
      [user.id]
    );

    // Log action
    await AuthService.logAction({
      userId: user.id,
      action: 'user_login',
      details: { email: user.email },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        email_verified: user.email_verified,
        is_superuser: user.is_superuser,
      },
      organizations: orgsResult.rows,
      tokens,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/v1/auth/refresh
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const validated = RefreshTokenSchema.parse(req.body);

    const tokens = await AuthService.refreshAccessToken(validated.refresh_token);

    res.json({ tokens });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Token refresh error:', error);
    res.status(401).json({ error: error.message || 'Token refresh failed' });
  }
});

// POST /api/v1/auth/logout
router.post('/logout', authenticateUser, async (req: UserAuthRequest, res: Response) => {
  try {
    const refreshToken = req.body.refresh_token;

    if (refreshToken) {
      await AuthService.revokeRefreshToken(refreshToken);
    }

    // Log action
    if (req.user) {
      await AuthService.logAction({
        userId: req.user.id,
        action: 'user_logout',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });
    }

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// POST /api/v1/auth/password-reset-request
router.post('/password-reset-request', async (req: Request, res: Response) => {
  try {
    const validated = PasswordResetRequestSchema.parse(req.body);

    const token = await AuthService.generatePasswordResetToken(validated.email);

    // TODO: Send password reset email
    console.log('Password reset token:', token);
    console.log('Reset URL:', `${process.env.BASE_URL}/reset-password?token=${token}`);

    // Always return success to avoid email enumeration
    res.json({
      message: 'If the email exists, a password reset link has been sent',
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    // Don't expose errors to avoid email enumeration
    res.json({
      message: 'If the email exists, a password reset link has been sent',
    });
  }
});

// POST /api/v1/auth/password-reset
router.post('/password-reset', async (req: Request, res: Response) => {
  try {
    const validated = PasswordResetSchema.parse(req.body);

    await AuthService.resetPassword(validated.token, validated.password);

    res.json({ message: 'Password reset successful' });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Password reset error:', error);
    res.status(400).json({ error: error.message || 'Password reset failed' });
  }
});

// POST /api/v1/auth/verify-email
router.post('/verify-email', async (req: Request, res: Response) => {
  try {
    const validated = EmailVerificationSchema.parse(req.body);

    await AuthService.verifyEmail(validated.token);

    res.json({ message: 'Email verified successfully' });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Email verification error:', error);
    res.status(400).json({ error: error.message || 'Email verification failed' });
  }
});

// GET /api/v1/auth/me
router.get('/me', authenticateUser, async (req: UserAuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Get full user details
    const userResult = await Database.query(
      `SELECT id, email, first_name, last_name, email_verified, is_active, is_superuser, created_at, last_login_at
       FROM users WHERE id = $1`,
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get user's organizations
    const orgsResult = await Database.query(
      `SELECT uo.org_id, o.name, o.api_key, r.name as role, uo.permissions
       FROM user_organizations uo
       JOIN organizations o ON uo.org_id = o.id
       LEFT JOIN roles r ON uo.role_id = r.id
       WHERE uo.user_id = $1 AND uo.is_active = true`,
      [req.user.id]
    );

    res.json({
      user: userResult.rows[0],
      organizations: orgsResult.rows,
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user details' });
  }
});

export default router;
