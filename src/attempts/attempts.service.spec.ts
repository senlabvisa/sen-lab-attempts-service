import { Test } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AttemptsService } from './attempts.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AttemptsService', () => {
  let service: AttemptsService;
  const prismaMock = {
    attempt: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [AttemptsService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();
    service = module.get(AttemptsService);
  });

  const row = (over: Partial<Record<string, unknown>> = {}) => ({
    id: 'a1',
    studentId: 'stu1',
    simulationId: 'sim1',
    assignmentId: null,
    status: 'started',
    score: null,
    dataJson: {},
    teacherComment: null,
    teacherRubric: null,
    publishedAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    syncedAt: null,
    ...over,
  });

  describe('start', () => {
    it('creates an attempt with status=started and current student as owner', async () => {
      prismaMock.attempt.create.mockResolvedValueOnce(row());
      const dto = await service.start('stu1', { simulationId: 'sim1' });
      expect(prismaMock.attempt.create).toHaveBeenCalledWith({
        data: {
          studentId: 'stu1',
          simulationId: 'sim1',
          status: 'started',
          dataJson: {},
        },
      });
      expect(dto.status).toBe('started');
      expect(dto.score).toBeNull();
      expect(dto.dataJson).toEqual({});
      expect(dto.syncedAt).toBeNull();
    });
  });

  describe('updateData', () => {
    it('merges dataJson into a started attempt owned by student', async () => {
      prismaMock.attempt.findUnique.mockResolvedValueOnce(row({ dataJson: { step1: 'done' } }));
      prismaMock.attempt.update.mockResolvedValueOnce(row({ dataJson: { step1: 'done', step2: 'ok' } }));
      const dto = await service.updateData('a1', 'stu1', { step2: 'ok' });
      expect(prismaMock.attempt.update).toHaveBeenCalledWith({
        where: { id: 'a1' },
        data: { dataJson: { step1: 'done', step2: 'ok' } },
      });
      expect(dto.dataJson).toEqual({ step1: 'done', step2: 'ok' });
    });

    it('throws NotFoundException when attempt missing', async () => {
      prismaMock.attempt.findUnique.mockResolvedValueOnce(null);
      await expect(service.updateData('ghost', 'stu1', {})).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ForbiddenException when student does not own the attempt', async () => {
      prismaMock.attempt.findUnique.mockResolvedValueOnce(row({ studentId: 'other' }));
      await expect(service.updateData('a1', 'stu1', {})).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws BadRequestException when attempt not started (already completed)', async () => {
      prismaMock.attempt.findUnique.mockResolvedValueOnce(row({ status: 'completed' }));
      await expect(service.updateData('a1', 'stu1', {})).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('complete', () => {
    it('sets status=completed, score, dataJson, syncedAt=now', async () => {
      const before = Date.now();
      prismaMock.attempt.findUnique.mockResolvedValueOnce(row());
      prismaMock.attempt.update.mockImplementationOnce(async ({ data }) =>
        row({ ...data, score: data.score, dataJson: data.dataJson, status: 'completed', syncedAt: data.syncedAt }),
      );
      const dto = await service.complete('a1', 'stu1', { score: 85, dataJson: { final: 'ok' } });
      const call = prismaMock.attempt.update.mock.calls[0][0];
      expect(call.where).toEqual({ id: 'a1' });
      expect(call.data.status).toBe('completed');
      expect(call.data.score).toBe(85);
      expect(call.data.dataJson).toEqual({ final: 'ok' });
      expect(call.data.syncedAt).toBeInstanceOf(Date);
      expect((call.data.syncedAt as Date).getTime()).toBeGreaterThanOrEqual(before);
      expect(dto.status).toBe('completed');
      expect(dto.score).toBe(85);
    });

    it('throws ForbiddenException when student does not own it', async () => {
      prismaMock.attempt.findUnique.mockResolvedValueOnce(row({ studentId: 'other' }));
      await expect(
        service.complete('a1', 'stu1', { score: 10, dataJson: {} }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws BadRequestException when not started', async () => {
      prismaMock.attempt.findUnique.mockResolvedValueOnce(row({ status: 'completed' }));
      await expect(
        service.complete('a1', 'stu1', { score: 10, dataJson: {} }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('clamps score to [0,100] (rejects 150 without touching DB)', async () => {
      await expect(
        service.complete('a1', 'stu1', { score: 150, dataJson: {} }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prismaMock.attempt.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('findMine', () => {
    it('returns own attempts filtered by studentId', async () => {
      prismaMock.attempt.findMany.mockResolvedValueOnce([row()]);
      const list = await service.findMine('stu1');
      expect(prismaMock.attempt.findMany).toHaveBeenCalledWith({
        where: { studentId: 'stu1' },
        orderBy: { createdAt: 'desc' },
      });
      expect(list).toHaveLength(1);
    });
  });

  describe('findAll (admin/teacher)', () => {
    it('lists all when no filter', async () => {
      prismaMock.attempt.findMany.mockResolvedValueOnce([row(), row({ id: 'a2' })]);
      const list = await service.findAll();
      expect(prismaMock.attempt.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
      });
      expect(list).toHaveLength(2);
    });

    it('applies studentId/simulationId/status filters', async () => {
      prismaMock.attempt.findMany.mockResolvedValueOnce([]);
      await service.findAll({ studentId: 'stu1', simulationId: 'sim1', status: 'completed' });
      expect(prismaMock.attempt.findMany).toHaveBeenCalledWith({
        where: { studentId: 'stu1', simulationId: 'sim1', status: 'completed' },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('findById', () => {
    it('returns when found', async () => {
      prismaMock.attempt.findUnique.mockResolvedValueOnce(row());
      const dto = await service.findById('a1');
      expect(dto.id).toBe('a1');
    });

    it('throws NotFoundException when missing', async () => {
      prismaMock.attempt.findUnique.mockResolvedValueOnce(null);
      await expect(service.findById('nope')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('evaluate (teacher rubric + comment)', () => {
    it('updates teacherComment and teacherRubric', async () => {
      prismaMock.attempt.update.mockResolvedValueOnce(
        row({
          teacherComment: 'Bien analysé',
          teacherRubric: { demarche: 4, calculs: 3 },
          status: 'completed',
        }),
      );
      const dto = await service.evaluate('a1', {
        teacherComment: 'Bien analysé',
        teacherRubric: { demarche: 4, calculs: 3 },
      });
      const call = prismaMock.attempt.update.mock.calls[0][0];
      expect(call.where).toEqual({ id: 'a1' });
      expect(call.data.teacherComment).toBe('Bien analysé');
      expect(call.data.teacherRubric).toEqual({ demarche: 4, calculs: 3 });
      expect(dto.teacherComment).toBe('Bien analysé');
      expect(dto.teacherRubric).toEqual({ demarche: 4, calculs: 3 });
    });

    it('throws NotFoundException when attempt missing (P2025)', async () => {
      prismaMock.attempt.update.mockRejectedValueOnce(
        Object.assign(new Error('gone'), { code: 'P2025' }),
      );
      await expect(service.evaluate('ghost', { teacherComment: 'x' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('publish', () => {
    it('sets publishedAt to now', async () => {
      const publishedDate = new Date('2026-04-25T10:00:00Z');
      prismaMock.attempt.update.mockResolvedValueOnce(row({ publishedAt: publishedDate }));
      const dto = await service.publish('a1');
      const call = prismaMock.attempt.update.mock.calls[0][0];
      expect(call.where).toEqual({ id: 'a1' });
      expect(call.data.publishedAt).toBeInstanceOf(Date);
      expect(dto.publishedAt).toBe('2026-04-25T10:00:00.000Z');
    });

    it('throws NotFoundException when attempt missing (P2025)', async () => {
      prismaMock.attempt.update.mockRejectedValueOnce(
        Object.assign(new Error('gone'), { code: 'P2025' }),
      );
      await expect(service.publish('ghost')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
