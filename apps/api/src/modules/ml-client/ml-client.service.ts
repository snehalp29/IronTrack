import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class MlClientService {
  private readonly basePath: string;

  constructor(
    private readonly httpService: HttpService,
    configService: ConfigService,
  ) {
    const configuredBasePath = configService.get<string>('ML_SERVICE_URL');
    this.basePath = this.resolveBasePath(configuredBasePath);
  }

  async health() {
    const { data } = await firstValueFrom(
      this.httpService.get(this.buildUrl('/health')),
    );
    return data;
  }

  async nextLoad(payload: unknown) {
    const { data } = await firstValueFrom(
      this.httpService.post(this.buildUrl('/api/v1/next-load'), payload),
    );
    return data;
  }

  async restTime(payload: unknown) {
    const { data } = await firstValueFrom(
      this.httpService.post(this.buildUrl('/api/v1/rest-time'), payload),
    );
    return data;
  }

  async painPattern(payload: unknown) {
    const { data } = await firstValueFrom(
      this.httpService.post(this.buildUrl('/api/v1/pain-pattern'), payload),
    );
    return data;
  }

  async sessionRecommender(payload: unknown) {
    const { data } = await firstValueFrom(
      this.httpService.post(
        this.buildUrl('/api/v1/session-recommender'),
        payload,
      ),
    );
    return data;
  }

  private resolveBasePath(configuredBasePath: string | undefined): string {
    const trimmed = configuredBasePath?.trim();
    const basePath =
      trimmed && trimmed.length > 0 ? trimmed : 'http://localhost:5000';
    return basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;
  }

  private buildUrl(path: `/${string}`): string {
    return `${this.basePath}${path}`;
  }
}
