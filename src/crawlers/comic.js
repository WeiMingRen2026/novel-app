const BASE_URL = 'https://www.biqukan.la';
const SOURCE_NAME = 'comic_biqukan';

const MOCK_COMICS = [
  { id: 'c1', title: '斗破苍穹', author: '任翔', cover: '🔴', category: '热血', intro: '三十年河东，三十年河西，莫欺少年穷！年仅15岁的萧家废物萧炎，于此地，立下了誓言，从今以后便一步步走向斗气大陆巅峰！', status: '连载中', chapters: 500, lastChapter: '第500话 大结局' },
  { id: 'c2', title: '斗罗大陆', author: '穆逢春', cover: '🔵', category: '玄幻', intro: '唐门外门弟子唐三，因偷学内门绝学为唐门所不容，跳崖明志时却发现没有死，反而以另外一个身份来到了另一个世界，一个属于武魂的世界，名叫斗罗大陆。', status: '连载中', chapters: 400, lastChapter: '第400话 海神传承' },
  { id: 'c3', title: '完美世界', author: '辰东', cover: '🟡', category: '热血', intro: '一粒尘可填海，一根草斩尽日月星辰，弹指间轰杀诸天强者。一个少年从大荒中走出，一切从这里开始……', status: '连载中', chapters: 350, lastChapter: '第350话 荒天帝' },
  { id: 'c4', title: '海贼王', author: '尾田荣一郎', cover: '🟢', category: '热血', intro: '拥有财富、名声、权势，这世界上的一切的男人海贼王哥尔·D·罗杰，在遭到处刑之前说出来一句话，让全世界的人们趋之若鹜奔向大海。', status: '连载中', chapters: 1100, lastChapter: '第1100话 最终之岛' },
  { id: 'c5', title: '火影忍者', author: '岸本齐史', cover: '🟠', category: '热血', intro: '这是一个忍者的世界。鸣人因身上封印着邪恶的九尾妖狐，受尽了村人的冷落，只是拼命用各种恶作剧试图吸引大家的注意力。', status: '已完结', chapters: 700, lastChapter: '第700话 最终话' },
  { id: 'c6', title: '进击的巨人', author: '谏山创', cover: '⚫', category: '暗黑', intro: '那一天，人类终于回想起了，曾经一度被巨人支配的恐惧，和被囚禁在鸟笼里的屈辱。', status: '已完结', chapters: 139, lastChapter: '第139话 朝着那棵树' },
  { id: 'c7', title: '鬼灭之刃', author: '吾峠呼世晴', cover: '🔴', category: '热血', intro: '大正时期的日本，卖炭少年炭治郎一家被鬼杀死，妹妹祢豆子也变成了鬼。为了让妹妹变回人类，炭治郎踏上了成为鬼杀队剑士的道路。', status: '已完结', chapters: 205, lastChapter: '第205话 生命璀璨' },
  { id: 'c8', title: '咒术回战', author: '芥见下下', cover: '🟣', category: '热血', intro: '高中生虎杖悠仁吞下了诅咒之王两面宿傩的手指，从此卷入了咒术师的世界。为了守护他人，他加入了东京都立咒术高等专门学校。', status: '连载中', chapters: 260, lastChapter: '第260话 决战' },
  { id: 'c9', title: '间谍过家家', author: '远藤达哉', cover: '🟤', category: '搞笑', intro: '为了执行任务，间谍黄昏组建了一个"家庭"。然而妻子是杀手，女儿是超能力者，三人都隐瞒着真实身份生活在一起。', status: '连载中', chapters: 100, lastChapter: '第100话 家庭旅行' },
  { id: 'c10', title: '葬送的芙莉莲', author: '山田钟人', cover: '🔵', category: '治愈', intro: '魔王被勇者一行人打倒后，精灵魔法使芙莉莲与同伴们道别。千年的时光对于长寿的精灵而言不过是一瞬，但她开始后悔没有更多地了解同伴们。', status: '连载中', chapters: 150, lastChapter: '第150话 魔法的意义' },
  { id: 'c11', title: '【我推的孩子】', author: '赤坂明', cover: '🩷', category: '偶像', intro: '爱的孩子，阿库亚和露比。两人在表面上是普通的偶像少女的孩子，实际上是爱的狂热粉丝和被爱杀死的医生的转世。', status: '连载中', chapters: 140, lastChapter: '第140话 电影开拍' },
  { id: 'c12', title: '电锯人', author: '藤本树', cover: '🟠', category: '暗黑', intro: '电次是一个欠债累累的少年，他与链锯恶魔波奇塔一起工作还债。在被背叛杀死后，他与波奇塔签订契约，成为了电锯人。', status: '连载中', chapters: 180, lastChapter: '第180话 战争恶魔' },
  { id: 'c13', title: '五等分的新娘', author: '春场葱', cover: '🩷', category: '恋爱', intro: '贫穷的高中生上杉风太郎，成为了五胞胎姐妹的家庭教师。他必须让这五名成绩垫底的美少女顺利毕业……', status: '已完结', chapters: 122, lastChapter: '第122话 五等分的新娘' },
  { id: 'c14', title: '辉夜大小姐想让我告白', author: '赤坂明', cover: '💜', category: '恋爱', intro: '学生会长白银御行和副会长四宫辉夜互相喜欢，但两人都因为自尊心过高无法坦率地表白。一场"让对方先告白"的头脑战就此展开。', status: '已完结', chapters: 195, lastChapter: '第195话 最终话' },
  { id: 'c15', title: '一人之下', author: '米二', cover: '🟢', category: '玄幻', intro: '这个世界是存在异人的。张楚岚就是一个隐藏在普通人中的异人。在失去爷爷之后，神秘少女冯宝宝闯入了他的生活。', status: '连载中', chapters: 600, lastChapter: '第600话 炁体源流' },
  { id: 'c16', title: '狐妖小红娘', author: '小新', cover: '🩷', category: '恋爱', intro: '狐妖一族的涂山苏苏，为了成为最优秀的红线仙，努力完成一个个转世续缘任务。人与妖之间的爱情故事，由此展开。', status: '连载中', chapters: 700, lastChapter: '第700话 相思树下' },
];

const CATEGORIES = [
  { name: '热血', icon: '🔥' },
  { name: '玄幻', icon: '⚡' },
  { name: '恋爱', icon: '💕' },
  { name: '搞笑', icon: '😂' },
  { name: '治愈', icon: '🌸' },
  { name: '暗黑', icon: '💀' },
  { name: '偶像', icon: '✨' },
  { name: '科幻', icon: '🚀' },
  { name: '悬疑', icon: '🔍' },
  { name: '校园', icon: '🏫' },
  { name: '美食', icon: '🍜' },
  { name: '运动', icon: '⚽' },
];

function randomTitle(cat) {
  const prefixes = ['无敌', '最强', '绝世', '从', '我，', '重生之', '穿越之', '我的'];
  const suffixes = ['系统', '日常', '生活', '之路', '传说', '纪元', '世界', '大陆'];
  const cats = cat ? [cat] : CATEGORIES.map(c => c.name);
  const c = cats[Math.floor(Math.random() * cats.length)];
  return prefixes[Math.floor(Math.random()*prefixes.length)] + c + suffixes[Math.floor(Math.random()*suffixes.length)];
}

function randomAuthor() {
  const names = ['张三', '李四', '王五', '赵六', '墨白', '清风', '夜寒', '落尘', '星魂', '月下'];
  return names[Math.floor(Math.random() * names.length)];
}

async function search(keyword, page = 1) {
  try {
    const results = MOCK_COMICS.filter(c => 
      c.title.includes(keyword) || c.author.includes(keyword)
    );
    if (results.length === 0) {
      for (let i = 0; i < 10; i++) {
        results.push({
          bookId: 'mock_' + Date.now() + '_' + i,
          source: SOURCE_NAME,
          title: keyword + '第' + (i+1) + '季',
          author: randomAuthor(),
          cover: '📚',
          intro: '这是一部关于' + keyword + '的精彩漫画作品。',
          category: '热血',
          status: '连载中',
          lastChapter: '最新话',
          type: 'comic',
        });
      }
    }
    return results.map(c => ({
      bookId: c.id || c.bookId,
      source: SOURCE_NAME,
      title: c.title,
      author: c.author,
      cover: c.cover || '📚',
      intro: c.intro || '',
      category: c.category || '未知',
      status: c.status || '连载中',
      lastChapter: c.lastChapter || '',
      type: 'comic',
    }));
  } catch (error) {
    console.error('漫画搜索失败:', error.message);
    return [];
  }
}

async function getBookInfo(bookId) {
  try {
    let comic = MOCK_COMICS.find(c => c.id === bookId);
    if (!comic) {
      comic = {
        id: bookId,
        title: '未知漫画',
        author: '未知作者',
        cover: '📚',
        category: '未知',
        intro: '暂无简介',
        status: '连载中',
        chapters: 100,
        lastChapter: '第100话',
      };
    }
    
    const chapters = [];
    for (let i = 1; i <= comic.chapters; i++) {
      chapters.push({
        chapterId: 'ch_' + i,
        title: '第' + i + '话',
        pageCount: 20 + Math.floor(Math.random() * 15),
      });
    }
    
    return {
      info: {
        bookId: comic.id,
        source: SOURCE_NAME,
        title: comic.title,
        author: comic.author,
        cover: comic.cover,
        intro: comic.intro,
        category: comic.category,
        status: comic.status,
        lastChapter: comic.lastChapter,
        totalChapters: comic.chapters,
        type: 'comic',
      },
      chapters,
    };
  } catch (error) {
    console.error('漫画详情失败:', error.message);
    throw error;
  }
}

async function getChapterContent(bookId, chapterId) {
  try {
    const pages = [];
    const pageCount = 20 + Math.floor(Math.random() * 10);
    for (let i = 1; i <= pageCount; i++) {
      pages.push({
        page: i,
        imageUrl: '',
        text: '第 ' + i + ' 页 - 精彩内容展示中...',
      });
    }
    return {
      title: chapterId.replace('ch_', '第') + '话',
      pages,
      pageCount,
    };
  } catch (error) {
    console.error('漫画章节失败:', error.message);
    throw error;
  }
}

async function getCategories() {
  return CATEGORIES.map(c => ({ name: c.name, icon: c.icon, source: SOURCE_NAME }));
}

async function getRankings(rankType = 'hot', page = 1) {
  try {
    const shuffled = [...MOCK_COMICS].sort(() => Math.random() - 0.5);
    return shuffled.map((c, i) => ({
      rank: i + 1,
      bookId: c.id,
      source: SOURCE_NAME,
      title: c.title,
      author: c.author,
      cover: c.cover,
      category: c.category,
      type: 'comic',
    }));
  } catch (error) {
    console.error('漫画排行榜失败:', error.message);
    return [];
  }
}

async function getRandom(count = 5) {
  try {
    const shuffled = [...MOCK_COMICS].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count).map(c => ({
      bookId: c.id,
      source: SOURCE_NAME,
      title: c.title,
      author: c.author,
      cover: c.cover,
      intro: c.intro,
      category: c.category,
      status: c.status,
      type: 'comic',
    }));
  } catch (error) {
    console.error('随机推荐失败:', error.message);
    return [];
  }
}

async function getByCategory(category, page = 1) {
  try {
    let results = MOCK_COMICS.filter(c => c.category === category);
    if (results.length === 0) {
      for (let i = 0; i < 12; i++) {
        results.push({
          id: category + '_' + i,
          title: category + '漫画' + (i+1),
          author: randomAuthor(),
          cover: '📚',
          category: category,
          intro: '一部精彩的' + category + '漫画。',
          status: '连载中',
          type: 'comic',
        });
      }
    }
    return results.map(c => ({
      bookId: c.id,
      source: SOURCE_NAME,
      title: c.title,
      author: c.author,
      cover: c.cover,
      intro: c.intro || '',
      category: c.category,
      status: c.status || '连载中',
      type: 'comic',
    }));
  } catch (error) {
    console.error('分类漫画失败:', error.message);
    return [];
  }
}

module.exports = {
  search,
  getBookInfo,
  getChapterContent,
  getCategories,
  getRankings,
  getRandom,
  getByCategory,
  SOURCE_NAME,
};
