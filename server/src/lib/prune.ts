// One interval that prunes every expiring structure in the process.
//
// Limiters and caches otherwise grow forever with distinct keys, which is a slow
// leak. Each module registers what it creates instead of starting its own timer,
// so there is a single place to reason about (and to stop).

type Prunable = { deleteExpired(now?: number): void };

const registry: Prunable[] = [];

export function registerPrunable(prunable: Prunable): void {
  registry.push(prunable);
}

export function pruneAll(now = Date.now()): void {
  for (const prunable of registry) prunable.deleteExpired(now);
}

export function startPruning(intervalMs = 60_000): void {
  const timer = setInterval(() => pruneAll(), intervalMs);
  timer.unref?.();
}
