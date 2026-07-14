export function loadEnv(): void {
  // Next.js loads .env files for route handlers. This no-op keeps scripts and
  // shared server modules from importing dynamic filesystem code during builds.
}

loadEnv();

export function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}
