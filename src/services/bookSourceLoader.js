const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const { fetchHTML, cleanText } = require('../utils/request');

const dataDir = path.join(__dirname, '../../data');

function loadBookSources() {
  const filePath = path.join(dataDir, 'bookSource.json');
  if (!fs.existsSync(filePath)) {
    console.log('[书源] bookSource.json 不存在，跳过加载');
    return {};
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const sources = JSON.parse(raw);
    if (!Array.isArray(sources)) {
      console.log('[书源] bookSource.json 格式不正确（应该是数组）');
      return {};
    }

    const dynamicSources = {};
    sources.forEach((src, idx) => {
      if (!src.bookSourceName || !src.bookSourceUrl) return;

      const key = `dynamic_${idx}`;
      const name = src.bookSourceName || `书源${idx + 1}`;
      const baseUrl = src.bookSourceUrl || '';

      console.log(`[书源] 加载: ${name} (${baseUrl})`);

      dynamicSources[key] = createDynamicCrawler(key, name, baseUrl, src);
    });

    console.log(`[书源] 共加载 ${Object.keys(dynamicSources).length} 个自定义书源`);
    return dynamicSources;
  } catch (error) {
    console.error('[书源] 加载失败:', error.message);
    return {};
  }
}

function createDynamicCrawler(key, name, baseUrl, config) {
  const searchUrl = config.searchUrl || '';
  const bookInfoUrl = config.bookInfoUrl || '';
  const chapterListUrl = config.chapterListUrl || '';
  const chapterContentUrl = config.chapterContentUrl || '';

  async function search(keyword, page = 1) {
    try {
      if (!searchUrl) return [];
      let url = searchUrl
        .replace('{keyword}', encodeURIComponent(keyword))
        .replace('{page}', page)
        .replace('{host}', baseUrl);
      if (!url.startsWith('http')) url = baseUrl + url;

      const html = await fetchHTML(url, { encoding: 'utf-8' });
      const $ = cheerio.load(html);
      const results = [];

      const searchSelector = config.searchSelect || '.result-item, .book-item, li';
      $(searchSelector).each((i, el) => {
        const $el = $(el);
        const bookUrl = $el.find('a').attr('href') || $el.attr('href') || '';
        const title = $el.find('a, .title, h3').first().text().trim() || $el.text().trim().split(/\s+/)[0] || '未知';
        const author = $el.find('.author, span').first().text().trim() || '';

        if (title && title.length > 0) {
          results.push({
            bookId: bookUrl || (key + '_' + i),
            source: key,
            title,
            author,
            cover: '📖',
            intro: '',
            category: '',
            status: '',
            lastChapter: '',
          });
        }
      });

      if (results.length === 0) {
        results.push({
          bookId: key + '_' + Date.now(),
          source: key,
          title: keyword + ' - ' + name,
          author: '未知',
          cover: '📖',
          intro: `来自${name}的搜索结果`,
          category: '',
          status: '连载中',
          lastChapter: '',
        });
      }

      return results;
    } catch (error) {
      console.error(`${name}搜索失败:`, error.message);
      return [{
        bookId: key + '_' + Date.now(),
        source: key,
        title: keyword,
        author: '未知',
        cover: '📖',
        intro: `来自${name}`,
        category: '',
        status: '连载中',
        lastChapter: '',
      }];
    }
  }

  async function getBookInfo(bookId) {
    try {
      if (!bookInfoUrl) {
        return {
          info: {
            bookId,
            source: key,
            title: `书籍${bookId}`,
            author: '未知',
            cover: '📖',
            intro: `来自${name}的书籍详情`,
            category: '',
            status: '连载中',
            lastChapter: '',
          },
          chapters: [],
        };
      }

      let url = bookInfoUrl
        .replace('{bookId}', bookId)
        .replace('{host}', baseUrl);
      if (!url.startsWith('http')) url = baseUrl + url;

      const html = await fetchHTML(url, { encoding: 'utf-8' });
      const $ = cheerio.load(html);

      const title = $('h1, .book-title, .info h1').first().text().trim() || `书籍${bookId}`;
      const author = $('.author, p').first().text().replace(/作\s*者[：:]/, '').trim() || '未知';
      const intro = cleanText($('#intro, .intro, .desc').text()) || `来自${name}`;
      const category = $('.con_top a, .crumb a').eq(1).text().trim() || '';

      const chapters = [];
      const chapterSelector = config.chapterSelect || '#list dl dd, .chapter-list li, .catalog li, dd';
      $(chapterSelector).each((i, el) => {
        const $el = $(el);
        const chapterUrl = $el.find('a').attr('href') || '';
        const chapterTitle = $el.find('a').text().trim() || `第${i + 1}章`;
        chapters.push({
          chapterId: chapterUrl || ('ch_' + i),
          title: chapterTitle,
          sourceUrl: chapterUrl ? (chapterUrl.startsWith('http') ? chapterUrl : baseUrl + chapterUrl) : '',
        });
      });

      if (chapters.length === 0) {
        for (let i = 1; i <= 50; i++) {
          chapters.push({
            chapterId: 'ch_' + i,
            title: '第' + i + '章',
            sourceUrl: '',
          });
        }
      }

      return {
        info: {
          bookId,
          source: key,
          title,
          author,
          cover: '📖',
          intro,
          category,
          status: '连载中',
          lastChapter: chapters[chapters.length - 1]?.title || '',
          totalChapters: chapters.length,
        },
        chapters,
      };
    } catch (error) {
      console.error(`${name}获取详情失败:`, error.message);
      return {
        info: {
          bookId,
          source: key,
          title: `书籍${bookId}`,
          author: '未知',
          cover: '📖',
          intro: `来自${name}`,
          category: '',
          status: '连载中',
          lastChapter: '',
        },
        chapters: [],
      };
    }
  }

  async function getChapterContent(bookId, chapterId) {
    try {
      if (!chapterContentUrl) {
        return { title: chapterId, content: '此章节来自' + name + '，暂不支持在线阅读。', wordCount: 50 };
      }

      let url = chapterContentUrl
        .replace('{bookId}', bookId)
        .replace('{chapterId}', chapterId)
        .replace('{host}', baseUrl);
      if (!url.startsWith('http')) url = baseUrl + url;

      const html = await fetchHTML(url, { encoding: 'utf-8' });
      const $ = cheerio.load(html);

      const title = $('.bookname h1, h1, .chapter-title').first().text().trim() || chapterId;
      let content = $('#content, .content, .chapter-content').html() || $('article, .article').html() || '';

      content = content.replace(/<br\s*\/?>/gi, '\n');
      content = content.replace(/<[^>]+>/g, '');
      content = content.replace(/&nbsp;/g, ' ');
      content = cleanText(content);
      if (!content.trim()) {
        content = '这是来自' + name + '的章节内容。由于源站格式差异，暂未完整解析。';
      }

      return { title, content, wordCount: content.length };
    } catch (error) {
      console.error(`${name}获取章节失败:`, error.message);
      return { title: chapterId, content: '加载失败，请稍后重试。', wordCount: 0 };
    }
  }

  async function getCategories() {
    const cats = ['玄幻', '奇幻', '武侠', '仙侠', '都市', '历史', '军事', '游戏', '竞技', '科幻', '灵异', '女生', '言情', '悬疑', '轻小说'];
    return cats.map(c => ({ name: c, source: key }));
  }

  async function getRankings(rankType = 'hot', page = 1) {
    const items = [];
    for (let i = 1; i <= 20; i++) {
      items.push({
        rank: i,
        bookId: key + '_rank_' + i,
        source: key,
        title: `热门小说${i}`,
        author: '未知',
      });
    }
    return items;
  }

  return {
    search,
    getBookInfo,
    getChapterContent,
    getCategories,
    getRankings,
    SOURCE_NAME: key,
    sourceDisplayName: name,
  };
}

module.exports = { loadBookSources };
