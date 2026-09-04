const SPREADSHEET_ID = '1IYyx3Peb6Jkiq8miyZaTOpfhoHKR5rGQ1qhwhLrdDXw';

const CARDS_SHEET_NAME = 'Cards';
const HISTORY_SHEET_NAME = 'History';
const DAILY_SHEET_NAME = 'Daily';

const JST_TIMEZONE = 'Asia/Tokyo';
const DAILY_GOAL = 40;

function doGet(e) {
  const parameters = e && e.parameter ? e.parameter : {};
  const callback = normalizeCallback_(parameters.callback);

  try {
    verifyApiToken_(parameters.token);
    const payload = parameters.payload ? JSON.parse(parameters.payload) : {};
    let response;

    switch (parameters.action) {
      case 'getCards':
        response = { success: true, cards: getQuestions({}) };
        break;
      case 'getNudgeStatus':
        response = { success: true, status: getNudgeStatus() };
        break;
      case 'saveResult':
        response = saveResult(payload.id, payload.result, payload.eventId, payload.timestamp);
        break;
      case 'addCard':
        response = addCard(payload.card);
        break;
      default:
        throw new Error('不明なAPIアクションです。');
    }

    return createApiOutput_(callback, response);
  } catch (error) {
    return createApiOutput_(callback, {
      success: false,
      error: error && error.message ? error.message : String(error)
    });
  }
}

function normalizeCallback_(callback) {
  const value = normalizeText(callback);
  if (!/^[A-Za-z_$][0-9A-Za-z_$\.]*$/.test(value)) {
    throw new Error('callbackが不正です。');
  }
  return value;
}

function verifyApiToken_(providedToken) {
  const expectedToken = PropertiesService.getScriptProperties().getProperty('API_TOKEN');
  if (expectedToken && normalizeText(providedToken) !== expectedToken) {
    throw new Error('APIトークンが不正です。');
  }
}

function createApiOutput_(callback, data) {
  return ContentService
    .createTextOutput(callback + '(' + JSON.stringify(data) + ');')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function getSpreadsheet() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function getCardsSheet() {
  const sheet = getSpreadsheet().getSheetByName(CARDS_SHEET_NAME);
  if (!sheet) throw new Error('Cards シートが見つかりません。');
  return sheet;
}

function getHistorySheet() {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(HISTORY_SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(HISTORY_SHEET_NAME);

  sheet.getRange(1, 1, 1, 5).setValues([[
    '日時', 'ID', '評価', 'EventID', '学習日(JST)'
  ]]);

  return sheet;
}

function getDailySheet() {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(DAILY_SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(DAILY_SHEET_NAME);

  sheet.getRange(1, 1, 1, 5).setValues([[
    '日付(JST)', '目標数', '学習数', '達成', '達成日時'
  ]]);

  return sheet;
}

function normalizeText(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function getFilters() {
  const sheet = getCardsSheet();
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return {
      subjects: [],
      majorCategories: [],
      categories: [],
      topics: [],
      majorCategoriesBySubject: {}
    };
  }

  const values = sheet.getRange(2, 1, lastRow - 1, 13).getValues();
  const subjects = new Set();
  const majorCategories = new Set();
  const categories = new Set();
  const topics = new Set();
  const majorCategoriesBySubject = {};

  values.forEach(row => {
    const subject = normalizeText(row[1]);
    const majorCategory = normalizeText(row[2]);
    const category = normalizeText(row[3]);
    const topic = normalizeText(row[4]);
    const question = normalizeText(row[6]);
    const rule = normalizeText(row[8]);

    if (!question || !rule) return;

    if (subject) subjects.add(subject);
    if (majorCategory) majorCategories.add(majorCategory);
    if (category) categories.add(category);
    if (topic) topics.add(topic);

    if (subject && majorCategory) {
      if (!majorCategoriesBySubject[subject]) {
        majorCategoriesBySubject[subject] = [];
      }
      if (!majorCategoriesBySubject[subject].includes(majorCategory)) {
        majorCategoriesBySubject[subject].push(majorCategory);
      }
    }
  });

  Object.keys(majorCategoriesBySubject).forEach(subject => {
    majorCategoriesBySubject[subject].sort((a, b) => a.localeCompare(b, 'ja'));
  });

  return {
    subjects: Array.from(subjects).sort(),
    majorCategories: Array.from(majorCategories).sort(),
    categories: Array.from(categories).sort(),
    topics: Array.from(topics).sort(),
    majorCategoriesBySubject: majorCategoriesBySubject
  };
}

function getQuestions(filters) {
  const sheet = getCardsSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const values = sheet.getRange(2, 1, lastRow - 1, 13).getValues();
  const selectedSubjects = filters && Array.isArray(filters.subjects)
    ? filters.subjects.map(normalizeText).filter(Boolean)
    : [];
  const selectedMajorCategories = filters && Array.isArray(filters.majorCategories)
    ? filters.majorCategories.map(normalizeText).filter(Boolean)
    : [];

  return values
    .filter(row => {
      const subject = normalizeText(row[1]);
      const majorCategory = normalizeText(row[2]);
      const question = normalizeText(row[6]);
      const rule = normalizeText(row[8]);

      if (!question || !rule) return false;
      if (selectedSubjects.length > 0 && !selectedSubjects.includes(subject)) return false;
      if (selectedMajorCategories.length > 0 && !selectedMajorCategories.includes(majorCategory)) return false;
      return true;
    })
    .map(row => ({
      id: normalizeText(row[0]),
      subject: normalizeText(row[1]),
      majorCategory: normalizeText(row[2]),
      category: normalizeText(row[3]),
      topic: normalizeText(row[4]),
      trigger: normalizeText(row[5]),
      question: normalizeText(row[6]),
      clozeRule: normalizeText(row[7]),
      rule: normalizeText(row[8]),
      reason: normalizeText(row[9]),
      caseName: normalizeText(row[10]),
      article: normalizeText(row[11]),
      lawUrl: normalizeText(row[12])
    }));
}

function saveResult(id, result, eventId, eventTimestamp) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);

  try {
    const normalizedId = normalizeText(id);
    const normalizedResult = normalizeText(result);
    const normalizedEventId = normalizeText(eventId);

    if (!normalizedId || !normalizedResult) {
      throw new Error('IDまたは評価が不正です。');
    }

    const historySheet = getHistorySheet();

    if (normalizedEventId && eventIdExists_(historySheet, normalizedEventId)) {
      return {
        success: true,
        duplicate: true,
        justAchieved: false,
        status: getNudgeStatus_()
      };
    }

    let eventDate = new Date();
    if (eventTimestamp) {
      const parsed = new Date(eventTimestamp);
      if (!Number.isNaN(parsed.getTime())) eventDate = parsed;
    }

    const studyDate = formatJstDate_(eventDate);
    historySheet.appendRow([
      eventDate,
      normalizedId,
      normalizedResult,
      normalizedEventId,
      studyDate
    ]);

    const count = countHistoryForDate_(studyDate);
    const justAchieved = count === DAILY_GOAL;
    updateDailyRow_(studyDate, count, justAchieved ? eventDate : null);

    return {
      success: true,
      duplicate: false,
      justAchieved: justAchieved,
      status: getNudgeStatus_()
    };
  } finally {
    lock.releaseLock();
  }
}

function eventIdExists_(sheet, eventId) {
  if (!eventId) return false;
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;

  const found = sheet
    .getRange(2, 4, lastRow - 1, 1)
    .createTextFinder(eventId)
    .matchEntireCell(true)
    .findNext();

  return Boolean(found);
}

function buildHistoryCounts_() {
  const sheet = getHistorySheet();
  const lastRow = sheet.getLastRow();
  const counts = {};
  if (lastRow < 2) return counts;

  const values = sheet.getRange(2, 1, lastRow - 1, 5).getValues();
  values.forEach(row => {
    const rawDate = row[0];
    if (!rawDate) return;
    const date = rawDate instanceof Date ? rawDate : new Date(rawDate);
    if (Number.isNaN(date.getTime())) return;
    const studyDate = formatJstDate_(date);
    counts[studyDate] = (counts[studyDate] || 0) + 1;
  });

  return counts;
}

function countHistoryForDate_(dateString) {
  const counts = buildHistoryCounts_();
  return counts[dateString] || 0;
}

function getNudgeStatus() {
  return getNudgeStatus_();
}

function getNudgeStatus_() {
  const today = formatJstDate_(new Date());
  const counts = buildHistoryCounts_();
  const todayCount = counts[today] || 0;
  const remaining = Math.max(DAILY_GOAL - todayCount, 0);
  const achieved = todayCount >= DAILY_GOAL;
  const totalAchievements = Object.values(counts).filter(count => count >= DAILY_GOAL).length;
  const currentStreak = calculateCurrentStreak_(counts, today);

  updateDailyRow_(today, todayCount, null);

  return {
    date: today,
    goal: DAILY_GOAL,
    count: todayCount,
    remaining: remaining,
    achieved: achieved,
    currentStreak: currentStreak,
    totalAchievements: totalAchievements
  };
}

function calculateCurrentStreak_(counts, today) {
  let cursor = today;
  if ((counts[today] || 0) < DAILY_GOAL) {
    cursor = shiftDateString_(today, -1);
  }

  let streak = 0;
  while ((counts[cursor] || 0) >= DAILY_GOAL) {
    streak += 1;
    cursor = shiftDateString_(cursor, -1);
  }
  return streak;
}

function updateDailyRow_(dateString, count, achievedAt) {
  const sheet = getDailySheet();
  const rowNumber = findDailyRow_(sheet, dateString);
  const achieved = count >= DAILY_GOAL;

  if (rowNumber) {
    const previousAchieved = sheet.getRange(rowNumber, 4).getValue() === true;
    sheet.getRange(rowNumber, 2).setValue(DAILY_GOAL);
    sheet.getRange(rowNumber, 3).setValue(count);
    sheet.getRange(rowNumber, 4).setValue(achieved);

    if (achieved && !previousAchieved) {
      sheet.getRange(rowNumber, 5).setValue(achievedAt || new Date());
    }
    if (!achieved) sheet.getRange(rowNumber, 5).clearContent();
    return;
  }

  sheet.appendRow([
    dateString,
    DAILY_GOAL,
    count,
    achieved,
    achieved ? (achievedAt || new Date()) : ''
  ]);
}

function findDailyRow_(sheet, dateString) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  const dates = sheet
    .getRange(2, 1, lastRow - 1, 1)
    .getDisplayValues()
    .flat();

  const index = dates.findIndex(value => normalizeText(value) === dateString);
  return index < 0 ? null : index + 2;
}

function formatJstDate_(date) {
  return Utilities.formatDate(date, JST_TIMEZONE, 'yyyy-MM-dd');
}

function shiftDateString_(dateString, days) {
  const date = new Date(dateString + 'T00:00:00+09:00');
  date.setUTCDate(date.getUTCDate() + days);
  return Utilities.formatDate(date, JST_TIMEZONE, 'yyyy-MM-dd');
}

function addCard(card) {
  if (!card) throw new Error('カード情報がありません。');

  const subject = normalizeText(card.subject);
  const majorCategory = normalizeText(card.majorCategory);
  const category = normalizeText(card.category);
  const topic = normalizeText(card.topic);
  const trigger = normalizeText(card.trigger);
  const question = normalizeText(card.question);
  const clozeRule = normalizeText(card.clozeRule);
  const rule = normalizeText(card.rule);
  const reason = normalizeText(card.reason);
  const caseName = normalizeText(card.caseName);
  const article = normalizeText(card.article);
  const lawUrl = normalizeText(card.lawUrl);

  if (!subject) throw new Error('科目を入力してください。');
  if (!majorCategory) throw new Error('大分野を入力してください。');
  if (!category) throw new Error('分野を入力してください。');
  if (!question) throw new Error('質問を入力してください。');
  if (!rule) throw new Error('規範を入力してください。');

  const sheet = getCardsSheet();
  const id = createNextId(sheet);

  sheet.appendRow([
    id,
    subject,
    majorCategory,
    category,
    topic,
    trigger,
    question,
    clozeRule || rule,
    rule,
    reason,
    caseName,
    article,
    lawUrl
  ]);

  return { success: true, id: id };
}

function createNextId(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return '001';

  const ids = sheet
    .getRange(2, 1, lastRow - 1, 1)
    .getValues()
    .flat()
    .map(value => parseInt(value, 10))
    .filter(value => !Number.isNaN(value));

  const next = ids.length > 0 ? Math.max(...ids) + 1 : 1;
  return String(next).padStart(3, '0');
}

function testCards() {
  const questions = getQuestions({ subjects: [], majorCategories: [] });
  Logger.log('問題数: ' + questions.length);
  if (questions.length > 0) Logger.log(JSON.stringify(questions[0], null, 2));
}

function testNudgeStatus() {
  Logger.log(JSON.stringify(getNudgeStatus_(), null, 2));
}
