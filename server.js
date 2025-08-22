import express from 'express';
import cors from 'cors';
import Busboy from 'busboy';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';
import fs from 'fs';
import os from 'os';
import path from 'path';

// Configuração do FFMPEG
ffmpeg.setFfmpegPath(ffmpegStatic);
ffmpeg.setFfprobePath(ffprobeStatic.path);

// Inicialização do Servidor
const app = express();
const PORT = process.env.PORT || 10000;

// Middlewares
app.use(cors()); // Habilita CORS para permitir que o site no Netlify se comunique com este servidor

// Rota principal para verificar se o servidor está no ar
app.get('/', (req, res) => {
  res.send('Servidor de conversão de vídeo está no ar!');
});

// Rota de conversão
app.post('/convert', (req, res) => {
  const busboy = Busboy({ headers: req.headers });
  let inputFile, outputFile;

  busboy.on('file', (name, file, info) => {
    const { filename } = info;
    inputFile = path.join(os.tmpdir(), `${Date.now()}-${filename}`);
    const writeStream = fs.createWriteStream(inputFile);
    file.pipe(writeStream);
  });

  busboy.on('finish', () => {
    if (!inputFile) {
      return res.status(400).send('Nenhum arquivo enviado.');
    }

    const format = 'mp4'; // O objetivo principal é sempre MP4
    outputFile = path.join(os.tmpdir(), `out-${Date.now()}.${format}`);

    ffmpeg(inputFile)
      .videoCodec('libx264')
      .audioCodec('aac')
      .audioBitrate('128k')
      .outputOptions([
        '-preset veryfast',
        '-profile:v main', // Perfil compatível com WhatsApp
        '-level 3.1',
        '-crf 23',
        '-movflags +faststart',
        '-pix_fmt yuv420p',
        '-bf 0'
      ])
      .output(outputFile)
      .on('end', () => {
        // Envia o arquivo convertido de volta e depois apaga os arquivos temporários
        res.sendFile(outputFile, (err) => {
          fs.unlinkSync(inputFile);

          // Verificamos se outputFile existe antes de tentar deletá-lo
          if (fs.existsSync(outputFile)) {
             fs.unlinkSync(outputFile);
          }
          if (err) {
            console.error('Erro ao enviar arquivo:', err);
          }
        });
      })
      .on('error', (err) => {
        console.error('Erro no FFMPEG:', err.message);
        fs.unlinkSync(inputFile);
        res.status(500).send(`Erro no FFMPEG: ${err.message}`);
      })
      .run();
  });

  req.pipe(busboy);
});

// Inicia o servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});