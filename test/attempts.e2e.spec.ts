import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuthGuard } from '@nestjs/passport';
import request from 'supertest';
import { AttemptsModule } from '../src/attempts/attempts.module';
import { AttemptsService } from '../src/attempts/attempts.service';
import { PrismaService } from '../src/prisma/prisma.service';

class FakeAuthGuard {
  constructor(private readonly role: string, private readonly userId = '33333333-3333-4333-8333-333333333333') {}
  canActivate(ctx: any) {
    const req = ctx.switchToHttp().getRequest();
    req.user = { userId: this.userId, role: this.role };
    return true;
  }
}

const UUID = '11111111-1111-4111-9111-111111111111';
const sample = () => ({
  id: UUID,
  studentId: '33333333-3333-4333-8333-333333333333',
  simulationId: '22222222-2222-4222-a222-222222222222',
  status: 'started' as const,
  score: null,
  dataJson: {},
  createdAt: '2026-01-01T00:00:00.000Z',
  syncedAt: null,
});

async function buildApp(role: 'admin' | 'teacher' | 'student') {
  const moduleRef = await Test.createTestingModule({
    imports: [AttemptsModule],
  })
    .overrideProvider(PrismaService).useValue({})
    .overrideProvider(AttemptsService).useValue({
      start: jest.fn().mockResolvedValue(sample()),
      updateData: jest.fn().mockResolvedValue(sample()),
      complete: jest.fn().mockResolvedValue({ ...sample(), status: 'completed', score: 80 }),
      findMine: jest.fn().mockResolvedValue([sample()]),
      findAll: jest.fn().mockResolvedValue([sample()]),
      findById: jest.fn().mockResolvedValue(sample()),
    })
    .overrideGuard(AuthGuard('jwt')).useValue(new FakeAuthGuard(role))
    .compile();

  const app: INestApplication = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
  return app;
}

describe('Attempts HTTP (e2e)', () => {
  let app: INestApplication;
  afterEach(async () => { if (app) await app.close(); });

  it('GET /attempts/health — public', async () => {
    app = await buildApp('student');
    await request(app.getHttpServer())
      .get('/attempts/health')
      .expect(200)
      .expect({ status: 'ok', service: 'attempts-service' });
  });

  it('POST /attempts/start — student succeeds', async () => {
    app = await buildApp('student');
    await request(app.getHttpServer())
      .post('/attempts/start')
      .send({ simulationId: '22222222-2222-4222-a222-222222222222' })
      .expect(201);
  });

  it('POST /attempts/start — teacher forbidden', async () => {
    app = await buildApp('teacher');
    await request(app.getHttpServer())
      .post('/attempts/start')
      .send({ simulationId: '22222222-2222-4222-a222-222222222222' })
      .expect(403);
  });

  it('POST /attempts/start — validation rejects non-UUID simulationId', async () => {
    app = await buildApp('student');
    await request(app.getHttpServer())
      .post('/attempts/start')
      .send({ simulationId: 'not-a-uuid' })
      .expect(400);
  });

  it('PATCH /attempts/:id — student updates dataJson', async () => {
    app = await buildApp('student');
    await request(app.getHttpServer())
      .patch(`/attempts/${UUID}`)
      .send({ dataJson: { step1: 'ok' } })
      .expect(200);
  });

  it('POST /attempts/:id/complete — student completes with valid score', async () => {
    app = await buildApp('student');
    await request(app.getHttpServer())
      .post(`/attempts/${UUID}/complete`)
      .send({ score: 80, dataJson: { final: 'ok' } })
      .expect(201);
  });

  it('POST /attempts/:id/complete — validation rejects score > 100', async () => {
    app = await buildApp('student');
    await request(app.getHttpServer())
      .post(`/attempts/${UUID}/complete`)
      .send({ score: 150, dataJson: {} })
      .expect(400);
  });

  it('GET /attempts/mine — any authenticated role returns filtered list', async () => {
    app = await buildApp('student');
    await request(app.getHttpServer()).get('/attempts/mine').expect(200);
  });

  it('GET /attempts — admin succeeds', async () => {
    app = await buildApp('admin');
    await request(app.getHttpServer()).get('/attempts').expect(200);
  });

  it('GET /attempts — teacher succeeds', async () => {
    app = await buildApp('teacher');
    await request(app.getHttpServer()).get('/attempts').expect(200);
  });

  it('GET /attempts — student forbidden', async () => {
    app = await buildApp('student');
    await request(app.getHttpServer()).get('/attempts').expect(403);
  });

  it('GET /attempts?status=bogus — validation 400', async () => {
    app = await buildApp('admin');
    await request(app.getHttpServer()).get('/attempts?status=bogus').expect(400);
  });

  it('GET /attempts/:id — any authenticated role returns detail', async () => {
    app = await buildApp('student');
    await request(app.getHttpServer()).get(`/attempts/${UUID}`).expect(200);
  });

  it('GET /attempts/:id — rejects non-UUID', async () => {
    app = await buildApp('student');
    await request(app.getHttpServer()).get('/attempts/not-a-uuid').expect(400);
  });
});
