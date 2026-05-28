import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Project } from '@prisma/client';

@Injectable()
export class ProjectService {
  constructor(private prisma: PrismaService) {}

  async findAll(): Promise<Project[]> {
    return this.prisma.project.findMany({
      where: { deletedAt: null },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findOne(id: bigint): Promise<Project> {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        sessions: {
          where: { deletedAt: null },
          orderBy: { updatedAt: 'desc' },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('项目不存在');
    }

    return project;
  }

  async create(name: string): Promise<Project> {
    return this.prisma.project.create({
      data: { name },
    });
  }

  async update(id: bigint, name?: string, xml?: string, json?: any): Promise<Project> {
    return this.prisma.project.update({
      where: { id },
      data: { name, xml, json },
    });
  }

  async remove(id: bigint): Promise<void> {
    await this.prisma.project.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}