import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { CorrelationIdInterceptor } from '../src/common/interceptors/correlation-id.interceptor';
import { CatalogModule } from '../src/modules/catalog/catalog.module';
import type { CatalogService } from '../src/modules/catalog/catalog.service';
import { HealthModule } from '../src/modules/health/health.module';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';

type PublicMuscleGroup = Pick<
  Awaited<ReturnType<CatalogService['muscleGroups']>>[number],
  'id' | 'name' | 'sortOrder'
>;

type PublicEquipment = Pick<
  Awaited<ReturnType<CatalogService['equipment']>>[number],
  'id' | 'name' | 'sortOrder'
>;

describe('Public endpoints (e2e)', () => {
  let app: INestApplication;

  const muscleGroups: PublicMuscleGroup[] = [
    { id: 'mg-1', name: 'Chest', sortOrder: 1 },
    { id: 'mg-2', name: 'Back', sortOrder: 2 },
  ];

  const equipment: PublicEquipment[] = [
    { id: 'eq-1', name: 'Barbell', sortOrder: 1 },
    { id: 'eq-2', name: 'Dumbbell', sortOrder: 2 },
  ];
  const uuidV4Regex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  const prismaMock = {
    muscleGroup: {
      findMany: jest.fn(async () => muscleGroups),
    },
    equipment: {
      findMany: jest.fn(async () => equipment),
    },
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [HealthModule, CatalogModule, PrismaModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalInterceptors(new CorrelationIdInterceptor());
    await app.init();
  });

  afterEach(async () => {
    jest.clearAllMocks();
    if (app) {
      await app.close();
    }
  });

  it('GET /api/v1/health', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.timestamp).toBe('string');
  });

  it('generates correlation id when header is missing or blank', async () => {
    const blankHeaderRes = await request(app.getHttpServer())
      .get('/api/v1/health')
      .set('x-correlation-id', '   ');

    expect(blankHeaderRes.status).toBe(200);
    expect(blankHeaderRes.headers['x-correlation-id']).toMatch(uuidV4Regex);

    const missingHeaderRes = await request(app.getHttpServer()).get(
      '/api/v1/health',
    );
    expect(missingHeaderRes.status).toBe(200);
    expect(missingHeaderRes.headers['x-correlation-id']).toMatch(uuidV4Regex);
  });

  it('echoes client-provided non-empty correlation id', async () => {
    const correlationId = 'custom-correlation-id-123';
    const res = await request(app.getHttpServer())
      .get('/api/v1/health')
      .set('x-correlation-id', correlationId);

    expect(res.status).toBe(200);
    expect(res.headers['x-correlation-id']).toBe(correlationId);
  });

  it('GET /api/v1/muscle-groups', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/muscle-groups');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(muscleGroups);
    expect(prismaMock.muscleGroup.findMany).toHaveBeenCalledWith({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  });

  it('GET /api/v1/equipment', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/equipment');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(equipment);
    expect(prismaMock.equipment.findMany).toHaveBeenCalledWith({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  });
});
