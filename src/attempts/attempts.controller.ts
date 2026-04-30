import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { AttemptDto } from '@senlabvisa/shared-types';
import { AttemptsService } from './attempts.service';
import {
  CompleteAttemptInput,
  EvaluateAttemptInput,
  ListAttemptsQuery,
  StartAttemptInput,
  UpdateAttemptInput,
} from './dto';
import { Roles, RolesGuard } from './roles.guard';

type ReqUser = { user: { userId: string; role: string } };

@Controller('attempts')
export class AttemptsController {
  constructor(private readonly svc: AttemptsService) {}

  @Get('health')
  health() {
    return { status: 'ok', service: 'attempts-service' };
  }

  @Post('start')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('student')
  start(@Body() input: StartAttemptInput, @Req() req: ReqUser): Promise<AttemptDto> {
    return this.svc.start(req.user.userId, input);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('student')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: UpdateAttemptInput,
    @Req() req: ReqUser,
  ): Promise<AttemptDto> {
    return this.svc.updateData(id, req.user.userId, input.dataJson);
  }

  @Post(':id/complete')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('student')
  complete(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: CompleteAttemptInput,
    @Req() req: ReqUser,
  ): Promise<AttemptDto> {
    return this.svc.complete(id, req.user.userId, input);
  }

  @Get('mine')
  @UseGuards(AuthGuard('jwt'))
  mine(@Req() req: ReqUser): Promise<AttemptDto[]> {
    return this.svc.findMine(req.user.userId);
  }

  @Post(':id/evaluation')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('sysadmin', 'admin', 'teacher')
  evaluate(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: EvaluateAttemptInput,
  ): Promise<AttemptDto> {
    return this.svc.evaluate(id, input);
  }

  @Post(':id/publish')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('sysadmin', 'admin', 'teacher')
  publish(@Param('id', new ParseUUIDPipe()) id: string): Promise<AttemptDto> {
    return this.svc.publish(id);
  }

  @Get()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('sysadmin', 'admin', 'teacher')
  findAll(@Query() query: ListAttemptsQuery): Promise<AttemptDto[]> {
    return this.svc.findAll({
      ...(query.studentId ? { studentId: query.studentId } : {}),
      ...(query.simulationId ? { simulationId: query.simulationId } : {}),
      ...(query.status ? { status: query.status } : {}),
    });
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<AttemptDto> {
    return this.svc.findById(id);
  }
}
