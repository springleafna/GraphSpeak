import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatOpenAI } from '@langchain/openai';
import { readFile } from 'fs/promises';
import { join } from 'path';

@Injectable()
export class AIService implements OnModuleInit {
  private chatOpenAI: ChatOpenAI;
  private graphPrompt: string = '';
  private sessionPrompt: string = '';

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    await this.loadPrompts();
    this.initOpenAI();
  }

  private async loadPrompts() {
    const graphPromptPath = join(process.cwd(), 'src/assets/prompts/graph.txt');
    const sessionPromptPath = join(process.cwd(), 'src/assets/prompts/session.txt');

    try {
      this.graphPrompt = await readFile(graphPromptPath, 'utf-8');
      this.sessionPrompt = await readFile(sessionPromptPath, 'utf-8');
    } catch (error) {
      console.error('Failed to load prompts:', error);
    }
  }

  private initOpenAI() {
    const deepSeekKey = this.configService.get<string>('DEEPSEEK_API_KEY');
    const deepSeekBaseUrl = this.configService.get<string>('DEEPSEEK_BASE_URL');
    const openAIKey = this.configService.get<string>('OPENAI_API_KEY');

    if (deepSeekKey && deepSeekBaseUrl) {
      this.chatOpenAI = new ChatOpenAI({
        configuration: {
          apiKey: deepSeekKey,
          baseURL: deepSeekBaseUrl,
        },
        model: 'deepseek-chat',
        temperature: 0.7,
        streaming: true,
      });
      console.log('AI Service initialized with: DeepSeek');
    } else if (openAIKey) {
      this.chatOpenAI = new ChatOpenAI({
        openAIApiKey: openAIKey,
        modelName: 'gpt-4o-mini',
        temperature: 0.7,
        streaming: true,
      });
      console.log('AI Service initialized with: OpenAI');
    } else {
      throw new Error('No AI API key configured');
    }
  }

  getGraphPrompt(): string {
    return this.graphPrompt;
  }

  getSessionPrompt(): string {
    return this.sessionPrompt;
  }

  getChatOpenAI(): ChatOpenAI {
    return this.chatOpenAI;
  }
}