import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

let cachedVoiceWav: Buffer | null = null;
let inFlightVoicePromise: Promise<Buffer> | null = null;

async function generateCommercialVoiceAlert(): Promise<Buffer> {
  if (cachedVoiceWav) {
    return cachedVoiceWav;
  }
  if (inFlightVoicePromise) {
    return inFlightVoicePromise;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY não configurada no servidor.');
  }

  inFlightVoicePromise = (async () => {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash-lite-tts',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: 'Pedido online!',
              speechMetadata: {
                style:
                  'Voz feminina brasileira jovem, locutora de comercial alegre, carismática, clara, envolvente e profissional em português do Brasil (pt-BR)',
              },
            },
          ],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    const base64Audio =
      response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!base64Audio) {
      throw new Error('O modelo TTS não retornou dados de áudio.');
    }

    const wavBuffer = Buffer.from(base64Audio, 'base64');
    cachedVoiceWav = wavBuffer;
    return wavBuffer;
  })();

  try {
    return await inFlightVoicePromise;
  } finally {
    inFlightVoicePromise = null;
  }
}

async function startServer() {
  const app = express();

  app.get('/api/voice-alert', async (_req, res) => {
    try {
      const wavBuffer = await generateCommercialVoiceAlert();
      res.setHeader('Content-Type', 'audio/wav');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.status(200).send(wavBuffer);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Erro ao gerar alerta de voz.';
      console.error('Erro em /api/voice-alert:', message);
      res.status(500).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor rodando na porta ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Falha ao iniciar servidor:', err);
  process.exit(1);
});
