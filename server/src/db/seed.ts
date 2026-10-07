import { sql } from "./client";

// Bootstrap admins. Password is the digits 1 through 8.
const BOOTSTRAP_PASSWORD = "12345678";
const BOOTSTRAP_ADMINS = [
  { username: "admin1", email: "admin1@playit.com", role: "super_admin", status: "active" },
  { username: "admin2", email: "admin2@playit.com", role: "admin", status: "active" },
  { username: "admin3", email: "admin3@playit.com", role: "admin", status: "active" }
];
// Accounts created by an older seed that are no longer part of the bootstrap set.
const RETIRED_BOOTSTRAP_ADMINS = ["admin4", "admin5"];

export async function seedAdmins() {
  console.log("🌱 Seeding admin accounts...");
  
  const passwordHash = await Bun.password.hash(BOOTSTRAP_PASSWORD);
  
  const admins = BOOTSTRAP_ADMINS;

  for (const admin of admins) {
    try {
      await sql`
        INSERT INTO admins (username, email, password_hash, role, status)
        VALUES (${admin.username}, ${admin.email}, ${passwordHash}, ${admin.role}, ${admin.status})
        ON CONFLICT (username) DO UPDATE 
        SET email = EXCLUDED.email, 
            password_hash = EXCLUDED.password_hash,
            role = EXCLUDED.role, 
            status = EXCLUDED.status
      `;
      console.log(`  - ${admin.username} (${admin.email}) synchronized.`);
    } catch (err) {
      console.error(`  - Failed to seed ${admin.username}:`, err);
    }
  }

  // Reset: drop the extra bootstrap accounts created by the previous seed so the
  // admin set is exactly admin1..admin3. Registered admins are left untouched.
  try {
    const retiredEmails = RETIRED_BOOTSTRAP_ADMINS.map((username) => `${username}@playit.com`);
    const removed = await sql`
      DELETE FROM admins
      WHERE username = ANY(${RETIRED_BOOTSTRAP_ADMINS})
        AND email = ANY(${retiredEmails})
      RETURNING username
    `;
    for (const row of removed) {
      console.log(`  - Removed retired bootstrap admin ${row.username}.`);
    }
  } catch (err) {
    console.error("  - Failed to remove retired bootstrap admins:", err);
  }
  
  console.log("✅ Seeding complete.");
  
  // LOG BOOTSTRAP INFO
  console.log("\n" + "=".repeat(50));
  console.log("🔐 ADMIN BOOTSTRAP INFO");
  console.log("  To register custom accounts, use this Invite Code:");
  console.log(`  >> ${process.env.ADMIN_INVITE_CODE || "PLAY-ADMIN-2026"} <<`);
  console.log("  (Visible only in these server logs)");
  console.log("=".repeat(50) + "\n");
}
