import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Message } from '@prisma/client';
import { AIService } from '../ai/ai.service';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

@Injectable()
export class MessageService {
  constructor(
    private prisma: PrismaService,
    private aiService: AIService,
  ) {}

  async findBySessionId(sessionId: bigint): Promise<Message[]> {
    return this.prisma.message.findMany({
      where: {
        sessionId,
        deletedAt: null,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(sessionId: bigint, role: string, content: string): Promise<Message> {
    return this.prisma.message.create({
      data: { sessionId, role, content },
    });
  }

  async countBySessionId(sessionId: bigint): Promise<number> {
    return this.prisma.message.count({
      where: {
        sessionId,
        deletedAt: null,
      },
    });
  }

  async *streamChat(sessionId: bigint, content: string): AsyncGenerator<string> {
    const chatOpenAI = this.aiService.getChatOpenAI();
    const graphPrompt = this.aiService.getGraphPrompt();
    const sessionPrompt = this.aiService.getSessionPrompt();

    await this.create(sessionId, 'user', content);

    const messages = [
      new SystemMessage(graphPrompt),
      new HumanMessage(content),
    ];

    let fullResponse = '';
    for await (const chunk of await chatOpenAI.stream(messages)) {
      const content = chunk.content as string;
      if (content) {
        fullResponse += content;
        yield content;
      }
    }

    await this.create(sessionId, 'ai', fullResponse);
  }

  async generateSessionName(sessionId: bigint, firstMessage: string): Promise<void> {
    const chatOpenAI = this.aiService.getChatOpenAI();
    const sessionPrompt = this.aiService.getSessionPrompt();

    const messages = [
      new SystemMessage(sessionPrompt),
      new HumanMessage(firstMessage),
    ];

    let fullResponse = '';
    for await (const chunk of await chatOpenAI.stream(messages)) {
      const content = chunk.content as string;
      if (content) {
        fullResponse += content;
      }
    }

    const name = fullResponse.trim().substring(0, 10);
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { name },
    });
  }
}