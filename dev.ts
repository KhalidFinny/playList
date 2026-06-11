import { spawn } from "bun";

console.log("\n\x1b[36m%s\x1b[0m", "🎵 Starting PlayMusic Development Stack...");
console.log("\x1b[2m%s\x1b[0m", "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

// Ensure cache is running via Docker Compose. Postgres uses existing `postgres` Docker container.
console.log("🐳 Starting Redis via Docker Compose...");
const docker = spawn(["docker", "compose", "up", "-d", "redis"], {
  stdout: "inherit",
  stderr: "inherit",
});
await docker.exited;

// Spawn Server
const server = spawn(["bun", "run", "dev"], {
  cwd: "./server",
  stdout: "inherit",
  stderr: "inherit",
});

// Spawn Client
const client = spawn(["bun", "run", "dev"], {
  cwd: "./client",
  stdout: "inherit",
  stderr: "inherit",
});

// Handle cleanup on exit
process.on("SIGINT", async () => {
  console.log("\n👋 Shutting down...");
  server.kill();
  client.kill();
  
  console.log("🐳 Stopping Redis container...");
  const dockerStop = spawn(["docker", "compose", "stop", "redis"], {
    stdout: "inherit",
    stderr: "inherit",
  });
  await dockerStop.exited;
  
  process.exit();
});

// Keep the process alive
await Promise.all([server.exited, client.exited]);
