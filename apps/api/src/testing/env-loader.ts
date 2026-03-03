import { loadEnvFiles } from '../common/env/workspace-env';

type EnvLoader = (path?: string) => void;

export function loadEnvForJest(options?: {
  nodeEnv?: string;
  loadEnvFile?: EnvLoader;
}): void {
  const nodeEnv = options?.nodeEnv ?? process.env.NODE_ENV;
  const filesToLoad = nodeEnv === 'test' ? ['.env.test', '.env'] : ['.env'];
  loadEnvFiles(filesToLoad, { loadEnvFile: options?.loadEnvFile });
}
