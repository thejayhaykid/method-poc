import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { MethodError, type TMethodErrorTypes } from 'method-node';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof MethodError) {
      this.logger.error(
        `Method API error: [${exception.type}] ${exception.message}`,
      );

      const errorType: TMethodErrorTypes = exception.type;
      response.status(HttpStatus.BAD_GATEWAY).json({
        statusCode: HttpStatus.BAD_GATEWAY,
        source: 'method-api',
        type: errorType,
        sub_type: exception.sub_type,
        code: exception.code,
        message: exception.message,
      });
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();

      response.status(status).json({
        statusCode: status,
        ...(typeof body === 'string' ? { message: body } : body),
      });
      return;
    }

    if (exception instanceof Error) {
      this.logger.error(`${exception.message}`, exception.stack);

      response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: exception.message,
        error: exception.constructor.name,
      });
      return;
    }

    this.logger.error('Unknown exception', exception);
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
    });
  }
}
