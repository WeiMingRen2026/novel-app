const express = require('express');
const router = express.Router();
const comicCrawler = require('../crawlers/comic');
const novelService = require('../services/novelService');

router.get('/categories', async (req, res) => {
  try {
    const categories = await comicCrawler.getCategories();
    res.json({ code: 0, data: categories });
  } catch (error) {
    console.error('获取漫画分类失败:', error);
    res.json({ code: 1, message: error.message });
  }
});

router.get('/rankings', async (req, res) => {
  try {
    const { type = 'hot', page = 1 } = req.query;
    const rankings = await comicCrawler.getRankings(type, parseInt(page));
    res.json({ code: 0, data: rankings });
  } catch (error) {
    console.error('获取漫画排行榜失败:', error);
    res.json({ code: 1, message: error.message });
  }
});

router.get('/random', async (req, res) => {
  try {
    const { count = 5 } = req.query;
    const comics = await comicCrawler.getRandom(parseInt(count));
    res.json({ code: 0, data: comics });
  } catch (error) {
    console.error('获取随机推荐失败:', error);
    res.json({ code: 1, message: error.message });
  }
});

router.get('/category/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const { page = 1 } = req.query;
    const comics = await comicCrawler.getByCategory(decodeURIComponent(name), parseInt(page));
    res.json({ code: 0, data: comics });
  } catch (error) {
    console.error('获取分类漫画失败:', error);
    res.json({ code: 1, message: error.message });
  }
});

router.get('/search', async (req, res) => {
  try {
    const { keyword, page = 1 } = req.query;
    if (!keyword) {
      return res.json({ code: 1, message: '关键词不能为空' });
    }
    const results = await comicCrawler.search(keyword, parseInt(page));
    res.json({ code: 0, data: results });
  } catch (error) {
    console.error('漫画搜索失败:', error);
    res.json({ code: 1, message: error.message });
  }
});

router.get('/book/:bookId', async (req, res) => {
  try {
    const { bookId } = req.params;
    const { info, chapters } = await comicCrawler.getBookInfo(bookId);
    
    const novelId = await novelService.upsertNovel(info);
    await novelService.saveChapters(novelId, chapters);
    const inShelf = await novelService.isInBookshelf(novelId);
    
    res.json({
      code: 0,
      data: {
        id: novelId,
        ...info,
        inShelf,
        chapters: chapters.slice(0, 100),
        totalChapters: chapters.length,
      }
    });
  } catch (error) {
    console.error('获取漫画详情失败:', error);
    res.json({ code: 1, message: error.message });
  }
});

router.get('/chapters/:novelId', async (req, res) => {
  try {
    const { novelId } = req.params;
    const chapters = await novelService.getChapters(parseInt(novelId));
    res.json({ code: 0, data: chapters });
  } catch (error) {
    console.error('获取章节列表失败:', error);
    res.json({ code: 1, message: error.message });
  }
});

router.get('/content/:novelId/:chapterId', async (req, res) => {
  try {
    const { novelId, chapterId } = req.params;
    const novel = await novelService.getNovel(parseInt(novelId));
    if (!novel) {
      return res.json({ code: 1, message: '漫画不存在' });
    }
    const contentData = await comicCrawler.getChapterContent(novel.book_id, chapterId);
    res.json({ code: 0, data: contentData });
  } catch (error) {
    console.error('获取漫画章节内容失败:', error);
    res.json({ code: 1, message: error.message });
  }
});

module.exports = router;
