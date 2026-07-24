const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');

const novelRoutes = require('./routes/novelRoutes');
const shelfRoutes = require('./routes/shelfRoutes');
const comicRoutes = require('./routes/comicRoutes');
const { initCronJobs } = require('./services/cronService');

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

require('./models/database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.get('/api/health', (req, res) => {
  res.json({ 
    code: 0, 
    data: { 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    } 
  });
});

app.use('/api/novel', novelRoutes);
app.use('/api/shelf', shelfRoutes);
app.use('/api/comic', comicRoutes);

// 提供网页版静态文件
app.use(express.static(path.join(__dirname, '../public')));

// 所有非API请求回退到 index.html（单页应用）
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({ code: 500, message: '服务器内部错误' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n========================================`);
  console.log(`  小说阅读App后端服务已启动`);
  console.log(`  端口: ${PORT}`);
  console.log(`  健康检查: http://localhost:${PORT}/api/health`);
  console.log(`========================================\n`);
  
  initCronJobs();
});
