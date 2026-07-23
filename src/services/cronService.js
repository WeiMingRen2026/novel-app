const cron = require('node-cron');
const novelService = require('./novelService');
const crawlers = require('../crawlers');

let isRunning = false;

async function updateBookshelfReviews() {
  if (isRunning) {
    console.log('[定时任务] 书评更新正在进行中，跳过本次执行');
    return;
  }
  
  isRunning = true;
  console.log('[定时任务] 开始更新书架小说书评...');
  
  try {
    const bookshelf = novelService.getBookshelf();
    console.log(`[定时任务] 书架共${bookshelf.length}本小说需要更新书评`);
    
    for (const book of bookshelf) {
      try {
        console.log(`[定时任务] 正在更新: ${book.title}`);
        
        const reviews = await crawlers.getBookReviews(book.source, book.book_id, 1);
        if (reviews.length > 0) {
          novelService.saveBookReviews(book.id, reviews);
          console.log(`[定时任务] ${book.title} - 更新了${reviews.length}条书评`);
        }
        
        await sleep(1000);
      } catch (error) {
        console.error(`[定时任务] 更新书评失败 ${book.title}:`, error.message);
      }
    }
    
    console.log('[定时任务] 书架书评更新完成');
  } catch (error) {
    console.error('[定时任务] 书评更新任务异常:', error);
  } finally {
    isRunning = false;
  }
}

async function updateParagraphComments() {
  if (isRunning) {
    console.log('[定时任务] 段评更新正在进行中，跳过本次执行');
    return;
  }
  
  isRunning = true;
  console.log('[定时任务] 开始更新最近阅读的段评...');
  
  try {
    const history = novelService.getReadHistory(20);
    console.log(`[定时任务] 共${history.length}条阅读记录`);
    
    const processed = new Set();
    
    for (const record of history) {
      const key = `${record.novel_id}_${record.chapter_id}`;
      if (processed.has(key)) continue;
      processed.add(key);
      
      try {
        const comments = await crawlers.getParagraphComments(
          record.source, 
          record.book_id, 
          record.chapter_id
        );
        
        if (comments.length > 0) {
          novelService.saveParagraphComments(record.novel_id, record.chapter_id, comments);
          console.log(`[定时任务] 章节${record.chapter_title} - 更新了${comments.length}条段评`);
        }
        
        await sleep(800);
      } catch (error) {
        console.error(`[定时任务] 更新段评失败 ${record.chapter_title}:`, error.message);
      }
    }
    
    console.log('[定时任务] 段评更新完成');
  } catch (error) {
    console.error('[定时任务] 段评更新任务异常:', error);
  } finally {
    isRunning = false;
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function initCronJobs() {
  console.log('[定时任务] 初始化定时任务...');
  
  cron.schedule('0 */2 * * *', () => {
    console.log('[定时任务] 触发：每2小时更新书架书评');
    updateBookshelfReviews();
  });
  
  cron.schedule('30 */3 * * *', () => {
    console.log('[定时任务] 触发：每3小时更新段评');
    updateParagraphComments();
  });
  
  console.log('[定时任务] 定时任务已启动');
  console.log('[定时任务] - 每2小时更新书架书评');
  console.log('[定时任务] - 每3小时更新阅读章节段评');
}

async function updateNovelReviews(novelId) {
  try {
    const novel = novelService.getNovel(novelId);
    if (!novel) return;
    
    const reviews = await crawlers.getBookReviews(novel.source, novel.book_id, 1);
    if (reviews.length > 0) {
      novelService.saveBookReviews(novelId, reviews);
    }
    return reviews.length;
  } catch (error) {
    console.error('更新小说书评失败:', error);
    return 0;
  }
}

async function updateChapterComments(novelId, chapterId) {
  try {
    const novel = novelService.getNovel(novelId);
    if (!novel) return;
    
    const comments = await crawlers.getParagraphComments(novel.source, novel.book_id, chapterId);
    if (comments.length > 0) {
      novelService.saveParagraphComments(novelId, chapterId, comments);
    }
    return comments.length;
  } catch (error) {
    console.error('更新章节段评失败:', error);
    return 0;
  }
}

module.exports = {
  initCronJobs,
  updateBookshelfReviews,
  updateParagraphComments,
  updateNovelReviews,
  updateChapterComments,
};
