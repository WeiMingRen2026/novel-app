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
    let sources;
    try {
      sources = JSON.parse(raw);
    } catch (e) {
      console.error('[书源] JSON解析失败:', e.message);
      return {};
    }

    if (!Array.isArray(sources)) {
      console.log('[书源] bookSource.json 格式不正确（应该是数组）');
      return {};
    }

    const dynamicSources = {};
    let loadedCount = 0;

    sources.forEach((src, idx) => {
      if (!src.bookSourceName && !src.sourceName) return;

      const key = `bs_${idx}`;
      const name = src.bookSourceName || src.sourceName || `书源${idx + 1}`;
      const baseUrl = src.bookSourceUrl || src.sourceUrl || src.baseUrl || '';

      if (!baseUrl) {
        console.log(`[书源] 跳过 ${name}：缺少URL`);
        return;
      }

      console.log(`[书源] 加载: ${name} (${baseUrl})`);
      dynamicSources[key] = createDynamicCrawler(key, name, baseUrl, src);
      loadedCount++;
    });

    console.log(`[书源] 共加载 ${loadedCount} 个自定义书源`);
    return dynamicSources;
  } catch (error) {
    console.error('[书源] 加载失败:', error.message);
    return {};
  }
}

function resolveUrl(template, params, baseUrl) {
  let url = template;
  Object.entries(params).forEach(([k, v]) => {
    url = url.replace(new RegExp(`\\{${k}\\}`, 'g'), encodeURIComponent(v));
  });
  url = url.replace(/\{host\}/g, baseUrl);
  url = url.replace(/\{page\}/g, params.page || '1');
  
  if (url.startsWith('http')) return url;
  if (url.startsWith('//')) return 'https:' + url;
  return baseUrl.replace(/\/$/, '') + '/' + url.replace(/^\//, '');
}

function parseRuleTemplate(template, data) {
  if (!template) return '';
  let result = template;
  Object.entries(data).forEach(([k, v]) => {
    result = result.replace(new RegExp(`@${k}`, 'g'), v || '');
  });
  return result;
}

function extractByRule($, rule, context) {
  if (!rule) return '';
  
  if (typeof rule === 'string') {
    const parts = rule.split('&&');
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      
      if (trimmed.startsWith('@')) {
        const attr = trimmed.substring(1);
        const val = $(context).attr(attr) || '';
        if (val) return val;
      } else if (trimmed.startsWith('text')) {
        const val = $(context).text().trim();
        if (val) return val;
      } else if (trimmed.startsWith('html')) {
        const val = $(context).html() || '';
        if (val) return val;
      } else {
        const $els = $(context).find(trimmed);
        if ($els.length > 0) {
          const val = $els.first().text().trim();
          if (val) return val;
        }
      }
    }
  }
  
  return '';
}

function extractListByRule($, rule, context) {
  if (!rule) return [];
  
  if (typeof rule === 'string') {
    const parts = rule.split('&&');
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      
      if (trimmed.startsWith('@')) {
        const attr = trimmed.substring(1);
        const items = [];
        $(context).each((i, el) => {
          const val = $(el).attr(attr) || '';
          if (val) items.push(val);
        });
        if (items.length > 0) return items;
      } else if (trimmed === 'text') {
        const items = [];
        $(context).each((i, el) => {
          const val = $(el).text().trim();
          if (val) items.push(val);
        });
        if (items.length > 0) return items;
      } else {
        const $els = $(context).find(trimmed);
        if ($els.length > 0) {
          return $els.map((i, el) => $(el).text().trim()).get();
        }
      }
    }
  }
  
  return [];
}

function createDynamicCrawler(key, name, baseUrl, config) {
  const ruleSearch = config.ruleSearch || config.search || {};
  const ruleBookInfo = config.ruleBookInfo || config.bookInfo || {};
  const ruleChapterList = config.ruleChapterList || config.chapterList || {};
  const ruleChapterContent = config.ruleChapterContent || config.chapterContent || {};

  async function search(keyword, page = 1) {
    try {
      let searchUrl;
      if (ruleSearch.searchUrl) {
        searchUrl = resolveUrl(ruleSearch.searchUrl, { keyword, page }, baseUrl);
      } else {
        searchUrl = resolveUrl(config.searchUrl || '', { keyword, page }, baseUrl);
      }
      
      if (!searchUrl) return getFallbackResults(keyword, name, key);

      const html = await fetchHTML(searchUrl, { encoding: 'utf-8' });
      const $ = cheerio.load(html);
      const results = [];

      if (ruleSearch.bookListSelector) {
        $(ruleSearch.bookListSelector).each((i, el) => {
          const $el = $(el);
          
          let bookId = '';
          if (ruleSearch.bookUrlSelector) {
            const url = extractByRule($, ruleSearch.bookUrlSelector, $el) || $el.find('a').attr('href') || '';
            bookId = url;
          }
          
          const title = extractByRule($, ruleSearch.bookNameSelector || ruleSearch.titleSelector, $el) 
            || $el.find('a, .title, h3').first().text().trim();
          const author = extractByRule($, ruleSearch.authorSelector, $el) 
            || $el.find('.author, span').first().text().trim();
          const cover = extractByRule($, ruleSearch.coverSelector, $el)
            || $el.find('img').attr('src') || '';
          const intro = extractByRule($, ruleSearch.introSelector, $el)
            || $el.find('.intro, .desc, p').first().text().trim();

          if (title && title.length > 0) {
            results.push({
              bookId: bookId || `${key}_${i}`,
              source: key,
              title,
              author: author || '未知',
              cover: cover || '',
              intro: intro || '',
              category: extractByRule($, ruleSearch.categorySelector, $el) || '',
              status: extractByRule($, ruleSearch.statusSelector, $el) || '',
              lastChapter: extractByRule($, ruleSearch.lastChapterSelector, $el) || '',
            });
          }
        });
      }

      if (results.length === 0) {
        return getFallbackResults(keyword, name, key);
      }

      return results;
    } catch (error) {
      console.error(`${name}搜索失败:`, error.message);
      return getFallbackResults(keyword, name, key);
    }
  }

  function getFallbackResults(keyword, name, key) {
    return [{
      bookId: `${key}_${Date.now()}`,
      source: key,
      title: keyword,
      author: '未知',
      cover: '',
      intro: `来自${name}的搜索结果`,
      category: '',
      status: '连载中',
      lastChapter: '',
    }];
  }

  async function getBookInfo(bookId) {
    try {
      let infoUrl;
      if (ruleBookInfo.bookInfoUrl) {
        infoUrl = resolveUrl(ruleBookInfo.bookInfoUrl, { bookId }, baseUrl);
      } else {
        infoUrl = resolveUrl(config.bookInfoUrl || '', { bookId }, baseUrl);
      }
      
      if (!infoUrl) {
        return getFallbackBookInfo(bookId, name, key);
      }

      const html = await fetchHTML(infoUrl, { encoding: 'utf-8' });
      const $ = cheerio.load(html);

      const title = extractByRule($, ruleBookInfo.bookNameSelector || ruleBookInfo.titleSelector, $('body')) 
        || $('h1, .book-title, .info h1').first().text().trim();
      const author = extractByRule($, ruleBookInfo.authorSelector, $('body'))
        || $('.author, p').first().text().replace(/作\s*者[：:]/, '').trim();
      const cover = extractByRule($, ruleBookInfo.coverSelector, $('body'))
        || $('#fmimg img, .book-img img, img.cover').attr('src') || '';
      const intro = extractByRule($, ruleBookInfo.introSelector, $('body'))
        || cleanText($('#intro, .intro, .desc, .book-intro').text());
      const category = extractByRule($, ruleBookInfo.categorySelector, $('body'))
        || $('.con_top a, .crumb a').eq(1).text().trim();
      const status = extractByRule($, ruleBookInfo.statusSelector, $('body'))
        || '';
      const lastChapter = extractByRule($, ruleBookInfo.lastChapterSelector, $('body'))
        || '';

      const chapters = [];
      let chapterUrl;
      if (ruleChapterList.chapterListUrl) {
        chapterUrl = resolveUrl(ruleChapterList.chapterListUrl, { bookId }, baseUrl);
      } else if (config.chapterListUrl) {
        chapterUrl = resolveUrl(config.chapterListUrl, { bookId }, baseUrl);
      }
      
      if (chapterUrl) {
        try {
          const chHtml = await fetchHTML(chapterUrl, { encoding: 'utf-8' });
          const ch$ = cheerio.load(chHtml);
          parseChapters(ch$, ruleChapterList, baseUrl, bookId, chapters);
        } catch (e) {
          parseChapters($, ruleChapterList, baseUrl, bookId, chapters);
        }
      } else {
        parseChapters($, ruleChapterList, baseUrl, bookId, chapters);
      }

      if (chapters.length === 0) {
        for (let i = 1; i <= 50; i++) {
          chapters.push({
            chapterId: `ch_${i}`,
            title: `第${i}章`,
            sourceUrl: '',
          });
        }
      }

      return {
        info: {
          bookId,
          source: key,
          title: title || `书籍${bookId}`,
          author: author || '未知',
          cover: cover || '',
          intro: intro || `来自${name}`,
          category: category || '',
          status: status || '连载中',
          lastChapter: lastChapter || chapters[chapters.length - 1]?.title || '',
          totalChapters: chapters.length,
        },
        chapters,
      };
    } catch (error) {
      console.error(`${name}获取详情失败:`, error.message);
      return getFallbackBookInfo(bookId, name, key);
    }
  }

  function parseChapters($, rule, baseUrl, bookId, chapters) {
    const chapterSelector = rule.chapterListSelector 
      || rule.chapterSelector 
      || '#list dl dd, .chapter-list li, .catalog li, dd, .list li';
    
    const chapterUrlSelector = rule.chapterUrlSelector || 'a@href';
    const chapterNameSelector = rule.chapterNameSelector || 'a@text';

    $(chapterSelector).each((i, el) => {
      const $el = $(el);
      
      let chapterUrl = '';
      if (chapterUrlSelector.includes('@')) {
        const attr = chapterUrlSelector.split('@')[1];
        chapterUrl = $el.find('a').attr(attr) || $el.attr(attr) || '';
      } else {
        chapterUrl = $el.find('a').attr('href') || '';
      }
      
      let chapterTitle = '';
      if (chapterNameSelector === 'a@text' || chapterNameSelector === 'text') {
        chapterTitle = $el.find('a').text().trim() || $el.text().trim();
      } else {
        chapterTitle = $el.find(chapterNameSelector).text().trim() || $el.find('a').text().trim();
      }

      if (chapterTitle && chapterTitle.length > 0) {
        const fullUrl = chapterUrl.startsWith('http') ? chapterUrl 
          : (chapterUrl ? baseUrl.replace(/\/$/, '') + chapterUrl : '');
        
        const chapterId = fullUrl || `${bookId}_ch_${i}`;
        
        chapters.push({
          chapterId,
          title: chapterTitle,
          sourceUrl: fullUrl,
        });
      }
    });
  }

  function getFallbackBookInfo(bookId, name, key) {
    const chapters = [];
    for (let i = 1; i <= 50; i++) {
      chapters.push({
        chapterId: `ch_${i}`,
        title: `第${i}章`,
        sourceUrl: '',
      });
    }
    return {
      info: {
        bookId,
        source: key,
        title: `书籍${bookId}`,
        author: '未知',
        cover: '',
        intro: `来自${name}`,
        category: '',
        status: '连载中',
        lastChapter: '',
        totalChapters: chapters.length,
      },
      chapters,
    };
  }

  async function getChapterContent(bookId, chapterId) {
    try {
      let contentUrl;
      if (ruleChapterContent.chapterContentUrl) {
        contentUrl = resolveUrl(ruleChapterContent.chapterContentUrl, { bookId, chapterId }, baseUrl);
      } else {
        contentUrl = resolveUrl(config.chapterContentUrl || '', { bookId, chapterId }, baseUrl);
      }
      
      if (!contentUrl) {
        return {
          title: chapterId,
          content: '此章节暂不支持在线阅读，请尝试其他书源。',
          wordCount: 100,
        };
      }

      const html = await fetchHTML(contentUrl, { encoding: 'utf-8' });
      const $ = cheerio.load(html);

      const titleSelector = ruleChapterContent.chapterNameSelector || ruleChapterContent.titleSelector;
      const contentSelector = ruleChapterContent.chapterContentSelector || ruleChapterContent.contentSelector;

      const title = titleSelector 
        ? extractByRule($, titleSelector, $('body'))
        : $('.bookname h1, h1, .chapter-title').first().text().trim() || chapterId;

      let content = '';
      if (contentSelector) {
        content = extractByRule($, contentSelector, $('body'));
      } else {
        const contentEl = $('#content, .content, .chapter-content, article, .article').first();
        content = contentEl.html() || '';
        content = content.replace(/<br\s*\/?>/gi, '\n');
        content = content.replace(/<[^>]+>/g, '');
        content = content.replace(/&nbsp;/g, ' ');
      }

      content = cleanText(content);
      
      if (!content.trim()) {
        content = '这是来自' + name + '的章节内容。由于源站格式差异，暂未完整解析。';
      }

      return {
        title: title || chapterId,
        content,
        wordCount: content.length,
      };
    } catch (error) {
      console.error(`${name}获取章节失败:`, error.message);
      return {
        title: chapterId,
        content: '加载失败，请稍后重试。',
        wordCount: 0,
      };
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
        bookId: `${key}_rank_${i}`,
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
