import express, { Request, Response } from 'express';
import dotenv from 'dotenv';

// .env dosyasını yükle
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// JSON body'lerini parse etmek için
app.use(express.json());

// Sağlık kontrolü endpoint'i
app.get('/health', (req: Request, res: Response) => {
    res.status(200).json({ status: 'ok', timestamp: new Date() });
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});