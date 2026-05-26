/**
 * Auth tRPC Router
 * Handles authentication: login, register, email verification, password reset, account management
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "../_core/cookies";

export const authRouter = router({
  me: publicProcedure
    .query(async ({ ctx }) => {
      console.log('[Auth.me] Checking current user...');
      console.log('[Auth.me] ctx.user exists:', !!ctx.user);
      if (ctx.user) {
        console.log('[Auth.me] User found:', {
          id: ctx.user.id,
          email: ctx.user.email,
          role: ctx.user.role,
        });
      } else {
        console.log('[Auth.me] No user in context');
      }
      return ctx.user || null;
    }),
  
  register: publicProcedure
    .input(z.object({
      email: z.string().trim().toLowerCase().email(),
      password: z.string().min(8),
      name: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { registerUser } = await import('../auth');
      const result = await registerUser(input.email, input.password, input.name);
      
      if (!result.success) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: result.error || '註冊失敗',
        });
      }
      
      // Do NOT set session cookie — user must verify email first
      // (Google OAuth users are auto-verified and don't go through this path)
      
      return {
        success: true,
        user: result.user,
        requiresEmailVerification: result.requiresEmailVerification ?? false,
      };
    }),
  
  login: publicProcedure
    .input(z.object({
      email: z.string().trim().toLowerCase().email(),
      password: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      console.log('[Login API] Starting login process for:', input.email);
      console.log('[Login API] ctx.req exists:', !!ctx.req);
      console.log('[Login API] ctx.res exists:', !!ctx.res);
      
      const { loginUser } = await import('../auth');
      const result = await loginUser(input.email, input.password);
      
      console.log('[Login API] Login result:', {
        success: result.success,
        hasToken: !!result.token,
        hasUser: !!result.user,
        userId: result.user?.id,
      });
      
      if (!result.success) {
        console.log('[Login API] Login failed:', result.error);
        // Special case: email not verified — return structured error
        if (result.requiresEmailVerification) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'EMAIL_NOT_VERIFIED',
          });
        }
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: result.error || '登入失敗',
        });
      }
      
      // Set session cookie
      if (result.token && ctx.res && ctx.req) {
        console.log('[Login API] Setting session cookie...');
        const cookieOptions = getSessionCookieOptions(ctx.req);
        console.log('[Login API] Cookie options:', cookieOptions);
        ctx.res.cookie('session', result.token, cookieOptions);
        console.log('[Login API] Session cookie set successfully');
      } else {
        console.warn('[Login API] Cannot set cookie - missing token, req, or res:', {
          hasToken: !!result.token,
          hasReq: !!ctx.req,
          hasRes: !!ctx.res,
        });
      }
      
      return {
        success: true,
        user: result.user,
        token: result.token,
      };
    }),
  
  updateProfile: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(100).optional(),
      phone: z.string().max(30).optional().nullable(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { getDb } = await import('../db');
      const drizzleDb = await getDb();
      if (!drizzleDb) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '資料庫連線失敗' });
      const updateData: Record<string, any> = {};
      if (input.name !== undefined) updateData.name = input.name;
      if (input.phone !== undefined) updateData.phone = input.phone;
      if (Object.keys(updateData).length === 0) throw new TRPCError({ code: 'BAD_REQUEST', message: '沒有需要更新的資料' });
      const { users: usersTable } = await import('../../drizzle/schema_new');
      const { eq: eqOp } = await import('drizzle-orm');
      await drizzleDb.update(usersTable).set(updateData).where(eqOp(usersTable.id, ctx.user.id));
      const rows = await drizzleDb.select().from(usersTable).where(eqOp(usersTable.id, ctx.user.id)).limit(1);
      return rows[0] || null;
    }),
  changePassword: protectedProcedure
    .input(z.object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(8, '密碼至少需要 8 個字元'),
    }))
    .mutation(async ({ input, ctx }) => {
      const bcrypt = await import('bcrypt');
      const { getDb } = await import('../db');
      const drizzleDb = await getDb();
      if (!drizzleDb) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '資料庫連線失敗' });
      const { users: usersTable } = await import('../../drizzle/schema_new');
      const { eq: eqOp } = await import('drizzle-orm');
      const userRows = await drizzleDb.select().from(usersTable).where(eqOp(usersTable.id, ctx.user.id)).limit(1);
      const user = userRows[0];
      if (!user) throw new TRPCError({ code: 'NOT_FOUND', message: '用戶不存在' });
      if (!user.passwordHash) throw new TRPCError({ code: 'BAD_REQUEST', message: '您的帳號使用第三方登入，無法修改密碼' });
      const isValid = await bcrypt.compare(input.currentPassword, user.passwordHash);
      if (!isValid) throw new TRPCError({ code: 'UNAUTHORIZED', message: '現有密碼不正確' });
      const newHash = await bcrypt.hash(input.newPassword, 12);
      await drizzleDb.update(usersTable).set({ passwordHash: newHash }).where(eqOp(usersTable.id, ctx.user.id));
      return { success: true };
    }),
  verifyEmail: publicProcedure
    .input(z.object({
      token: z.string().min(1),
    }))
    .mutation(async ({ input, ctx }) => {
      const { getDb } = await import('../db');
      const { users: usersTable } = await import('../../drizzle/schema_new');
      const { eq, and, gt } = await import('drizzle-orm');
      const drizzleDb = await getDb();
      if (!drizzleDb) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '資料庫連線失敗' });

      // Find user with matching token that hasn't expired
      const now = new Date();
      const userResults = await drizzleDb
        .select()
        .from(usersTable)
        .where(
          and(
            eq(usersTable.emailVerificationToken, input.token),
            gt(usersTable.emailVerificationExpiry, now)
          )
        )
        .limit(1);

      if (userResults.length === 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: '驗證連結無效或已過期，請重新發送驗證電郵',
        });
      }

      const user = userResults[0];

      // Mark email as verified and clear the token
      await drizzleDb
        .update(usersTable)
        .set({
          emailVerified: true,
          emailVerificationToken: null,
          emailVerificationExpiry: null,
          lastSignedIn: new Date(),
        })
        .where(eq(usersTable.id, user.id));

      // Fetch updated user
      const updatedUsers = await drizzleDb.select().from(usersTable).where(eq(usersTable.id, user.id)).limit(1);
      const updatedUser = updatedUsers[0];

      // Generate session token and set cookie (auto-login after verification)
      const { generateToken } = await import('../auth');
      const token = generateToken(updatedUser);
      if (ctx.res && ctx.req) {
        ctx.res.cookie('session', token, getSessionCookieOptions(ctx.req));
      }

      // Send welcome email now that user is verified
      if (updatedUser.email) {
        import('../emailService').then(({ sendWelcomeEmail }) => {
          sendWelcomeEmail({
            userId: updatedUser.id,
            userName: updatedUser.name || updatedUser.email!.split('@')[0],
            email: updatedUser.email!,
            siteUrl: 'https://boxium.asia',
          }).catch((err: Error) => console.error('[Auth] Failed to send welcome email after verification:', err));
        });
      }

      return { success: true, user: updatedUser };
    }),

  resendVerificationEmail: publicProcedure
    .input(z.object({
      email: z.string().trim().toLowerCase().email(),
    }))
    .mutation(async ({ input }) => {
      const { getDb } = await import('../db');
      const { users: usersTable } = await import('../../drizzle/schema_new');
      const { eq } = await import('drizzle-orm');
      const drizzleDb = await getDb();
      if (!drizzleDb) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '資料庫連線失敗' });

      const userResults = await drizzleDb.select().from(usersTable).where(eq(usersTable.email, input.email)).limit(1);
      const user = userResults[0];

      // Always return success to prevent email enumeration
      if (!user || user.emailVerified) {
        return { success: true };
      }

      // 60-second cooldown: check if a token was recently issued
      // Token expiry is set to 24 hours from issue time, so if expiry > 23h59m from now, it was issued within 60 seconds
      if (user.emailVerificationExpiry) {
        const issuedAt = new Date(user.emailVerificationExpiry).getTime() - 24 * 60 * 60 * 1000;
        const secondsSinceIssued = (Date.now() - issuedAt) / 1000;
        if (secondsSinceIssued < 60) {
          const remainingSeconds = Math.ceil(60 - secondsSinceIssued);
          throw new TRPCError({
            code: 'TOO_MANY_REQUESTS',
            message: `請等待 ${remainingSeconds} 秒後再重新發送`,
          });
        }
      }

      // Generate new token
      const { generateEmailVerificationToken } = await import('../auth');
      const newToken = generateEmailVerificationToken();
      const newExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await drizzleDb
        .update(usersTable)
        .set({ emailVerificationToken: newToken, emailVerificationExpiry: newExpiry })
        .where(eq(usersTable.id, user.id));

      // Send verification email
      import('../emailService').then(({ sendEmailVerificationEmail }) => {
        sendEmailVerificationEmail({
          userId: user.id,
          userName: user.name || user.email!.split('@')[0],
          email: user.email!,
          verificationToken: newToken,
          siteUrl: 'https://boxium.asia',
        }).catch((err: Error) => console.error('[Auth] Failed to resend verification email:', err));
      });

      return { success: true };
    }),

  logout: publicProcedure
    .mutation(async ({ ctx }) => {
      console.log('[Logout API] Clearing session cookie...');
      
      if (ctx.res && ctx.req) {
        // Use the same options as when the cookie was set, to ensure it can be cleared
        const cookieOptions = getSessionCookieOptions(ctx.req);
        // Clear the 'session' cookie (the actual cookie name used when setting)
        ctx.res.clearCookie('session', cookieOptions);
        // Also clear legacy COOKIE_NAME just in case
        ctx.res.clearCookie(COOKIE_NAME, cookieOptions);
        // Extra: set expired cookie with same options to force browser removal
        ctx.res.cookie('session', '', { ...cookieOptions, maxAge: 0, expires: new Date(0) });
        console.log('[Logout API] Session cookie cleared with options:', JSON.stringify(cookieOptions));
      } else {
        console.warn('[Logout API] Cannot clear cookie - ctx.res or ctx.req is missing');
      }
      
      return { success: true };
    }),

  deleteAccount: protectedProcedure
    .input(z.object({
      confirmEmail: z.string().email(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      const userEmail = ctx.user.email;

      // Verify the user typed their own email correctly
      if (input.confirmEmail.toLowerCase() !== (userEmail || '').toLowerCase()) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '電子郵件地址不符，請重新輸入' });
      }

      const { getDb: _getDbForDelete } = await import('../db');
      const db = await _getDbForDelete();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '資料庫連線失敗' });

      try {
        const {
          watchlist,
          viewHistory,
          notifications,
          auctionBids,
          offers,
          cartItems,
          userShippingAddresses,
          userSearchLogs,
          marketplaceSearchLogs,
          wishlists,
          sellerProfiles,
          gradingSubmissions,
          users,
        } = await import('../../drizzle/schema_new');
        const { eq } = await import('drizzle-orm');

        // Delete user-related records in dependency order
        // 1. Watchlist
        await db.delete(watchlist).where(eq(watchlist.userId, userId));
        // 2. View history
        await db.delete(viewHistory).where(eq(viewHistory.userId, userId));
        // 3. Notifications
        await db.delete(notifications).where(eq(notifications.userId, userId));
        // 4. Auction bids
        await db.delete(auctionBids).where(eq(auctionBids.bidderId, userId));
        // 5. Offers (as buyer)
        await db.delete(offers).where(eq(offers.buyerId, userId));
        // 6. Cart items
        await db.delete(cartItems).where(eq(cartItems.userId, userId));
        // 7. Shipping addresses
        await db.delete(userShippingAddresses).where(eq(userShippingAddresses.userId, userId));
        // 8. User search logs
        await db.delete(userSearchLogs).where(eq(userSearchLogs.userId, userId));
        // 9. Marketplace search logs
        await db.delete(marketplaceSearchLogs).where(eq(marketplaceSearchLogs.userId, userId));
        // 10. Wishlists
        await db.delete(wishlists).where(eq(wishlists.userId, userId));
        // 11. Seller profile (listings are kept for order history integrity, seller anonymized)
        await db.delete(sellerProfiles).where(eq(sellerProfiles.userId, userId));
        // 12. Grading submissions created by user
        await db.delete(gradingSubmissions).where(eq(gradingSubmissions.userId, userId));

        // 13. Finally delete the user record
        await db.delete(users).where(eq(users.id, userId));

        console.log(`[DeleteAccount] User ${userId} (${userEmail}) account deleted successfully`);
      } catch (err) {
        console.error('[DeleteAccount] Error deleting account:', err);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '刪除帳號時發生錯誤，請稍後再試' });
      }

      // Clear session cookie
      if (ctx.res && ctx.req) {
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.clearCookie('session', cookieOptions);
        ctx.res.clearCookie(COOKIE_NAME, cookieOptions);
        ctx.res.cookie('session', '', { ...cookieOptions, maxAge: 0, expires: new Date(0) });
      }

      return { success: true };
    }),

  forgotPassword: publicProcedure
    .input(z.object({
      email: z.string().trim().toLowerCase().email(),
    }))
    .mutation(async ({ input }) => {
      const { getDb } = await import('../db');
      const { users: usersTable } = await import('../../drizzle/schema_new');
      const { eq: eqOp } = await import('drizzle-orm');
      const crypto = await import('crypto');

      const drizzleDb = await getDb();
      if (!drizzleDb) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '資料庫連線失敗' });

      // Always return success to prevent email enumeration
      const userResults = await drizzleDb.select().from(usersTable).where(eqOp(usersTable.email, input.email)).limit(1);
      const user = userResults[0];

      if (user && user.passwordHash) {
        // Generate a reset token valid for 1 hour
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetExpiry = new Date(Date.now() + 60 * 60 * 1000);

        await drizzleDb
          .update(usersTable)
          .set({
            emailVerificationToken: resetToken,
            emailVerificationExpiry: resetExpiry,
          })
          .where(eqOp(usersTable.id, user.id));

        // Send password reset email
        import('../emailService').then(({ sendPasswordResetEmail }) => {
          sendPasswordResetEmail({
            userId: user.id,
            userName: user.name || user.email!.split('@')[0],
            email: user.email!,
            resetToken,
            siteUrl: 'https://boxium.asia',
          }).catch((err: Error) => console.error('[Auth] Failed to send password reset email:', err));
        }).catch(() => {
          // emailService may not have sendPasswordResetEmail yet — notify owner as fallback
          import('../_core/notification').then(({ notifyOwner }) => {
            notifyOwner({
              title: '密碼重設請求',
              content: `用戶 ${user.email} 請求重設密碼。重設 Token: ${resetToken}`,
            }).catch(() => {});
          });
        });
      }

      return { success: true };
    }),

  resetPassword: publicProcedure
    .input(z.object({
      token: z.string().min(1),
      newPassword: z.string().min(8, '密碼至少需要 8 個字元'),
    }))
    .mutation(async ({ input, ctx }) => {
      const { getDb } = await import('../db');
      const { users: usersTable } = await import('../../drizzle/schema_new');
      const { eq: eqOp, and: andOp, gt: gtOp } = await import('drizzle-orm');
      const bcrypt = await import('bcrypt');

      const drizzleDb = await getDb();
      if (!drizzleDb) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '資料庫連線失敗' });

      const now = new Date();
      const userResults = await drizzleDb
        .select()
        .from(usersTable)
        .where(
          andOp(
            eqOp(usersTable.emailVerificationToken, input.token),
            gtOp(usersTable.emailVerificationExpiry, now)
          )
        )
        .limit(1);

      if (userResults.length === 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: '重設連結無效或已過期，請重新申請忘記密碼',
        });
      }

      const user = userResults[0];
      if (!user.passwordHash) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: '您的帳號使用第三方登入，無法使用此功能',
        });
      }

      const newHash = await bcrypt.hash(input.newPassword, 12);
      await drizzleDb
        .update(usersTable)
        .set({
          passwordHash: newHash,
          emailVerificationToken: null,
          emailVerificationExpiry: null,
        })
        .where(eqOp(usersTable.id, user.id));

      return { success: true };
    }),
});

