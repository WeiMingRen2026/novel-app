const db = require('../models/database');

async function upsertNovel(novelData) {
  const existing = db.findOne('novels', { 
    book_id: novelData.bookId, 
    source: novelData.source 
  });
  
  if (existing) {
    db.updateOne('novels', { id: existing.id }, {
      title: novelData.title,
      author: novelData.author,
      cover: novelData.cover,
      intro: novelData.intro,
      category: novelData.category,
      status: novelData.status,
      word_count: novelData.wordCount || 0,
      last_chapter: novelData.lastChapter,
      last_update_time: novelData.lastUpdateTime,
      updated_at: new Date().toISOString(),
    });
    return existing.id;
  } else {
    const item = db.insertOne('novels', {
      book_id: novelData.bookId,
      source: novelData.source,
      title: novelData.title,
      author: novelData.author,
      cover: novelData.cover,
      intro: novelData.intro,
      category: novelData.category,
      status: novelData.status,
      word_count: novelData.wordCount || 0,
      last_chapter: novelData.lastChapter,
      last_update_time: novelData.lastUpdateTime,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    return item.id;
  }
}

async function getNovel(novelId) {
  return db.findOne('novels', { id: parseInt(novelId) });
}

async function getNovelByBookId(bookId, source) {
  return db.findOne('novels', { book_id: bookId, source });
}

async function saveChapters(novelId, chapters) {
  db.deleteMany('chapters', { novel_id: parseInt(novelId) });
  
  const chapterData = chapters.map(ch => ({
    novel_id: parseInt(novelId),
    chapter_id: ch.chapterId,
    title: ch.title,
    source_url: ch.sourceUrl || '',
    content: null,
    word_count: 0,
    created_at: new Date().toISOString(),
  }));
  
  db.insertMany('chapters', chapterData);
}

async function getChapters(novelId) {
  return db.findAll('chapters', { novel_id: parseInt(novelId) }, { id: 'asc' });
}

async function getChapter(novelId, chapterId) {
  return db.findOne('chapters', { 
    novel_id: parseInt(novelId), 
    chapter_id: chapterId 
  });
}

async function updateChapterContent(novelId, chapterId, content, wordCount) {
  return db.updateOne('chapters', 
    { novel_id: parseInt(novelId), chapter_id: chapterId },
    { content, word_count: wordCount }
  );
}

async function addToBookshelf(novelId, lastReadChapter = '', lastReadPosition = 0) {
  const existing = db.findOne('bookshelf', { novel_id: parseInt(novelId) });
  if (existing) {
    return existing.id;
  }
  
  const item = db.insertOne('bookshelf', {
    novel_id: parseInt(novelId),
    last_read_chapter: lastReadChapter,
    last_read_position: lastReadPosition,
    added_at: new Date().toISOString(),
  });
  return item.id;
}

async function removeFromBookshelf(novelId) {
  return db.deleteMany('bookshelf', { novel_id: parseInt(novelId) });
}

async function getBookshelf() {
  const shelfItems = db.findAll('bookshelf', null, { added_at: 'desc' });
  const result = [];
  
  for (const item of shelfItems) {
    const novel = db.findOne('novels', { id: item.novel_id });
    if (novel) {
      result.push({
        ...item,
        title: novel.title,
        author: novel.author,
        cover: novel.cover,
        source: novel.source,
        book_id: novel.book_id,
        last_chapter: novel.last_chapter,
      });
    }
  }
  
  return result;
}

async function isInBookshelf(novelId) {
  const row = db.findOne('bookshelf', { novel_id: parseInt(novelId) });
  return !!row;
}

async function updateReadProgress(novelId, chapterId, chapterTitle, position) {
  db.insertOne('readHistory', {
    novel_id: parseInt(novelId),
    chapter_id: chapterId,
    chapter_title: chapterTitle,
    read_position: position || 0,
    read_at: new Date().toISOString(),
  });
  
  db.updateOne('bookshelf', 
    { novel_id: parseInt(novelId) },
    { last_read_chapter: chapterId, last_read_position: position || 0 }
  );
}

async function getReadHistory(limit = 50) {
  const history = db.findAll('readHistory', null, { read_at: 'desc' }, limit);
  const seen = new Set();
  const result = [];
  
  for (const item of history) {
    const key = item.novel_id;
    if (seen.has(key)) continue;
    seen.add(key);
    
    const novel = db.findOne('novels', { id: item.novel_id });
    if (novel) {
      result.push({
        novel_id: item.novel_id,
        chapter_id: item.chapter_id,
        chapter_title: item.chapter_title,
        read_position: item.read_position,
        read_at: item.read_at,
        title: novel.title,
        author: novel.author,
        cover: novel.cover,
        source: novel.source,
        book_id: novel.book_id,
      });
    }
  }
  
  return result;
}

async function saveBookReviews(novelId, reviews) {
  const reviewData = reviews.map(r => ({
    novel_id: parseInt(novelId),
    review_id: r.reviewId,
    user_name: r.userName,
    user_avatar: r.userAvatar,
    content: r.content,
    rating: r.rating,
    like_count: r.likeCount,
    reply_count: r.replyCount,
    review_time: r.reviewTime,
    source: r.source,
    created_at: new Date().toISOString(),
  }));
  
  return db.insertOrIgnore('bookReviews', 'review_id', reviewData);
}

async function getBookReviews(novelId, page = 1, pageSize = 20) {
  const offset = (page - 1) * pageSize;
  return db.findAll('bookReviews', 
    { novel_id: parseInt(novelId) }, 
    { like_count: 'desc', review_time: 'desc' },
    pageSize,
    offset
  );
}

async function getBookReviewCount(novelId) {
  return db.count('bookReviews', { novel_id: parseInt(novelId) });
}

async function saveParagraphComments(novelId, chapterId, comments) {
  const commentData = comments.map(c => ({
    novel_id: parseInt(novelId),
    chapter_id: chapterId,
    paragraph_index: c.paragraphIndex,
    comment_id: c.commentId,
    user_name: c.userName,
    user_avatar: c.userAvatar,
    content: c.content,
    like_count: c.likeCount,
    comment_time: c.commentTime,
    source: c.source,
    created_at: new Date().toISOString(),
  }));
  
  return db.insertOrIgnore('paragraphComments', 'comment_id', commentData);
}

async function getParagraphComments(novelId, chapterId, paragraphIndex = null) {
  const filter = { 
    novel_id: parseInt(novelId), 
    chapter_id: chapterId 
  };
  
  if (paragraphIndex !== null) {
    filter.paragraph_index = paragraphIndex;
    return db.findAll('paragraphComments', 
      filter, 
      { like_count: 'desc', comment_time: 'desc' }
    );
  }
  
  return db.findAll('paragraphComments', 
    filter, 
    { paragraph_index: 'asc', like_count: 'desc' }
  );
}

module.exports = {
  upsertNovel,
  getNovel,
  getNovelByBookId,
  saveChapters,
  getChapters,
  getChapter,
  updateChapterContent,
  addToBookshelf,
  removeFromBookshelf,
  getBookshelf,
  isInBookshelf,
  updateReadProgress,
  getReadHistory,
  saveBookReviews,
  getBookReviews,
  getBookReviewCount,
  saveParagraphComments,
  getParagraphComments,
};
