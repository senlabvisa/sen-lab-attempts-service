import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PrismaModule } from './prisma/prisma.module';
import { AttemptsModule } from './attempts/attempts.module';
import { JwtStrategy } from './attempts/jwt.strategy';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PassportModule,
    JwtModule.register({}),
    PrismaModule,
    AttemptsModule,
  ],
  providers: [JwtStrategy],
})
export class AppModule {}
