import { HttpService } from '@nestjs/axios';
import {
  BadGatewayException,
  GatewayTimeoutException,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

const ML_REQUEST_TIMEOUT_MS = 5000;

type MlAxiosLikeError = {
  isAxiosError?: unknown;
  code?: unknown;
  response?: {
    status?: unknown;
    data?: unknown;
  };
};

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
    return this.request(() =>
      this.httpService.get(this.buildUrl('/health'), {
        timeout: ML_REQUEST_TIMEOUT_MS,
      }),
    );
  }

  async nextLoad(payload: unknown) {
    return this.request(() =>
      this.httpService.post(this.buildUrl('/api/v1/next-load'), payload, {
        timeout: ML_REQUEST_TIMEOUT_MS,
      }),
    );
  }

  async restTime(payload: unknown) {
    return this.request(() =>
      this.httpService.post(this.buildUrl('/api/v1/rest-time'), payload, {
        timeout: ML_REQUEST_TIMEOUT_MS,
      }),
    );
  }

  async painPattern(payload: unknown) {
    return this.request(() =>
      this.httpService.post(this.buildUrl('/api/v1/pain-pattern'), payload, {
        timeout: ML_REQUEST_TIMEOUT_MS,
      }),
    );
  }

  async sessionRecommender(payload: unknown) {
    return this.request(() =>
      this.httpService.post(
        this.buildUrl('/api/v1/session-recommender'),
        payload,
        {
          timeout: ML_REQUEST_TIMEOUT_MS,
        },
      ),
    );
  }

  private resolveBasePath(configuredBasePath: string | undefined): string {
    const trimmed = configuredBasePath?.trim();
    const basePath =
      trimmed && trimmed.length > 0 ? trimmed : 'http://localhost:5000';
    return basePath.replace(/\/+$/, '');
  }

  private buildUrl(path: `/${string}`): string {
    return `${this.basePath}${path}`;
  }

  private async request(
    factory: () => ReturnType<HttpService['get']>,
  ): Promise<unknown> {
    try {
      const { data } = await firstValueFrom(factory());
      return data;
    } catch (error) {
      if (isMlAxiosLikeError(error)) {
        if (isMlTimeoutError(error)) {
          throw new GatewayTimeoutException({
            code: 'ML_UPSTREAM_TIMEOUT',
            message: 'ML service timed out',
          });
        }

        if (
          error.response?.status !== undefined &&
          typeof error.response.status === 'number' &&
          error.response.status >= 400 &&
          error.response.status < 500
        ) {
          throw new UnprocessableEntityException({
            code: 'ML_UPSTREAM_VALIDATION_ERROR',
            message: 'ML service rejected the request payload',
            details: error.response.data,
          });
        }

        throw new BadGatewayException({
          code: 'ML_UPSTREAM_ERROR',
          message: 'ML service is unavailable',
        });
      }

      throw error;
    }
  }
}

function isMlAxiosLikeError(error: unknown): error is MlAxiosLikeError {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const maybeAxiosError = error as MlAxiosLikeError;
  return (
    maybeAxiosError.isAxiosError === true ||
    typeof maybeAxiosError.code === 'string' ||
    typeof maybeAxiosError.response?.status === 'number'
  );
}

function isMlTimeoutError(error: MlAxiosLikeError): boolean {
  return error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT';
}
