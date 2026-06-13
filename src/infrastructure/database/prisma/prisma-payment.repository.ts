import { FindPaymentsQuery, PaymentsSearchResult } from '../../../application/dtos';
import type { PaymentRepository } from '../../../application/ports';
import type { PaymentLog } from '../../../domain/entities';
import type { PrismaClient } from '../../../generated/prisma/client';

export class PrismaPaymentRepository implements PaymentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByUserId(userId: string): Promise<PaymentLog[]> {
    const paymentLogs = await this.prisma.paymentLog.findMany({
      where: {
        userId,
      },
      orderBy: {
        paymentDate: 'desc',
      },
    });

    return paymentLogs.map((paymentLog) => ({
      ...paymentLog,
      amount: paymentLog.amount.toNumber(),
    }));
  }

  async findAll({ page, limit }: FindPaymentsQuery): Promise<PaymentsSearchResult> {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.paymentLog.findMany({
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.paymentLog.count()
    ]);
    
    return {
      items: items.map((paymentLog) => ({
        ...paymentLog,
        amount: paymentLog.amount.toNumber(),
      })),
      total
    }
  }

  async save(payment: PaymentLog): Promise<void> {
    await this.prisma.paymentLog.create({
      data: payment,
    });
  }
}
