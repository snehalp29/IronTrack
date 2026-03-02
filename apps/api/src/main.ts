import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { CorrelationIdInterceptor } from './common/interceptors/correlation-id.interceptor';
import { WinstonLoggerService } from './common/logger/winston-logger.service';
import { PrismaService } from './prisma/prisma.service';

async function bootstrap() {
  const logger = new WinstonLoggerService();
  const app = await NestFactory.create(AppModule, { logger });
  const configService = app.get(ConfigService);

  app.use(helmet());
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidUnknownValues: false,
    }),
  );
  app.useGlobalInterceptors(new CorrelationIdInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  const prefix = configService.get<string>('API_PREFIX') ?? 'api/v1';
  app.setGlobalPrefix(prefix);

  const allowedOrigins = (
    configService.get<string>('CORS_ORIGINS') ??
    'http://localhost:3000,http://localhost:5173,http://localhost:8081'
  )
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('IronTrack API')
    .setDescription('IronTrack REST API documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(`${prefix}/docs`, app, document);

  const prismaService = app.get(PrismaService);
  await prismaService.enableShutdownHooks(app);

  const port = configService.get<number>('API_PORT') ?? 3000;
  await app.listen(port);

  logger.log(`API running on http://localhost:${port}/${prefix}`);
}

bootstrap();
