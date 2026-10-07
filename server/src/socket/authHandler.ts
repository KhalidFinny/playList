import { Server, Socket } from "socket.io";
import { sql } from "../db/client";
import { redisCache } from "../lib/redis";
import { clientIpOf } from "../lib/clientIp";
import { RateLimiter } from "../lib/rateLimit";
import { registerPrunable } from "../lib/prune";

// These endpoints are unauthenticated, so they are throttled per IP: credential
// stuffing on login, and pending-admin spam on register.
const loginAttemptsPerIp = new RateLimiter(10, 60_000);
const registerAttemptsPerIp = new RateLimiter(5, 60 * 60_000);
registerPrunable(loginAttemptsPerIp);
registerPrunable(registerAttemptsPerIp);



export function handleAuthEvents(io: Server, socket: Socket) {
  
  // Register a new admin
  socket.on("admin_register", async (data: { username: string; email: string; password: string; inviteCode?: string }, callback) => {
    const { username, email, password, inviteCode } = data;

    const clientIp = clientIpOf(socket);
    if (!registerAttemptsPerIp.take(clientIp)) {
      console.warn(`[AUTH] admin_register rate limited (ip=${clientIp})`);
      return callback?.({ success: false, error: "Too many registration attempts. Please try again later." });
    }

    // Fail closed: without a configured code, registration is disabled rather
    // than silently open.
    const expectedInviteCode = process.env.ADMIN_INVITE_CODE;
    if (!expectedInviteCode) {
      console.error("[AUTH] ADMIN_INVITE_CODE is not set — registration is disabled.");
      return callback?.({ success: false, error: "Registration is currently disabled." });
    }

    if (!inviteCode || inviteCode !== expectedInviteCode) {
      console.warn(`[AUTH] admin_register rejected: bad invite code (ip=${clientIp})`);
      return callback?.({ success: false, error: "Invalid invite code." });
    }

    if (!email || !email.toLowerCase().endsWith("@playit.com")) {
      return callback?.({ success: false, error: "Only @playit.com corporate emails are allowed." });
    }



    if (!username || !password || password.length < 6) {
      return callback?.({ success: false, error: "Invalid username or password" });
    }

    try {
      const existing = await sql`SELECT id FROM admins WHERE username = ${username} OR email = ${email}`;
      if (existing.length > 0) {
        return callback?.({ success: false, error: "Username or Email already registered" });
      }

      const passwordHash = await Bun.password.hash(password);

      const result = await sql`
        INSERT INTO admins (username, email, password_hash, status)
        VALUES (${username}, ${email}, ${passwordHash}, 'pending')
        RETURNING id, username, email, status
      `;

      if (callback) callback({ 
        success: true, 
        message: "Registration received. Please wait for Head Admin approval.",
        user: result[0] 
      });
    } catch (err) {
      console.error("[AUTH] Register error:", err);
      if (callback) callback({ success: false, error: "Internal server error" });
    }
  });

  // Login admin
  socket.on("admin_login", async (data: { username: string; password: string }, callback) => {
    const { username, password } = data;

    if (!username || !password) {
      return callback?.({ success: false, error: "Missing credentials" });
    }

    // Throttle before the password verify so a stuffing loop cannot force
    // expensive hashing on every request.
    const clientIp = clientIpOf(socket);
    if (!loginAttemptsPerIp.take(clientIp)) {
      console.warn(`[AUTH] admin_login rate limited (ip=${clientIp})`);
      return callback?.({ success: false, error: "Too many attempts. Please wait a moment." });
    }

    try {
      const result = await sql`SELECT id, username, email, password_hash, status, role FROM admins WHERE username = ${username} OR email = ${username}`;
      
      if (result.length === 0) {
        return callback?.({ success: false, error: "Invalid credentials" });
      }

      const admin = result[0] as { id: string; username: string; email: string; password_hash: string; status: string; role: string };
      
      if (admin.status !== 'active') {
        return callback?.({ 
          success: false, 
          error: admin.status === 'pending' 
            ? "Your account is pending approval from the Head Admin." 
            : "Your account has been suspended." 
        });
      }

      const isValid = await Bun.password.verify(password, admin.password_hash);
      if (!isValid) {
        return callback?.({ success: false, error: "Invalid credentials" });
      }

      const sessionToken = crypto.randomUUID();
      await redisCache.client.setex(`admin_session:${sessionToken}`, 7 * 24 * 60 * 60, admin.id);

      if (callback) callback({ 
        success: true, 
        token: sessionToken,
        user: { id: admin.id, username: admin.username, email: admin.email, role: admin.role }
      });
    } catch (err) {
      console.error("[AUTH] Login error:", err);
      if (callback) callback({ success: false, error: "Internal server error" });
    }
  });

  // Authenticate an existing session
  socket.on("admin_authenticate", async (data: { token: string }, callback) => {
    const { token } = data;
    if (!token) return callback?.({ success: false, error: "No token provided" });

    try {
      const adminId = await redisCache.client.get(`admin_session:${token}`);
      if (!adminId) {
        return callback?.({ success: false, error: "Invalid or expired session" });
      }

      const result = await sql`SELECT id, username, email, role, status FROM admins WHERE id = ${adminId}`;
      if (result.length === 0) {
        return callback?.({ success: false, error: "Admin not found" });
      }

      if (callback) callback({ success: true, user: result[0] });
    } catch (err) {
      console.error("[AUTH] Authenticate error:", err);
      if (callback) callback({ success: false, error: "Internal server error" });
    }
  });

  // Logout — invalidate session server-side
  socket.on("admin_logout", async (data: { token: string }, callback) => {
    const { token } = data;
    if (!token) return callback?.({ success: false });
    try {
      await redisCache.client.del(`admin_session:${token}`);
      console.log("[AUTH] Session invalidated");
      if (callback) callback({ success: true });
    } catch (err) {
      console.error("[AUTH] Logout error:", err);
      if (callback) callback({ success: false });
    }
  });

  // Get pending admins (Super Admin only)
  socket.on("get_pending_admins", async (data: { adminToken: string }, callback) => {
    const { adminToken } = data;
    try {
      const adminId = await redisCache.client.get(`admin_session:${adminToken}`);
      if (!adminId) return callback?.({ success: false, error: "Unauthorized" });

      const admin = await sql`SELECT role FROM admins WHERE id = ${adminId}`;
      if (admin[0]?.role !== 'super_admin') return callback?.({ success: false, error: "Forbidden" });

      const pending = await sql`SELECT id, username, email, created_at as "createdAt" FROM admins WHERE status = 'pending' ORDER BY created_at DESC`;
      if (callback) callback({ success: true, admins: pending });
    } catch (err) {
      if (callback) callback({ success: false, error: "Internal server error" });
    }
  });

  // Approve admin (Super Admin only)
  socket.on("approve_admin", async (data: { adminToken: string, targetId: string }, callback) => {
    const { adminToken, targetId } = data;
    try {
      const adminId = await redisCache.client.get(`admin_session:${adminToken}`);
      if (!adminId) return callback?.({ success: false, error: "Unauthorized" });

      const admin = await sql`SELECT role FROM admins WHERE id = ${adminId}`;
      if (admin[0]?.role !== 'super_admin') return callback?.({ success: false, error: "Forbidden" });

      await sql`UPDATE admins SET status = 'active' WHERE id = ${targetId}`;
      if (callback) callback({ success: true });
    } catch (err) {
      if (callback) callback({ success: false, error: "Internal server error" });
    }
  });

  // Deny/Delete admin (Super Admin only)
  socket.on("deny_admin", async (data: { adminToken: string, targetId: string }, callback) => {
    const { adminToken, targetId } = data;
    try {
      const adminId = await redisCache.client.get(`admin_session:${adminToken}`);
      if (!adminId) return callback?.({ success: false, error: "Unauthorized" });

      const admin = await sql`SELECT role FROM admins WHERE id = ${adminId}`;
      if (admin[0]?.role !== 'super_admin') return callback?.({ success: false, error: "Forbidden" });

      await sql`DELETE FROM admins WHERE id = ${targetId} AND status = 'pending'`;
      if (callback) callback({ success: true });
    } catch (err) {
      if (callback) callback({ success: false, error: "Internal server error" });
    }
  });
}
