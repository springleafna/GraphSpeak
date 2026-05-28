import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { ProjectService } from './project.service';

@Controller('api/projects')
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @Get()
  async findAll() {
    const projects = await this.projectService.findAll();
    return {
      code: 200,
      message: '获取项目列表成功',
      data: projects,
    };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const project = await this.projectService.findOne(BigInt(id));
    return {
      code: 200,
      message: '获取项目成功',
      data: project,
    };
  }

  @Post()
  async create(@Body() body: { name: string }) {
    const project = await this.projectService.create(body.name);
    return {
      code: 200,
      message: '创建项目成功',
      data: project,
    };
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: { name?: string; xml?: string; json?: any }) {
    const project = await this.projectService.update(BigInt(id), body.name, body.xml, body.json);
    return {
      code: 200,
      message: '更新项目成功',
      data: project,
    };
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.projectService.remove(BigInt(id));
    return {
      code: 200,
      message: '删除项目成功',
      data: null,
    };
  }
}