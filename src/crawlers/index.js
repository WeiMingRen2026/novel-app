const fanqie = require('./fanqie');
const qimao = require('./qimao');
const qidian = require('./qidian');
const biquge = require('./biquge');
const { loadBookSources } = require('../services/bookSourceLoader');

const sources = {
  fanqie,
  qimao,
  qidian,
  biquge,
};

const SOURCE_NAMES = {
  fanqie: '番茄小说',
  qimao: '七猫小说',
  qidian: '起点读书',
  biquge: '笔趣阁',
};

function initDynamicSources() {
  const dynamic = loadBookSources();
  Object.entries(dynamic).forEach(([key, source]) => {
    sources[key] = source;
    SOURCE_NAMES[key] = source.sourceDisplayName || key;
  });
  console.log(`[书源] 动态书源已注册，当前共 ${Object.keys(sources).length} 个书源`);
}

initDynamicSources();

function getSource(sourceName) {
  return sources[sourceName] || biquge;
}

async function searchAllSources(keyword, page = 1) {
  const results = [];

  const searchPromises = Object.entries(sources).map(async ([sourceName, source]) => {
    try {
      const items = await source.search(keyword, page);
      return items.map(item => ({
        ...item,
        sourceName: SOURCE_NAMES[sourceName] || sourceName,
      }));
    } catch (error) {
      return [];
    }
  });

  const allResults = await Promise.all(searchPromises);
  allResults.forEach(items => results.push(...items));

  return results;
}

async function searchBySource(sourceName, keyword, page = 1) {
  const source = getSource(sourceName);
  try {
    const items = await source.search(keyword, page);
    return items.map(item => ({
      ...item,
      sourceName: SOURCE_NAMES[sourceName] || sourceName,
    }));
  } catch (error) {
    return [];
  }
}

async function getBookInfo(sourceName, bookId) {
  const source = getSource(sourceName);
  return source.getBookInfo(bookId);
}

async function getChapterContent(sourceName, bookId, chapterId) {
  const source = getSource(sourceName);
  return source.getChapterContent(bookId, chapterId);
}

async function getBookReviews(sourceName, bookId, page = 1) {
  const source = getSource(sourceName);
  if (source.getBookReviews) {
    return source.getBookReviews(bookId, page);
  }
  return [];
}

async function getParagraphComments(sourceName, bookId, chapterId) {
  const source = getSource(sourceName);
  if (source.getParagraphComments) {
    return source.getParagraphComments(bookId, chapterId);
  }
  return [];
}

async function getCategories() {
  const categories = [];
  const categoryMap = new Map();

  for (const [sourceName, source] of Object.entries(sources)) {
    try {
      const cats = await source.getCategories();
      cats.forEach(cat => {
        const key = cat.name;
        if (!categoryMap.has(key)) {
          categoryMap.set(key, {
            name: cat.name,
            sources: [sourceName],
          });
        } else {
          categoryMap.get(key).sources.push(sourceName);
        }
      });
    } catch (error) {
      // skip
    }
  }

  return Array.from(categoryMap.values());
}

async function getRankings(sourceName, rankType = 'hot', page = 1) {
  const source = getSource(sourceName);
  try {
    return await source.getRankings(rankType, page);
  } catch (error) {
    return [];
  }
}

function getFirstDynamicSource() {
  const dynamicKeys = Object.keys(sources).filter(k => k.startsWith('bs_'));
  if (dynamicKeys.length > 0) return dynamicKeys[0];
  return 'biquge';
}

async function getBooksByCategory(sourceName, categoryName, page = 1) {
  const source = getSource(sourceName);
  if (source.getBooksByCategory) {
    try {
      return await source.getBooksByCategory(categoryName, page);
    } catch (error) {
      return [];
    }
  }
  return [];
}

function getAllSources() {
  return Object.entries(sources).map(([key, value]) => ({
    key,
    name: SOURCE_NAMES[key] || key,
    hasReviews: !!value.getBookReviews,
    hasParagraphComments: !!value.getParagraphComments,
  }));
}

module.exports = {
  searchAllSources,
  searchBySource,
  getBookInfo,
  getChapterContent,
  getBookReviews,
  getParagraphComments,
  getCategories,
  getRankings,
  getBooksByCategory,
  getFirstDynamicSource,
  getAllSources,
  getSource,
  SOURCE_NAMES,
};
