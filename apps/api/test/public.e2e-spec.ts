import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { CatalogModule } from '../src/modules/catalog/catalog.module';
import { HealthModule } from '../src/modules/health/health.module';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Public endpoints (e2e)', () => {
  let app: INestApplication;

  const muscleGroups = [
    { id: 'mg-1', name: 'Chest', sortOrder: 1 },
    { id: 'mg-2', name: 'Back', sortOrder: 2 },
  ];

  const equipment = [
    { id: 'eq-1', name: 'Barbell', sortOrder: 1 },
    { id: 'eq-2', name: 'Dumbbell', sortOrder: 2 },
  ];

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
