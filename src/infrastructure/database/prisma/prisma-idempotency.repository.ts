import type { ClaimIdempotencyInput, ClaimIdempotencyResult } from '../../../application/dtos';
import type { IdempotencyRepository } from '../../../application/ports';
import type { PrismaClient } from '../../../generated/prisma/client.js';
import { Prisma } from '../../../generated/prisma/client.js';

export class PrismaIdempotencyRepository implements IdempotencyRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async claim(input: ClaimIdempotencyInput): Promise<ClaimIdempotencyResult> {
    try {
      const record = await this.prisma.idempotencyKey.create({
        data: {
          ...input,
          status: 'PROCESSING',
        },
      });

      return {
        outcome: 'CLAIMED',
        record,
      };
    } catch (error) {
      if (!this.isUniqueConstraintError(error)) {
        throw error;
      }

      return this.findExistingRecord(input);
    }
  }

  async markFailed(id: string): Promise<void> {
    await this.prisma.idempotencyKey.update({
      where: { id },
      data: { status: 'FAILED' },
    });
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
  }

  private async findExistingRecord(input: ClaimIdempotencyInput): Promise<ClaimIdempotencyResult> {
    const existingRecord = await this.prisma.idempotencyKey.findUniqueOrThrow({
      where: {
        userId_operation_key: {
          userId: input.userId,
          operation: input.operation,
          key: input.key,
        },
      },
    });

    if (existingRecord.requestHash !== input.requestHash) {
      return {
        outcome: 'PAYLOAD_MISMATCH',
      };
    }

    if (existingRecord.status === 'COMPLETED' && existingRecord.responseStatus !== null) {
      return {
        outcome: 'REPLAY',
        responseStatus: existingRecord.responseStatus,
        responseBody: existingRecord.responseBody,
      };
    }

    const reclaimResult = await this.prisma.idempotencyKey.updateMany({
      where: {
        id: existingRecord.id,
        requestHash: input.requestHash,
        OR: [
          { status: 'FAILED' },
          { 
            status: 'PROCESSING',
            expiresAt: { lte: new Date() }
          }
        ]
      },
      data: {
        status: 'PROCESSING',
        expiresAt: input.expiresAt,
        responseStatus: null,
        responseBody: Prisma.DbNull,
        resourceId: null
      }
    });

    if(reclaimResult.count === 1) {
      const reclaimed = await this.prisma.idempotencyKey.findUniqueOrThrow({
        where: { id: existingRecord.id }
      });

      return {
        outcome: 'CLAIMED',
        record: reclaimed
      };
    }

    return {
      outcome: 'IN_PROGRESS',
    };
  }
}
