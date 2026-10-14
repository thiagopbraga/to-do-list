import { Body, Controller, HttpCode, Param, Post } from '@nestjs/common';
import { ZodPipe } from '../comum/zod.pipe';
import { type Dono, DonoAtual } from '../sessao/dono';
import { AceitaAnonimo } from '../sessao/sessao.guard';
import { type CriarUpload, CriarUploadSchema } from './dto';
import { UploadsService } from './uploads.service';

@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  @AceitaAnonimo()
  @Post()
  criar(@DonoAtual() dono: Dono, @Body(new ZodPipe(CriarUploadSchema)) corpo: CriarUpload) {
    return this.uploads.criar(dono, corpo);
  }

  @AceitaAnonimo()
  @HttpCode(200)
  @Post(':id/concluir')
  concluir(@DonoAtual() dono: Dono, @Param('id') id: string) {
    return this.uploads.concluir(dono, id);
  }
}
