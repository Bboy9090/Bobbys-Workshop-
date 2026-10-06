import express from 'express';

const app = express();
app.use(express.json());

app.post('/api/flash/start', (req, res) => {
  res.status(501).json({
    success: false,
    error: 'FLASH_BACKEND_UNAVAILABLE',
    message: 'Legacy flash progress service is disabled. Use the BobFWTools native hardware-qualified executor.',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/flash/jobs', (req, res) => {
  res.json({ jobs: [], source: 'legacy-service-disabled' });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    flashExecutionAvailable: false,
    reason: 'Legacy flash execution disabled by BobFWTools production policy',
    timestamp: new Date().toISOString()
  });
});

const HTTP_PORT = Number(process.env.PORT || 3000);
app.listen(HTTP_PORT, '127.0.0.1', () => {
  console.log(`[BobFWTools] Legacy flash progress compatibility service on 127.0.0.1:${HTTP_PORT}; execution disabled.`);
});
