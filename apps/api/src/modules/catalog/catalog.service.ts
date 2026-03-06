import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

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
    });
  }
}
