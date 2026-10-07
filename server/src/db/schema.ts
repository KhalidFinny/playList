import { sql } from "./client";

export async function setupDatabase() {
  console.log("🛠️  Setting up database schema...");

  try {
    // Admins table
    console.log("  - Ensuring 'admins' table exists...");
    await sql`
      CREATE TABLE IF NOT EXISTS admins (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'admin', -- super_admin, admin
        status VARCHAR(20) NOT NULL DEFAULT 'pending', -- active, pending, suspended
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;

    // Migration: Add email, role, status to admins
    await sql`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='admins' AND column_name='email') THEN
          ALTER TABLE admins ADD COLUMN email VARCHAR(255) UNIQUE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='admins' AND column_name='role') THEN
          ALTER TABLE admins ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'admin';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='admins' AND column_name='status') THEN
          ALTER TABLE admins ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'pending';
        END IF;
      END $$;
    `;

    // Rooms table
    console.log("  - Ensuring 'rooms' table exists...");
    await sql`
      CREATE TABLE IF NOT EXISTS rooms (
        id VARCHAR(50) PRIMARY KEY,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;

    // Songs table
    console.log("  - Ensuring 'songs' table exists...");
    await sql`
      CREATE TABLE IF NOT EXISTS songs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        room_id VARCHAR(50) REFERENCES rooms(id) ON DELETE CASCADE,
        youtube_id VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        author VARCHAR(255),
        status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, approved, playing, done
        submitted_by VARCHAR(255) NOT NULL, -- userId from localstorage
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        approved_at TIMESTAMP WITH TIME ZONE
      );
    `;

    // Migration: Add author if it doesn't exist (for existing databases)
    await sql`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='songs' AND column_name='author') THEN
          ALTER TABLE songs ADD COLUMN author VARCHAR(255);
        END IF;
      END $$;
    `;

    // Migration: Add done_at column for previous-track support
    await sql`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='songs' AND column_name='done_at') THEN
          ALTER TABLE songs ADD COLUMN done_at TIMESTAMP WITH TIME ZONE;
        END IF;
      END $$;
    `;

    // Create an index for faster queue pulling (orderBy approved_at ASC)
    console.log("  - Ensuring 'songs_queue_idx' exists...");
    await sql`
      CREATE INDEX IF NOT EXISTS songs_queue_idx ON songs(room_id, status, approved_at);
    `;

    // Bounded history lookup: rebuildRoomQueue reads the most recent done tracks.
    await sql`
      CREATE INDEX IF NOT EXISTS songs_done_idx ON songs(room_id, status, done_at DESC);
    `;

    // Backs the global "top this week" chart, which filters across all rooms and
    // so cannot use songs_done_idx (room_id leads that one).
    await sql`
      CREATE INDEX IF NOT EXISTS songs_charted_idx ON songs(status, created_at DESC);
    `;

    // Durable DB event idempotency log
    console.log("  - Ensuring 'db_event_log' table exists...");
    await sql`
      CREATE TABLE IF NOT EXISTS db_event_log (
        event_id VARCHAR(100) PRIMARY KEY,
        type VARCHAR(50) NOT NULL,
        room_id VARCHAR(50) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'processing',
        processed_at TIMESTAMP WITH TIME ZONE,
        error TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS db_event_log_room_idx ON db_event_log(room_id, created_at);
    `;


    // Migration: Add passkey to rooms if it doesn't exist
    await sql`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rooms' AND column_name='passkey') THEN
          ALTER TABLE rooms ADD COLUMN passkey VARCHAR(5);
        END IF;
      END $$;
    `;

    // The passkey is the participant's only credential, so it must be unique.
    // Postgres allows multiple NULLs, so un-keyed rooms are unaffected.
    console.log("  - Ensuring 'rooms_passkey_idx' exists...");
    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS rooms_passkey_idx ON rooms(passkey);
    `;

    // Migration: Add owner_id to rooms if it doesn't exist
    await sql`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rooms' AND column_name='owner_id') THEN
          ALTER TABLE rooms ADD COLUMN owner_id UUID REFERENCES admins(id) ON DELETE SET NULL;
        END IF;
      END $$;
    `;

    // Seeding initial admins
    const { seedAdmins } = await import("./seed");
    await seedAdmins();

    console.log("✅ Database schema ready.");
  } catch (error: any) {
    console.error("❌ Failed to setup database schema:", error.message || error);
    
    if (error.code === 'ECONNREFUSED') {
      console.error("💡 Hint: Connection refused. Is your database running and accessible?");
    } else if (error.code === 'ETIMEDOUT') {
      console.error("💡 Hint: Connection timed out. This is often a firewall or IP whitelist issue.");
    }
    
    throw error;
  }
}

