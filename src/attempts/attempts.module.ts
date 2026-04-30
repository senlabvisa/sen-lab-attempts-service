import { Module } from '@nestjs/common';
import { AttemptsController } from './attempts.controller';
import { AttemptsService } from './attempts.service';
import { RolesGuard } from './roles.guard';

@Module({
  controllers: [AttemptsController],
  providers: [AttemptsService, RolesGuard],
})
export class AttemptsModule {}
