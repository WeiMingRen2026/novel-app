const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const axios = require('axios');
const iconv = require('iconv-lite');

const dataDir = path.join(__dirname, '../../data');

const USER_AGENTS = [
  'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Linux; Android 12; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Linux; Android 10; MIX 2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
];

function getRandomUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function fetchURL(url, encoding = 'utf-8', retries = 3) {
  const urlObj = new URL(url);
  const baseDomain = urlObj.origin;
  
  const headers = {
    'User-Agent': getRandomUA(),
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
    'Referer': baseDomain + '/',
  };

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 20000,
        headers: attempt === 0 ? headers : {
          ...headers,
          'User-Agent': getRandomUA(),
          'Referer': baseDomain + '/',
        },
        maxRedirects: 5,
        validateStatus: function (status) {
          return status < 500;
        },
      });
      
      if (response.status === 403 || response.status === 401) {
        if (attempt < retries - 1) continue;
        throw new Error(`HTTP ${response.status}`);
      }

      const buffer = Buffer.from(response.data);
      
      const contentType = response.headers['content-type'] || '';
      let detectedEncoding = encoding;
      
      if (contentType.includes('charset=gbk') || contentType.includes('charset=gb2312')) {
        detectedEncoding = 'gbk';
      } else if (contentType.includes('charset=utf-8')) {
        detectedEncoding = 'utf-8';
      }
      
      if (detectedEncoding !== 'utf-8') {
        try {
          const decoded = iconv.decode(buffer, detectedEncoding);
          return decoded.toString('utf-8');
        } catch (e) {
          return buffer.toString('utf-8');
        }
      }
      
      let text = buffer.toString('utf-8');
      
      if (text.includes('�') || text.includes('\uFFFD')) {
        try {
          text = iconv.decode(buffer, 'gbk').toString('utf-8');
        } catch (e) {
          try {
            text = iconv.decode(buffer, 'gb2312').toString('utf-8');
          } catch (e2) {}
        }
      }
      
      return text;
    } catch (error) {
      if (attempt === retries - 1) throw error;
    }
  }
}

function cleanText(text) {
  if (!text) return '';
  return text.replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim();
}

function parseSelector(rule) {
  if (!rule) return { type: 'css', selector: '' };
  
  rule = rule.trim();
  
  if (rule === 'text') return { type: 'text' };
  if (rule === 'html') return { type: 'html' };
  
  if (rule.startsWith('text##')) {
    const rest = rule.substring(5);
    const parts = rest.split('##');
    return { type: 'textRegex', prefix: parts[0] || '', regex: parts[1] || '', suffix: parts[2] || '' };
  }
  
  if (rule.includes('@')) {
    const parts = rule.split('@');
    const selector = parts[0];
    const attr = parts[1];
    return { type: 'attr', selector: selector, attr: attr };
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
      if (sel.selector && sel.selector !== 'text' && sel.selector !== 'html') {
        $els = $els.find(sel.selector);
      }
      if ($els.length === 0 && sel.selector) {
        $els = $(sel.selector).first();
      }
      return $els.attr(sel.attr) || '';
    }
    case 'textRegex': {
      let text = '';
      if (sel.prefix) {
        const $el = $(context).find(sel.prefix);
        if ($el.length) text = $el.text().trim();
      }
      if (!text) text = $(context).text().trim();
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
      let $el;
      if (context && context.find) {
        $el = $(context).find(sel.selector).first();
        if ($el.length === 0) {
          $el = $(sel.selector).first();
        }
      } else {
        $el = $(sel.selector).first();
      }
      if ($el.length === 0) return '';
      return $el.text().trim() || $el.attr('href') || $el.attr('src') || '';
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
      if (src.enabled === false) return;

      const key = `bs_${idx}`;
      const name = src.bookSourceName || `书源${idx + 1}`;
      const baseUrl = src.bookSourceUrl || '';

      if (!baseUrl) return;

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
  url = url.replace(/\{host\}/g, baseUrl);
  url = url.replace(/\{page\}/g, String(params.page || 1));
  
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
      let searchUrl = '';
      if (ruleSearch.searchUrl) {
        searchUrl = resolveUrl(ruleSearch.searchUrl, { keyword, key: keyword, page }, baseUrl);
      } else if (config.searchUrl) {
        searchUrl = resolveUrl(config.searchUrl, { keyword, key: keyword, page }, baseUrl);
      }
      
      if (!searchUrl) return [];

      const html = await fetchURL(searchUrl);
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

          if (title && title.length > 0 && title !== '') {
            let fullBookId = bookUrl;
            if (bookUrl && !bookUrl.startsWith('http')) {
              fullBookId = baseUrl.replace(/\/$/, '') + bookUrl;
            }
            
            results.push({
              bookId: fullBookId || `${key}_${Date.now()}_${i}`,
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

      return results;
    } catch (error) {
      return [];
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
      let infoUrl = bookId;
      if (!infoUrl.startsWith('http')) {
        infoUrl = baseUrl.replace(/\/$/, '') + infoUrl;
      }
      
      if (!infoUrl.startsWith('http')) {
        return null;
      }

      const html = await fetchURL(infoUrl);
      const $ = cheerio.load(html);

      let title = extractValue($, ruleBookInfo.name, $('body')) || '';
      if (!title) title = $('h1').first().text().trim() || '';
      
      let author = extractValue($, ruleBookInfo.author, $('body')) || '';
      if (!author) author = $('.author, .book-author, span').first().text().replace(/作\s*者[：:]/, '').trim() || '';
      
      let cover = extractValue($, ruleBookInfo.coverUrl, $('body')) || '';
      if (!cover) cover = $('.book-img img, .cover img, #fmimg img').attr('src') || '';
      if (cover && !cover.startsWith('http')) cover = baseUrl.replace(/\/$/, '') + cover;
      
      let intro = extractValue($, ruleBookInfo.intro, $('body')) || '';
      if (!intro) intro = cleanText($('#intro, .intro, .desc, .book-intro').text());
      
      let category = extractValue($, ruleBookInfo.kind, $('body')) || '';
      if (!category) category = $('.crumb a, .con_top a').eq(1).text().trim() || '';

      let lastChapter = extractValue($, ruleBookInfo.lastChapter, $('body')) || '';

      const chapters = parseChapters($, ruleToc, baseUrl, bookId);

      return {
        info: {
          bookId,
          source: key,
          title: title || `书籍${bookId}`,
          author: author || '未知',
          cover: cover || '',
          intro: intro || '',
          category: category || '',
          status: '连载中',
          lastChapter: lastChapter || (chapters.length > 0 ? chapters[chapters.length - 1].title : ''),
          totalChapters: chapters.length,
        },
        chapters,
      };
    } catch (error) {
      return null;
    }
  }

  function parseChapters($, rule, baseUrl, bookId) {
    const chapters = [];
    const chapterListSelector = rule.chapterList || '';
    const chapterNameSelector = rule.chapterName || 'text';
    const chapterUrlSelector = rule.chapterUrl || '';

    if (chapterListSelector) {
      let $links;
      if (chapterListSelector === 'a') {
        $links = $('a');
      } else {
        $links = $(chapterListSelector);
      }
      
      $links.each((i, el) => {
        const $el = $(el);
        
        let chUrl = '';
        let chTitle = '';
        
        if (chapterUrlSelector === 'href' || !chapterUrlSelector) {
          chUrl = $el.attr('href') || '';
        } else {
          chUrl = extractValue($, chapterUrlSelector, $el) || $el.attr('href') || '';
        }
        
        if (chapterNameSelector === 'text' || chapterNameSelector === 'a@text') {
          chTitle = $el.text().trim();
        } else {
          chTitle = extractValue($, chapterNameSelector, $el) || $el.text().trim();
        }

        if (chTitle && chTitle.length > 1) {
          const fullUrl = chUrl && !chUrl.startsWith('http') 
            ? baseUrl.replace(/\/$/, '') + chUrl 
            : chUrl;
          
          chapters.push({
            chapterId: fullUrl || `${bookId}_ch_${i}`,
            title: chTitle,
            sourceUrl: fullUrl,
          });
        }
      });
    }

    return chapters;
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

      const html = await fetchURL(contentUrl);
      const $ = cheerio.load(html);

      const contentSelector = ruleContent.content || '#content';
      const replaceRegex = ruleContent.replaceRegex || '';

      let content = '';
      const sel = parseSelector(contentSelector);
      if (sel.type === 'css' && sel.selector) {
        const $el = $(sel.selector).first();
        content = $el.html() || '';
      } else if (sel.type === 'html') {
        content = $('body').html() || '';
      } else {
        const $el = $(contentSelector).first();
        content = $el.html() || $('body').html() || '';
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
      return { title: chapterId, content: '加载失败，请稍后重试。', wordCount: 0 };
    }
  }

  async function getCategories() {
    const exploreUrls = parseExploreUrls(ruleExplore.exploreUrl);
    if (exploreUrls.length > 0) {
      return exploreUrls.map(e => ({ name: e.name, source: key, url: e.url }));
    }
    const searchUrl = ruleSearch.searchUrl || config.searchUrl || '';
    if (searchUrl) {
      const cats = ['玄幻', '奇幻', '武侠', '仙侠', '都市', '历史', '军事', '游戏', '竞技', '科幻', '灵异', '女生', '言情', '悬疑', '轻小说'];
      return cats.map(c => ({ name: c, source: key }));
    }
    return [];
  }

  async getRankings(rankType = 'hot', page = 1) {
    const exploreUrls = parseExploreUrls(ruleExplore.exploreUrl);
    if (exploreUrls.length > 0) {
      try {
        const url = exploreUrls[0].url.replace('{page}', page);
        const html = await fetchURL(url);
        const $ = cheerio.load(html);
        const results = [];
        
        const bookListSelector = ruleExplore.bookList || ruleSearch.bookList || '';
        if (bookListSelector) {
          $(bookListSelector).each((i, el) => {
            const $el = $(el);
            const title = extractValue($, ruleExplore.name || ruleSearch.name, $el) || '';
            const author = extractValue($, ruleExplore.author || ruleSearch.author, $el) || '';
            const bookUrl = extractValue($, ruleExplore.bookUrl || ruleSearch.bookUrl, $el) || '';
            
            if (title && title.length > 0) {
              const fullBookId = bookUrl && !bookUrl.startsWith('http') 
                ? baseUrl.replace(/\/$/, '') + bookUrl 
                : bookUrl;
              results.push({
                rank: results.length + 1,
                bookId: fullBookId || `${key}_rank_${i}`,
                source: key,
                title,
                author,
              });
            }
          });
        }
        if (results.length > 0) return results;
      } catch (e) {}
    }
    
    return [];
  }

  async function getBooksByCategory(categoryName, page = 1) {
    try {
      const exploreUrls = parseExploreUrls(ruleExplore.exploreUrl);
      if (exploreUrls.length === 0) return [];

      let match = exploreUrls.find(e => e.name === categoryName);
      
      if (!match) {
        match = exploreUrls.find(e => e.name.includes(categoryName) || categoryName.includes(e.name));
      }
      
      if (!match && exploreUrls.length > 0) {
        match = exploreUrls[0];
      }
      
      if (!match) return [];

      const url = match.url.replace('{page}', page);
      const html = await fetchURL(url);
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
            const fullBookId = bookUrl && !bookUrl.startsWith('http') 
              ? baseUrl.replace(/\/$/, '') + bookUrl 
              : bookUrl;
            results.push({
              bookId: fullBookId || `${key}_cat_${i}`,
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

      if (results.length === 0 && exploreUrls.length > 0) {
        const fallbackUrl = exploreUrls[0].url.replace('{page}', page);
        const fallbackHtml = await fetchURL(fallbackUrl);
        const $f = cheerio.load(fallbackHtml);
        const fbListSelector = ruleExplore.bookList || ruleSearch.bookList || '';
        if (fbListSelector) {
          $f(fbListSelector).each((i, el) => {
            const $el = $f(el);
            const bookUrl = extractValue($f, ruleExplore.bookUrl || ruleSearch.bookUrl, $el) || '';
            const title = extractValue($f, ruleExplore.name || ruleSearch.name, $el) || '';
            const author = extractValue($f, ruleExplore.author || ruleSearch.author, $el) || '';
            if (title && title.length > 0) {
              const fullBookId = bookUrl && !bookUrl.startsWith('http') 
                ? baseUrl.replace(/\/$/, '') + bookUrl 
                : bookUrl;
              results.push({
                bookId: fullBookId || `${key}_cat_fb_${i}`,
                source: key,
                title,
                author,
                cover: '',
                intro: '',
                category: categoryName,
              });
            }
          });
        }
      }

      return results;
    } catch (error) {
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

module.exports = { loadBookSources, fetchURL, cleanText };
