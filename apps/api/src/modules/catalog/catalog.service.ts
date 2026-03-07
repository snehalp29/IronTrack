import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

const MAX_CATALOG_RESULTS = 500;

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async muscleGroups() {
    return this.prisma.muscleGroup.findMany({
      orderBy: [
        {
          sortOrder: {
            sort: 'asc',
            nulls: 'last',
          },
        },
        { name: 'asc' },
      ],
      take: MAX_CATALOG_RESULTS,
    });
  }

  async equipment() {
    return this.prisma.equipment.findMany({
      orderBy: [
        {
          sortOrder: {
            sort: 'asc',
            nulls: 'last',
          },
        },
        { name: 'asc' },
      ],
      take: MAX_CATALOG_RESULTS,
    });
  }
}
