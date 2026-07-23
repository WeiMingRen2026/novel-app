const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../../data');
const dbFile = path.join(dataDir, 'db.json');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const defaultData = {
  novels: [],
  chapters: [],
  bookshelf: [],
  readHistory: [],
  bookReviews: [],
  paragraphComments: [],
  categories: [],
  rankings: [],
  counters: {
    novels: 0,
    chapters: 0,
    bookshelf: 0,
    readHistory: 0,
    bookReviews: 0,
    paragraphComments: 0,
  },
};

let db = null;
let saveTimer = null;

function loadDB() {
  try {
    if (fs.existsSync(dbFile)) {
      const content = fs.readFileSync(dbFile, 'utf-8');
      db = JSON.parse(content);
      
      for (const key of Object.keys(defaultData)) {
        if (!(key in db)) {
          db[key] = defaultData[key];
        }
      }
      if (!db.counters) db.counters = defaultData.counters;
    } else {
      db = JSON.parse(JSON.stringify(defaultData));
      saveDB();
    }
  } catch (error) {
    console.error('加载数据库失败:', error);
    db = JSON.parse(JSON.stringify(defaultData));
  }
}

function saveDB() {
  if (saveTimer) return;
  
  saveTimer = setTimeout(() => {
    try {
      fs.writeFileSync(dbFile, JSON.stringify(db, null, 2), 'utf-8');
    } catch (error) {
      console.error('保存数据库失败:', error);
    }
    saveTimer = null;
  }, 100);
}

function nextId(collection) {
  db.counters[collection] = (db.counters[collection] || 0) + 1;
  return db.counters[collection];
}

function findAll(collection, filter = null, sort = null, limit = null, offset = 0) {
  let items = db[collection] || [];
  
  if (filter) {
    items = items.filter(item => {
      for (const [key, value] of Object.entries(filter)) {
        if (item[key] !== value) return false;
      }
      return true;
    });
  }
  
  if (sort) {
    items = [...items].sort((a, b) => {
      for (const [key, order] of Object.entries(sort)) {
        if (a[key] < b[key]) return order === 'asc' ? -1 : 1;
        if (a[key] > b[key]) return order === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }
  
  if (offset > 0) {
    items = items.slice(offset);
  }
  
  if (limit !== null) {
    items = items.slice(0, limit);
  }
  
  return items;
}

function findOne(collection, filter) {
  const items = db[collection] || [];
  return items.find(item => {
    for (const [key, value] of Object.entries(filter)) {
      if (item[key] !== value) return false;
    }
    return true;
  }) || null;
}

function insertOne(collection, data) {
  const id = nextId(collection);
  const item = { id, ...data };
  db[collection].push(item);
  saveDB();
  return item;
}

function insertMany(collection, items) {
  const result = [];
  for (const data of items) {
    const id = nextId(collection);
    const item = { id, ...data };
    db[collection].push(item);
    result.push(item);
  }
  saveDB();
  return result;
}

function insertOrIgnore(collection, uniqueKey, items) {
  let count = 0;
  const existingKeys = new Set(
    (db[collection] || []).map(item => item[uniqueKey])
  );
  
  for (const data of items) {
    if (data[uniqueKey] && !existingKeys.has(data[uniqueKey])) {
      const id = nextId(collection);
      db[collection].push({ id, ...data });
      existingKeys.add(data[uniqueKey]);
      count++;
    }
  }
  
  if (count > 0) saveDB();
  return count;
}

function updateOne(collection, filter, updates) {
  const items = db[collection] || [];
  const index = items.findIndex(item => {
    for (const [key, value] of Object.entries(filter)) {
      if (item[key] !== value) return false;
    }
    return true;
  });
  
  if (index !== -1) {
    items[index] = { ...items[index], ...updates };
    saveDB();
    return items[index];
  }
  return null;
}

function deleteMany(collection, filter) {
  const items = db[collection] || [];
  const newItems = items.filter(item => {
    for (const [key, value] of Object.entries(filter)) {
      if (item[key] !== value) return true;
    }
    return false;
  });
  
  const deleted = items.length - newItems.length;
  db[collection] = newItems;
  if (deleted > 0) saveDB();
  return deleted;
}

function count(collection, filter = null) {
  let items = db[collection] || [];
  
  if (filter) {
    items = items.filter(item => {
      for (const [key, value] of Object.entries(filter)) {
        if (item[key] !== value) return false;
      }
      return true;
    });
  }
  
  return items.length;
}

loadDB();

module.exports = {
  findAll,
  findOne,
  insertOne,
  insertMany,
  insertOrIgnore,
  updateOne,
  deleteMany,
  count,
  saveDB,
};
