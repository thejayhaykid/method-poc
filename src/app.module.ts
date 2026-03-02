import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join, dirname } from 'path';
import { mkdirSync } from 'fs';
import { MethodModule } from './method/method.module.js';
import { EntitiesModule } from './entities/entities.module.js';
import { VerificationModule } from './verification/verification.module.js';
import { AccountsModule } from './accounts/accounts.module.js';

const DB_PATH = join(__dirname, '..', 'data', 'method-poc.sqlite');
mkdirSync(dirname(DB_PATH), { recursive: true });

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: DB_PATH,
      autoLoadEntities: true,
      synchronize: true,
    }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'client', 'dist'),
      exclude: ['/api/(.*)'],
    }),
    MethodModule,
    EntitiesModule,
    VerificationModule,
    AccountsModule,
  ],
})
export class AppModule {}
