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

export function loadEnvForJest(options?: {
  nodeEnv?: string;
  loadEnvFile?: EnvLoader;
}): void {
  const loadEnvFile =
    options?.loadEnvFile ??
    (typeof process.loadEnvFile === 'function'
      ? process.loadEnvFile.bind(process)
      : undefined);

  if (!loadEnvFile) {
    return;
  }

  const nodeEnv = options?.nodeEnv ?? process.env.NODE_ENV;
  const filesToLoad = nodeEnv === 'test' ? ['.env.test', '.env'] : ['.env'];

  for (const path of filesToLoad) {
    safeLoadEnvFile(loadEnvFile, path);
  }
}
