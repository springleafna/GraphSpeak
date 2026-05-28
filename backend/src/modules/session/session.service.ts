import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Session } from '@prisma/client';

@Injectable()
export class SessionService {
  constructor(private prisma: PrismaService) {}

  async findByProjectId(projectId: bigint): Promise<Session[]> {
    return this.prisma.session.findMany({
      where: {
        projectId,
        deletedAt: null,
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findOne(id: bigint): Promise<Session> {
    const session = await this.prisma.session.findUnique({
      where: { id },
      include: {
        messages: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!session) {
      throw new NotFoundException('会话不存在');
    }

    return session;
  }

  async create(projectId: bigint): Promise<Session> {
    return this.prisma.session.create({
      data: { projectId },
    });
  }

  async updateName(id: bigint, name: string): Promise<Session> {
    return this.prisma.session.update({
      where: { id },
      data: { name },
    });
  }

  async remove(id: bigint): Promise<void> {
    await this.prisma.session.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}