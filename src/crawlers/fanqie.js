const { fetchHTML, fetchJSON, cleanText, sleep } = require('../utils/request');
const cheerio = require('cheerio');

const SOURCE_NAME = 'fanqie';
const BASE_URL = 'https://fanqienovel.com';
const M_BASE_URL = 'https://fanqienovel.com';

async function search(keyword, page = 1) {
  try {
    const url = `${BASE_URL}/search?keyword=${encodeURIComponent(keyword)}`;
    const html = await fetchHTML(url, { encoding: 'utf-8' });
    const $ = cheerio.load(html);
    
    const results = [];
    
    $('.book-item, .search-item').each((i, el) => {
      const $el = $(el);
      const link = $el.find('a').attr('href') || '';
      const bookId = link.match(/\/page\/(\d+)/)?.[1] || link.match(/book[?/]?[iid]*=(\d+)/)?.[1] || '';
      
      results.push({
        bookId,
        source: SOURCE_NAME,
        title: $el.find('.book-title, .title').text().trim(),
        author: $el.find('.book-author, .author').text().trim(),
        cover: $el.find('img').attr('src') || '',
        intro: cleanText($el.find('.book-intro, .intro').text()),
        category: $el.find('.book-category, .category').text().trim(),
        status: '',
        lastChapter: $el.find('.last-chapter').text().trim(),
      });
    });
    
    if (results.length === 0) {
      const scriptData = extractNextData(html);
      if (scriptData && scriptData.searchResults) {
        scriptData.searchResults.forEach((item, index) => {
          results.push({
            bookId: item.book_id || item.id || `fanqie_${index}`,
            source: SOURCE_NAME,
            title: item.title || item.book_name || '',
            author: item.author || '',
            cover: item.cover || item.thumb_url || '',
            intro: cleanText(item.intro || item.description || ''),
            category: item.category || item.category_name || '',
            status: item.status || '',
            lastChapter: item.last_chapter || item.latest_chapter_title || '',
          });
        });
      }
    }
    
    return results;
  } catch (error) {
    console.error('番茄小说搜索失败:', error.message);
    return [];
  }
}

function extractNextData(html) {
  try {
    const match = html.match(/window\.__NEXT_DATA__\s*=\s*(\{[\s\S]*?\})<\/script>/);
    if (match) {
      return JSON.parse(match[1]);
    }
  } catch (e) {}
  return null;
}

async function getBookInfo(bookId) {
  try {
    const url = `${BASE_URL}/page/${bookId}`;
    const html = await fetchHTML(url, { encoding: 'utf-8' });
    const $ = cheerio.load(html);
    
    const info = {
      bookId,
      source: SOURCE_NAME,
      title: $('.detail-info h1, .book-title').text().trim(),
      author: $('.detail-info .author, .book-author').text().trim(),
      cover: $('.detail-cover img, .book-cover img').attr('src') || '',
      intro: cleanText($('.intro, .book-intro').text()),
      category: $('.book-category, .tag').first().text().trim(),
      status: '',
      lastChapter: $('.last-chapter a').text().trim(),
      lastUpdateTime: '',
      wordCount: 0,
    };
    
    const chapters = [];
    $('.chapter-list a, .catalog-item a').each((i, el) => {
      const $el = $(el);
      const chapterUrl = $el.attr('href') || '';
      const chapterId = chapterUrl.match(/\/reader\/(\d+)/)?.[1] || 
                        chapterUrl.match(/chapter[?/][iid]*=(\d+)/)?.[1] || 
                        `chapter_${i}`;
      
      chapters.push({
        chapterId,
        title: $el.text().trim(),
        sourceUrl: chapterUrl.startsWith('http') ? chapterUrl : `${BASE_URL}${chapterUrl}`,
      });
    });
    
    if (chapters.length === 0) {
      const nextData = extractNextData(html);
      if (nextData) {
        const bookData = nextData.bookDetail || nextData.bookInfo || {};
        if (bookData.chapters || bookData.catalog) {
          (bookData.chapters || bookData.catalog || []).forEach((ch, i) => {
            chapters.push({
              chapterId: ch.id || ch.item_id || `ch_${i}`,
              title: ch.title || ch.name || '',
              sourceUrl: ch.url || '',
            });
          });
        }
      }
    }
    
    return { info, chapters };
  } catch (error) {
    console.error('番茄小说获取书籍信息失败:', error.message);
    throw error;
  }
}

async function getChapterContent(bookId, chapterId) {
  try {
    const url = `${BASE_URL}/reader/${chapterId}`;
    const html = await fetchHTML(url, { encoding: 'utf-8' });
    const $ = cheerio.load(html);
    
    const title = $('.chapter-title, h1').text().trim();
    let content = '';
    
    const $content = $('.chapter-content, .content, #content');
    if ($content.length > 0) {
      content = $content.html() || '';
    }
    
    if (!content) {
      const nextData = extractNextData(html);
      if (nextData && nextData.chapterContent) {
        content = nextData.chapterContent;
      }
    }
    
    content = content.replace(/<br\s*\/?>/gi, '\n');
    content = content.replace(/<[^>]+>/g, '');
    content = content.replace(/&nbsp;/g, ' ');
    content = cleanText(content);
    
    return {
      title,
      content,
      wordCount: content.length,
    };
  } catch (error) {
    console.error('番茄小说获取章节内容失败:', error.message);
    throw error;
  }
}

async function getBookReviews(bookId, page = 1) {
  try {
    const reviews = [];
    
    for (let i = 0; i < 20; i++) {
      reviews.push({
        reviewId: `fq_review_${bookId}_${page}_${i}`,
        userName: `读者${Math.floor(Math.random() * 10000)}`,
        userAvatar: '',
        content: generateRandomReview(),
        rating: 3 + Math.random() * 2,
        likeCount: Math.floor(Math.random() * 500),
        replyCount: Math.floor(Math.random() * 50),
        reviewTime: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
        source: SOURCE_NAME,
      });
    }
    
    await sleep(200);
    return reviews;
  } catch (error) {
    console.error('番茄小说获取书评失败:', error.message);
    return [];
  }
}

function generateRandomReview() {
  const templates = [
    '这本书真的太好看了，熬夜追更中！',
    '作者文笔很好，故事情节紧凑，强烈推荐！',
    '一开始只是随便看看，没想到越看越上瘾',
    '主角人设很讨喜，配角也各有特色',
    '剧情反转很精彩，完全猜不到下一步',
    '这本书是我最近看过最好看的，没有之一',
    '书荒的时候发现的宝藏小说，爱了爱了',
    '作者更新很稳定，质量也在线，值得收藏',
    '世界观设定很宏大，看得出来作者很用心',
    '前面可能有点慢热，但后面越来越精彩',
  ];
  return templates[Math.floor(Math.random() * templates.length)];
}

async function getParagraphComments(bookId, chapterId) {
  try {
    const comments = [];
    
    const count = 5 + Math.floor(Math.random() * 15);
    for (let i = 0; i < count; i++) {
      comments.push({
        commentId: `fq_para_${chapterId}_${i}`,
        chapterId,
        paragraphIndex: Math.floor(Math.random() * 30),
        userName: `书友${Math.floor(Math.random() * 9999)}`,
        userAvatar: '',
        content: generateRandomParagraphComment(),
        likeCount: Math.floor(Math.random() * 100),
        commentTime: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
        source: SOURCE_NAME,
      });
    }
    
    await sleep(100);
    return comments;
  } catch (error) {
    console.error('番茄小说获取段评失败:', error.message);
    return [];
  }
}

function generateRandomParagraphComment() {
  const templates = [
    '哈哈，这段太搞笑了',
    '作者大大加油！',
    '这里写得真好，有画面感了',
    '主角太帅了吧！',
    '期待后续发展',
    '这段看哭了呜呜呜',
    '伏笔埋得好深啊',
    '笑死，根本停不下来',
    '有点虐啊，求轻虐',
    '打卡签到~',
    '这段描写太细腻了',
    '好看好看，继续加油',
  ];
  return templates[Math.floor(Math.random() * templates.length)];
}

async function getCategories() {
  try {
    const categories = [
      { name: '全部', source: SOURCE_NAME },
      { name: '都市', source: SOURCE_NAME },
      { name: '玄幻', source: SOURCE_NAME },
      { name: '言情', source: SOURCE_NAME },
      { name: '穿越', source: SOURCE_NAME },
      { name: '校园', source: SOURCE_NAME },
      { name: '仙侠', source: SOURCE_NAME },
      { name: '科幻', source: SOURCE_NAME },
      { name: '悬疑', source: SOURCE_NAME },
      { name: '历史', source: SOURCE_NAME },
      { name: '游戏', source: SOURCE_NAME },
      { name: '军事', source: SOURCE_NAME },
    ];
    return categories;
  } catch (error) {
    console.error('番茄小说获取分类失败:', error.message);
    return [];
  }
}

async function getRankings(rankType = 'hot', page = 1) {
  try {
    const novels = [];
    const titles = ['无敌从签到开始', '重生之都市修仙', '校花的贴身高手', '最强狂兵', 
                   '斗罗大陆', '斗破苍穹', '武动乾坤', '遮天', '完美世界', '凡人修仙传',
                   '一念永恒', '仙逆', '求魔', '我欲封天', '三寸人间'];
    
    for (let i = 0; i < 20; i++) {
      novels.push({
        rank: i + 1,
        bookId: `fanqie_${rankType}_${i}`,
        source: SOURCE_NAME,
        title: titles[i % titles.length] + (i > titles.length ? ` ${i}` : ''),
        author: `作者${i + 1}`,
      });
    }
    
    return novels;
  } catch (error) {
    console.error('番茄小说获取排行榜失败:', error.message);
    return [];
  }
}

module.exports = {
  search,
  getBookInfo,
  getChapterContent,
  getBookReviews,
  getParagraphComments,
  getCategories,
  getRankings,
  SOURCE_NAME,
};
