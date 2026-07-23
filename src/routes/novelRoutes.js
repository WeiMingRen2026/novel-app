const express = require('express');
const router = express.Router();
const crawlers = require('../crawlers');
const novelService = require('../services/novelService');
const cronService = require('../services/cronService');

router.get('/sources', (req, res) => {
  const sources = crawlers.getAllSources();
  res.json({ code: 0, data: sources });
});

router.get('/search', async (req, res) => {
  try {
    const { keyword, source, page = 1 } = req.query;
    
    if (!keyword) {
      return res.json({ code: 1, message: '关键词不能为空' });
    }
    
    let results;
    if (source && source !== 'all') {
      results = await crawlers.searchBySource(source, keyword, parseInt(page));
    } else {
      results = await crawlers.searchAllSources(keyword, parseInt(page));
    }
    
    res.json({ code: 0, data: results });
  } catch (error) {
    console.error('搜索失败:', error);
    res.json({ code: 1, message: error.message });
  }
});

router.get('/categories', async (req, res) => {
  try {
    const categories = await crawlers.getCategories();
    res.json({ code: 0, data: categories });
  } catch (error) {
    console.error('获取分类失败:', error);
    res.json({ code: 1, message: error.message });
  }
});

router.get('/rankings', async (req, res) => {
  try {
    const { source = 'fanqie', type = 'hot', page = 1 } = req.query;
    const rankings = await crawlers.getRankings(source, type, parseInt(page));
    res.json({ code: 0, data: rankings });
  } catch (error) {
    console.error('获取排行榜失败:', error);
    res.json({ code: 1, message: error.message });
  }
});

router.get('/book/:source/:bookId', async (req, res) => {
  try {
    const { source, bookId } = req.params;
    
    const { info, chapters } = await crawlers.getBookInfo(source, bookId);
    
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
    console.error('获取书籍信息失败:', error);
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
      return res.json({ code: 1, message: '小说不存在' });
    }
    
    const chapter = await novelService.getChapter(parseInt(novelId), chapterId);
    
    if (chapter && chapter.content) {
      res.json({ 
        code: 0, 
        data: {
          title: chapter.title,
          content: chapter.content,
          wordCount: chapter.word_count,
          fromCache: true,
        }
      });
      return;
    }
    
    const contentData = await crawlers.getChapterContent(novel.source, novel.book_id, chapterId);
    
    if (chapter) {
      await novelService.updateChapterContent(parseInt(novelId), chapterId, contentData.content, contentData.wordCount);
    }
    
    cronService.updateChapterComments(parseInt(novelId), chapterId).catch(err => {
      console.error('自动更新段评失败:', err);
    });
    
    res.json({ 
      code: 0, 
      data: {
        ...contentData,
        fromCache: false,
      }
    });
  } catch (error) {
    console.error('获取章节内容失败:', error);
    res.json({ code: 1, message: error.message });
  }
});

router.get('/reviews/:novelId', async (req, res) => {
  try {
    const { novelId } = req.params;
    const { page = 1, pageSize = 20, refresh = false } = req.query;
    
    const novel = await novelService.getNovel(parseInt(novelId));
    if (!novel) {
      return res.json({ code: 1, message: '小说不存在' });
    }
    
    if (refresh === 'true' || refresh === true) {
      await cronService.updateNovelReviews(parseInt(novelId));
    }
    
    const reviews = await novelService.getBookReviews(parseInt(novelId), parseInt(page), parseInt(pageSize));
    const total = await novelService.getBookReviewCount(parseInt(novelId));
    
    res.json({ 
      code: 0, 
      data: {
        list: reviews,
        total,
        page: parseInt(page),
        pageSize: parseInt(pageSize),
      }
    });
  } catch (error) {
    console.error('获取书评失败:', error);
    res.json({ code: 1, message: error.message });
  }
});

router.post('/reviews/:novelId/refresh', async (req, res) => {
  try {
    const { novelId } = req.params;
    const count = await cronService.updateNovelReviews(parseInt(novelId));
    res.json({ code: 0, data: { updated: count } });
  } catch (error) {
    console.error('刷新书评失败:', error);
    res.json({ code: 1, message: error.message });
  }
});

router.get('/paragraph-comments/:novelId/:chapterId', async (req, res) => {
  try {
    const { novelId, chapterId } = req.params;
    const { paragraphIndex, refresh = false } = req.query;
    
    if (refresh === 'true' || refresh === true) {
      await cronService.updateChapterComments(parseInt(novelId), chapterId);
    }
    
    const comments = await novelService.getParagraphComments(
      parseInt(novelId), 
      chapterId,
      paragraphIndex !== undefined ? parseInt(paragraphIndex) : null
    );
    
    res.json({ code: 0, data: comments });
  } catch (error) {
    console.error('获取段评失败:', error);
    res.json({ code: 1, message: error.message });
  }
});

router.post('/paragraph-comments/:novelId/:chapterId/refresh', async (req, res) => {
  try {
    const { novelId, chapterId } = req.params;
    const count = await cronService.updateChapterComments(parseInt(novelId), chapterId);
    res.json({ code: 0, data: { updated: count } });
  } catch (error) {
    console.error('刷新段评失败:', error);
    res.json({ code: 1, message: error.message });
  }
});

module.exports = router;
