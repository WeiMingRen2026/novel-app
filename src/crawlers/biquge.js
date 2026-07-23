const cheerio = require('cheerio');
const { fetchHTML, cleanText } = require('../utils/request');

const BASE_URL = 'https://www.bqg99.cc';
const SOURCE_NAME = 'biquge';

async function search(keyword, page = 1) {
  try {
    const url = `${BASE_URL}/search.php?q=${encodeURIComponent(keyword)}&p=${page}`;
    const html = await fetchHTML(url, { encoding: 'utf-8' });
    const $ = cheerio.load(html);
    
    const results = [];
    $('.result-item').each((i, el) => {
      const $el = $(el);
      const bookUrl = $el.find('.result-game-item-title-link').attr('href') || '';
      const bookId = bookUrl.match(/\/(\d+)\/?$/)?.[1] || '';
      
      results.push({
        bookId,
        source: SOURCE_NAME,
        title: $el.find('.result-game-item-title-link span').text().trim(),
        author: $el.find('.result-game-item-info-tag span').eq(1).text().trim(),
        cover: $el.find('.result-game-item-pic img').attr('src') || '',
        intro: cleanText($el.find('.result-game-item-desc').text()),
        category: $el.find('.result-game-item-info-tag span').first().text().trim(),
        status: '',
        lastChapter: $el.find('.result-game-item-info-tag a').text().trim(),
      });
    });
    
    if (results.length === 0) {
      $('.so-book').each((i, el) => {
        const $el = $(el);
        const bookUrl = $el.find('h3 a').attr('href') || '';
        const bookId = bookUrl.match(/\/(\d+)\/?$/)?.[1] || '';
        
        results.push({
          bookId,
          source: SOURCE_NAME,
          title: $el.find('h3 a').text().trim(),
          author: $el.find('.search_book_author span').first().text().trim(),
          cover: $el.find('img').attr('src') || '',
          intro: cleanText($el.find('p').text()),
          category: '',
          status: '',
          lastChapter: $el.find('.search_book_author a').text().trim(),
        });
      });
    }
    
    return results;
  } catch (error) {
    console.error('笔趣阁搜索失败:', error.message);
    return [];
  }
}

async function getBookInfo(bookId) {
  try {
    const url = `${BASE_URL}/book/${bookId}/`;
    const html = await fetchHTML(url, { encoding: 'utf-8' });
    const $ = cheerio.load(html);
    
    const info = {
      bookId,
      source: SOURCE_NAME,
      title: $('#info h1').text().trim(),
      author: $('#info p').eq(0).text().replace('作 者：', '').trim(),
      cover: $('#fmimg img').attr('src') || '',
      intro: cleanText($('#intro').text()),
      category: $('.con_top a').eq(1).text().trim(),
      status: $('#info p').eq(2).text().includes('连载') ? '连载中' : '已完结',
      lastChapter: $('#info p').eq(3).text().replace('最新章节：', '').trim(),
      lastUpdateTime: $('#info p').eq(2).text().replace(/.*更新时间：/, '').trim(),
      wordCount: 0,
    };
    
    const chapters = [];
    $('#list dl dd').each((i, el) => {
      const $el = $(el);
      const chapterUrl = $el.find('a').attr('href') || '';
      const chapterId = chapterUrl.replace(`/book/${bookId}/`, '').replace('.html', '');
      
      chapters.push({
        chapterId,
        title: $el.find('a').text().trim(),
        sourceUrl: `${BASE_URL}${chapterUrl}`,
      });
    });
    
    return { info, chapters };
  } catch (error) {
    console.error('笔趣阁获取书籍信息失败:', error.message);
    throw error;
  }
}

async function getChapterContent(bookId, chapterId) {
  try {
    const url = `${BASE_URL}/book/${bookId}/${chapterId}.html`;
    const html = await fetchHTML(url, { encoding: 'utf-8' });
    const $ = cheerio.load(html);
    
    const title = $('.bookname h1').text().trim();
    let content = $('#content').html() || '';
    
    content = content.replace(/<br\s*\/?>/gi, '\n');
    content = content.replace(/<[^>]+>/g, '');
    content = content.replace(/&nbsp;/g, ' ');
    content = cleanText(content);
    
    content = content.replace(/笔趣阁.*?最新章节！/g, '');
    content = content.replace(/www\.bqg\d*\.cc/g, '');
    
    return {
      title,
      content,
      wordCount: content.length,
    };
  } catch (error) {
    console.error('笔趣阁获取章节内容失败:', error.message);
    throw error;
  }
}

async function getCategories() {
  try {
    const html = await fetchHTML(`${BASE_URL}/`, { encoding: 'utf-8' });
    const $ = cheerio.load(html);
    
    const categories = [];
    $('.nav a').each((i, el) => {
      const name = $(el).text().trim();
      const href = $(el).attr('href') || '';
      if (name && href.includes('/list/') || href.includes('/xuanhuan/') || href.includes('/qihuan/')) {
        categories.push({ name, source: SOURCE_NAME });
      }
    });
    
    if (categories.length === 0) {
      const defaultCats = ['玄幻', '奇幻', '武侠', '仙侠', '都市', '现实', '历史', '军事', '游戏', '竞技', '科幻', '灵异', '女生'];
      return defaultCats.map(name => ({ name, source: SOURCE_NAME }));
    }
    
    return categories.slice(0, 15);
  } catch (error) {
    console.error('笔趣阁获取分类失败:', error.message);
    return [];
  }
}

async function getRankings(rankType = 'hot', page = 1) {
  try {
    const rankMap = {
      hot: 'topmonthvisit',
      new: 'topnew',
      total: 'topallvisit',
      vote: 'topgoodnum',
    };
    
    const url = `${BASE_URL}/paihangbang/${rankMap[rankType] || 'topmonthvisit'}/${page}.html`;
    const html = await fetchHTML(url, { encoding: 'utf-8' });
    const $ = cheerio.load(html);
    
    const novels = [];
    $('.rank-list li').each((i, el) => {
      const $el = $(el);
      const bookUrl = $el.find('a').attr('href') || '';
      const bookId = bookUrl.match(/\/(\d+)\/?$/)?.[1] || '';
      
      novels.push({
        rank: i + 1,
        bookId,
        source: SOURCE_NAME,
        title: $el.find('a').text().trim(),
      });
    });
    
    if (novels.length === 0) {
      $('#main li').each((i, el) => {
        const $el = $(el);
        const bookUrl = $el.find('a').attr('href') || '';
        const bookId = bookUrl.match(/\/(\d+)\/?$/)?.[1] || '';
        
        novels.push({
          rank: i + 1,
          bookId,
          source: SOURCE_NAME,
          title: $el.find('a').text().trim(),
        });
      });
    }
    
    return novels;
  } catch (error) {
    console.error('笔趣阁获取排行榜失败:', error.message);
    return [];
  }
}

module.exports = {
  search,
  getBookInfo,
  getChapterContent,
  getCategories,
  getRankings,
  SOURCE_NAME,
};
