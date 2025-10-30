import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { Database } from '../db/database';

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_here';
const JWT_EXPIRES_IN = '15m'; // Access token expires in 15 minutes
const REFRESH_TOKEN_EXPIRES_IN = '7d'; // Refresh token expires in 7 days
const SALT_ROUNDS = 10;

export interface TokenPayload {
  userId: string;
  email: string;
  orgIds?: string[];
  type: 'access' | 'refresh';
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export class AuthService {
  /**
   * Hash a password using bcrypt
   */
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
  }

  /**
   * Verify a password against a hash
   */
  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Generate JWT access token
   */
  static generateAccessToken(payload: Omit<TokenPayload, 'type'>): string {
    return jwt.sign(
      { ...payload, type: 'access' },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
  }

  /**
   * Generate JWT refresh token
   */
  static generateRefreshToken(payload: Omit<TokenPayload, 'type'>): string {
    return jwt.sign(
      { ...payload, type: 'refresh' },
      JWT_SECRET,
      { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
    );
  }

  /**
   * Verify and decode JWT token
   */
  static verifyToken(token: string): TokenPayload {
    try {
      return jwt.verify(token, JWT_SECRET) as TokenPayload;
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  /**
   * Generate both access and refresh tokens
   */
  static async generateTokens(
    userId: string,
    email: string,
    userAgent?: string,
    ipAddress?: string
  ): Promise<AuthTokens> {
    // Get user's organizations
    const orgResult = await Database.query(
      `SELECT org_id FROM user_organizations WHERE user_id = $1 AND is_active = true`,
      [userId]
    );

    const orgIds = orgResult.rows.map((row) => row.org_id);

    const accessToken = this.generateAccessToken({ userId, email, orgIds });
    const refreshToken = this.generateRefreshToken({ userId, email, orgIds });

    // Store refresh token in database
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await Database.query(
      `INSERT INTO refresh_tokens (user_id, token, expires_at, user_agent, ip_address)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, refreshToken, expiresAt, userAgent, ipAddress]
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: 900, // 15 minutes in seconds
    };
  }

  /**
   * Refresh access token using refresh token
   */
  static async refreshAccessToken(refreshToken: string): Promise<AuthTokens> {
    // Verify refresh token
    const payload = this.verifyToken(refreshToken);

    if (payload.type !== 'refresh') {
      throw new Error('Invalid token type');
    }

    // Check if refresh token exists and is not revoked
    const tokenResult = await Database.query(
      `SELECT user_id, revoked_at, expires_at FROM refresh_tokens
       WHERE token = $1`,
      [refreshToken]
    );

    if (tokenResult.rows.length === 0) {
      throw new Error('Refresh token not found');
    }

    const tokenData = tokenResult.rows[0];

    if (tokenData.revoked_at) {
      throw new Error('Refresh token has been revoked');
    }

    if (new Date(tokenData.expires_at) < new Date()) {
      throw new Error('Refresh token has expired');
    }

    // Get user data
    const userResult = await Database.query(
      `SELECT id, email FROM users WHERE id = $1 AND is_active = true`,
      [tokenData.user_id]
    );

    if (userResult.rows.length === 0) {
      throw new Error('User not found or inactive');
    }

    const user = userResult.rows[0];

    // Generate new tokens
    return this.generateTokens(user.id, user.email);
  }

  /**
   * Revoke a refresh token
   */
  static async revokeRefreshToken(token: string): Promise<void> {
    await Database.query(
      `UPDATE refresh_tokens SET revoked_at = NOW() WHERE token = $1`,
      [token]
    );
  }

  /**
   * Revoke all refresh tokens for a user
   */
  static async revokeAllUserTokens(userId: string): Promise<void> {
    await Database.query(
      `UPDATE refresh_tokens SET revoked_at = NOW()
       WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId]
    );
  }

  /**
   * Generate password reset token
   */
  static async generatePasswordResetToken(email: string): Promise<string> {
    // Get user by email
    const userResult = await Database.query(
      `SELECT id FROM users WHERE email = $1 AND is_active = true`,
      [email]
    );

    if (userResult.rows.length === 0) {
      // Don't reveal if email exists or not
      throw new Error('If the email exists, a reset link has been sent');
    }

    const userId = userResult.rows[0].id;

    // Generate secure random token
    const token = crypto.randomBytes(32).toString('hex');

    // Expires in 1 hour
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    // Store token
    await Database.query(
      `INSERT INTO password_reset_tokens (user_id, token, expires_at)
       VALUES ($1, $2, $3)`,
      [userId, token, expiresAt]
    );

    return token;
  }

  /**
   * Reset password using token
   */
  static async resetPassword(token: string, newPassword: string): Promise<void> {
    // Get token data
    const tokenResult = await Database.query(
      `SELECT user_id, used_at, expires_at FROM password_reset_tokens
       WHERE token = $1`,
      [token]
    );

    if (tokenResult.rows.length === 0) {
      throw new Error('Invalid reset token');
    }

    const tokenData = tokenResult.rows[0];

    if (tokenData.used_at) {
      throw new Error('Reset token has already been used');
    }

    if (new Date(tokenData.expires_at) < new Date()) {
      throw new Error('Reset token has expired');
    }

    // Hash new password
    const passwordHash = await this.hashPassword(newPassword);

    // Update password
    await Database.query(
      `UPDATE users SET password_hash = $1, updated_at = NOW()
       WHERE id = $2`,
      [passwordHash, tokenData.user_id]
    );

    // Mark token as used
    await Database.query(
      `UPDATE password_reset_tokens SET used_at = NOW()
       WHERE token = $1`,
      [token]
    );

    // Revoke all refresh tokens for security
    await this.revokeAllUserTokens(tokenData.user_id);
  }

  /**
   * Generate email verification token
   */
  static async generateEmailVerificationToken(userId: string): Promise<string> {
    const token = crypto.randomBytes(32).toString('hex');

    // Expires in 24 hours
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    await Database.query(
      `INSERT INTO email_verification_tokens (user_id, token, expires_at)
       VALUES ($1, $2, $3)`,
      [userId, token, expiresAt]
    );

    return token;
  }

  /**
   * Verify email using token
   */
  static async verifyEmail(token: string): Promise<void> {
    const tokenResult = await Database.query(
      `SELECT user_id, verified_at, expires_at FROM email_verification_tokens
       WHERE token = $1`,
      [token]
    );

    if (tokenResult.rows.length === 0) {
      throw new Error('Invalid verification token');
    }

    const tokenData = tokenResult.rows[0];

    if (tokenData.verified_at) {
      throw new Error('Email already verified');
    }

    if (new Date(tokenData.expires_at) < new Date()) {
      throw new Error('Verification token has expired');
    }

    // Mark user as verified
    await Database.query(
      `UPDATE users SET email_verified = true, updated_at = NOW()
       WHERE id = $1`,
      [tokenData.user_id]
    );

    // Mark token as used
    await Database.query(
      `UPDATE email_verification_tokens SET verified_at = NOW()
       WHERE token = $1`,
      [token]
    );
  }

  /**
   * Log user action for audit trail
   */
  static async logAction(params: {
    userId: string;
    orgId?: string;
    action: string;
    resourceType?: string;
    resourceId?: string;
    details?: any;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    await Database.query(
      `INSERT INTO user_audit_log
       (user_id, org_id, action, resource_type, resource_id, details, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        params.userId,
        params.orgId || null,
        params.action,
        params.resourceType || null,
        params.resourceId || null,
        JSON.stringify(params.details || {}),
        params.ipAddress || null,
        params.userAgent || null,
      ]
    );
  }
}
