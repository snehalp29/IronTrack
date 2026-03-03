import { defineConfig } from 'prisma/config';

import {
  loadWorkspaceEnv,
  resolveDatabaseUrl,
} from './src/common/env/workspace-env';

loadWorkspaceEnv();

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: resolveDatabaseUrl(),
  },
});
