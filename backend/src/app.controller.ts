import { Controller, Get } from '@nestjs/common';

@Controller('api')
export class AppController {
  // Development-only connectivity check. Required API endpoints follow in later commits.
  @Get('health')
  health(): { status: string } {
    return { status: 'ok' };
  }
}
