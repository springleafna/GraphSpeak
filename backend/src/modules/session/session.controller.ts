import { Controller, Get, Post, Delete, Body, Param, Query } from '@nestjs/common';
import { SessionService } from './session.service';

@Controller('api/sessions')
export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

  @Get()
  async findByProjectId(@Query('projectId') projectId: string) {
    if (!projectId) {
      return {
        code: 400,
        message: '项目ID不能为空',
        data: null,
      };
    }
    const sessions = await this.sessionService.findByProjectId(BigInt(projectId));
    return {
      code: 200,
      message: '获取会话列表成功',
      data: sessions,
    };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const session = await this.sessionService.findOne(BigInt(id));
    return {
      code: 200,
      message: '获取会话成功',
      data: session,
    };
  }

  @Post()
  async create(@Body() body: { projectId: string }) {
    const session = await this.sessionService.create(BigInt(body.projectId));
    return {
      code: 200,
      message: '创建会话成功',
      data: session,
    };
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.sessionService.remove(BigInt(id));
    return {
      code: 200,
      message: '删除会话成功',
      data: null,
    };
  }
}