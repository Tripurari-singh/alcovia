import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import syncRouter from './syncRouter';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api', syncRouter);

// Mock notification sink (logs n8n payloads)
app.post('/mock-notify', (req, res) => {
  console.log('\n🔔 [MOCK NOTIFY] n8n fired notification:');
  console.log(JSON.stringify(req.body, null, 2));
  res.json({ ok: true, logged: true });
});

app.get('/health', (_req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Alcovia backend running on http://localhost:${PORT}`);
});
