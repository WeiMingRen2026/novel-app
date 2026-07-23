const fanqie = require('./fanqie');
const qimao = require('./qimao');
const qidian = require('./qidian');
const biquge = require('./biquge');

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
      console.error(`${sourceName}搜索失败:`, error.message);
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
    console.error(`${sourceName}搜索失败:`, error.message);
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
      console.error(`${sourceName}获取分类失败:`, error.message);
    }
  }
  
  return Array.from(categoryMap.values());
}

async function getRankings(sourceName, rankType = 'hot', page = 1) {
  const source = getSource(sourceName);
  try {
    return await source.getRankings(rankType, page);
  } catch (error) {
    console.error(`${sourceName}获取排行榜失败:`, error.message);
    return [];
  }
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
  getAllSources,
  getSource,
  SOURCE_NAMES,
};
