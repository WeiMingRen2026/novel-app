const express = require('express');
const router = express.Router();
const novelService = require('../services/novelService');

router.get('/', async (req, res) => {
  try {
    const bookshelf = await novelService.getBookshelf();
    res.json({ code: 0, data: bookshelf });
  } catch (error) {
    console.error('获取书架失败:', error);
    res.json({ code: 1, message: error.message });
  }
});

router.post('/add', async (req, res) => {
  try {
    const { novelId } = req.body;
    if (!novelId) {
      return res.json({ code: 1, message: 'novelId不能为空' });
    }
    
    const id = await novelService.addToBookshelf(parseInt(novelId));
    res.json({ code: 0, data: { id } });
  } catch (error) {
    console.error('加入书架失败:', error);
    res.json({ code: 1, message: error.message });
  }
});

router.delete('/:novelId', async (req, res) => {
  try {
    const { novelId } = req.params;
    await novelService.removeFromBookshelf(parseInt(novelId));
    res.json({ code: 0, data: { success: true } });
  } catch (error) {
    console.error('移除书架失败:', error);
    res.json({ code: 1, message: error.message });
  }
});

router.get('/check/:novelId', async (req, res) => {
  try {
    const { novelId } = req.params;
    const inShelf = await novelService.isInBookshelf(parseInt(novelId));
    res.json({ code: 0, data: { inShelf } });
  } catch (error) {
    console.error('检查书架状态失败:', error);
    res.json({ code: 1, message: error.message });
  }
});

router.get('/history', async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const history = await novelService.getReadHistory(parseInt(limit));
    res.json({ code: 0, data: history });
  } catch (error) {
    console.error('获取阅读历史失败:', error);
    res.json({ code: 1, message: error.message });
  }
});

router.post('/progress', async (req, res) => {
  try {
    const { novelId, chapterId, chapterTitle, position } = req.body;
    if (!novelId || !chapterId) {
      return res.json({ code: 1, message: '参数不完整' });
    }
    
    await novelService.updateReadProgress(
      parseInt(novelId), 
      chapterId, 
      chapterTitle || '', 
      position || 0
    );
    res.json({ code: 0, data: { success: true } });
  } catch (error) {
    console.error('更新阅读进度失败:', error);
    res.json({ code: 1, message: error.message });
  }
});

module.exports = router;
