import {
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const STATUSES = ['started', 'completed', 'failed'] as const;

export class StartAttemptInput {
  @IsUUID()
  simulationId!: string;

  @IsOptional()
  @IsUUID()
  assignmentId?: string;
}

export class EvaluateAttemptInput {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  teacherComment?: string;

  @IsOptional()
  @IsObject()
  teacherRubric?: Record<string, number>;
}

export class UpdateAttemptInput {
  @IsObject()
  dataJson!: Record<string, unknown>;
}

export class CompleteAttemptInput {
  @IsInt()
  @Min(0)
  @Max(100)
  score!: number;

  @IsObject()
  dataJson!: Record<string, unknown>;
}

export class ListAttemptsQuery {
  @IsOptional()
  @IsUUID()
  studentId?: string;

  @IsOptional()
  @IsUUID()
  simulationId?: string;

  @IsOptional()
  @IsIn(STATUSES as unknown as string[])
  status?: (typeof STATUSES)[number];
}
