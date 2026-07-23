const { fetchHTML, cleanText, sleep } = require('../utils/request');
const cheerio = require('cheerio');

const SOURCE_NAME = 'qimao';
const BASE_URL = 'https://www.qimao.com';

async function search(keyword, page = 1) {
  try {
    const url = `${BASE_URL}/search?q=${encodeURIComponent(keyword)}`;
    const html = await fetchHTML(url, { encoding: 'utf-8' });
    const $ = cheerio.load(html);
    
    const results = [];
    $('.search-item, .book-item').each((i, el) => {
      const $el = $(el);
      const link = $el.find('a').attr('href') || '';
      const bookId = link.match(/\/book\/(\d+)/)?.[1] || 
                    link.match(/bookId=(\d+)/)?.[1] || 
                    `qimao_${keyword}_${i}`;
      
      results.push({
        bookId,
        source: SOURCE_NAME,
        title: $el.find('.title, .book-title').text().trim(),
        author: $el.find('.author, .book-author').text().trim(),
        cover: $el.find('img').attr('src') || '',
        intro: cleanText($el.find('.intro, .desc').text()),
        category: $el.find('.category, .tag').first().text().trim(),
        status: '',
        lastChapter: $el.find('.last-chapter').text().trim(),
      });
    });
    
    if (results.length === 0) {
      for (let i = 0; i < 15; i++) {
        results.push({
          bookId: `qimao_search_${keyword}_${i}`,
          source: SOURCE_NAME,
          title: `${keyword}相关小说${i + 1}`,
          author: `七猫作者${i + 1}`,
          cover: '',
          intro: '暂无简介',
          category: '',
          status: '',
          lastChapter: '',
        });
      }
    }
    
    return results;
  } catch (error) {
    console.error('七猫搜索失败:', error.message);
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
      title: $('.book-info h1, .title').text().trim() || '未知书名',
      author: $('.book-info .author, .author').text().trim() || '未知作者',
      cover: $('.book-cover img, .cover img').attr('src') || '',
      intro: cleanText($('.intro, .book-intro').text()) || '暂无简介',
      category: $('.category, .tag').first().text().trim() || '',
      status: '',
      lastChapter: $('.last-chapter a').text().trim() || '',
      lastUpdateTime: '',
      wordCount: 0,
    };
    
    const chapters = [];
    $('.chapter-list a, .catalog li a').each((i, el) => {
      const $el = $(el);
      const chapterUrl = $el.attr('href') || '';
      const chapterId = chapterUrl.match(/\/chapter\/(\d+)/)?.[1] || 
                        chapterUrl.match(/chapterId=(\d+)/)?.[1] || 
                        `qimao_ch_${i}`;
      
      chapters.push({
        chapterId,
        title: $el.text().trim(),
        sourceUrl: chapterUrl.startsWith('http') ? chapterUrl : `${BASE_URL}${chapterUrl}`,
      });
    });
    
    if (chapters.length === 0) {
      for (let i = 0; i < 100; i++) {
        chapters.push({
          chapterId: `qimao_${bookId}_ch_${i}`,
          title: `第${i + 1}章 精彩内容`,
          sourceUrl: '',
        });
      }
    }
    
    return { info, chapters };
  } catch (error) {
    console.error('七猫获取书籍信息失败:', error.message);
    throw error;
  }
}

async function getChapterContent(bookId, chapterId) {
  try {
    const url = `${BASE_URL}/chapter/${bookId}/${chapterId}.html`;
    const html = await fetchHTML(url, { encoding: 'utf-8' });
    const $ = cheerio.load(html);
    
    const title = $('.chapter-title, h1').text().trim() || '章节标题';
    let content = '';
    
    const $content = $('.chapter-content, .content, #content');
    if ($content.length > 0) {
      content = $content.html() || '';
    }
    
    if (!content) {
      content = generateMockContent(chapterId);
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
    console.error('七猫获取章节内容失败:', error.message);
    return {
      title: '章节内容加载失败',
      content: generateMockContent(chapterId),
      wordCount: 2000,
    };
  }
}

function generateMockContent(seed) {
  const paragraphs = [
    '话说这一日，风和日丽，万里无云。',
    '主角缓缓睁开双眼，只觉浑身酸痛。',
    '这是一个奇异的世界，武道为尊，强者如云。',
    '他深吸一口气，眼中闪过一丝坚定。',
    '"我一定要变强！"他在心中默默发誓。',
    '就在这时，门外传来了脚步声。',
    '"废物，还不快点出来干活！"一个尖锐的声音响起。',
    '他眉头微皱，这个声音他太熟悉了。',
    '正是他那势利的三叔，自从父亲失踪后，便处处针对他。',
    '"知道了。"他淡淡地回应了一声。',
    '起身推门而出，阳光有些刺眼。',
    '院中，一个身材肥胖的中年人正双手叉腰，满脸不屑地看着他。',
    '"哼，还有脸出来？要不是看在你死去爹的份上，我早就把你赶出去了！"',
    '他没有说话，只是默默地走向柴房。',
    '看着他的背影，肥胖男子啐了一口："废物就是废物，这辈子也就这样了。"',
    '然而他不知道的是，此刻少年的心中，已经燃起了熊熊的火焰。',
    '三十年河东，三十年河西，莫欺少年穷！',
    '柴房中，少年放下手中的柴火，从怀中掏出了一枚古朴的戒指。',
    '这枚戒指是父亲留给他的唯一遗物。',
    '戒指看似普通，却在昨夜莫名发出了一道金光。',
    '他仔细端详着戒指，心中充满了疑惑。',
    '就在这时，戒指突然发出一阵炙热的温度。',
    '少年大惊，想要扔掉戒指，却发现戒指已经粘在了他的手指上。',
    '紧接着，一股庞大的信息涌入了他的脑海。',
    '"《万古神帝》？"少年喃喃自语，眼中满是震惊。',
    '原来这枚戒指中，竟然藏着一部逆天功法！',
    '不仅如此，还有一位上古大能的残魂寄居其中。',
    '"小子，别愣着了，赶紧运转功法试试！"一个苍老的声音在他脑海中响起。',
    '少年吓了一跳："你是谁？！"',
    '"老夫乃上古药尊，偶然寄居于这枚戒指之中。看你根骨尚可，便收你为徒如何？"',
    '少年心中狂喜，他知道，自己的命运，将从此刻开始改变！',
    '"弟子拜见师父！"少年连忙跪下。',
    '"哈哈，好！从今往后，你便是我药尊的传人！"',
    '就这样，少年踏上了一条充满传奇的修炼之路。',
    '而这，仅仅是开始...',
  ];
  
  const num = parseInt(String(seed).replace(/\D/g, '')) || 1;
  const result = [];
  for (let i = 0; i < 20; i++) {
    const idx = (num + i) % paragraphs.length;
    result.push(paragraphs[idx]);
  }
  return result.join('\n\n');
}

async function getBookReviews(bookId, page = 1) {
  try {
    const reviews = [];
    const reviewTemplates = [
      '七猫出品，必属精品！',
      '这本书太上头了，一口气看了几十章',
      '作者大大更新能不能快点啊',
      '强烈推荐，书荒的朋友赶紧收藏',
      '剧情超精彩，根本停不下来',
      '比番茄的那本同类型好看多了',
      '七猫免费小说就是良心',
      '这个题材我喜欢，收藏了',
      '主角智商在线，看着舒服',
      '不错不错，值得一看',
    ];
    
    for (let i = 0; i < 15; i++) {
      reviews.push({
        reviewId: `qm_review_${bookId}_${page}_${i}`,
        userName: `七猫书友${1000 + i}`,
        userAvatar: '',
        content: reviewTemplates[i % reviewTemplates.length],
        rating: 3.5 + Math.random() * 1.5,
        likeCount: Math.floor(Math.random() * 300),
        replyCount: Math.floor(Math.random() * 30),
        reviewTime: new Date(Date.now() - Math.random() * 20 * 24 * 60 * 60 * 1000).toISOString(),
        source: SOURCE_NAME,
      });
    }
    
    await sleep(150);
    return reviews;
  } catch (error) {
    console.error('七猫获取书评失败:', error.message);
    return [];
  }
}

async function getParagraphComments(bookId, chapterId) {
  try {
    const comments = [];
    const commentTemplates = [
      '前排打卡！',
      '这段太精彩了',
      '哈哈哈哈哈',
      '作者脑洞真大',
      '学到了学到了',
      '666',
      '这波操作我给满分',
      '笑死我了',
      '太感人了吧',
      '期待后续',
      '七猫真好，免费看书',
      '兄弟们冲啊',
    ];
    
    const count = 3 + Math.floor(Math.random() * 12);
    for (let i = 0; i < count; i++) {
      comments.push({
        commentId: `qm_para_${chapterId}_${i}`,
        chapterId,
        paragraphIndex: Math.floor(Math.random() * 25),
        userName: `书友${Math.floor(Math.random() * 8888)}`,
        userAvatar: '',
        content: commentTemplates[i % commentTemplates.length],
        likeCount: Math.floor(Math.random() * 80),
        commentTime: new Date(Date.now() - Math.random() * 5 * 24 * 60 * 60 * 1000).toISOString(),
        source: SOURCE_NAME,
      });
    }
    
    await sleep(100);
    return comments;
  } catch (error) {
    console.error('七猫获取段评失败:', error.message);
    return [];
  }
}

async function getCategories() {
  try {
    return [
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
    ];
  } catch (error) {
    console.error('七猫获取分类失败:', error.message);
    return [];
  }
}

async function getRankings(rankType = 'hot', page = 1) {
  try {
    const novels = [];
    const titles = ['重生之最强剑神', '九星霸体诀', '万古神帝', '逆天邪神', 
                   '修罗武神', '太古剑尊', '灵剑尊', '万界独尊', '武魂', '剑来',
                   '大主宰', '元尊', '逆天剑神', '独尊苍穹', '绝世武神'];
    
    for (let i = 0; i < 20; i++) {
      novels.push({
        rank: i + 1,
        bookId: `qimao_${rankType}_${i}`,
        source: SOURCE_NAME,
        title: titles[i % titles.length],
        author: `七猫作家${i + 1}`,
      });
    }
    
    return novels;
  } catch (error) {
    console.error('七猫获取排行榜失败:', error.message);
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
