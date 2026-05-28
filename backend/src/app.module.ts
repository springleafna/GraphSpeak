import { Module } from '@nestjs/common';
import { ProjectModule } from './modules/project/project.module';
import { SessionModule } from './modules/session/session.module';
import { MessageModule } from './modules/message/message.module';
import { AIModule } from './modules/ai/ai.module';
import { PrismaModule } from './common/prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    AIModule,
    ProjectModule,
    SessionModule,
    MessageModule,
  ],
})
export class AppModule {}