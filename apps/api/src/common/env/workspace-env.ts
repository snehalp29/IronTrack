import { resolve } from 'node:path';

type EnvLoader = (path?: string) => void;

function safeLoadEnvFile(loadEnvFile: EnvLoader, path: string): void {
  try {
    loadEnvFile(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
}

export function loadEnvFiles(
  paths: string[],
  options?: { loadEnvFile?: EnvLoader },
): void {
  const loadEnvFile =
    options?.loadEnvFile ??
    (typeof process.loadEnvFile === 'function'
      ? process.loadEnvFile.bind(process)
      : undefined);

  if (!loadEnvFile) {
    return;
  }

  for (const path of paths) {
    safeLoadEnvFile(loadEnvFile, path);
  }
}

export function loadWorkspaceEnv(options?: {
  cwd?: string;
  loadEnvFile?: EnvLoader;
}): void {
  const cwd = options?.cwd ?? process.cwd();
  loadEnvFiles([resolve(cwd, '.env'), resolve(cwd, '../../.env')], {
    loadEnvFile: options?.loadEnvFile,
  });
}

export function resolveDatabaseUrl(
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  const value = env.DATABASE_URL?.trim();
  return value && value.length > 0 ? value : undefined;
}

export function requireDatabaseUrl(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const value = resolveDatabaseUrl(env);
  if (!value) {
    throw new Error(
      'DATABASE_URL is required for Prisma datasource configuration.',
    );
  }
  return value;
}
