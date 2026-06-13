import type { PaymentRepository } from "../../../application/ports";
import type { PaymentLog } from "../../../domain/entities";
import type { PrismaClient } from "../../../generated/prisma/client";

export class PrismaPaymentRepository implements PaymentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByUserId(userId: string): Promise<PaymentLog[]> {
    const records = await this.prisma.paymentLog.findMany({
      where: {
        userId
      },
      orderBy: {
        paymentDate: 'desc'
      }
    });

    return records.map((record) => ({
      ...record,
      amount: record.amount.toNumber(),
    }));
  }

  async save(payment: PaymentLog): Promise<void> {
    await this.prisma.paymentLog.create({
      data: payment
    });
  }
}