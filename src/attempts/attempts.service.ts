import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma, AttemptStatus as PrismaAttemptStatus } from '@prisma/client';
import type {
  AttemptDto,
  CompleteAttemptDto,
  EvaluateAttemptDto,
  RubricEvaluation,
  StartAttemptDto,
} from '@senlabvisa/shared-types';
import { PrismaService } from '../prisma/prisma.service';

type AttemptRow = {
  id: string;
  studentId: string;
  simulationId: string;
  assignmentId: string | null;
  status: string;
  score: number | null;
  dataJson: Prisma.JsonValue;
  teacherComment: string | null;
  teacherRubric: Prisma.JsonValue | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  syncedAt: Date | null;
};

@Injectable()
export class AttemptsService {
  constructor(private readonly prisma: PrismaService) {}

  async start(studentId: string, input: StartAttemptDto): Promise<AttemptDto> {
    const row = await this.prisma.attempt.create({
      data: {
        studentId,
        simulationId: input.simulationId,
        ...(input.assignmentId ? { assignmentId: input.assignmentId } : {}),
        status: 'started' as PrismaAttemptStatus,
        dataJson: {},
      },
    });
    return this.toDto(row);
  }

  async evaluate(id: string, input: EvaluateAttemptDto): Promise<AttemptDto> {
    const data: Prisma.AttemptUpdateInput = {};
    if (input.teacherComment !== undefined) data.teacherComment = input.teacherComment;
    if (input.teacherRubric !== undefined) {
      data.teacherRubric = input.teacherRubric as unknown as Prisma.InputJsonValue;
    }
    try {
      const row = await this.prisma.attempt.update({ where: { id }, data });
      return this.toDto(row);
    } catch (err) {
      if ((err as { code?: string }).code === 'P2025') {
        throw new NotFoundException('Attempt not found');
      }
      throw err;
    }
  }

  async publish(id: string): Promise<AttemptDto> {
    try {
      const row = await this.prisma.attempt.update({
        where: { id },
        data: { publishedAt: new Date() },
      });
      return this.toDto(row);
    } catch (err) {
      if ((err as { code?: string }).code === 'P2025') {
        throw new NotFoundException('Attempt not found');
      }
      throw err;
    }
  }

  async updateData(
    id: string,
    studentId: string,
    patch: Record<string, unknown>,
  ): Promise<AttemptDto> {
    const current = await this.loadOwn(id, studentId);
    if (current.status !== 'started') {
      throw new BadRequestException('Attempt is not in progress');
    }
    const merged = { ...(current.dataJson as Record<string, unknown>), ...patch };
    const row = await this.prisma.attempt.update({
      where: { id },
      data: { dataJson: merged as Prisma.InputJsonValue },
    });
    return this.toDto(row);
  }

  async complete(
    id: string,
    studentId: string,
    input: CompleteAttemptDto,
  ): Promise<AttemptDto> {
    if (input.score < 0 || input.score > 100) {
      throw new BadRequestException('Score must be within [0,100]');
    }
    const current = await this.loadOwn(id, studentId);
    if (current.status !== 'started') {
      throw new BadRequestException('Attempt is not in progress');
    }
    const row = await this.prisma.attempt.update({
      where: { id },
      data: {
        status: 'completed' as PrismaAttemptStatus,
        score: input.score,
        dataJson: input.dataJson as Prisma.InputJsonValue,
        syncedAt: new Date(),
      },
    });
    return this.toDto(row);
  }

  async findMine(studentId: string): Promise<AttemptDto[]> {
    const rows = await this.prisma.attempt.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.toDto(r));
  }

  async findAll(
    filters: { studentId?: string; simulationId?: string; status?: string } = {},
  ): Promise<AttemptDto[]> {
    const where: Prisma.AttemptWhereInput = {};
    if (filters.studentId) where.studentId = filters.studentId;
    if (filters.simulationId) where.simulationId = filters.simulationId;
    if (filters.status) where.status = filters.status as PrismaAttemptStatus;

    const args: Prisma.AttemptFindManyArgs = { orderBy: { createdAt: 'desc' } };
    if (Object.keys(where).length > 0) args.where = where;

    const rows = await this.prisma.attempt.findMany(args);
    return rows.map((r) => this.toDto(r));
  }

  async findById(id: string): Promise<AttemptDto> {
    const row = await this.prisma.attempt.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Attempt not found');
    return this.toDto(row);
  }

  private async loadOwn(id: string, studentId: string): Promise<AttemptRow> {
    const row = await this.prisma.attempt.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Attempt not found');
    if (row.studentId !== studentId) {
      throw new ForbiddenException('You do not own this attempt');
    }
    return row;
  }

  private toDto(r: AttemptRow): AttemptDto {
    return {
      id: r.id,
      studentId: r.studentId,
      simulationId: r.simulationId,
      ...(r.assignmentId ? { assignmentId: r.assignmentId } : {}),
      status: r.status as AttemptDto['status'],
      score: r.score,
      dataJson: (r.dataJson ?? {}) as Record<string, unknown>,
      ...(r.teacherComment !== null ? { teacherComment: r.teacherComment } : {}),
      ...(r.teacherRubric !== null
        ? { teacherRubric: r.teacherRubric as unknown as RubricEvaluation }
        : {}),
      ...(r.publishedAt !== null ? { publishedAt: r.publishedAt.toISOString() } : {}),
      createdAt: r.createdAt.toISOString(),
      syncedAt: r.syncedAt ? r.syncedAt.toISOString() : null,
    };
  }
}
