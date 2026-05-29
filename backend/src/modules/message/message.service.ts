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

  async *streamChat(sessionId: bigint, content: string, modelContent?: string): AsyncGenerator<string> {
    const chatOpenAI = this.aiService.getChatOpenAI();
    const graphPrompt = this.aiService.getGraphPrompt();
    const promptContent = modelContent || content;

    await this.create(sessionId, 'user', content);

    const messages = [
      new SystemMessage(graphPrompt),
      new HumanMessage(promptContent),
    ];

    let fullResponse = '';
    for await (const chunk of await chatOpenAI.stream(messages)) {
      const content = chunk.content as string;
      if (content) {
        fullResponse += content;
        yield content;
      }
    }

    await this.create(sessionId, 'ai', this.formatAiMessageForStorage(fullResponse));
  }

  private extractXmlFromContent(content: string): string | null {
    const normalizedContent = content
      .replace(/```(?:xml)?/gi, '')
      .replace(/```/g, '')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&');

    const xmlMatch = normalizedContent.match(/<((?:mxGraphModel|GraphDataModel|mxfile)\b)[\s\S]*?<\/\1>/);
    return xmlMatch ? xmlMatch[0] : null;
  }

  private formatAiMessageForStorage(content: string): string {
    const xml = this.extractXmlFromContent(content);
    if (!xml) return content;

    const textWithoutXml = content
      .replace(/```(?:xml)?/gi, '')
      .replace(/```/g, '')
      .replace(xml, '')
      .trim();

    if (textWithoutXml) return content;

    return `已根据你的要求更新当前页面。\n\n\`\`\`xml\n${xml}\n\`\`\``;
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