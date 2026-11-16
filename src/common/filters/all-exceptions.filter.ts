import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse();
    const req = ctx.getRequest();
    let status = 500;
    let message: any = 'Internal server error';
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      message = exception.getResponse();
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') { status = 409; message = 'Dữ liệu đã tồn tại'; }
      if (exception.code === 'P2025') { status = 404; message = 'Không tìm thấy dữ liệu'; }
    }
    res.status(status).json({
      statusCode: status, message, path: req.url, timestamp: new Date().toISOString(),
    });
  }
}