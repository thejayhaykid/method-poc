import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Method, Environments, type TEnvironments } from 'method-node';

@Injectable()
export class MethodService {
  public readonly client: Method;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.getOrThrow<string>('METHOD_API_KEY');
    const env = this.configService.get<string>('METHOD_ENV', 'dev');

    const resolvedEnv: TEnvironments =
      env === 'production'
        ? Environments.production
        : env === 'sandbox'
          ? Environments.sandbox
          : Environments.dev;

    this.client = new Method({ apiKey, env: resolvedEnv });
  }
}
