/**
 * Railway injects these system variables into every deployment. Do not key
 * security behavior from the non-system `RAILWAY_ENVIRONMENT` name: it is not
 * part of Railway's documented runtime contract.
 */
export function isRailwayRuntime(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(
    env.RAILWAY_ENVIRONMENT_ID?.trim() ||
    env.RAILWAY_ENVIRONMENT_NAME?.trim() ||
    env.RAILWAY_DEPLOYMENT_ID?.trim(),
  );
}

export function isProtectedServerRuntime(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV === "production" || isRailwayRuntime(env);
}
