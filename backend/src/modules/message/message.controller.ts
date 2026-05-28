import { Controller, Get, Post, Query, Body, Res, HttpCode } from '@nestjs/common';
import { MessageService } from './message.service';
import type { Response } from 'express';

@Controller('api/messages')
export class MessageController {
  constructor(private readonly messageService: MessageService) {}

  @Get()
  async findBySessionId(@Query('sessionId') sessionId: string) {
    if (!sessionId) {
      return {
        code: 400,
        message: '会话ID不能为空',
        data: null,
      };
    }
    const messages = await this.messageService.findBySessionId(BigInt(sessionId));
    return {
      code: 200,
      message: '获取消息列表成功',
      data: messages,
    };
  }

  @Post('stream')
  @HttpCode(200)
  async stream(
    @Body() body: { sessionId: string; content: string },
    @Res() res: Response,
  ) {
    const { sessionId, content } = body;
    const id = BigInt(sessionId);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const messageCount = await this.messageService.countBySessionId(id);
    const isFirstMessage = messageCount === 0;

    try {
      const stream = this.messageService.streamChat(id, content);

      let fullResponse = '';
      for await (const chunk of stream) {
        fullResponse += chunk;
        res.write(`data: ${JSON.stringify({ type: 'content', content: chunk })}\n\n`);
      }

      res.write(`data: ${JSON.stringify({ type: 'end' })}\n\n`);

      if (isFirstMessage) {
        this.messageService.generateSessionName(id, content).catch(console.error);
      }

      res.end();
    } catch (error) {
      console.error('Stream error:', error);
      res.write(`data: ${JSON.stringify({ type: 'error', message: '服务器错误' })}\n\n`);
      res.end();
    }
  }
}