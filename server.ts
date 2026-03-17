import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import QRCode from 'qrcode';
import Jimp from 'jimp';
import axios from 'axios';

async function startServer() {
  const app = express();
  app.use(express.json());
  const PORT = 3000;

  // API Route for Telegram Notifications
  app.post("/api/notifications/send", async (req, res) => {
    const { chatId, message } = req.body;
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    if (!botToken) {
      return res.status(500).json({ error: "Telegram bot tokeni sozlanmagan" });
    }

    if (!chatId) {
      return res.status(400).json({ error: "Chat ID kiritilmagan" });
    }

    try {
      const response = await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML'
      });

      res.json({ success: true, data: response.data });
    } catch (error: any) {
      console.error("Telegram notification error:", error.response?.data || error.message);
      res.status(500).json({ error: "Xabar yuborishda xatolik yuz berdi" });
    }
  });

  app.get("/api/bot/info", async (req, res) => {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) return res.status(500).json({ error: "Token not set" });
    
    try {
      const response = await axios.get(`https://api.telegram.org/bot${botToken}/getMe`);
      res.json(response.data);
    } catch (error) {
      res.status(500).json({ error: "Failed to get bot info" });
    }
  });

  // API Route for Student Registration & QR Generation
  app.post("/api/students/register", async (req, res) => {
    try {
      const { name, className, studentId, phone } = req.body;
      const qrData = `${name}|${className}|${studentId}|${phone || ''}`;

      // 1. Generate QR Code as Buffer
      const qrBuffer = await QRCode.toBuffer(qrData, {
        margin: 4,
        width: 400,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      });

      // 2. Load QR into Jimp and add text
      const qrImage = await Jimp.read(qrBuffer);
      
      // Create a canvas with extra space at the bottom for text
      const canvas = new Jimp(400, 520, 0xffffffff);

      // Composite QR onto canvas
      canvas.composite(qrImage, 0, 0);

      // Add text (Name and Class)
      try {
        const font = await Jimp.loadFont(Jimp.FONT_SANS_16_BLACK);
        canvas.print(font, 20, 410, `Ism: ${name}`);
        canvas.print(font, 20, 440, `Sinf: ${className}`);
        canvas.print(font, 20, 470, `ID: ${studentId}`);
      } catch (e) {
        console.error("Font loading error:", e);
      }
      
      const base64Image = await canvas.getBase64Async(Jimp.MIME_PNG);
      
      res.json({ 
        success: true, 
        qrCode: base64Image,
        studentId
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ error: "QR kod yaratishda xatolik" });
    }
  });

  // Vite middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
