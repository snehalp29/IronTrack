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
    this.basePath = configuredBasePath?.trim() || 'http://localhost:5000';
  }

  async health() {
    const { data } = await firstValueFrom(
      this.httpService.get(`${this.basePath}/health`),
    );
    return data;
  }

  async nextLoad(payload: unknown) {
    const { data } = await firstValueFrom(
      this.httpService.post(`${this.basePath}/api/v1/next-load`, payload),
    );
    return data;
  }

  async restTime(payload: unknown) {
    const { data } = await firstValueFrom(
      this.httpService.post(`${this.basePath}/api/v1/rest-time`, payload),
    );
    return data;
  }

  async painPattern(payload: unknown) {
    const { data } = await firstValueFrom(
      this.httpService.post(`${this.basePath}/api/v1/pain-pattern`, payload),
    );
    return data;
  }

  async sessionRecommender(payload: unknown) {
    const { data } = await firstValueFrom(
      this.httpService.post(
        `${this.basePath}/api/v1/session-recommender`,
        payload,
      ),
    );
    return data;
  }
}
