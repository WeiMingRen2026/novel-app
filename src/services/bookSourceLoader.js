const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const { fetchHTML, cleanText } = require('../utils/request');

const dataDir = path.join(__dirname, '../../data');

function parseSelector(rule) {
  if (!rule) return { type: 'css', selector: '' };
  
  rule = rule.trim();
  
  if (rule === 'text') return { type: 'text' };
  if (rule === 'html') return { type: 'html' };
  
  if (rule.startsWith('.')) return { type: 'css', selector: rule };
  if (rule.startsWith('#')) return { type: 'css', selector: rule };
  if (rule.includes('@')) {
    const parts = rule.split('@');
    const selector = parts[0];
    const attr = parts[1];
    return { type: 'attr', selector: selector, attr: attr };
  }
  if (rule.startsWith('text##')) {
    const rest = rule.substring(5);
    const parts = rest.split('##');
    return { type: 'textRegex', prefix: parts[0] || '', regex: parts[1] || '', suffix: parts[2] || '' };
  }
  if (rule.startsWith('class.')) {
    return { type: 'css', selector: '.' + rule.substring(6) };
  }
  
  return { type: 'css', selector: rule };
}

function extractValue($, rule, context) {
  if (!rule) return '';
  
  const sel = parseSelector(rule);
  
  switch (sel.type) {
    case 'text':
      return $(context).text().trim();
    case 'html':
      return $(context).html() || '';
    case 'attr': {
      let $els = $(context);
      if (sel.selector) {
        $els = $els.find(sel.selector);
      }
      return $els.attr(sel.attr) || '';
    }
    case 'textRegex': {
      let text = $(context).text().trim();
      if (!text && sel.prefix) {
        const $el = $(context).find(sel.prefix);
        if ($el.length) text = $el.text().trim();
      }
      const regex = new RegExp(sel.regex || '');
      const match = text.match(regex);
      if (match) {
        return match[1] || match[0] || text;
      }
      return text;
    }
    case 'css':
    default: {
      if (!sel.selector) return '';
      const $el = $(context).find(sel.selector);
      if ($el.length === 0) return '';
      return $el.first().text().trim() || $el.first().attr('href') || $el.first().attr('src') || '';
    }
  }
}

function extractList($, rule, context) {
  if (!rule) return [];
  
  if (rule === 'text') {
    const results = [];
    $(context).each((i, el) => {
      const val = $(el).text().trim();
      if (val) results.push(val);
    });
    return results;
  }
  
  const sel = parseSelector(rule);
  
  switch (sel.type) {
    case 'text': {
      const results = [];
      $(context).each((i, el) => {
        const val = $(el).text().trim();
        if (val) results.push(val);
      });
      return results;
    }
    case 'attr': {
      const results = [];
      $(context).each((i, el) => {
        const val = $(el).attr(sel.attr) || '';
        if (val) results.push(val);
      });
      return results;
    }
    case 'css':
    default: {
      if (!sel.selector) return [];
      const $els = $(context).find(sel.selector);
      return $els.map((i, el) => $(el).text().trim() || $(el).attr('href') || '').get();
    }
  }
}

function parseExploreUrls(exploreUrl) {
  if (!exploreUrl) return [];
  const lines = exploreUrl.split('\n');
  const results = [];
  lines.forEach(line => {
    const match = line.trim().match(/(.+?)::(.+)/);
    if (match) {
      results.push({ name: match[1], url: match[2] });
    }
  });
  return results;
}

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
      if (!src.bookSourceName) return;
      if (!src.enabled && src.enabled !== undefined) return;

      const key = `bs_${idx}`;
      const name = src.bookSourceName || `书源${idx + 1}`;
      const baseUrl = src.bookSourceUrl || '';

      if (!baseUrl) return;

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
  if (!template) return '';
  let url = template;
  Object.entries(params).forEach(([k, v]) => {
    url = url.replace(new RegExp(`\\{${k}\\}`, 'g'), encodeURIComponent(v));
  });
  url = url.replace(/\{key\}/g, encodeURIComponent(params.key || ''));
  url = url.replace(/\{host\}/g, baseUrl);
  url = url.replace(/\{page\}/g, params.page || '1');
  
  if (url.startsWith('http')) return url;
  if (url.startsWith('//')) return 'https:' + url;
  return baseUrl.replace(/\/$/, '') + '/' + url.replace(/^\//, '');
}

function createDynamicCrawler(key, name, baseUrl, config) {
  const ruleSearch = config.ruleSearch || {};
  const ruleBookInfo = config.ruleBookInfo || {};
  const ruleToc = config.ruleToc || {};
  const ruleContent = config.ruleContent || {};
  const ruleExplore = config.ruleExplore || {};

  async function search(keyword, page = 1) {
    try {
      const searchUrl = resolveUrl(ruleSearch.searchUrl, { keyword, key: keyword, page }, baseUrl);
      if (!searchUrl) return getFallbackResults(keyword, name, key);

      const html = await fetchHTML(searchUrl, { encoding: 'utf-8' });
      const $ = cheerio.load(html);
      const results = [];

      const bookListSelector = ruleSearch.bookList || '';
      if (bookListSelector) {
        $(bookListSelector).each((i, el) => {
          const $el = $(el);
          
          const bookUrl = extractValue($, ruleSearch.bookUrl, $el) || '';
          const title = extractValue($, ruleSearch.name, $el) || '';
          const author = extractValue($, ruleSearch.author, $el) || '';
          const cover = extractValue($, ruleSearch.coverUrl, $el) || '';
          const intro = extractValue($, ruleSearch.intro, $el) || '';
          const lastChapter = extractValue($, ruleSearch.lastChapter, $el) || '';
          const category = extractValue($, ruleSearch.kind, $el) || '';

          if (title && title.length > 0) {
            results.push({
              bookId: bookUrl || `${key}_${i}`,
              source: key,
              title,
              author,
              cover,
              intro,
              category,
              status: '',
              lastChapter,
            });
          }
        });
      }

      if (results.length === 0) return getFallbackResults(keyword, name, key);
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
      intro: `来自${name}`,
      category: '',
      status: '连载中',
      lastChapter: '',
    }];
  }

  async function getBookInfo(bookId) {
    try {
      const tocUrl = extractTocUrl(bookId);
      
      let infoUrl = '';
      if (ruleBookInfo.tocUrl) {
        const tocSel = parseSelector(ruleBookInfo.tocUrl);
        if (bookId && tocSel.type === 'attr') {
          infoUrl = bookId;
        } else {
          infoUrl = resolveUrl(ruleBookInfo.tocUrl, { bookId }, baseUrl);
        }
      } else {
        infoUrl = bookId.startsWith('http') ? bookId : (baseUrl.replace(/\/$/, '') + bookId);
      }
      
      if (!infoUrl) return getFallbackBookInfo(bookId, name, key);

      const html = await fetchHTML(infoUrl, { encoding: 'utf-8' });
      const $ = cheerio.load(html);

      const title = extractValue($, ruleBookInfo.name, $('body')) || '';
      const author = extractValue($, ruleBookInfo.author, $('body')) || '';
      const cover = extractValue($, ruleBookInfo.coverUrl, $('body')) || '';
      const intro = extractValue($, ruleBookInfo.intro, $('body')) || '';
      const category = extractValue($, ruleBookInfo.kind, $('body')) || '';
      const lastChapter = extractValue($, ruleBookInfo.lastChapter, $('body')) || '';

      const chapters = [];
      const chapterListSelector = ruleToc.chapterList || '';
      const chapterNameSelector = ruleToc.chapterName || 'text';
      const chapterUrlSelector = ruleToc.chapterUrl || 'href';

      if (chapterListSelector) {
        const $chapterLinks = $(chapterListSelector);
        
        if (chapterUrlSelector === 'href') {
          $chapterLinks.each((i, el) => {
            const $el = $(el);
            const chUrl = $el.attr('href') || '';
            let chTitle = '';
            
            if (chapterNameSelector === 'text') {
              chTitle = $el.text().trim();
            } else {
              chTitle = extractValue($, chapterNameSelector, $el) || $el.text().trim();
            }
            
            if (chTitle && chTitle.length > 0) {
              const fullUrl = chUrl.startsWith('http') ? chUrl : (chUrl ? baseUrl.replace(/\/$/, '') + chUrl : '');
              chapters.push({
                chapterId: fullUrl || `${bookId}_ch_${i}`,
                title: chTitle,
                sourceUrl: fullUrl,
              });
            }
          });
        } else {
          $chapterLinks.each((i, el) => {
            const $el = $(el);
            const chUrl = extractValue($, chapterUrlSelector, $el) || '';
            const chTitle = extractValue($, chapterNameSelector, $el) || $el.text().trim();
            
            if (chTitle && chTitle.length > 0) {
              const fullUrl = chUrl.startsWith('http') ? chUrl : (chUrl ? baseUrl.replace(/\/$/, '') + chUrl : '');
              chapters.push({
                chapterId: fullUrl || `${bookId}_ch_${i}`,
                title: chTitle,
                sourceUrl: fullUrl,
              });
            }
          });
        }
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
          status: '连载中',
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

  function extractTocUrl(bookId) {
    if (!ruleBookInfo.tocUrl) return bookId;
    const sel = parseSelector(ruleBookInfo.tocUrl);
    if (sel.type === 'attr') return bookId;
    return ruleBookInfo.tocUrl;
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
      let contentUrl = chapterId;
      if (!contentUrl.startsWith('http')) {
        contentUrl = baseUrl.replace(/\/$/, '') + contentUrl;
      }
      if (!contentUrl.startsWith('http')) {
        return { title: chapterId, content: '此章节暂不支持阅读，请换其他书源。', wordCount: 100 };
      }

      const html = await fetchHTML(contentUrl, { encoding: 'utf-8' });
      const $ = cheerio.load(html);

      const contentSelector = ruleContent.content || '#content';
      const replaceRegex = ruleContent.replaceRegex || '';

      let content = '';
      const sel = parseSelector(contentSelector);
      if (sel.type === 'css' && sel.selector) {
        content = $(sel.selector).html() || '';
      } else if (sel.type === 'html') {
        content = $('body').html() || '';
      } else {
        const $el = $(contentSelector).first();
        content = $el.html() || '';
      }

      content = content.replace(/<br\s*\/?>/gi, '\n');
      content = content.replace(/<[^>]+>/g, '');
      content = content.replace(/&nbsp;/g, ' ');

      if (replaceRegex) {
        try {
          const patterns = replaceRegex.split('##');
          if (patterns.length >= 2) {
            const regex = new RegExp(patterns[0], patterns[2] || 'g');
            content = content.replace(regex, patterns[1] || '');
          }
        } catch (e) {}
      }

      content = cleanText(content);
      if (!content.trim()) {
        content = '这是来自' + name + '的章节内容。';
      }

      return {
        title: chapterId,
        content,
        wordCount: content.length,
      };
    } catch (error) {
      console.error(`${name}获取章节失败:`, error.message);
      return { title: chapterId, content: '加载失败，请稍后重试。', wordCount: 0 };
    }
  }

  async function getCategories() {
    const exploreUrls = parseExploreUrls(ruleExplore.exploreUrl);
    if (exploreUrls.length > 0) {
      return exploreUrls.map(e => ({ name: e.name, source: key, url: e.url }));
    }
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

  async function getBooksByCategory(categoryName, page = 1) {
    try {
      const exploreUrls = parseExploreUrls(ruleExplore.exploreUrl);
      const match = exploreUrls.find(e => e.name === categoryName);
      if (!match) return [];

      const html = await fetchHTML(match.url.replace('{page}', page), { encoding: 'utf-8' });
      const $ = cheerio.load(html);
      const results = [];

      const bookListSelector = ruleExplore.bookList || ruleSearch.bookList || '';
      if (bookListSelector) {
        $(bookListSelector).each((i, el) => {
          const $el = $(el);
          const bookUrl = extractValue($, ruleExplore.bookUrl || ruleSearch.bookUrl, $el) || '';
          const title = extractValue($, ruleExplore.name || ruleSearch.name, $el) || '';
          const author = extractValue($, ruleExplore.author || ruleSearch.author, $el) || '';
          const cover = extractValue($, ruleExplore.coverUrl || ruleSearch.coverUrl, $el) || '';
          const intro = extractValue($, ruleExplore.intro || ruleSearch.intro, $el) || '';

          if (title && title.length > 0) {
            results.push({
              bookId: bookUrl || `${key}_cat_${i}`,
              source: key,
              title,
              author,
              cover,
              intro,
              category: categoryName,
            });
          }
        });
      }

      return results;
    } catch (error) {
      console.error(`${name}获取分类失败:`, error.message);
      return [];
    }
  }

  return {
    search,
    getBookInfo,
    getChapterContent,
    getCategories,
    getRankings,
    getBooksByCategory,
    SOURCE_NAME: key,
    sourceDisplayName: name,
  };
}

module.exports = { loadBookSources };
