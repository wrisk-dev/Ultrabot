const { Telegraf, Markup, session } = require('telegraf');
const crypto = require('crypto');
const fs = require('fs');
const https = require('https');
const axios = require('axios');
const { createCanvas, loadImage } = require('canvas');
const path = require('path');

const logging = {
  info: (msg) => console.log(`[INFO] ${new Date().toISOString()} - ${msg}`),
  warning: (msg) => console.log(`[WARN] ${new Date().toISOString()} - ${msg}`),
  error: (msg) => console.log(`[ERROR] ${new Date().toISOString()} - ${msg}`),
  debug: (msg) => console.log(`[DEBUG] ${new Date().toISOString()} - ${msg}`)
};

const userState = {};
const userTemp = {};
const userSessions = {};
const userPendingBets = {};
const userWaitingForResult = {};
const userSkippedBets = {};
const userShouldSkipNext = {};
const userBalanceWarnings = {};
const userSkipResultWait = {};
const userAllResults = {};
const userStopInitiated = {};
const userSLSkipWaitingForWin = {};
const userPlatforms = {};
let userSettings = {};
let userGameInfo = {};
let userStats = {};
let userLastResults = {};
let userSilentMessages = {};
let userTimeRanges = {};
let userActiveTimeRange = {};
let userTimeRangeForecastWin = {};
let userSniperCompleteImages = {};

let allowedsixlotteryIds = new Set();
let freeModeEnabled = false;

const activeUsers = new Set();

const PLATFORMS = {
  "6LOTTERY": {
    name: "6LOTTERY",
    baseUrl: "https://6lotteryapi.com/api/webapi/",
    color: "🔴"
  }
};

const COLORS = {
  GREEN: { name: 'Green', id: 11, numbers: [1, 3, 7, 9] },
  VIOLET: { name: 'Violet', id: 12, numbers: [0, 5] },
  RED: { name: 'Red', id: 10, numbers: [2, 4, 6, 8] }
};

const EMOJI = {
  WIN: '🪀',
  LOSS: '☎️',
  RESULT: '📇',
  SKIP: '⏭️',
  BET: '🧩',
  BETWRAGER: '💊',
  BALANCE: '🎫',
  PROFIT: '📈',
  LOSS_ICON: '📉',
  START: '🔋',
  STOP: '🪫',
  SETTINGS: '📟',
  STATS: '📊',
  LOGIN: '🔐',
  LOGOUT: '🚪',
  BACK: '🔙',
  MENU: '📋',
  GAME: '🎮',
  STRATEGY: '🧠',
  RISK: '🛡️',
  TARGET: '🎯',
  LAYER: '🏗️',
  MODE: '🔄',
  INFO: 'ℹ️',
  ADMIN: '👑',
  USER: '👤',
  ADD: '➕',
  REMOVE: '➖',
  BROADCAST: '📢',
  CHECK: '🔍',
  ENABLE: '✅',
  DISABLE: '❌',
  WARNING: '⚠️',
  ERROR: '❌',
  LOADING: '⏳',
  SUCCESS: '🎉',
  WAIT: '⏰',
  VIRTUAL: '🖥️',
  REAL: '💵',
  TREND: '📊',
  ALTERNATE: '🔄',
  PATTERN: '🔢',
  COLOR: '🎨',
  GREEN: '🟢',
  VIOLET: '🟣',
  RED: '🔴',
  MARTINGALE: '📈',
  ANTI_MARTINGALE: '📉',
  DALEMBERT: '⚖️',
  CUSTOM: '🎛️',
  TIME: '⏱️',
  FORECAST: '🌤️',
  LIVE: '📡',
  SILENT: '🫆',
  RESULTSBS: '🗽'
};

const STYLE = {
  SEPARATOR: '─'.repeat(15),
  BOLD: (text) => `*${text}*`,
  CODE: (text) => `\`${text}\``,
  HEADER: (text) => `🔥 *${text}* 🔥`,
  SUBHEADER: (text) => `📌 *${text}*`,
  SECTION: (text) => `📁 *${text}*`,
  ITEM: (text) => `├─ ${text}`,
  LAST_ITEM: (text) => `└─ ${text}`,
  INFO: (text) => `ℹ️ ${text}`
};

function saveUserSettings() {
  try {
    const settingsData = {
      userSettings: userSettings,
      userGameInfo: userGameInfo,
      userStats: userStats,
      userLastResults: userLastResults,
      userSilentMessages: userSilentMessages,
      userTimeRanges: userTimeRanges,
      userActiveTimeRange: userActiveTimeRange,
      userTimeRangeForecastWin: userTimeRangeForecastWin
    };
    fs.writeFileSync('user_settings.json', JSON.stringify(settingsData, null, 4));
    logging.info("User settings saved to file");
  } catch (error) {
    logging.error(`Error saving user settings: ${error}`);
  }
}

function loadUserSettings() {
  try {
    if (fs.existsSync('user_settings.json')) {
      const data = JSON.parse(fs.readFileSync('user_settings.json', 'utf8'));
      
      Object.assign(userSettings, data.userSettings || {});
      Object.assign(userGameInfo, data.userGameInfo || {});
      Object.assign(userStats, data.stats || {});
      Object.assign(userSilentMessages, data.userSilentMessages || {});
      Object.assign(userTimeRanges, data.userTimeRanges || {});
      Object.assign(userActiveTimeRange, data.userActiveTimeRange || {});
      Object.assign(userTimeRangeForecastWin, data.userTimeRangeForecastWin || {});
      
      if (data.userLastResults && Array.isArray(data.userLastResults)) {
        userLastResults.length = 0;
        data.userLastResults.forEach(item => userLastResults.push(item));
      }
      
      logging.info("User settings loaded from file");
    } else {
      logging.info("user_settings.json not found. Starting with empty settings");
    }
  } catch (error) {
    logging.error(`Error loading user settings: ${error}`);
  }
}

const FREE_MODE_CONFIG_FILE = 'free_mode.json';

function loadFreeModeSetting() {
  try {
    if (fs.existsSync(FREE_MODE_CONFIG_FILE)) {
      const data = JSON.parse(fs.readFileSync(FREE_MODE_CONFIG_FILE, 'utf8'));
      freeModeEnabled = data.enabled || false;
      logging.info(`Free Mode loaded: ${freeModeEnabled ? 'ENABLED' : 'DISABLED'}`);
    } else {
      freeModeEnabled = false;
      saveFreeModeSetting();
      logging.info("Free Mode config not found. Starting with Free Mode DISABLED");
    }
  } catch (error) {
    logging.error(`Error loading free mode setting: ${error}`);
    freeModeEnabled = false;
  }
}

function saveFreeModeSetting() {
  try {
    const data = { enabled: freeModeEnabled };
    fs.writeFileSync(FREE_MODE_CONFIG_FILE, JSON.stringify(data, null, 4));
    logging.info(`Free Mode saved: ${freeModeEnabled ? 'ENABLED' : 'DISABLED'}`);
  } catch (error) {
    logging.error(`Error saving free mode setting: ${error}`);
  }
}

async function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const agent = new https.Agent({ 
      rejectUnauthorized: false,
      keepAlive: true,
      keepAliveMsecs: 1000
    });
    
    const defaultOptions = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:142.0) Gecko/20100101 Firefox/142.0',
        'Connection': 'Keep-Alive',
        'Ar-Origin': 'https://6win598.com',
        'Origin': 'https://6win598.com',
        'Referer': 'https://6win598.com/',
      },
      timeout: 12000
    };
    
    const requestOptions = {
      ...defaultOptions,
      ...options,
      agent
    };
    
    const req = https.request(url, requestOptions, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({ data: jsonData });
        } catch (error) {
          reject(new Error(`Failed to parse response: ${error.message}`));
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });
    
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    
    req.end();
  });
}

function loadAllowedUsers() {
  try {
    if (fs.existsSync('users_6lottery.json')) {
      const data = JSON.parse(fs.readFileSync('users_6lottery.json', 'utf8'));
      allowedsixlotteryIds = new Set(data.allowed_ids || []);
      logging.info(`Loaded ${allowedsixlotteryIds.size} users`);
    } else {
      logging.warning("users_6lottery.json not found. Starting new");
      allowedsixlotteryIds = new Set();
    }
  } catch (error) {
    logging.error(`Error loading users_6lottery.json: ${error}`);
    allowedsixlotteryIds = new Set();
  }
}

function saveAllowedUsers() {
  try {
    fs.writeFileSync('users_6lottery.json', JSON.stringify({ 
      allowed_ids: Array.from(allowedsixlotteryIds) 
    }, null, 4));
    logging.info(`Saved ${allowedsixlotteryIds.size} users`);
  } catch (error) {
    logging.error(`Error saving user list: ${error}`);
  }
}

function normalizeText(text) {
  return text.normalize('NFKC').trim();
}

function isValid12HourTime(timeStr) {
  // Format: HH:MM AM/PM (or PM/AM)
  const pattern = /^(0?[1-9]|1[0-2]):[0-5][0-9]\s?(AM|PM|am|pm|Am|Pm|aM|pM)$/;
  return pattern.test(timeStr.trim());
}

function convert12to24(timeStr) {
  const trimmed = timeStr.trim();
  const [time, modifier] = trimmed.split(/\s+/);
  let [hours, minutes] = time.split(':').map(Number);
  
  if (modifier.toUpperCase() === 'PM' && hours !== 12) {
    hours += 12;
  }
  if (modifier.toUpperCase() === 'AM' && hours === 12) {
    hours = 0;
  }
  
  const paddedHours = hours.toString().padStart(2, '0');
  const paddedMinutes = minutes.toString().padStart(2, '0');
  
  return `${paddedHours}:${paddedMinutes}`;
}

function convert24to12(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  let displayHours = hours % 12;
  displayHours = displayHours === 0 ? 12 : displayHours;
  const paddedMinutes = minutes.toString().padStart(2, '0');
  
  return `${displayHours}:${paddedMinutes} ${period}`;
}

function signMd5(data) {
  const filtered = {};
  for (const [key, value] of Object.entries(data)) {
    if (key !== "signature" && key !== "timestamp") {
      filtered[key] = value;
    }
  }
  const sorted = Object.keys(filtered).sort().reduce((acc, key) => {
    acc[key] = filtered[key];
    return acc;
  }, {});
  const jsonStr = JSON.stringify(sorted).replace(/\s+/g, '');
  return crypto.createHash('md5').update(jsonStr).digest('hex').toUpperCase();
}

function computeUnitAmount(amt) {
  if (amt <= 0) return 1;
  const amtStr = String(amt);
  const trailingZeros = amtStr.length - amtStr.replace(/0+$/, '').length;
  
  if (trailingZeros >= 4) return 10000;
  if (trailingZeros === 3) return 1000;
  if (trailingZeros === 2) return 100;
  if (trailingZeros === 1) return 10;
  return Math.pow(10, amtStr.length - 1);
}

function getSelectMap(gameType, betType) {
  if (betType === 'COLOR') {
    return { 
      "G": 11,
      "V": 12,
      "R": 10
    };
  } else {
    return { 
      "B": 13,
      "S": 14
    };
  }
}

function numberToBS(num) {
  return num >= 5 ? 'B' : 'S';
}

function numberToColor(num) {
  if (COLORS.GREEN.numbers.includes(num)) return 'G';
  if (COLORS.VIOLET.numbers.includes(num)) return 'V';
  if (COLORS.RED.numbers.includes(num)) return 'R';
  return 'G';
}

function getColorName(colorCode) {
  switch(colorCode) {
    case 'G': return COLORS.GREEN.name;
    case 'V': return COLORS.VIOLET.name;
    case 'R': return COLORS.RED.name;
    default: return 'Unknown';
  }
}

function getValidDalembertBetAmount(unitSize, currentUnits, balance, minBet) {
  let amount = unitSize * currentUnits;
  
  while (amount > balance && currentUnits > 1) {
    currentUnits--;
    amount = unitSize * currentUnits;
  }
  
  if (amount > balance) {
    amount = balance;
  }
  
  if (amount < minBet) {
    amount = minBet;
  }
  
  return { amount, adjustedUnits: currentUnits };
}

function computeBetDetails(desiredAmount) {
  if (desiredAmount <= 0) {
    return { unitAmount: 0, betCount: 0, actualAmount: 0 };
  }
  
  const unitAmount = computeUnitAmount(desiredAmount);
  const betCount = Math.max(1, Math.floor(desiredAmount / unitAmount));
  const actualAmount = unitAmount * betCount;
  
  return { unitAmount, betCount, actualAmount };
}

function calculateBetAmount(settings, currentBalance) {
  const bettingStrategy = settings.betting_strategy || "Martingale";
  const betSizes = settings.bet_sizes || [100];
  const minBetSize = Math.min(...betSizes);
  
  logging.debug(`Calculating bet amount - Strategy: ${bettingStrategy}, Bet Sizes: [${betSizes.join(', ')}]`);
  
  if (bettingStrategy === "D'Alembert") {
    if (betSizes.length > 1) {
      throw new Error("D'Alembert strategy requires only ONE Bet_Wrager");
    }
    
    const unitSize = betSizes[0];
    let units = settings.dalembert_units || 1;
    
    const { amount: validAmount, adjustedUnits } = getValidDalembertBetAmount(unitSize, units, currentBalance, minBetSize);
    
    if (adjustedUnits !== units) {
      settings.dalembert_units = adjustedUnits;
      units = adjustedUnits;
      logging.info(`D'Alembert: Adjusted units to ${units} due to balance constraints`);
    }
    
    logging.info(`D'Alembert: Betting ${validAmount} (${units} units of ${unitSize})`);
    return validAmount;
    
  } else if (bettingStrategy === "Custom") {
    const customIndex = settings.custom_index || 0;
    const adjustedIndex = Math.min(customIndex, betSizes.length - 1);
    const amount = betSizes[adjustedIndex];
    logging.info(`Custom: Betting ${amount} at index ${adjustedIndex}`);
    return amount;
    
  } else {
    const martinIndex = settings.martin_index || 0;
    const adjustedIndex = Math.min(martinIndex, betSizes.length - 1);
    const amount = betSizes[adjustedIndex];
    logging.info(`${bettingStrategy}: Betting ${amount} at index ${adjustedIndex}`);
    return amount;
  }
}

function updateBettingStrategy(settings, isWin, betAmount) {
  const bettingStrategy = settings.betting_strategy || "Martingale";
  const betSizes = settings.bet_sizes || [100];
  
  logging.debug(`Updating betting strategy - Strategy: ${bettingStrategy}, Result: ${isWin ? 'WIN' : 'LOSS'}, Bet Amount: ${betAmount}`);
  
  if (bettingStrategy === "Martingale") {
    if (isWin) {
      settings.martin_index = 0;
      logging.info("Martingale: Win - Reset to index 0");
    } else {
      settings.martin_index = Math.min((settings.martin_index || 0) + 1, betSizes.length - 1);
      logging.info(`Martingale: Loss - Move to index ${settings.martin_index}`);
    }
    
  } else if (bettingStrategy === "Anti-Martingale") {
    if (isWin) {
      settings.martin_index = Math.min((settings.martin_index || 0) + 1, betSizes.length - 1);
      logging.info(`Anti-Martingale: Win - Move to index ${settings.martin_index}`);
    } else {
      settings.martin_index = 0;
      logging.info("Anti-Martingale: Loss - Reset to index 0");
    }
    
  } else if (bettingStrategy === "D'Alembert") {
    if (isWin) {
      settings.dalembert_units = Math.max(1, (settings.dalembert_units || 1) - 1);
      logging.info(`D'Alembert: Win - Decrease units to ${settings.dalembert_units}`);
    } else {
      settings.dalembert_units = (settings.dalembert_units || 1) + 1;
      logging.info(`D'Alembert: Loss - Increase units to ${settings.dalembert_units}`);
    }
    
  } else if (bettingStrategy === "Custom") {
    const currentIndex = settings.custom_index || 0;
    
    let actualIndex = 0;
    for (let i = 0; i < betSizes.length; i++) {
      if (betSizes[i] === betAmount) {
        actualIndex = i;
        break;
      }
    }
    
    if (isWin) {
      if (actualIndex > 0) {
        settings.custom_index = actualIndex - 1;
      } else {
        settings.custom_index = 0;
      }
      logging.info(`Custom: Win - Move to index ${settings.custom_index}`);
    } else {
      if (actualIndex < betSizes.length - 1) {
        settings.custom_index = actualIndex + 1;
      } else {
        settings.custom_index = betSizes.length - 1;
      }
      logging.info(`Custom: Loss - Move to index ${settings.custom_index}`);
    }
  }
}

function generateSignature(data) {
  const f = {};
  const exclude = ["signature", "track", "xosoBettingData"];
  
  Object.keys(data).sort().forEach(function(k) {
    const v = data[k];
    if (v !== null && v !== '' && !exclude.includes(k)) {
      f[k] = v === 0 ? 0 : v;
    }
  });
  
  const jstr = JSON.stringify(f);
  return crypto.createHash('md5').update(jstr).digest('hex').toUpperCase();
}

async function loginRequest(phone, password, baseUrl = PLATFORMS["6LOTTERY"].baseUrl) {
  if (!baseUrl.endsWith('/')) baseUrl += '/';

  const loginData = {
    username: "95" + phone,
    pwd: password,
    phonetype: 1,
    logintype: "mobile",
    packId: "",
    deviceId: "5dcab3e06db88a206975e91ea6ac7c87",
    language: 7,
    random: crypto.randomBytes(16).toString('hex'),
  };
  
  const signature = generateSignature(loginData);
  loginData.signature = signature;
  loginData.timestamp = Math.floor(Date.now() / 1000);
  
  try {
    const response = await axios.post(
      baseUrl + "Login",
      loginData,
      {
        headers: {
          "Content-Type": "application/json;charset=UTF-8",
          "Ar-Origin": "https://6win598.com",
          "Origin": "https://6win598.com",
          "Referer": "https://6win598.com/",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:142.0) Gecko/20100101 Firefox/142.0",
          "Accept-Language": "en-US,en;q=0.5",
          "Accept-Encoding": "gzip, deflate, br",
          "Connection": "keep-alive",
        },
        timeout: 15000,
      }
    );
    
    const res = response.data;
    if (res.code === 0 && res.data) {
      const tokenHeader = res.data.tokenHeader || "Bearer ";
      const token = res.data.token || "";
      
      const session = {
        post: async (endpoint, data) => {
          const url = baseUrl + endpoint;
          const options = {
            method: 'POST',
            headers: {
              "Authorization": `${tokenHeader}${token}`,
              "Content-Type": "application/json; charset=UTF-8",
              "Ar-Origin": "https://6win598.com",
              "Origin": "https://6win598.com",
              "Referer": "https://6win598.com/",
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:142.0) Gecko/20100101 Firefox/142.0"
            },
            body: data
          };
          return makeRequest(url, options);
        }
      };
      return { response: res, session };
    }
    return { response: res, session: null };
  } catch (error) {
    logging.error(`Login error: ${error.message}`);
    return { response: { error: error.message }, session: null };
  }
}

async function getUserInfo(session, userId) {
  const body = {
    "language": 7,
    "random": "4fc9f8f8d6764a5f934d4c6a468644e0"
  };
  body.signature = generateSignature(body).toUpperCase();
  body.timestamp = Math.floor(Date.now() / 1000);
  
  try {
    const response = await session.post("GetUserInfo", body);
    const res = response.data;
    if (res.code === 0 && res.data) {
      const info = {
        "user_id": res.data.userId,
        "username": res.data.userName,
        "nickname": res.data.nickName,
        "balance": res.data.amount,
        "photo": res.data.userPhoto,
        "login_date": res.data.userLoginDate,
        "withdraw_count": res.data.withdrawCount,
        "is_allow_withdraw": res.data.isAllowWithdraw === 1
      };
      userGameInfo[userId] = info;
      return info;
    }
    return null;
  } catch (error) {
    logging.error(`Get user info error: ${error.message}`);
    return null;
  }
}

async function getBalance(session, userId) {
  const platformKey = userSettings[userId]?.platform || "6LOTTERY";
  const platform = PLATFORMS[platformKey];
  const body = {
    "language": 7,
    "random": "71ebd56cff7d4679971c482807c33f6f"
  };
  body.signature = generateSignature(body).toUpperCase();
  body.timestamp = Math.floor(Date.now() / 1000);
  
  try {
    const response = await session.post("GetBalance", body);
    const res = response.data;
    logging.info(`Balance check response for user ${userId}`);
    
    if (res.code === 0 && res.data) {
      const data = res.data;
      const amount = data.Amount || data.amount || data.balance;
      if (amount !== undefined && amount !== null) {
        const balance = parseFloat(amount);
        if (userGameInfo[userId]) {
          userGameInfo[userId].balance = balance;
        }
        if (!userStats[userId]) {
          userStats[userId] = { start_balance: balance, profit: 0.0 };
        }
        return balance;
      }
      logging.warning(`No balance amount found for user ${userId}`);
    } else {
      logging.error(`Get balance failed for user ${userId}: ${res.msg || 'Unknown error'}`);
    }
    return null;
  } catch (error) {
    logging.error(`Balance check error for user ${userId}: ${error.message}`);
    return null;
  }
}

async function getGameIssueRequest(session, gameType) {
  let typeId, endpoint;
  
  if (gameType === "TRX") {
    typeId = 13;
    endpoint = "GetTrxGameIssue";
  } else if (gameType === "WINGO_30S") {
    typeId = 30;
    endpoint = "GetGameIssue";
  } else if (gameType === "WINGO_3MIN") {
    typeId = 2;
    endpoint = "GetGameIssue";
  } else if (gameType === "WINGO_5MIN") {
    typeId = 3;
    endpoint = "GetGameIssue";
  } else {
    typeId = 1;
    endpoint = "GetGameIssue";
  }
  
  const body = {
    "typeId": typeId,
    "language": 7,
    "random": "7d76f361dc5d4d8c98098ae3d48ef7af"
  };
  body.signature = signMd5(body).toUpperCase();
  body.timestamp = Math.floor(Date.now() / 1000);
  
  const maxRetries = 3;
  const retryDelay = 2000;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await session.post(endpoint, body);
      logging.info(`Game issue request for ${gameType}, attempt ${attempt + 1}`);
      
      if (response.data && response.data.code === 0) {
        return response.data;
      } else if (response.data && response.data.code !== 0) {
        logging.error(`Game issue error for ${gameType}: ${response.data.msg || 'Unknown error'}`);
        if (attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue;
        }
        return response.data;
      }
      
      return response.data;
    } catch (error) {
      logging.error(`Game issue error for ${gameType}, attempt ${attempt + 1}: ${error.message}`);
      
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        continue;
      }
      return { error: error.message };
    }
  }
  
  return { error: "Failed after retries" };
}

async function placeBetRequest(session, issueNumber, selectType, unitAmount, betCount, gameType, userId) {
  let typeId, endpoint;
  
  if (gameType === "TRX") {
    typeId = 13;
    endpoint = "GameTrxBetting";
  } else if (gameType === "WINGO_30S") {
    typeId = 30;
    endpoint = "GameBetting";
  } else if (gameType === "WINGO_3MIN") {
    typeId = 2;
    endpoint = "GameBetting";
  } else if (gameType === "WINGO_5MIN") {
    typeId = 3;
    endpoint = "GameBetting";
  } else {
    typeId = 1;
    endpoint = "GameBetting";
  }
  
  const settings = userSettings[userId] || {};
  const betType = settings.bet_type || "BS";
  const actualGameType = betType === "COLOR" ? 0 : 2;
  
  if (!selectType || isNaN(selectType)) {
    logging.error(`Invalid selectType: ${selectType} for user ${userId}`);
    return { error: "Invalid bet selection type" };
  }
  
  const betBody = {
    "typeId": typeId,
    "issuenumber": issueNumber,
    "language": 7,
    "gameType": actualGameType,
    "amount": unitAmount,
    "betCount": betCount,
    "selectType": parseInt(selectType),
    "random": "f9ec46840a374a65bb2abad44dfc4dc3"
  };
  betBody.signature = generateSignature(betBody).toUpperCase();
  betBody.timestamp = Math.floor(Date.now() / 1000);
  
  logging.info(`Bet request details for user ${userId}:`);
  logging.info(`  Game Type: ${gameType}, Bet Type: ${betType}, API gameType: ${actualGameType}`);
  logging.info(`  Issue: ${issueNumber}, SelectType: ${selectType}, Amount: ${unitAmount * betCount}`);
  
  for (let attempt = 0; attempt < MAX_BET_RETRIES; attempt++) {
    try {
      const response = await session.post(endpoint, betBody);
      const res = response.data;
      logging.info(`Bet request for user ${userId}, ${gameType}, issue ${issueNumber}, select_type ${selectType}, amount ${unitAmount * betCount}`);
      return res;
    } catch (error) {
      logging.error(`Bet error for user ${userId}, attempt ${attempt + 1}: ${error.message}`);
      
      if (attempt < MAX_BET_RETRIES - 1) {
        await new Promise(resolve => setTimeout(resolve, BET_RETRY_DELAY * 1000));
        continue;
      }
      return { error: error.message };
    }
  }
  return { error: "Failed after retries" };
}

async function getWingoGameResults(session, gameType = "WINGO") {
  let typeId;
  
  if (gameType === "WINGO_30S") {
    typeId = 30;
  } else if (gameType === "WINGO_3MIN") {
    typeId = 2;
  } else if (gameType === "WINGO_5MIN") {
    typeId = 3;
  } else {
    typeId = 1;
  }
  
  const body = {
    "pageSize": 10,
    "pageNo": 1,
    "typeId": typeId,
    "language": 7,
    "random": "4ad5325e389745a882f4189ed6550e70"
  };
  
  if (gameType === "WINGO_30S") {
    body.signature = "5483D466A138F08B6704354BAA7E7FB3";
    body.timestamp = 1761247150;
  } else {
    body.signature = generateSignature(body).toUpperCase();
    body.timestamp = Math.floor(Date.now() / 1000);
  }
  
  try {
    const response = await session.post("GetNoaverageEmerdList", body);
    const data = response.data;
    
    if (data && data.code === 0 && data.data && data.data.list) {
      logging.info(`Successfully fetched ${data.data.list.length} results for ${gameType}`);
      return data;
    } else {
      logging.error(`Failed to get ${gameType} results: ${data?.msg || 'Unknown error'}`);
      return data;
    }
  } catch (error) {
    logging.error(`Error getting ${gameType} results: ${error.message}`);
    return { error: error.message };
  }
}

async function getRPatRecentResults(session, gameType = "WINGO") {
  let typeId;
  if (gameType === "TRX") typeId = 13;
  else if (gameType === "WINGO_30S") typeId = 30;
  else if (gameType === "WINGO_3MIN") typeId = 2;
  else if (gameType === "WINGO_5MIN") typeId = 3;
  else typeId = 1;

  const body = {
    pageSize: 500,
    pageNo: 1,
    typeId,
    language: 7,
    random: "4ad5325e389745a882f4189ed6550e70"
  };
  body.signature = generateSignature(body).toUpperCase();
  body.timestamp = Math.floor(Date.now() / 1000);

  try {
    const response = await session.post("GetNoaverageEmerdList", body);
    const data = response.data;
    const list = data?.data?.list || [];
    if (data?.code !== 0 || !list.length) {
      logging.warning(`R-PAT: 500-result request failed for ${gameType}: ${data?.msg || 'No results'}`);
      return [];
    }

    const outcomes = list
      .map(item => Number.parseInt(item.number ?? item.openNum, 10))
      .filter(number => Number.isFinite(number))
      .map(number => number % 10 >= 5 ? 'B' : 'S')
      .reverse();

    logging.info(`R-PAT: fetched ${outcomes.length} results from API for ${gameType}`);
    return outcomes.slice(-500);
  } catch (error) {
    logging.error(`R-PAT 500-result request error for ${gameType}: ${error.message}`);
    return [];
  }
}

async function refreshRPatResults(userId, session, gameType) {
  const settings = userSettings[userId] || {};
  const now = Date.now();
  if (settings.rpat_results_cache && now - settings.rpat_results_cache_time < 3000) {
    userAllResults[userId] = settings.rpat_results_cache;
    return settings.rpat_results_cache;
  }

  const outcomes = await getRPatRecentResults(session, gameType);
  if (outcomes.length >= 20) {
    settings.rpat_results_cache = outcomes;
    settings.rpat_results_cache_time = now;
    userAllResults[userId] = outcomes;
    logging.info(`R-PAT: loaded ${outcomes.length}/500 results for pattern analysis`);
  }
  return outcomes;
}

const PREMIUM_EMOJI_MAP = {
  '🛠️': '6053387526150823179',
  '👤': '6293782579489280950',
  '🗑️': '6053169517905845173',
  '📋': '5197269100878907942',
  '✅': '6255771332940663641',
  '❌': '6253758805755038090',
  '📢': '5213391561999526028',
  '🔍': '4958587679361991667',
  '🔧': '5462921117423384478',
  '📟': '5332823031859389246',
  '🎮': '5260491208454604697',
  '💰': '5278467510604160626',
  '📊': '5028746137645876535',
  '📝': '6053375122285270945',
  '🎯': '5463274047771000031',
  '🔴': '6213241428609345342',
  '🟢': '6132088635731743291',
  '🟣': '5888544366342967214',
  '🍏': '6145166480435583574',
  '🍎': '5327975757538929455',
  '🤿': '5354892648295440006',
  '🎛': '6271285755541197273',
  '⚙️': '6131808483604960712',
  '📂': '5298853345241358103',
  '🔐': '5307843983102204243',
  '🔺': '5890942929484123460',
  '🔻': '5972302069770488984',
  '⛳': '6053189841691088934',
  '💥': '6240071956163468978',
  '🕒': '5215484787325676090',
  '📚': '5222444124698853913',
  '🔙': '5253997076169115797',
  '🏠': '5413341943398669490',
  '🕹': '5213430392798851273',
  '🎲': '5350314303352223876',
  '🎰': '5235989279024373566',
  '💎': '6053314026375485069',
  '⚡': '5382194935057372936',
  '⏱️': '6048701411888206453',
  '🖥️': '5204160122502263825',
  '💵': '5197434882321567830',
  '🎛️': '6338935574967098253',
  '📜': '5258334563641363972',
  '📈': '6132094670160793426',
  '🔄': '6240172522822704149',
  '🤖': '6057669453926113105',
  '🔮': '5296408130165434029',
  '💭': '6266764202950530136',
  '🌙': '6127573903549145643',
  '🦁': '6282641460093260838',
  '🔫': '6237783309825350841',
  '🚬': '6158710333386005234',
  '🐰': '6138441059866253757',
  '👑': '6131816313330341620',
  '📺': '5373330964372004748',
  '☃️': '5188481279963715781',
  '⛔': '5472239203590888751',
  '🛑': '6237753687435910268',
  '▶️': '5377336227533969892',
  '⏹️': '5443127283898405358',
  'ℹ️': '6132133436535608372',
  '🔔': '6264510702329797113',
  '⚠️': '6053163053980063912',
  '🗒️': '6053229398339884957',
  '🌐': '6339280615459789282',
  '⏳': '6256000602589891870',
  '📉': '5429518319243775957',
  '🕐': '6242308461598610637',
  '⏰': '5384466886857614542',
  '🎫': '5418010521309815154',
  '🏇': '6131909286487399523',
  '💳': '6156634743195572281',
  '⏸️': '5321154224191462061',
  '📱': '6052942202466736870',
  '👨‍💻': '5818813162815753343',
  '🔘': '6275811074818184964',
  '🖌': '5258450450448915742',
  '🧠': '5368290794480358649',
};

const PREMIUM_CONTEXTUAL_EMOJI_MAP = {
  // The platform-selection prompt uses a dedicated premium red-circle emoji.
  'selectedRedCircle': '6213241428609345342'
};

const PREMIUM_EMOJI_FALLBACKS = {
  // bes.js does not define these symbols; use verified semantic fallback IDs from its map.
  '🪀': '6255771332940663641',
  '🪫': '5443127283898405358',
  '☎️': '6253758805755038090'
};

function convertToPremiumEmojis(text) {
  if (!text) return text;
  let result = text;

  // Apply the dedicated red emoji only when it appears before the Selected label.
  const selectedRedEmojiId = PREMIUM_CONTEXTUAL_EMOJI_MAP.selectedRedCircle;
  result = result.replace(
    /🔴(?=\s*(?:\*|<b>)?Selected\b)/g,
    `<tg-emoji emoji-id="${selectedRedEmojiId}">🔴</tg-emoji>`
  );

  const allPremiumIds = { ...PREMIUM_EMOJI_MAP, ...PREMIUM_EMOJI_FALLBACKS };
  for (const [emoji, premiumId] of Object.entries(allPremiumIds)) {
    const regex = new RegExp(emoji.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    result = result.replace(regex, `<tg-emoji emoji-id="${premiumId}">${emoji}</tg-emoji>`);
  }
  return result
    .replace(/\*([^*]+)\*/g, '<b>$1</b>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

async function sendMessageWithRetry(ctx, text, replyMarkup = null) {
  for (let attempt = 0; attempt < MAX_TELEGRAM_RETRIES; attempt++) {
    try {
      const options = { parse_mode: 'Markdown' };
      if (replyMarkup) {
        options.reply_markup = replyMarkup.reply_markup || replyMarkup;
      }
      
      await ctx.reply(convertToPremiumEmojis(text), { ...options, parse_mode: 'HTML' });
      return true;
    } catch (error) {
      logging.error(`Telegram message error, attempt ${attempt + 1}: ${error.message}`);
      
      if (attempt < MAX_TELEGRAM_RETRIES - 1) {
        await new Promise(resolve => setTimeout(resolve, TELEGRAM_RETRY_DELAY));
        continue;
      }
      
      // Last resort - send without markdown
      try {
        const plainText = text.replace(/\*/g, '').replace(/_/g, '').replace(/`/g, '');
        await ctx.reply(plainText, replyMarkup);
        return true;
      } catch (e) {
        return false;
      }
    }
  }
  return false;
}

async function sendSilentMessage(ctx, text, replyMarkup = null) {
  try {
    const options = { parse_mode: 'Markdown' };
    if (replyMarkup) {
      options.reply_markup = replyMarkup.reply_markup || replyMarkup;
    }
    await ctx.reply(convertToPremiumEmojis(text), { ...options, parse_mode: 'HTML' });
    return true;
  } catch (error) {
    logging.error(`Silent message error: ${error.message}`);
    return false;
  }
}

async function updateLiveStats(userId, bot) {
  if (!userSilentMessages[userId] || !userSilentMessages[userId].messageId || !userSilentMessages[userId].chatId) {
    return;
  }
  
  const settings = userSettings[userId] || {};
  const isVirtual = settings.virtual_mode || false;
  
  let balance = 0;
  let profit = 0;
  let startAmount = 0;
  
  if (isVirtual) {
    balance = userStats[userId]?.virtual_balance || 0;
    startAmount = userStats[userId]?.initial_balance || balance;
    profit = balance - startAmount;
  } else {
    balance = userGameInfo[userId]?.balance || 0;
    profit = userStats[userId]?.profit || 0;
    startAmount = userStats[userId]?.start_balance || balance;
  }
  
  const gameType = settings.game_type || "TRX";
  const strategy = settings.strategy || "TREND_FOLLOW";
  const betSizes = settings.bet_sizes || [];
  const betWrager = betSizes.length > 0 ? betSizes.join(', ') : 'Not set';
  
  const imagePath = await createLiveStatsImage(startAmount, profit, balance, isVirtual, gameType, strategy, betWrager, userId);
  
  try {
    await bot.telegram.editMessageMedia(
      userSilentMessages[userId].chatId,
      userSilentMessages[userId].messageId,
      null,
      {
        type: 'photo',
        media: { source: imagePath },
        caption: `${EMOJI.LIVE} *LIVE STATS UPDATED*`,
        parse_mode: 'Markdown'
      }
    );
    fs.unlinkSync(imagePath);
  } catch (error) {
    logging.error(`Failed to update live stats for user ${userId}: ${error.message}`);
    try {
      fs.unlinkSync(imagePath);
    } catch (e) {}
  }
}

async function createLiveStatsImage(startAmount, profit, balance, isVirtual, gameType, strategy, betWrager, userId) {
  const canvas = createCanvas(800, 600);
  const ctx = canvas.getContext('2d');
  
  const gradient = ctx.createLinearGradient(0, 0, 800, 600);
  gradient.addColorStop(0, '#0f0c29');
  gradient.addColorStop(0.5, '#302b63');
  gradient.addColorStop(1, '#24243e');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 800, 600);
  
  ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
  for (let i = 0; i < 50; i++) {
    const x = Math.random() * 800;
    const y = Math.random() * 600;
    const radius = Math.random() * 3;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  
  ctx.strokeStyle = 'rgba(0, 255, 255, 0.5)';
  ctx.lineWidth = 2;
  ctx.setLineDash([15, 10]);
  ctx.strokeRect(20, 20, 760, 560);
  ctx.setLineDash([]);
  
  ctx.fillStyle = '#00ffff';
  ctx.font = 'bold 48px "Arial Black", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('LIVE BETTING', 400, 120);
  
  ctx.fillStyle = '#ffffff';
  ctx.font = '36px Arial';
  ctx.fillText('STATS', 400, 180);
  
  ctx.beginPath();
  ctx.moveTo(100, 200);
  ctx.lineTo(700, 200);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.stroke();
  
  ctx.font = '28px Arial';
  ctx.textAlign = 'left';
  
  ctx.fillStyle = '#8888ff';
  ctx.fillText('STARTED AMOUNT', 150, 270);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`${startAmount.toFixed(2)} Ks`, 500, 270);
  
  ctx.fillStyle = profit >= 0 ? '#00ff00' : '#ff4444';
  ctx.fillText('PROFIT', 150, 330);
  ctx.fillStyle = profit >= 0 ? '#00ff00' : '#ff4444';
  ctx.fillText(`${profit >= 0 ? '+' : ''}${profit.toFixed(2)} Ks`, 500, 330);
  
  ctx.fillStyle = '#88ff88';
  ctx.fillText('FINAL BALANCE', 150, 390);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`${balance.toFixed(2)} Ks`, 500, 390);
  
  ctx.font = '24px Arial';
  ctx.fillStyle = '#cccccc';
  ctx.fillText(`Game: ${gameType}`, 150, 450);
  ctx.fillText(`Strategy: ${strategy}`, 150, 490);
  ctx.fillText(`Bet Wrager: ${betWrager}`, 150, 530);
  ctx.fillStyle = isVirtual ? '#ffaa00' : '#00aaff';
  ctx.fillText(isVirtual ? 'VIRTUAL MODE' : 'REAL MODE', 150, 570);
  
  ctx.font = '20px Arial';
  ctx.fillStyle = '#888888';
  ctx.textAlign = 'center';
  ctx.fillText('DESIGNED BY MICK', 400, 590);
  
  const imagePath = path.join(__dirname, `live_stats_${userId}_${Date.now()}.png`);
  const out = fs.createWriteStream(imagePath);
  const stream = canvas.createPNGStream();
  stream.pipe(out);
  
  return new Promise((resolve) => {
    out.on('finish', () => resolve(imagePath));
  });
}

async function createSniperCompleteImage(startAmount, profit, balance, isVirtual, hits, strategy, userId) {
  const canvas = createCanvas(800, 600);
  const ctx = canvas.getContext('2d');
  
  const gradient = ctx.createLinearGradient(0, 0, 800, 600);
  gradient.addColorStop(0, '#1a1a2e');
  gradient.addColorStop(0.5, '#16213e');
  gradient.addColorStop(1, '#0f3460');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 800, 600);
  
  ctx.fillStyle = 'rgba(255, 215, 0, 0.1)';
  for (let i = 0; i < 30; i++) {
    const x = Math.random() * 800;
    const y = Math.random() * 600;
    const radius = Math.random() * 30 + 5;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  
  ctx.strokeStyle = '#ffd700';
  ctx.lineWidth = 4;
  ctx.strokeRect(20, 20, 760, 560);
  
  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 52px "Arial Black", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SNIPER', 400, 100);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 48px "Arial Black", sans-serif';
  ctx.fillText('MISSION COMPLETE', 400, 160);
  
  ctx.font = '32px Arial';
  ctx.fillStyle = '#ffaa00';
  ctx.fillText(`🎯 ${strategy}`, 400, 220);
  
  ctx.beginPath();
  ctx.moveTo(100, 240);
  ctx.lineTo(700, 240);
  ctx.strokeStyle = '#ffd700';
  ctx.lineWidth = 2;
  ctx.stroke();
  
  ctx.font = '28px Arial';
  ctx.textAlign = 'left';
  
  ctx.fillStyle = '#88ff88';
  ctx.fillText('TARGET HITS', 150, 310);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`${hits}/${SNIPER_MAX_HITS}`, 500, 310);
  
  ctx.fillStyle = '#8888ff';
  ctx.fillText('START BALANCE', 150, 370);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`${startAmount.toFixed(2)} Ks`, 500, 370);
  
  ctx.fillStyle = profit >= 0 ? '#00ff00' : '#ff4444';
  ctx.fillText('PROFIT', 150, 430);
  ctx.fillStyle = profit >= 0 ? '#00ff00' : '#ff4444';
  ctx.fillText(`${profit >= 0 ? '+' : ''}${profit.toFixed(2)} Ks`, 500, 430);
  
  ctx.fillStyle = '#00ffff';
  ctx.fillText('FINAL BALANCE', 150, 490);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`${balance.toFixed(2)} Ks`, 500, 490);
  
  ctx.font = '20px Arial';
  ctx.fillStyle = '#888888';
  ctx.textAlign = 'center';
  ctx.fillText('DESIGNED BY MICK', 400, 550);
  ctx.fillStyle = '#cccccc';
  ctx.fillText(new Date().toLocaleString(), 400, 580);
  
  const imagePath = path.join(__dirname, `sniper_complete_${userId}_${Date.now()}.png`);
  const out = fs.createWriteStream(imagePath);
  const stream = canvas.createPNGStream();
  stream.pipe(out);
  
  return new Promise((resolve) => {
    out.on('finish', () => resolve(imagePath));
  });
}

async function safeDeleteMessage(ctx, messageId = null) {
  try {
    const msgId = messageId || ctx.callbackQuery?.message?.message_id;
    if (msgId) {
      await ctx.deleteMessage(msgId);
    }
  } catch (error) {
    if (error.response?.error_code !== 400) {
      logging.error(`Failed to delete message: ${error.message}`);
    }
  }
}

function checkTimeRange(userId) {
  if (!userTimeRanges[userId] || !userActiveTimeRange[userId]) {
    return { shouldRun: true, nextCheck: null };
  }
  
  const now = new Date();
  const currentHours = now.getHours();
  const currentMinutes = now.getMinutes();
  const currentTime = currentHours * 60 + currentMinutes;
  
  let isInRange = false;
  let nextStartTime = null;
  let nextEndTime = null;
  
  for (const range of userTimeRanges[userId]) {
    const [startHour, startMin] = range.start.split(':').map(Number);
    const [endHour, endMin] = range.end.split(':').map(Number);
    
    let startTime = startHour * 60 + startMin;
    let endTime = endHour * 60 + endMin;
    
    if (endTime <= startTime) {
      endTime += 24 * 60;
    }
    
    let checkTime = currentTime;
    if (checkTime < startTime) {
      checkTime += 24 * 60;
    }
    
    if (checkTime >= startTime && checkTime < endTime) {
      isInRange = true;
      break;
    }
    
    if (!nextStartTime || startTime > currentTime) {
      nextStartTime = startTime;
    }
    if (!nextEndTime) {
      nextEndTime = endTime;
    }
  }
  
  return { 
    shouldRun: isInRange, 
    nextCheck: isInRange ? null : nextStartTime 
  };
}

async function checkProfitAndStopLoss(userId, bot) {
  const settings = userSettings[userId] || {};
  const stats = safeGetUserStats(userId);
  
  const targetProfit = settings.target_profit;
  const stopLossLimit = settings.stop_loss;

  const isSniperStrategy = ["CYBER_SNIPER", "COLOR_SNIPER"].includes(settings.strategy);
  
  if (isSniperStrategy) {
    logging.info(`Skipping profit/stop-loss check for ${settings.strategy} strategy`);
    return false;
  }
  
  if (!targetProfit && !stopLossLimit) {
    return false;
  }
  
  let currentProfit;
  let balance;
  
  if (settings.virtual_mode) {
    currentProfit = (userStats[userId].virtual_balance || 0) - (userStats[userId].initial_balance || 0);
    balance = userStats[userId].virtual_balance;
  } else {
    currentProfit = userStats[userId].profit || 0;
    const session = userSessions[userId];
    balance = await getBalance(session, parseInt(userId));
  }
  
  if (targetProfit && currentProfit >= targetProfit) {
    settings.running = false;
    delete userWaitingForResult[userId];
    delete userShouldSkipNext[userId];
    
    settings.martin_index = 0;
    settings.dalembert_units = 1;
    settings.custom_index = 0;
    
    settings.profit_target_reached = true;
    settings.profit_target_message = `${EMOJI.TARGET} ${STYLE.HEADER('TARGET ACHIEVED')}\n` +
                                    `${STYLE.SEPARATOR}\n` +
                                    `${STYLE.ITEM(`Target: ${targetProfit} Ks`)}\n` +
                                    `${STYLE.ITEM(`Profit: ${currentProfit >= 0 ? '+' : ''}${currentProfit.toFixed(2)} Ks`)}\n` +
                                    `${STYLE.LAST_ITEM(`${settings.virtual_mode ? 'Virtual Balance' : 'Balance'}: ${balance?.toFixed(2) || '0.00'} Ks`)}`;
    
    try {
      const imagePath = await createResultImage('PROFIT', targetProfit, balance, settings.virtual_mode, currentProfit, userId);
      
      const restartKeyboard = Markup.inlineKeyboard([
        Markup.button.callback(`${EMOJI.START} RESTART`, `restart_bot:${userId}`)
      ]);
      
      await bot.telegram.sendPhoto(userId, { source: imagePath }, {
        caption: settings.profit_target_message,
        parse_mode: 'Markdown',
        reply_markup: restartKeyboard.reply_markup
      });
      
      fs.unlinkSync(imagePath);
    } catch (error) {
      logging.error(`Error creating/sending profit target image: ${error.message}`);
    }
    
    return true;
  }
  
  if (stopLossLimit && currentProfit <= -stopLossLimit) {
    settings.running = false;
    delete userWaitingForResult[userId];
    delete userShouldSkipNext[userId];
    
    settings.martin_index = 0;
    settings.dalembert_units = 1;
    settings.custom_index = 0;
    
    settings.stop_loss_reached = true;
    settings.stop_loss_message = `${EMOJI.STOP} ${STYLE.HEADER('STOP LOSS HIT')}\n` +
                               `${STYLE.SEPARATOR}\n` +
                               `${STYLE.ITEM(`Limit: ${stopLossLimit} Ks`)}\n` +
                               `${STYLE.ITEM(`Loss: ${Math.abs(currentProfit).toFixed(2)} Ks`)}\n` +
                               `${STYLE.LAST_ITEM(`${settings.virtual_mode ? 'Virtual Balance' : 'Balance'}: ${balance?.toFixed(2) || '0.00'} Ks`)}`;
    
    try {
      const imagePath = await createResultImage('STOP LOSS', stopLossLimit, balance, settings.virtual_mode, currentProfit, userId);
      
      const restartKeyboard = Markup.inlineKeyboard([
        Markup.button.callback(`${EMOJI.START} RESTART`, `restart_bot:${userId}`)
      ]);
      
      await bot.telegram.sendPhoto(userId, { source: imagePath }, {
        caption: settings.stop_loss_message,
        parse_mode: 'Markdown',
        reply_markup: restartKeyboard.reply_markup
      });
      
      fs.unlinkSync(imagePath);
    } catch (error) {
      logging.error(`Error creating/sending stop loss image: ${error.message}`);
    }
    
    return true;
  }
  
  return false;
}

function ensureUserStatsInitialized(userId) {
  if (!userStats[userId]) {
    const settings = userSettings[userId] || {};
    userStats[userId] = {
      start_balance: 0,
      profit: 0,
      virtual_balance: settings.virtual_mode ? (settings.virtual_balance || 0) : 0,
      initial_balance: settings.virtual_mode ? (settings.virtual_balance || 0) : 0
    };
    logging.info(`Initialized userStats for user ${userId}`);
  }
}

function safeGetUserStats(userId) {
  if (!userStats[userId]) {
    const settings = userSettings[userId] || {};
    userStats[userId] = {
      start_balance: 0,
      profit: 0,
      virtual_balance: settings.virtual_mode ? (settings.virtual_balance || 0) : 0,
      initial_balance: settings.virtual_mode ? (settings.virtual_balance || 0) : 0
    };
    logging.info(`Created userStats for ${userId}`);
  }
  return userStats[userId];
}

function getCyberSniperPrediction(userId) {
  const state = userSettings[userId].cyber_sniper_state || {
    active: false,
    direction: null,
    sequence: [],
    step: 0,
    hit_count: 0,
    got_same_result: false
  };

  const lastNumbers = userLastResults[userId] || [];
  const lastNumStr = lastNumbers.length > 0 ? lastNumbers[lastNumbers.length - 1] : null;

  if (!state.active && lastNumStr) {
    if (lastNumStr === "0") {
      state.active = true;
      state.direction = "B";
      state.sequence = ["B"];
      state.step = 0;
      state.hit_count = 0;
      state.got_same_result = false;
      logging.info(`CYBER_SNIPER: Triggered by 0. Betting BIG.`);
    } else if (lastNumStr === "9") {
      state.active = true;
      state.direction = "S";
      state.sequence = ["S"];
      state.step = 0;
      state.hit_count = 0;
      state.got_same_result = false;
      logging.info(`CYBER_SNIPER: Triggered by 9. Betting SMALL.`);
    }
  }

  userSettings[userId].cyber_sniper_state = state;

  if (state.active) {
    if (state.step < state.sequence.length) {
      return { choice: state.sequence[state.step], shouldSkip: false };
    } else {
      return { choice: state.direction, shouldSkip: false };
    }
  } else {
    return { choice: 'B', shouldSkip: true };
  }
}

// RLDS Strategy: current issue + immediately previous result only.
// The two-item history is intentionally built as [latest issue, previous result]
// to match the requested analyzeTrend(historyArr) logic.
function getRldsPrediction(userId, latestIssue) {
  const lastResults = userLastResults[userId] || [];
  const latestIssueStr = String(latestIssue ?? '');
  const historyArr = [
    { issueNumber: latestIssueStr },
    { number: lastResults.length > 0 ? lastResults[lastResults.length - 1] : undefined }
  ];

  if (historyArr.length < 2 || historyArr[1].number === undefined || historyArr[1].number === null) {
    return { choice: 'B', shouldSkip: true, skipReason: 'RLDS requires 2 history items' };
  }

  const prevNumber = parseInt(historyArr[1].number, 10);
  const lastDigitOfIssue = parseInt(historyArr[0].issueNumber.slice(-1), 10);
  if (!Number.isFinite(prevNumber) || !Number.isFinite(lastDigitOfIssue) || !/^\d+$/.test(latestIssueStr)) {
    logging.warning(`RLDS: Invalid history/current issue for user ${userId}`);
    return { choice: 'B', shouldSkip: true, skipReason: 'RLDS invalid data' };
  }

  const diff = prevNumber - lastDigitOfIssue;
  const signal = Math.abs(diff) >= 5 ? 'BIG' : 'SMALL';
  const nextIssue = (BigInt(latestIssueStr) + 1n).toString();
  const choice = signal === 'BIG' ? 'B' : 'S';

  logging.info(`RLDS: ${prevNumber} - ${lastDigitOfIssue} = ${diff}; ` +
    `prediction=${signal}, nextIssue=${nextIssue}`);
  return {
    choice,
    shouldSkip: false,
    nextIssue,
    calculation: `${prevNumber} - ${lastDigitOfIssue} = ${diff}`,
    resultValue: diff,
    prediction: signal,
    signalCode: choice
  };
}

// RLDS V2: same two-item RLDS calculation, but reverse the final signal.
function getRldsV2Prediction(userId, latestIssue) {
  const lastResults = userLastResults[userId] || [];
  const latestIssueStr = String(latestIssue ?? '');
  const historyArr = [
    { issueNumber: latestIssueStr },
    { number: lastResults.length > 0 ? lastResults[lastResults.length - 1] : undefined }
  ];

  if (historyArr.length < 2 || historyArr[1].number === undefined || historyArr[1].number === null) {
    return { choice: 'B', shouldSkip: true, skipReason: 'RLDS V2 requires 2 history items' };
  }

  const prevNumber = parseInt(historyArr[1].number, 10);
  const lastDigitOfIssue = parseInt(historyArr[0].issueNumber.slice(-1), 10);
  if (!Number.isFinite(prevNumber) || !Number.isFinite(lastDigitOfIssue) || !/^\d+$/.test(latestIssueStr)) {
    logging.warning(`RLDS V2: Invalid history/current issue for user ${userId}`);
    return { choice: 'B', shouldSkip: true, skipReason: 'RLDS V2 invalid data' };
  }

  const diff = prevNumber - lastDigitOfIssue;
  const originalSignal = Math.abs(diff) >= 5 ? 'BIG' : 'SMALL';
  const prediction = originalSignal === 'BIG' ? 'SMALL' : 'BIG';
  const nextIssue = (BigInt(latestIssueStr) + 1n).toString();
  const choice = prediction === 'BIG' ? 'B' : 'S';

  logging.info(`RLDS V2: ${prevNumber} - ${lastDigitOfIssue} = ${diff}; ` +
    `original=${originalSignal}, reversed=${prediction}, nextIssue=${nextIssue}`);
  return {
    choice,
    shouldSkip: false,
    nextIssue,
    calculation: `${prevNumber} - ${lastDigitOfIssue} = ${diff}`,
    resultValue: diff,
    originalLogic: originalSignal,
    prediction,
    signalCode: choice
  };
}

// Shared 500-result fetch for the custom strategies.
async function getStrategyRecentResults(session, gameType = "WINGO") {
  let typeId;
  if (gameType === "TRX") typeId = 13;
  else if (gameType === "WINGO_30S") typeId = 30;
  else if (gameType === "WINGO_3MIN") typeId = 2;
  else if (gameType === "WINGO_5MIN") typeId = 3;
  else typeId = 1;

  const body = {
    pageSize: 500,
    pageNo: 1,
    typeId,
    language: 7,
    random: "4ad5325e389745a882f4189ed6550e70"
  };
  body.signature = generateSignature(body).toUpperCase();
  body.timestamp = Math.floor(Date.now() / 1000);

  try {
    const response = await session.post("GetNoaverageEmerdList", body);
    const data = response.data;
    const list = data?.data?.list || [];
    if (data?.code !== 0 || !Array.isArray(list)) return [];
    const outcomes = list
      .map(item => ({
        number: Number.parseInt(item.number ?? item.openNum, 10),
        issueNumber: String(item.issueNumber ?? item.issue ?? '')
      }))
      .filter(item => Number.isFinite(item.number))
      .reverse()
      .slice(-500);
    logging.info(`Strategy fetch: retained ${outcomes.length}/500 results for ${gameType}`);
    return outcomes;
  } catch (error) {
    logging.error(`Strategy 500-result request error for ${gameType}: ${error.message}`);
    return [];
  }
}

async function refreshStrategyResults(userId, session, gameType) {
  const settings = userSettings[userId] || {};
  const now = Date.now();
  if (Array.isArray(settings.strategy_results_cache) &&
      now - (settings.strategy_results_cache_time || 0) < 3000) {
    return settings.strategy_results_cache;
  }
  const outcomes = await getStrategyRecentResults(session, gameType);
  if (outcomes.length > 0) {
    settings.strategy_results_cache = outcomes.slice(-500);
    settings.strategy_results_cache_time = now;
  }
  return settings.strategy_results_cache || [];
}

function getChiSquareAnomalyDetectionPrediction(outcomes) {
  const latest50 = (outcomes || []).slice(-50);
  const counts = latest50.reduce((acc, item) => {
    acc[item.number >= 5 ? 'B' : 'S']++;
    return acc;
  }, { B: 0, S: 0 });
  const chiSquare = ((counts.B - 25) ** 2) / 25 + ((counts.S - 25) ** 2) / 25;
  const choice = counts.B <= counts.S ? 'B' : 'S';
  logging.info(`Chi-Square Anomaly Detection: BIG=${counts.B}, SMALL=${counts.S}, chi2=${chiSquare.toFixed(4)}, prediction=${choice}`);
  return { choice, shouldSkip: false, bigCount: counts.B, smallCount: counts.S, chiSquare };
}

function getMultiplicationMatrixPrediction(outcomes, currentIssue) {
  const latest3 = (outcomes || []).slice(-3);
  if (latest3.length < 3 || !/^\d+$/.test(String(currentIssue ?? ''))) {
    return { choice: 'B', shouldSkip: true, skipReason: 'Multiplication Matrix requires 3 results and a valid issue' };
  }
  const digits = latest3.map(item => item.number % 10);
  const issueLast = Number(String(currentIssue).slice(-1));
  const value = ((digits[0] + 2) * (digits[1] + 2) * (digits[2] + 2) * (issueLast + 1)) % 10;
  const choice = value >= 5 ? 'B' : 'S';
  logging.info(`Multiplication Matrix: n0=${digits[0]}, n1=${digits[1]}, n2=${digits[2]}, issue_last=${issueLast}, val=${value}, prediction=${choice}`);
  return { choice, shouldSkip: false, value, digits, issueLast };
}

function getQuantumCalcPrediction(userId) {
  if (!userAllResults[userId] || userAllResults[userId].length < 5) {
    return 'B';
  }

  const latest5 = userAllResults[userId].slice(-5);
  const numericLatest5 = latest5.map(r => r === 'B' ? 7 : 2);
  const sumLatest = numericLatest5.reduce((a, b) => a + b, 0);

  const remainingHistory = userAllResults[userId].slice(0, -5);
  let sumHistory = 0;
  if (remainingHistory.length > 0) {
    const numericHistory = remainingHistory.map(r => r === 'B' ? 7 : 2);
    sumHistory = numericHistory.reduce((a, b) => a + b, 0);
  }

  const diff = Math.abs(sumLatest - sumHistory);
  const lastDigit = diff % 10;
  const isTwoDigitCalc = Math.abs(sumLatest - sumHistory) >= 10;

  logging.info(`QUANTUM_CALC: SumLatest=${sumLatest}, SumHistory=${sumHistory}, Diff=${diff}, LastDigit=${lastDigit}, Is2Digit=${isTwoDigitCalc}`);

  if (isTwoDigitCalc) {
    if (lastDigit >= 5) return 'S';
    else return 'B';
  } else {
    if (lastDigit >= 5) return 'B';
    else return 'S';
  }
}

function getTimeWarpPrediction(userId) {
  if (!userSettings[userId].time_warp_pos) {
    userSettings[userId].time_warp_pos = 8;
  }
  const pos = userSettings[userId].time_warp_pos;

  if (!userAllResults[userId] || userAllResults[userId].length < pos) {
    const last = userAllResults[userId]?.slice(-1)[0];
    return last || 'B';
  }

  const index = userAllResults[userId].length - pos;
  const prediction = userAllResults[userId][index];
  logging.info(`TIME_WARP: Looking back ${pos} positions (index ${index}), found ${prediction}`);
  return prediction;
}

function getColorSniperPrediction(userId) {
  const state = userSettings[userId].color_sniper_state || {
    active: false,
    step: 0,
    hit_count: 0,
    waiting_for_trigger: true
  };

  const lastNumbers = userLastResults[userId] || [];
  const lastNumStr = lastNumbers.length > 0 ? lastNumbers[lastNumbers.length - 1] : null;

  if (!state.active && state.waiting_for_trigger && lastNumStr) {
    if (lastNumStr === "1" || lastNumStr === "7") {
      state.active = true;
      state.waiting_for_trigger = false;
      state.step = 0;
      state.hit_count = 0;
      logging.info(`COLOR_SNIPER: Triggered by ${lastNumStr}. Betting RED.`);
    }
  }

  userSettings[userId].color_sniper_state = state;

  if (state.active) {
    return { choice: 'R', shouldSkip: false };
  } else {
    return { choice: 'R', shouldSkip: true };
  }
}

function getOpPatternPrediction(userId) {
  const OP_PATTERN_TRX = "BSBSBBSSBBBSSSBSBS";
  
  try {
    if (!userSettings[userId].op_pattern_index) {
      userSettings[userId].op_pattern_index = 0;
    }
    
    let patternIndex = userSettings[userId].op_pattern_index;
    const betType = OP_PATTERN_TRX[patternIndex];
    
    patternIndex = (patternIndex + 1) % OP_PATTERN_TRX.length;
    userSettings[userId].op_pattern_index = patternIndex;
    
    logging.info(`🔥 OP PATTERN: Index ${patternIndex-1}/${OP_PATTERN_TRX.length}, Bet ${betType}`);
    return { choice: betType, shouldSkip: false };
  } catch (error) {
    logging.error(`❌ OP PATTERN error: ${error.message}`);
    return { choice: 'B', shouldSkip: false };
  }
}

function getCustomDigitPrediction(userId) {
  const DEFAULT_DIGIT_MAPPING = {
    '0': 'B', '1': 'B', '2': 'S', '3': 'S', '4': 'B',
    '5': 'S', '6': 'S', '7': 'B', '8': 'B', '9': 'S',
    'DEFAULT': 'B'
  };
  
  try {
    const mapping = userSettings[userId]?.digit_mapping || DEFAULT_DIGIT_MAPPING;
    
    if (!mapping || Object.keys(mapping).length === 0) {
      logging.info(`🎲 Custom Digit: No mapping found, using default`);
      return { choice: DEFAULT_DIGIT_MAPPING.DEFAULT, shouldSkip: false };
    }
    
    const lastResults = userLastResults[userId] || [];
    if (lastResults.length === 0) {
      return { choice: mapping['DEFAULT'] || DEFAULT_DIGIT_MAPPING.DEFAULT, shouldSkip: false };
    }
    
    const lastNumber = lastResults[lastResults.length - 1];
    const lastDigit = lastNumber.toString().slice(-1);
    let betType = mapping[lastDigit] || mapping['DEFAULT'] || DEFAULT_DIGIT_MAPPING.DEFAULT;
    
    logging.info(`🎲 Custom Digit: Last digit ${lastDigit}, Bet ${betType}`);
    return { choice: betType, shouldSkip: false };
  } catch (error) {
    logging.error(`❌ Custom Digit error: ${error.message}`);
    return { choice: 'B', shouldSkip: false };
  }
}

function getShinePrediction(userId) {
  const SHINE_PATTERNS = {
    "B": ["S", "B", "S", "B", "S"],
    "S": ["B", "S", "B", "S", "B"]
  };
  
  try {
    if (!userSettings[userId].shine_state) {
      userSettings[userId].shine_state = {
        consecutive_count: 0,
        last_result: null,
        pattern_index: 0
      };
    }
    
    const shineState = userSettings[userId].shine_state;
    
    if (!shineState.last_result) {
      const randomBet = Math.random() < 0.5 ? 'B' : 'S';
      logging.info(`✨ SHINE: First bet random (${randomBet})`);
      return { choice: randomBet, shouldSkip: false };
    }
    
    const pattern = SHINE_PATTERNS[shineState.last_result];
    const prediction = pattern[shineState.pattern_index % pattern.length];
    
    logging.info(`✨ SHINE: Last ${shineState.last_result}, Consecutive ${shineState.consecutive_count}, Bet ${prediction}`);
    return { choice: prediction, shouldSkip: false };
  } catch (error) {
    logging.error(`❌ SHINE error: ${error.message}`);
    return { choice: Math.random() < 0.5 ? 'B' : 'S', shouldSkip: false };
  }
}

function getAlinkarPrediction(userId) {
  const ALINKAR_PATTERN = "BBSSBSBSBBSS";
  
  try {
    if (!userSettings[userId].alinkar_index) {
      userSettings[userId].alinkar_index = 0;
    }
    
    const patternIndex = userSettings[userId].alinkar_index;
    const prediction = ALINKAR_PATTERN[patternIndex];
    
    userSettings[userId].alinkar_index = (patternIndex + 1) % ALINKAR_PATTERN.length;
    
    logging.info(`🔗 ALINKAR: Pattern index ${patternIndex}, Bet ${prediction}`);
    return { choice: prediction, shouldSkip: false };
  } catch (error) {
    logging.error(`❌ ALINKAR error: ${error.message}`);
    return { choice: Math.random() < 0.5 ? 'B' : 'S', shouldSkip: false };
  }
}

function getPlutoPrediction(userId) {
  const PLUTO_PATTERNS = {
    "0": "BSBS", "1": "BSBB", "2": "SBSS", "3": "BBSS",
    "4": "BSBB", "5": "BBBB", "6": "SBBS", "7": "BBBB",
    "8": "SSSS", "9": "SSBB"
  };
  
  try {
    if (!userSettings[userId].pluto_state) {
      userSettings[userId].pluto_state = {
        current_pattern: PLUTO_PATTERNS["0"],
        pattern_index: 0,
        last_digit: "0"
      };
    }
    
    const plutoState = userSettings[userId].pluto_state;
    const lastResults = userLastResults[userId] || [];
    
    if (lastResults.length === 0) {
      const prediction = plutoState.current_pattern[plutoState.pattern_index];
      return { choice: prediction, shouldSkip: false };
    }
    
    const lastNumber = lastResults[lastResults.length - 1];
    const lastDigit = lastNumber.toString().slice(-1);
    
    if (lastDigit !== plutoState.last_digit) {
      plutoState.current_pattern = PLUTO_PATTERNS[lastDigit] || PLUTO_PATTERNS["0"];
      plutoState.pattern_index = 0;
      plutoState.last_digit = lastDigit;
    }
    
    const prediction = plutoState.current_pattern[plutoState.pattern_index];
    plutoState.pattern_index = (plutoState.pattern_index + 1) % plutoState.current_pattern.length;
    
    logging.info(`🪐 PLUTO: Digit ${lastDigit}, Pattern ${plutoState.current_pattern}, Bet ${prediction}`);
    return { choice: prediction, shouldSkip: false };
  } catch (error) {
    logging.error(`❌ PLUTO error: ${error.message}`);
    return { choice: Math.random() < 0.5 ? 'B' : 'S', shouldSkip: false };
  }
}

function getDreamPrediction(userId) {
  const DREAM_MAPPING = {
    "0": "B", "1": "B", "2": "S", "3": "S", "4": "B",
    "5": "S", "6": "S", "7": "B", "8": "B", "9": "S"
  };
  
  try {
    const lastResults = userLastResults[userId] || [];
    
    if (lastResults.length === 0) {
      return { choice: 'B', shouldSkip: false };
    }
    
    const lastNumber = lastResults[lastResults.length - 1];
    const lastDigit = lastNumber.toString().slice(-1);
    const prediction = DREAM_MAPPING[lastDigit] || 'B';
    
    logging.info(`💭 DREAM: Last digit ${lastDigit}, Prediction ${prediction}`);
    return { choice: prediction, shouldSkip: false };
  } catch (error) {
    logging.error(`❌ DREAM error: ${error.message}`);
    return { choice: 'B', shouldSkip: false };
  }
}

function getDreamV2Prediction(userId) {
  try {
    if (!userLastResults[userId]) {
      userLastResults[userId] = [];
    }
    
    if (userLastResults[userId].length < 10) {
      const randomBet = Math.random() < 0.5 ? 'B' : 'S';
      logging.info(`🏄 DREAM V2: Not enough data (${userLastResults[userId].length}/10), random ${randomBet}`);
      return { choice: randomBet, shouldSkip: false };
    }
    
    const last10 = userLastResults[userId].slice(-10);
    const last10BS = last10.map(num => {
      const n = parseInt(num);
      return n >= 5 ? 'B' : 'S';
    });
    
    const countB = last10BS.filter(r => r === 'B').length;
    const countS = last10BS.filter(r => r === 'S').length;
    
    let prediction;
    if (countB > countS) {
      prediction = 'S';
    } else if (countS > countB) {
      prediction = 'B';
    } else {
      prediction = last10BS[2] || 'B';
    }
    
    logging.info(`🏄 DREAM V2: Last 10: B=${countB}, S=${countS}, Prediction ${prediction}`);
    return { choice: prediction, shouldSkip: false };
  } catch (error) {
    logging.error(`❌ DREAM V2 error: ${error.message}`);
    return { choice: Math.random() < 0.5 ? 'B' : 'S', shouldSkip: false };
  }
}

function getSniperV1Prediction(userId) {
  const SNIPER_MAPPING = {
    "0": "S", "2": "B", "4": "B", "5": "S", "7": "B"
  };
  
  try {
    const lastResults = userLastResults[userId] || [];
    
    if (lastResults.length === 0) {
      return { choice: 'B', shouldSkip: false };
    }
    
    const lastNumber = lastResults[lastResults.length - 1];
    const lastDigit = lastNumber.toString().slice(-1);
    
    if (SNIPER_MAPPING[lastDigit]) {
      const prediction = SNIPER_MAPPING[lastDigit];
      logging.info(`🎯 SNIPER V1: Last digit ${lastDigit}, Mapped to ${prediction}`);
      return { choice: prediction, shouldSkip: false };
    } else {
      logging.info(`🎯 SNIPER V1: Last digit ${lastDigit} not in mapping, using default`);
      return { choice: 'B', shouldSkip: false };
    }
  } catch (error) {
    logging.error(`❌ SNIPER V1 error: ${error.message}`);
    return { choice: 'B', shouldSkip: false };
  }
}

function getDynamicTrendFlipPrediction(userId) {
  const settings = userSettings[userId] || {};
  const state = settings.dynamic_trend_flip_state || (settings.dynamic_trend_flip_state = {
    last_bet: null,
    last_result: null,
    next_bet: null,
    mode: 'STRAIGHT',
    skip_next: false
  });
  const history = userLastResults[userId] || [];

  // Keep compatibility with old saved RISK state.
  if (!state.mode) state.mode = state.loss_count > 0 ? 'COUNTER' : 'STRAIGHT';

  if (state.skip_next) {
    state.skip_next = false;
    return { choice: state.last_bet || 'B', shouldSkip: true };
  }

  const lastResult = state.last_result || (history.length
    ? numberToBS(parseInt(history[history.length - 1], 10))
    : null);
  if (!lastResult) {
    state.last_bet = 'B';
    state.next_bet = 'B';
    logging.info('DYNAMIC_TREND_FLIP: First bet -> B (STRAIGHT mode)');
    return { choice: 'B', shouldSkip: false };
  }

  // Settlement writes next_bet explicitly so a winning side is continued.
  const choice = state.next_bet || (state.mode === 'COUNTER'
    ? (lastResult === 'B' ? 'S' : 'B')
    : lastResult);
  state.last_bet = choice;
  logging.info(`DYNAMIC_TREND_FLIP: ${state.mode} mode -> betting ${choice}`);
  return { choice, shouldSkip: false };
}

function updateDynamicTrendFlipState(userId, betChoice, result, isWin) {
  const settings = userSettings[userId] || (userSettings[userId] = {});
  const state = settings.dynamic_trend_flip_state || (settings.dynamic_trend_flip_state = {
    last_bet: null,
    last_result: null,
    next_bet: null,
    mode: 'STRAIGHT',
    skip_next: false
  });

  state.last_bet = betChoice;
  state.last_result = result;

  if (isWin) {
    // Straight win continues straight; counter win continues counter.
    state.next_bet = betChoice;
    logging.info(`DYNAMIC_TREND_FLIP: ${state.mode} bet ${betChoice} WIN -> continue ${betChoice}`);
  } else {
    // One miss switches mode. B bet + S result -> COUNTER -> next B.
    state.mode = state.mode === 'STRAIGHT' ? 'COUNTER' : 'STRAIGHT';
    state.next_bet = state.mode === 'COUNTER'
      ? betChoice
      : result;
    logging.info(`DYNAMIC_TREND_FLIP: ${betChoice} LOSS on ${result} -> ${state.mode}, next ${state.next_bet}`);
  }

  state.loss_count = isWin ? 0 : 1;
  state.skip_next = false;
}

function getManusV1Prediction(userId) {
  const results = (userLastResults[userId] || []).slice(-5);
  if (!results.length) return { choice: 'B', shouldSkip: false };
  const bs = results.map(n => parseInt(n) >= 5 ? 'B' : 'S');
  const b = bs.filter(x => x === 'B').length;
  const s = bs.length - b;
  const choice = b === s ? (bs[bs.length - 1] === 'B' ? 'S' : 'B') : (b > s ? 'S' : 'B');
  logging.info(`MANUS V1: last 5 B=${b}, S=${s}, prediction=${choice}`);
  return { choice, shouldSkip: false };
}

function getManusV2Prediction(userId) {
  const results = (userLastResults[userId] || []).slice(-3);
  if (!results.length) return { choice: 'B', shouldSkip: false };
  const bs = results.map(n => parseInt(n) >= 5 ? 'B' : 'S');
  const last = bs[bs.length - 1];
  const streak = bs.every(x => x === last);
  const choice = streak ? (last === 'B' ? 'S' : 'B') : (last === 'B' ? 'S' : 'B');
  logging.info(`MANUS V2: sequence=${bs.join('')}, prediction=${choice}`);
  return { choice, shouldSkip: false };
}

function getAiSteageyPrediction(userId) {
  try {
    const results = (userLastResults[userId] || []).slice(-10);
    if (results.length === 0) {
      return { choice: 'B', shouldSkip: false };
    }

    const bs = results.map(value => parseInt(value, 10) >= 5 ? 'B' : 'S');
    const bigCount = bs.filter(value => value === 'B').length;
    const smallCount = bs.length - bigCount;
    const last = bs[bs.length - 1];

    // AI steagey: weighted recent majority; the newest three results carry extra weight.
    let weightedBig = 0;
    let weightedSmall = 0;
    bs.forEach((value, index) => {
      const weight = index >= bs.length - 3 ? 2 : 1;
      if (value === 'B') weightedBig += weight;
      else weightedSmall += weight;
    });

    const choice = weightedBig === weightedSmall
      ? (last === 'B' ? 'S' : 'B')
      : (weightedBig > weightedSmall ? 'B' : 'S');

    logging.info(`AI_STEAGEY: B=${bigCount}, S=${smallCount}, weighted=${weightedBig}/${weightedSmall}, prediction=${choice}`);
    return { choice, shouldSkip: false };
  } catch (error) {
    logging.error(`AI_STEAGEY error: ${error.message}`);
    return { choice: 'B', shouldSkip: false };
  }
}

function getFireStrageyPrediction(userId) {
  try {
    const results = (userLastResults[userId] || []).slice(-8);
    if (results.length === 0) {
      return { choice: 'B', shouldSkip: false };
    }

    const bs = results.map(value => parseInt(value, 10) >= 5 ? 'B' : 'S');
    const last = bs[bs.length - 1];
    let streak = 1;
    for (let index = bs.length - 2; index >= 0 && bs[index] === last; index--) {
      streak++;
    }

    const bigCount = bs.filter(value => value === 'B').length;
    const smallCount = bs.length - bigCount;
    let choice;

    // Fire stragey: follow a short trend, then flip long streaks to reduce overextension.
    if (streak >= 3) {
      choice = last === 'B' ? 'S' : 'B';
    } else if (bigCount === smallCount) {
      choice = last === 'B' ? 'S' : 'B';
    } else {
      choice = bigCount > smallCount ? 'B' : 'S';
    }

    logging.info(`FIRE_STRAGEY: sequence=${bs.join('')}, streak=${streak}, prediction=${choice}`);
    return { choice, shouldSkip: false };
  } catch (error) {
    logging.error(`FIRE_STRAGEY error: ${error.message}`);
    return { choice: 'B', shouldSkip: false };
  }
}

function getRPatPrediction(userId) {
  try {
    const outcomes = (userAllResults[userId] || []).slice(-500);
    const state = userSettings[userId].rpat_state || {
      total_bets: 0, wins: 0, losses: 0, max_streak: 0, current_loss_streak: 0
    };
    userSettings[userId].rpat_state = state;

    if (outcomes.length < 20) {
      logging.info(`R-PAT: ${outcomes.length}/20 outcomes available; scanning 500 recent patterns`);
      return { choice: 'B', shouldSkip: true, skipReason: '(R-PAT scanning)' };
    }

    const p4 = outcomes[outcomes.length - 4];
    const p3 = outcomes[outcomes.length - 3];
    const p2 = outcomes[outcomes.length - 2];
    const p1 = outcomes[outcomes.length - 1];
    let currentSeq = `${p4}-${p3}-${p2}-${p1}`;
    let bigCount = 0;
    let smallCount = 0;

    for (let i = 0; i < outcomes.length - 4; i++) {
      if (outcomes[i] === p4 && outcomes[i + 1] === p3 && outcomes[i + 2] === p2 && outcomes[i + 3] === p1) {
        const nextResult = outcomes[i + 4];
        if (nextResult === 'B') bigCount++;
        else if (nextResult === 'S') smallCount++;
      }
    }

    let totalMatches = bigCount + smallCount;
    if (totalMatches === 0) {
      currentSeq = `${p3}-${p2}-${p1}`;
      for (let i = 0; i < outcomes.length - 3; i++) {
        if (outcomes[i] === p3 && outcomes[i + 1] === p2 && outcomes[i + 2] === p1) {
          const nextResult = outcomes[i + 3];
          if (nextResult === 'B') bigCount++;
          else if (nextResult === 'S') smallCount++;
        }
      }
      totalMatches = bigCount + smallCount;
    }

    let choice;
    let confidence = 50;
    if (bigCount > smallCount) {
      choice = 'B';
      confidence = totalMatches > 0 ? Math.floor((bigCount / totalMatches) * 100) : 50;
    } else if (smallCount > bigCount) {
      choice = 'S';
      confidence = totalMatches > 0 ? Math.floor((smallCount / totalMatches) * 100) : 50;
    } else {
      choice = p1 === 'B' ? 'B' : 'S';
    }

    const shortSignal = `Seq:[${currentSeq}] ➜ Match:${totalMatches} (B:${bigCount}|S:${smallCount}) ➜ ${choice === 'B' ? 'BIG' : 'SMALL'}`;
    const detailLog = `🧩 PATTERN MATCH (500): [${currentSeq}] ➜ B:${bigCount} | S:${smallCount} (Matches:${totalMatches}) ➜ ${choice === 'B' ? 'BIG' : 'SMALL'} (${confidence}%)`;
    logging.info(`R-PAT: ${shortSignal}`);
    logging.info(detailLog);
    return { choice, shouldSkip: false, shortSignal, detailLog, confidence };
  } catch (error) {
    logging.error(`R-PAT error: ${error.message}`);
    return { choice: 'B', shouldSkip: true, skipReason: '(R-PAT error)' };
  }
}

function getTrendFollowPrediction(userId) {
  try {
    const settings = userSettings[userId] || {};
    const betType = settings.bet_type || "BS";
    
    if (betType === "COLOR") {
      if (!settings.color_trend_state) {
        settings.color_trend_state = { last_result: null };
      }
      
      if (settings.color_trend_state.last_result === null) {
        const colors = ['G', 'V', 'R'];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];
        logging.info(`Color TREND_FOLLOW: First bet random (${randomColor})`);
        return { choice: randomColor, shouldSkip: false };
      } else {
        const prediction = settings.color_trend_state.last_result;
        logging.info(`Color TREND_FOLLOW: Following last result (${prediction})`);
        return { choice: prediction, shouldSkip: false };
      }
    } else {
      if (!settings.trend_state) {
        settings.trend_state = { last_result: null, skip_mode: false };
      }
      
      const bsWaitCount = settings.bs_sb_wait_count || 0;
      let shouldSkip = false;
      
      if (bsWaitCount > 0) {
        const requiredResults = 2 * bsWaitCount;
        const results = userAllResults[userId] || [];
        
        if (results.length >= requiredResults) {
          const lastResults = results.slice(-requiredResults);
          const patternBS = 'BS'.repeat(bsWaitCount);
          const patternSB = 'SB'.repeat(bsWaitCount);
          const actualPattern = lastResults.join('');
          
          if (actualPattern === patternBS || actualPattern === patternSB) {
            shouldSkip = true;
            settings.trend_state.skip_mode = true;
            logging.info(`TREND_FOLLOW: Pattern ${actualPattern} found. Skipping.`);
          } else {
            shouldSkip = false;
            settings.trend_state.skip_mode = false;
          }
        }
      }
      
      if (settings.trend_state.skip_mode) {
        const prediction = settings.trend_state.last_result || 'B';
        logging.info(`TREND_FOLLOW: Skip mode, betting ${prediction}`);
        return { choice: prediction, shouldSkip: true };
      } else {
        if (settings.trend_state.last_result === null) {
          logging.info(`TREND_FOLLOW: First bet, defaulting to B`);
          return { choice: 'B', shouldSkip: false };
        } else {
          const prediction = settings.trend_state.last_result;
          logging.info(`TREND_FOLLOW: Betting ${prediction}`);
          return { choice: prediction, shouldSkip: false };
        }
      }
    }
  } catch (error) {
    logging.error(`❌ TREND_FOLLOW error: ${error.message}`);
    return { choice: 'B', shouldSkip: false };
  }
}

function getAlternatePrediction(userId) {
  try {
    const settings = userSettings[userId] || {};
    
    if (!settings.alternate_state) {
      settings.alternate_state = { last_result: null, skip_mode: false };
    }
    
    const bbWaitCount = settings.bb_ss_wait_count || 0;
    let shouldSkip = false;
    
    if (bbWaitCount > 0) {
      const requiredResults = 2 * bbWaitCount;
      const results = userAllResults[userId] || [];
      
      if (results.length >= requiredResults) {
        const lastResults = results.slice(-requiredResults);
        const patternBB = 'BB'.repeat(bbWaitCount);
        const patternSS = 'SS'.repeat(bbWaitCount);
        const actualPattern = lastResults.join('');
        
        if (actualPattern === patternBB || actualPattern === patternSS) {
          shouldSkip = true;
          settings.alternate_state.skip_mode = true;
          logging.info(`ALTERNATE: Pattern ${actualPattern} found. Skipping.`);
        } else {
          shouldSkip = false;
          settings.alternate_state.skip_mode = false;
        }
      }
    }
    
    if (settings.alternate_state.skip_mode) {
      let prediction;
      if (settings.alternate_state.last_result === null) {
        prediction = 'B';
      } else {
        prediction = settings.alternate_state.last_result === 'B' ? 'S' : 'B';
      }
      logging.info(`ALTERNATE: Skip mode, betting ${prediction}`);
      return { choice: prediction, shouldSkip: true };
    } else {
      if (settings.alternate_state.last_result === null) {
        logging.info(`ALTERNATE: First bet, defaulting to B`);
        return { choice: 'B', shouldSkip: false };
      } else {
        const prediction = settings.alternate_state.last_result === 'B' ? 'S' : 'B';
        logging.info(`ALTERNATE: Betting ${prediction}`);
        return { choice: prediction, shouldSkip: false };
      }
    }
  } catch (error) {
    logging.error(`❌ ALTERNATE error: ${error.message}`);
    return { choice: 'B', shouldSkip: false };
  }
}

function getBsOrderPrediction(userId) {
  try {
    const settings = userSettings[userId] || {};
    const DEFAULT_BS_ORDER = "BSBBSBSSSB";
    
    if (!settings.pattern) {
      settings.pattern = DEFAULT_BS_ORDER;
      settings.pattern_index = 0;
      logging.warning(`BS_ORDER: Pattern not found, using default: ${DEFAULT_BS_ORDER}`);
    }
    
    const pattern = settings.pattern;
    let patternIndex = settings.pattern_index || 0;
    
    if (patternIndex >= pattern.length) {
      patternIndex = 0;
      settings.pattern_index = 0;
    }
    
    if (!pattern || typeof pattern !== 'string' || pattern.length === 0) {
      logging.error(`BS_ORDER: Invalid pattern for user ${userId}: ${pattern}`);
      return { choice: 'B', shouldSkip: false };
    }
    
    if (!pattern.split('').every(c => c === 'B' || c === 'S')) {
      logging.error(`BS_ORDER: Pattern contains invalid characters: ${pattern}`);
      return { choice: 'B', shouldSkip: false };
    }
    
    const prediction = pattern[patternIndex];
    logging.info(`BS_ORDER: Pattern="${pattern}", Index=${patternIndex}, Choice=${prediction}`);
    
    const nextIndex = (patternIndex + 1) % pattern.length;
    settings.pattern_index = nextIndex;
    logging.info(`BS_ORDER: Next index will be ${nextIndex}`);
    
    return { choice: prediction, shouldSkip: false };
  } catch (error) {
    logging.error(`❌ BS_ORDER error: ${error.message}`);
    return { choice: 'B', shouldSkip: false };
  }
}

async function createSniperImage(type, userId, strategyName, hitCount, lossCount, maxHits, maxLosses, profit = 0, balance = 0) {
  const canvas = createCanvas(800, 600);
  const ctx = canvas.getContext('2d');
  
  let gradient;
  if (type === 'HIT' || type === 'MISSION_COMPLETE') {
    gradient = ctx.createLinearGradient(0, 0, 800, 600);
    gradient.addColorStop(0, '#00C851');
    gradient.addColorStop(0.5, '#007E33');
    gradient.addColorStop(1, '#004d00');
  } else if (type === 'LOSS' || type === 'MAX_LOSSES') {
    gradient = ctx.createLinearGradient(0, 0, 800, 600);
    gradient.addColorStop(0, '#ff4444');
    gradient.addColorStop(0.5, '#CC0000');
    gradient.addColorStop(1, '#800000');
  } else {
    gradient = ctx.createLinearGradient(0, 0, 800, 600);
    gradient.addColorStop(0, '#33b5e5');
    gradient.addColorStop(0.5, '#0099CC');
    gradient.addColorStop(1, '#006699');
  }
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 800, 600);
  
  ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
  for (let i = 0; i < 15; i++) {
    const x = Math.random() * 800;
    const y = Math.random() * 600;
    const radius = Math.random() * 30 + 10;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 4;
  ctx.setLineDash([15, 10]);
  ctx.strokeRect(20, 20, 760, 560);
  ctx.setLineDash([]);
  
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  
  let title = '';
  let titleColor = '#FFFFFF';
  
  switch(type) {
    case 'HIT':
      title = 'SNIPER HIT';
      titleColor = '#00FF00';
      break;
    case 'LOSS':
      title = 'SNIPER LOSS';
      titleColor = '#FF4444';
      break;
    case 'MISSION_COMPLETE':
      title = 'MISSION COMPLETE';
      titleColor = '#FFD700';
      break;
    case 'MAX_LOSSES':
      title = 'MAX LOSSES REACHED';
      titleColor = '#FF4444';
      break;
  }
  
  ctx.fillStyle = titleColor;
  ctx.font = 'bold 48px "Arial Black", sans-serif';
  ctx.fillText(title, 400, 120);
  
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 36px Arial';
  ctx.fillText(`${strategyName}`, 400, 180);
  
  ctx.beginPath();
  ctx.moveTo(100, 200);
  ctx.lineTo(700, 200);
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 4;
  ctx.stroke();
  
  ctx.font = 'bold 32px Arial';
  ctx.textAlign = 'left';
  
  ctx.fillStyle = '#ffffff';
  ctx.fillText('HITS:', 280, 240);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(`${hitCount}/${maxHits}`, 480, 240);
  
  ctx.fillStyle = '#ffffff';
  ctx.fillText('LOSSES:', 280, 290);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(`${lossCount}/${maxLosses}`, 480, 290);

  ctx.font = 'bold 32px Arial';
  ctx.textAlign = 'center';
  
  let statusMessage = '';
  if (type === 'HIT') {
    statusMessage = 'Target Acquired!';
    ctx.fillStyle = '#00FF00';
  } else if (type === 'LOSS') {
    statusMessage = 'Target Missed';
    ctx.fillStyle = '#FF4444';
  } else if (type === 'MISSION_COMPLETE') {
    statusMessage = 'Mission Successfully Completed!';
    ctx.fillStyle = '#FFD700';
  } else if (type === 'MAX_LOSSES') {
    statusMessage = 'Session Terminated - Too Many Losses';
    ctx.fillStyle = '#FF4444';
  }
  
  ctx.fillText(statusMessage, 400, 370);
  
  if (type === 'MISSION_COMPLETE' && profit > 0) {
    ctx.font = '28px Arial';
    ctx.fillStyle = '#00FF00';
    ctx.fillText(`Profit: +${profit.toFixed(2)} Ks`, 400, 420);
  }

  if (type === 'MISSION_COMPLETE' || type === 'MAX_LOSSES') {
    ctx.font = 'bold 28px Arial';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    
    const settings = userSettings[userId] || {};
    const isVirtual = settings.virtual_mode || false;
    const balanceText = isVirtual ? 'Virtual Balance' : 'Real Balance';
    
    ctx.fillText(`${balanceText}: ${balance.toFixed(2)} Ks`, 400, 450);
  }
  
  ctx.font = '20px Arial';
  ctx.fillStyle = '#CCCCCC';
  ctx.textAlign = 'center';
  ctx.fillText(`User ID: ${userId}`, 400, 500);
  
  const now = new Date();
  ctx.fillText(now.toLocaleString(), 400, 530);
  
  ctx.font = 'bold 24px Arial';
  ctx.fillStyle = '#FFFFFF';
  
  const imagePath = path.join(__dirname, `sniper_${type.toLowerCase()}_${userId}_${Date.now()}.png`);
  const out = fs.createWriteStream(imagePath);
  const stream = canvas.createPNGStream();
  stream.pipe(out);
  
  return new Promise((resolve, reject) => {
    out.on('finish', () => resolve(imagePath));
    out.on('error', reject);
  });
}

async function handleSniperHit(userId, strategyName, bot, isWin) {
  const settings = userSettings[userId] || {};
  
  if (!settings.sniper_hit_count) {
    settings.sniper_hit_count = 0;
  }
  
  if (!settings.sniper_loss_count) {
    settings.sniper_loss_count = 0;
  }
  
  if (isWin) {
    settings.sniper_hit_count++;
    settings.sniper_loss_count = 0;
    
    if (SNIPER_NOTIFICATIONS) {
      const hitNotification = `🎯 ${STYLE.BOLD(`${strategyName} HIT!`)} 🎯\n` +
                            `${STYLE.SEPARATOR}\n` +
                            `${STYLE.ITEM(`Hit Count: ${settings.sniper_hit_count}/${SNIPER_MAX_HITS}`)}\n` +
                            `${STYLE.ITEM(`Loss Count: ${settings.sniper_loss_count}/${SNIPER_MAX_LOSSES}`)}\n` +
                            `${STYLE.LAST_ITEM(`Strategy: ${strategyName}`)}`;
      
      try {
        await bot.telegram.sendMessage(userId, convertToPremiumEmojis(hitNotification), { parse_mode: 'HTML' });
      } catch (error) {
        logging.error(`Failed to send sniper notification to ${userId}: ${error.message}`);
      }
    }
    
    if (settings.sniper_hit_count >= SNIPER_MAX_HITS) {
      await terminateSniperSession(userId, strategyName, bot, true);
      return true;
    }
  } else {
    settings.sniper_loss_count++;
    if (SNIPER_NOTIFICATIONS) {
      const lossNotification = `❌ ${STYLE.BOLD(`${strategyName} LOSS!`)} ❌\n` +
                              `${STYLE.SEPARATOR}\n` +
                              `${STYLE.ITEM(`Hit Count: ${settings.sniper_hit_count}/${SNIPER_MAX_HITS}`)}\n` +
                              `${STYLE.ITEM(`Loss Count: ${settings.sniper_loss_count}/${SNIPER_MAX_LOSSES}`)}\n` +
                              `${STYLE.LAST_ITEM(`Strategy: ${strategyName}`)}`;
      
      try {
        await bot.telegram.sendMessage(userId, convertToPremiumEmojis(lossNotification), { parse_mode: 'HTML' });
      } catch (error) {
        logging.error(`Failed to send sniper loss notification to ${userId}: ${error.message}`);
      }
    }
    
    if (settings.sniper_loss_count >= SNIPER_MAX_LOSSES) {
      await terminateSniperSession(userId, strategyName, bot, false);
      return true;
    }
  }
  
  return false;
}

async function terminateSniperSession(userId, strategyName, bot, isHitTermination) {
  const settings = userSettings[userId] || {};
  
  settings.running = false;
  delete userWaitingForResult[userId];
  delete userShouldSkipNext[userId];
  
  settings.martin_index = 0;
  settings.dalembert_units = 1;
  settings.custom_index = 0;
  
  const isVirtual = settings.virtual_mode || false;
  let startAmount = 0;
  let balance = 0;
  let profit = 0;
  
  if (isVirtual) {
    startAmount = userStats[userId]?.initial_balance || 0;
    balance = userStats[userId]?.virtual_balance || 0;
    profit = balance - startAmount;
  } else {
    startAmount = userStats[userId]?.start_balance || 0;
    profit = userStats[userId]?.profit || 0;
    const session = userSessions[userId];
    if (session) {
      balance = await getBalance(session, parseInt(userId)) || 0;
    }
  }
  
  try {
    const imagePath = await createSniperCompleteImage(
      startAmount,
      profit,
      balance,
      isVirtual,
      settings.sniper_hit_count || 0,
      strategyName,
      userId
    );
    
    const caption = isHitTermination 
      ? `🎯 ${STYLE.BOLD('SNIPER MISSION COMPLETE!')}\n` +
        `${STYLE.SEPARATOR}\n` +
        `${STYLE.ITEM(`Target Hits: ${SNIPER_MAX_HITS}`)}\n` +
        `${STYLE.ITEM(`Actual Hits: ${settings.sniper_hit_count || 0}`)}\n` +
        `${STYLE.ITEM(`Losses: ${settings.sniper_loss_count || 0}`)}\n` +
        `${STYLE.LAST_ITEM('🎉 Target acquired successfully!')}`
      : `🛑 ${STYLE.BOLD('SNIPER MAX LOSSES REACHED')}\n` +
        `${STYLE.SEPARATOR}\n` +
        `${STYLE.ITEM(`Target Hits: ${SNIPER_MAX_HITS}`)}\n` +
        `${STYLE.ITEM(`Actual Hits: ${settings.sniper_hit_count || 0}`)}\n` +
        `${STYLE.ITEM(`Max Losses: ${SNIPER_MAX_LOSSES}`)}\n` +
        `${STYLE.LAST_ITEM('⚠️ Session terminated - Too many consecutive losses')}`;
    
    const restartKeyboard = Markup.inlineKeyboard([
      Markup.button.callback(`${EMOJI.START} RESTART`, `restart_bot:${userId}`)
    ]);
    
    await bot.telegram.sendPhoto(userId, { source: imagePath }, {
      caption: caption,
      parse_mode: 'Markdown',
      reply_markup: restartKeyboard.reply_markup
    });
    
    fs.unlinkSync(imagePath);
  } catch (error) {
    logging.error(`Failed to send sniper complete image to ${userId}: ${error.message}`);
  }
  
  delete settings.sniper_hit_count;
  delete settings.sniper_loss_count;
}

async function winLoseChecker(bot) {
  logging.info("Win/lose checker started");
  while (true) {
    try {
      for (const [userId, session] of Object.entries(userSessions)) {
        if (!session) continue;
        const settings = userSettings[userId] || {};
        const isSilent = userSilentMessages[userId]?.enabled || false;
        
        if (!userStats[userId]) {
          userStats[userId] = {
            start_balance: 0,
            profit: 0,
            virtual_balance: settings.virtual_mode ? (settings.virtual_balance || 0) : 0,
            initial_balance: settings.virtual_mode ? (settings.virtual_balance || 0) : 0
          };
          logging.info(`Initialized userStats for user ${userId} in winLoseChecker`);
        }
        
        const gameType = settings.game_type || "TRX";
        const betType = settings.bet_type || "BS";
        const stats = safeGetUserStats(userId);
        
        let data;
        
        if (gameType === "WINGO" || gameType === "WINGO_30S" || gameType === "WINGO_3MIN" || gameType === "WINGO_5MIN") {
          const wingoRes = await getWingoGameResults(session, gameType);
          if (!wingoRes || wingoRes.code !== 0) {
            logging.error(`Failed to get ${gameType} results: ${wingoRes?.msg || 'Unknown error'}`);
            continue;
          }
          data = wingoRes.data?.list || [];

          if (data.length < 10) {
            logging.warning(`Only ${data.length} results available for ${gameType}, expected 10`);
          }
          
          if (gameType === "WINGO_30S" || gameType === "WINGO_3MIN" || gameType === "WINGO_5MIN") {
            logging.debug(`${gameType}: Retrieved ${data.length} results`);
            if (data.length > 0) {
              logging.debug(`${gameType}: First result issueNumber: ${data[0].issueNumber}, number: ${data[0].number}`);
            }
          }
        } else {
          let issueRes = await getGameIssueRequest(session, gameType);
          
          if (!issueRes || issueRes.code !== 0) {
            continue;
          }
          
          data = issueRes.data ? [issueRes.data.settled || {}] : [];
        }
        
        if (gameType === "WINGO" || gameType === "WINGO_30S" || gameType === "WINGO_3MIN" || gameType === "WINGO_5MIN") {
          if (!userAllResults[userId]) userAllResults[userId] = [];
          if (!userLastResults[userId]) userLastResults[userId] = [];
          
          for (let i = 0; i < Math.min(data.length, 10); i++) {
            const result = data[i];
            if (result && result.number) {
              const number = parseInt(result.number || "0") % 10;
              const bigSmall = number >= 5 ? "B" : "S";
              const color = numberToColor(number);
              
              if (!userAllResults[userId].includes(bigSmall)) {
                userAllResults[userId].push(bigSmall);
                if (userAllResults[userId].length > 500) {
                  userAllResults[userId] = userAllResults[userId].slice(-500);
                }
              }
            }
          }
        }
        
        if (userPendingBets[userId]) {
          for (const [period, betInfo] of Object.entries(userPendingBets[userId])) {
            const settled = data.find(item => item.issueNumber === period);
            if (settled && settled.number) {
              if (gameType === "WINGO_30S" || gameType === "WINGO_3MIN" || gameType === "WINGO_5MIN") {
                logging.debug(`${gameType}: Found result for period ${period}: ${settled.number}`);
              }
              
              const [betChoice, amount, isVirtual] = betInfo;
              const number = parseInt(settled.number || "0") % 10;
              const bigSmall = number >= 5 ? "B" : "S";
              const color = numberToColor(number);
              
              let isWin;
              if (betType === "COLOR") {
                isWin = betChoice === color;
              } else {
                isWin = (betChoice === "B" && bigSmall === "B") || (betChoice === "S" && bigSmall === "S");
              }
              
              if (!userLastResults[userId]) {
                userLastResults[userId] = [];
              }
              userLastResults[userId].push(number.toString());
              if (userLastResults[userId].length > 10) {
                userLastResults[userId] = userLastResults[userId].slice(-10);
              }
              
              if (!userAllResults[userId]) {
                userAllResults[userId] = [];
              }
              userAllResults[userId].push(bigSmall);
              if (userAllResults[userId].length > 500) {
                userAllResults[userId] = userAllResults[userId].slice(-500);
              }

              if (settings.strategy === "R_PAT") {
                const rpatState = settings.rpat_state || {
                  total_bets: 0, wins: 0, losses: 0, max_streak: 0, current_loss_streak: 0
                };
                rpatState.total_bets++;
                if (isWin) {
                  rpatState.wins++;
                  rpatState.current_loss_streak = 0;
                } else {
                  rpatState.losses++;
                  rpatState.current_loss_streak++;
                  rpatState.max_streak = Math.max(rpatState.max_streak, rpatState.current_loss_streak);
                }
                settings.rpat_state = rpatState;
                const winRate = rpatState.total_bets > 0 ? (rpatState.wins / rpatState.total_bets * 100).toFixed(1) : '0.0';
                logging.info(`R-PAT metrics: ${isWin ? 'WIN' : 'LOSS'}, win rate=${winRate}%, max loss streak=${rpatState.max_streak}`);
              }

              if (settings.strategy === "CYBER_SNIPER" && settings.cyber_sniper_state) {
                const csState = settings.cyber_sniper_state;
                
                if (settings.sniper_hit_count === undefined) {
                  settings.sniper_hit_count = 0;
                }
                if (settings.sniper_loss_count === undefined) {
                  settings.sniper_loss_count = 0;
                }
                
                if (isWin) {
                  settings.sniper_hit_count++;
                  settings.sniper_loss_count = 0;
                  csState.hit_count = (csState.hit_count || 0) + 1;
                  
                  if (settings.sniper_hit_count >= SNIPER_MAX_HITS) {
                    await terminateSniperSession(userId, 'CYBER SNIPER', bot, true);
                    settings.running = false;
                    delete userWaitingForResult[userId];
                    delete userShouldSkipNext[userId];
                    
                    csState.active = false;
                    csState.direction = null;
                    csState.sequence = [];
                    csState.step = 0;
                    csState.hit_count = 0;
                    csState.got_same_result = false;
                    
                    logging.info(`CYBER_SNIPER: Target Acquired (${SNIPER_MAX_HITS} Wins). Stopping.`);
                  } else {
                    settings.cyber_hit_once = true;
                    logging.info(`CYBER_SNIPER: Hit ${settings.sniper_hit_count}/${SNIPER_MAX_HITS}`);
                    
                    csState.active = false;
                    csState.direction = null;
                    csState.sequence = [];
                    csState.step = 0;
                  }
                } else {
                  settings.sniper_loss_count++;
                  
                  if (settings.sniper_loss_count >= SNIPER_MAX_LOSSES) {
                    await terminateSniperSession(userId, 'CYBER SNIPER', bot, false);
                    
                    settings.running = false;
                    settings.cyber_max_reached = true;
                    delete userWaitingForResult[userId];
                    delete userShouldSkipNext[userId];
                    
                    csState.active = false;
                    csState.direction = null;
                    csState.sequence = [];
                    csState.step = 0;
                    csState.hit_count = 0;
                    csState.got_same_result = false;
                    
                    logging.info(`CYBER_SNIPER: Max losses (${SNIPER_MAX_LOSSES}) reached. Stopping.`);
                  } else {
                    csState.step++;
                    if (csState.step >= 4) {
                      settings.running = false;
                      settings.cyber_max_reached = true;
                      logging.info(`CYBER_SNIPER: Max internal losses (4) reached. Stopping.`);
                      delete userWaitingForResult[userId];
                      delete userShouldSkipNext[userId];
                    } else {
                      const lastNumStr = userLastResults[userId][userLastResults[userId].length - 2];
                      const currentNumStr = userLastResults[userId][userLastResults[userId].length - 1];

                      if (lastNumStr === currentNumStr && csState.step === 1) {
                        csState.got_same_result = true;
                        if (currentNumStr === "0") csState.sequence = ["B", "S", "B", "B"];
                        if (currentNumStr === "9") csState.sequence = ["S", "B", "S", "S"];
                      } else if (!csState.got_same_result) {
                        if (csState.direction === "B") {
                          if (csState.step === 2) csState.sequence.push("B");
                          if (csState.step === 3) csState.sequence.push("B");
                        } else {
                          if (csState.step === 2) csState.sequence.push("S");
                          if (csState.step === 3) csState.sequence.push("S");
                        }
                      }
                    }
                  }
                }
              }

              if (settings.strategy === "COLOR_SNIPER" && settings.color_sniper_state) {
                const csState = settings.color_sniper_state;
                
                if (settings.sniper_hit_count === undefined) {
                  settings.sniper_hit_count = 0;
                }
                if (settings.sniper_loss_count === undefined) {
                  settings.sniper_loss_count = 0;
                }
                
                if (isWin) {
                  settings.sniper_hit_count++;
                  settings.sniper_loss_count = 0;
                  csState.hit_count = (csState.hit_count || 0) + 1;
                  
                  if (settings.sniper_hit_count >= SNIPER_MAX_HITS) {
                    await terminateSniperSession(userId, 'COLOR SNIPER', bot, true);
                    
                    settings.color_sniper_hit_twice = true;
                    settings.running = false;
                    delete userWaitingForResult[userId];
                    delete userShouldSkipNext[userId];
                    
                    csState.active = false;
                    csState.waiting_for_trigger = true;
                    csState.step = 0;
                    csState.hit_count = 0;
                    
                    logging.info(`COLOR_SNIPER: Target Acquired (${SNIPER_MAX_HITS} Wins). Stopping.`);
                  } else {
                    settings.color_sniper_hit_once = true;
                    logging.info(`COLOR_SNIPER: Hit ${settings.sniper_hit_count}/${SNIPER_MAX_HITS}`);
                    
                    csState.active = false;
                    csState.waiting_for_trigger = true;
                    csState.step = 0;
                  }
                } else {
                  settings.sniper_loss_count++;
                  
                  if (settings.sniper_loss_count >= SNIPER_MAX_LOSSES) {
                    await terminateSniperSession(userId, 'COLOR SNIPER', bot, false);
                    
                    settings.running = false;
                    settings.color_sniper_max_reached = true;
                    delete userWaitingForResult[userId];
                    delete userShouldSkipNext[userId];
                    
                    csState.active = false;
                    csState.waiting_for_trigger = true;
                    csState.step = 0;
                    csState.hit_count = 0;
                    
                    logging.info(`COLOR_SNIPER: Max losses (${SNIPER_MAX_LOSSES}) reached. Stopping.`);
                  } else {
                    csState.step++;
                    if (csState.step >= 4) {
                      settings.running = false;
                      settings.color_sniper_max_reached = true;
                      logging.info(`COLOR_SNIPER: Max internal losses (4) reached. Stopping.`);
                      delete userWaitingForResult[userId];
                      delete userShouldSkipNext[userId];
                    }
                  }
                }
              }

              if (settings.strategy === "DYNAMIC_TREND_FLIP" && betType !== "COLOR") {
                updateDynamicTrendFlipState(userId, betChoice, bigSmall, isWin);
              }

              if (settings.strategy === "TREND_FOLLOW") {
                if (betType === "COLOR") {
                  if (!settings.color_trend_state) {
                    settings.color_trend_state = { last_result: null };
                  }
                  settings.color_trend_state.last_result = color;
                  logging.info(`Color TREND_FOLLOW: Updated last_result to ${color}`);
                } else {
                  if (!settings.trend_state) {
                    settings.trend_state = { last_result: null, skip_mode: false };
                  }
                  settings.trend_state.last_result = bigSmall;
                  logging.info(`TREND_FOLLOW: Updated last_result to ${bigSmall}`);
                }
              }

              if (settings.strategy === "ALTERNATE") {
                if (!settings.alternate_state) {
                  settings.alternate_state = { last_result: null, skip_mode: false };
                }
                settings.alternate_state.last_result = bigSmall;
                
                if (settings.alternate_state.skip_mode) {
                  if (isWin) {
                    settings.alternate_state.skip_mode = false;
                    logging.info(`ALTERNATE: Win in skip mode. Resuming normal betting.`);
                  }
                  logging.info(`ALTERNATE: Updated last_result to ${bigSmall} (still in skip mode)`);
                } else {
                  logging.info(`ALTERNATE: Updated last_result to ${bigSmall} (normal mode)`);
                }
              }
              
              if (settings.strategy === "QUANTUM_CALC") {
                logging.info(`QUANTUM_CALC: ${isWin ? 'WIN' : 'LOSS'}`);
              }

              if (settings.strategy === "TIME_WARP") {
                logging.info(`TIME_WARP: ${isWin ? 'WIN' : 'LOSS'}`);
                if (!isWin) {
                  settings.time_warp_pos = settings.time_warp_pos === 8 ? 5 : 8;
                  logging.info(`TIME_WARP: Loss. Switched lookback to ${settings.time_warp_pos}`);
                }
              }
              
              const entryLayer = settings.layer_limit || 1;
              
              if (entryLayer === 2) {
                if (!settings.entry_layer_state) {
                  settings.entry_layer_state = { waiting_for_lose: true };
                }
                
                if (settings.entry_layer_state.waiting_for_lose) {
                  if (isWin) {
                    settings.entry_layer_state.waiting_for_lose = true;
                  } else {
                    settings.entry_layer_state.waiting_for_lose = false;
                  }
                }
              } else if (entryLayer === 3) {
                if (!settings.entry_layer_state) {
                  settings.entry_layer_state = { waiting_for_loses: true, consecutive_loses: 0 };
                }
                
                if (settings.entry_layer_state.waiting_for_loses) {
                  if (isWin) {
                    settings.entry_layer_state.waiting_for_loses = true;
                    settings.entry_layer_state.consecutive_loses = 0;
                  } else {
                    settings.entry_layer_state.consecutive_loses++;
                    
                    if (settings.entry_layer_state.consecutive_loses >= 2) {
                      settings.entry_layer_state.waiting_for_loses = false;
                    }
                  }
                }
              }
              
              if (settings.sl_layer && settings.sl_layer > 0) {
                if (isWin) {
                  settings.consecutive_losses = 0;
                  userShouldSkipNext[userId] = false;
                  
                  if (userSLSkipWaitingForWin[userId]) {
                    delete userSLSkipWaitingForWin[userId];
                    logging.info(`SL Layer: Got win after skip, resetting SL state for user ${userId}`);
                  }
                  
                  updateBettingStrategy(settings, true, amount);
                } else {
                  settings.consecutive_losses = (settings.consecutive_losses || 0) + 1;
                  logging.info(`SL Layer: Consecutive losses increased to ${settings.consecutive_losses}/${settings.sl_layer}`);
                  
                  updateBettingStrategy(settings, false, amount);
                  
                  if (settings.consecutive_losses >= settings.sl_layer) {
                    const bettingStrategy = settings.betting_strategy || "Martingale";
                    if (bettingStrategy === "Martingale" || bettingStrategy === "Anti-Martingale") {
                      settings.original_martin_index = settings.martin_index || 0;
                    } else if (bettingStrategy === "D'Alembert") {
                      settings.original_dalembert_units = settings.dalembert_units || 1;
                    } else if (bettingStrategy === "Custom") {
                      settings.original_custom_index = settings.custom_index || 0;
                    }
                    
                    settings.skip_betting = true;
                    userShouldSkipNext[userId] = true;
                    userSLSkipWaitingForWin[userId] = true;
                    logging.warning(`SL Layer triggered! Skipping next bet after ${settings.consecutive_losses} consecutive losses.`);
                  }
                }
              } else {
                updateBettingStrategy(settings, isWin, amount);
              }
              
              if (isVirtual) {
                if (!userStats[userId].virtual_balance) {
                  userStats[userId].virtual_balance = settings.virtual_balance || 0;
                }
                
                if (isWin) {
                  userStats[userId].virtual_balance += amount * 0.96;
                } else {
                  userStats[userId].virtual_balance -= amount;
                }
              } else {
                if (userStats[userId] && amount > 0) {
                  if (isWin) {
                    const profitChange = amount * 0.96;
                    userStats[userId].profit += profitChange;
                  } else {
                    userStats[userId].profit -= amount;
                  }
                }
              }
              
              const currentBalance = isVirtual 
                ? userStats[userId].virtual_balance 
                : await getBalance(session, parseInt(userId));
              
              const botStopped = await checkProfitAndStopLoss(userId, bot);
              
              if (!userStats[userId]) {
                userStats[userId] = {
                  start_balance: 0,
                  profit: 0,
                  virtual_balance: settings.virtual_mode ? (settings.virtual_balance || 0) : 0,
                  initial_balance: settings.virtual_mode ? (settings.virtual_balance || 0) : 0
                };
              }

              if (!isSilent) {
                let resultText;
                if (betType === "COLOR") {
                  resultText = `${EMOJI.RESULT} Result: ${number} → ${getColorName(color)} (${bigSmall === 'B' ? 'Big' : 'Small'})`;
                } else {
                  resultText = `${EMOJI.RESULT} Result: ${number} → ${bigSmall === 'B' ? 'Big' : 'Small'}`;
                }
                
                const gameId = `${EMOJI.GAME} ${escapeMarkdown(gameType)} : ${period}`;
                
                let message;
                if (isWin) {
                  const winAmount = amount * 0.96;
                  const totalProfit = isVirtual 
                    ? (userStats[userId].virtual_balance - (userStats[userId].initial_balance || 0))
                    : (userStats[userId]?.profit || 0);
                  message = `${EMOJI.WIN} ${STYLE.BOLD('VICTORY')} +${winAmount.toFixed(2)} Ks\n` +
                           `${STYLE.SEPARATOR}\n` +
                           `${gameId}\n` +
                           `${resultText}\n` +
                           `${EMOJI.BALANCE} Balance: ${currentBalance?.toFixed(2) || '0.00'} Ks\n` +
                           `${EMOJI.PROFIT} Total Profit: ${totalProfit >= 0 ? '+' : ''}${totalProfit.toFixed(2)} Ks`;
                } else {
                  const totalProfit = isVirtual 
                    ? (userStats[userId].virtual_balance - (userStats[userId].initial_balance || 0))
                    : (userStats[userId]?.profit || 0);
                  const consecutiveLosses = settings.consecutive_losses || 0;
                  
                  let slStatusLine = '';
                  if (settings.sl_layer) {
                    slStatusLine = `${EMOJI.WARNING} Consecutive Losses: ${consecutiveLosses}/${settings.sl_layer}\n`;
                  }
                  
                  message = `${EMOJI.LOSS} ${STYLE.BOLD('LOSS')} -${amount} Ks\n` +
                           `${STYLE.SEPARATOR}\n` +
                           `${gameId}\n` +
                           `${resultText}\n` +
                           `${slStatusLine}` +
                           `${EMOJI.BALANCE} Balance: ${currentBalance?.toFixed(2) || '0.00'} Ks\n` +
                           `${EMOJI.LOSS_ICON} Total Profit: ${totalProfit >= 0 ? '+' : ''}${totalProfit.toFixed(2)} Ks`;
                }
                
                try {
                  await bot.telegram.sendMessage(userId, convertToPremiumEmojis(message), { parse_mode: 'HTML' });
                } catch (error) {
                  logging.error(`Failed to send result to ${userId}: ${error.message}`);
                }
              }
              
              if (isSilent) {
                await updateLiveStats(userId, bot);
              }
              
              
              
              delete userPendingBets[userId][period];
              if (Object.keys(userPendingBets[userId]).length === 0) {
                delete userPendingBets[userId];
              }
              userWaitingForResult[userId] = false;
            }
          }
        }
        
        if (userSkippedBets[userId]) {
          if (!userStats[userId]) {
            userStats[userId] = {
              start_balance: 0,
              profit: 0,
              virtual_balance: settings.virtual_mode ? (settings.virtual_balance || 0) : 0,
              initial_balance: settings.virtual_mode ? (settings.virtual_balance || 0) : 0
            };
          }

          for (const [period, betInfo] of Object.entries(userSkippedBets[userId])) {
            const settled = data.find(item => item.issueNumber === period);
            if (settled && settled.number) {
              if (gameType === "WINGO_30S" || gameType === "WINGO_3MIN" || gameType === "WINGO_5MIN") {
                logging.debug(`${gameType}: Found result for skipped period ${period}: ${settled.number}`);
              }
              
              const [betChoice, isVirtual] = betInfo;
              const number = parseInt(settled.number || "0") % 10;
              const bigSmall = number >= 5 ? "B" : "S";
              const color = numberToColor(number);
              
              let isWin;
              if (betType === "COLOR") {
                isWin = betChoice === color;
              } else {
                isWin = (betChoice === "B" && bigSmall === "B") || (betChoice === "S" && bigSmall === "S");
              }
              
              if (!userLastResults[userId]) {
                userLastResults[userId] = [];
              }
              userLastResults[userId].push(number.toString());
              if (userLastResults[userId].length > 10) {
                userLastResults[userId] = userLastResults[userId].slice(-10);
              }
              
              if (!userAllResults[userId]) {
                userAllResults[userId] = [];
              }
              userAllResults[userId].push(bigSmall);
              if (userAllResults[userId].length > 500) {
                userAllResults[userId] = userAllResults[userId].slice(-500);
              }

              if (settings.strategy === "R_PAT") {
                const rpatState = settings.rpat_state || {
                  total_bets: 0, wins: 0, losses: 0, max_streak: 0, current_loss_streak: 0
                };
                rpatState.total_bets++;
                if (isWin) {
                  rpatState.wins++;
                  rpatState.current_loss_streak = 0;
                } else {
                  rpatState.losses++;
                  rpatState.current_loss_streak++;
                  rpatState.max_streak = Math.max(rpatState.max_streak, rpatState.current_loss_streak);
                }
                settings.rpat_state = rpatState;
              }
              
              if (settings.strategy === "DYNAMIC_TREND_FLIP" && betType !== "COLOR") {
                updateDynamicTrendFlipState(userId, betChoice, bigSmall, isWin);
              }

              if (settings.strategy === "TREND_FOLLOW") {
                if (betType === "COLOR") {
                  if (!settings.color_trend_state) {
                    settings.color_trend_state = { last_result: null };
                  }
                  settings.color_trend_state.last_result = color;
                  logging.info(`Color TREND_FOLLOW: Updated last_result to ${color}`);
                } else {
                  if (!settings.trend_state) {
                    settings.trend_state = { last_result: null, skip_mode: false };
                  }
                  settings.trend_state.last_result = bigSmall;
                  
                  if (settings.trend_state.skip_mode) {
                    if (isWin) {
                      settings.trend_state.skip_mode = false;
                      logging.info(`TREND_FOLLOW: Win in skip mode. Resuming normal betting.`);
                    }
                    logging.info(`TREND_FOLLOW: Updated last_result to ${bigSmall} (still in skip mode)`);
                  }
                }
              }
              
              if (settings.strategy === "ALTERNATE") {
                if (!settings.alternate_state) {
                  settings.alternate_state = { last_result: null, skip_mode: false };
                }
                settings.alternate_state.last_result = bigSmall;
                
                if (settings.alternate_state.skip_mode) {
                  if (isWin) {
                    settings.alternate_state.skip_mode = false;
                    logging.info(`ALTERNATE: Win in skip mode. Resuming normal betting.`);
                  }
                  logging.info(`ALTERNATE: Updated last_result to ${bigSmall} (still in skip mode)`);
                } else {
                  logging.info(`ALTERNATE: Updated last_result to ${bigSmall} (normal mode)`);
                }
              }
              
              const entryLayer = settings.layer_limit || 1;
              
              if (entryLayer === 2) {
                if (!settings.entry_layer_state) {
                  settings.entry_layer_state = { waiting_for_lose: true };
                }
                
                if (settings.entry_layer_state.waiting_for_lose) {
                  if (isWin) {
                    settings.entry_layer_state.waiting_for_lose = true;
                  } else {
                    settings.entry_layer_state.waiting_for_lose = false;
                  }
                }
              } else if (entryLayer === 3) {
                if (!settings.entry_layer_state) {
                  settings.entry_layer_state = { waiting_for_loses: true, consecutive_loses: 0 };
                }
                
                if (settings.entry_layer_state.waiting_for_loses) {
                  if (isWin) {
                    settings.entry_layer_state.waiting_for_loses = true;
                    settings.entry_layer_state.consecutive_loses = 0;
                  } else {
                    settings.entry_layer_state.consecutive_loses++;
                    if (settings.entry_layer_state.consecutive_loses >= 2) {
                      settings.entry_layer_state.waiting_for_loses = false;
                    }
                  }
                }
              }
              
              if (settings.sl_layer && settings.sl_layer > 0 && userSLSkipWaitingForWin[userId] && isWin) {
                userShouldSkipNext[userId] = false;
                settings.skip_betting = false;
                settings.consecutive_losses = 0;
                delete userSLSkipWaitingForWin[userId];
                
                const bettingStrategy = settings.betting_strategy || "Martingale";
                if (bettingStrategy === "Martingale" || bettingStrategy === "Anti-Martingale") {
                  settings.martin_index = settings.original_martin_index || 0;
                } else if (bettingStrategy === "D'Alembert") {
                  settings.dalembert_units = settings.original_dalembert_units || 1;
                } else if (bettingStrategy === "Custom") {
                  settings.custom_index = settings.original_custom_index || 0;
                }
                
                logging.info(`SL Layer: Skip win achieved! Resetting SL state and continuing with normal betting for user ${userId}`);
              }
              
              const currentBalance = isVirtual 
                ? userStats[userId].virtual_balance 
                : await getBalance(session, parseInt(userId));
              const totalProfit = isVirtual 
                ? (userStats[userId].virtual_balance - (userStats[userId].initial_balance || 0))
                : (userStats[userId]?.profit || 0);
              
              if (!isSilent) {
                let resultText;
                if (betType === "COLOR") {
                  resultText = `${EMOJI.RESULT} Result: ${number} → ${getColorName(color)} (${bigSmall === 'B' ? 'Big' : 'Small'})`;
                } else {
                  resultText = `${EMOJI.RESULT} Result: ${number} → ${bigSmall === 'B' ? 'Big' : 'Small'}`;
                }
                
                const gameId = `${EMOJI.GAME} ${escapeMarkdown(gameType)} : ${period}`;
                
                const resultMessage = isWin ? 
                  `${EMOJI.RESULTSBS} ${STYLE.BOLD('RESULT')}\n` +
                  `${STYLE.SEPARATOR}\n` +
                  `${gameId}\n` +
                  `${resultText}\n` +
                  `${EMOJI.BALANCE} Balance: ${currentBalance?.toFixed(2) || '0.00'} Ks\n` +
                  `${EMOJI.PROFIT} Total Profit: ${totalProfit >= 0 ? '+' : ''}${totalProfit.toFixed(2)} Ks` :
                  `${EMOJI.LOSS} ${STYLE.BOLD('RESULT')}\n` +
                  `${STYLE.SEPARATOR}\n` +
                  `${gameId}\n` +
                  `${resultText}\n` +
                  `${EMOJI.BALANCE} Balance: ${currentBalance?.toFixed(2) || '0.00'} Ks\n` +
                  `${EMOJI.LOSS_ICON} Total Profit: ${totalProfit >= 0 ? '+' : ''}${totalProfit.toFixed(2)} Ks`;
                
                try {
                  await bot.telegram.sendMessage(userId, convertToPremiumEmojis(resultMessage), { parse_mode: 'HTML' });
                } catch (error) {
                  logging.error(`Failed to send virtual result to ${userId}: ${error.message}`);
                }
              }
              
              if (isSilent) {
                await updateLiveStats(userId, bot);
              }
              
              delete userSkippedBets[userId][period];
              if (Object.keys(userSkippedBets[userId]).length === 0) {
                delete userSkippedBets[userId];
              }
              
              if (userSkipResultWait[userId] === period) {
                delete userSkipResultWait[userId];
              }
            }
          }
        }
      }
      await new Promise(resolve => setTimeout(resolve, WIN_LOSE_CHECK_INTERVAL * 1000));
    } catch (error) {
      logging.error(`Win/lose checker error: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  }
}

function getBetIndexEmoji(settings) {
  const bettingStrategy = settings.betting_strategy || "Martingale";
  let betIndex = 0;
  
  if (bettingStrategy === "Martingale" || bettingStrategy === "Anti-Martingale") {
    betIndex = settings.martin_index || 0;
  } else if (bettingStrategy === "Custom") {
    betIndex = settings.custom_index || 0;
  } else if (bettingStrategy === "D'Alembert") {
    betIndex = (settings.dalembert_units || 1) - 1;
  }
  
  return betIndex === 0 ? "🔺" : "🔻";
}

async function createResultImage(type, amount, balance, isVirtual, currentProfit, userId) {
  const canvas = createCanvas(800, 500);
  const ctx = canvas.getContext('2d');
  
  // Premium dark theme background with depth
  if (type === 'PROFIT') {
    // Luxury emerald with black pearl gradient
    const gradient = ctx.createLinearGradient(0, 0, 800, 500);
    gradient.addColorStop(0, '#0A2F1F');
    gradient.addColorStop(0.3, '#1A4F2A');
    gradient.addColorStop(0.7, '#0E3B1E');
    gradient.addColorStop(1, '#052010');
    ctx.fillStyle = gradient;
  } else {
    // Royal burgundy with black diamond gradient
    const gradient = ctx.createLinearGradient(0, 0, 800, 500);
    gradient.addColorStop(0, '#2A0A0A');
    gradient.addColorStop(0.3, '#4F1A1A');
    gradient.addColorStop(0.7, '#3B0E0E');
    gradient.addColorStop(1, '#200505');
    ctx.fillStyle = gradient;
  }
  
  ctx.fillRect(0, 0, 800, 500);
  
  // Intricate geometric pattern overlay
  ctx.strokeStyle = type === 'PROFIT' ? 'rgba(255,215,0,0.1)' : 'rgba(255,99,71,0.1)';
  ctx.lineWidth = 0.5;
  for (let i = 0; i < 20; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 40, 0);
    ctx.lineTo(i * 40 + 500, 500);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(800 - i * 40, 0);
    ctx.lineTo(800 - i * 40 - 500, 500);
    ctx.stroke();
  }
  
  // Crystal light effects
  for (let i = 0; i < 5; i++) {
    const gradient = ctx.createRadialGradient(
      100 + i * 150, 100 + i * 80, 20,
      100 + i * 150, 100 + i * 80, 150
    );
    gradient.addColorStop(0, `rgba(255,255,255,${0.15 - i * 0.02})`);
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 800, 500);
  }
  
  // Premium frame with metallic effect
  ctx.strokeStyle = type === 'PROFIT' ? 'rgba(255,215,0,0.8)' : 'rgba(255,99,71,0.8)';
  ctx.lineWidth = 4;
  ctx.strokeRect(8, 8, 784, 484);
  
  // Inner glow frame
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 1;
  ctx.strokeRect(12, 12, 776, 476);
  
  // Ornate corner designs
  ctx.fillStyle = type === 'PROFIT' ? 'rgba(255,215,0,0.6)' : 'rgba(255,99,71,0.6)';
  ctx.shadowBlur = 15;
  ctx.shadowColor = type === 'PROFIT' ? '#FFD700' : '#FF6347';
  
  // Top-left corner
  ctx.beginPath();
  ctx.moveTo(20, 20);
  ctx.lineTo(45, 20);
  ctx.lineTo(20, 45);
  ctx.closePath();
  ctx.fillStyle = type === 'PROFIT' ? 'rgba(255,215,0,0.4)' : 'rgba(255,99,71,0.4)';
  ctx.fill();
  
  // Top-right corner
  ctx.beginPath();
  ctx.moveTo(780, 20);
  ctx.lineTo(755, 20);
  ctx.lineTo(780, 45);
  ctx.closePath();
  ctx.fill();
  
  // Bottom-left corner
  ctx.beginPath();
  ctx.moveTo(20, 480);
  ctx.lineTo(45, 480);
  ctx.lineTo(20, 455);
  ctx.closePath();
  ctx.fill();
  
  // Bottom-right corner
  ctx.beginPath();
  ctx.moveTo(780, 480);
  ctx.lineTo(755, 480);
  ctx.lineTo(780, 455);
  ctx.closePath();
  ctx.fill();
  
  ctx.shadowBlur = 0;
  
  // Floating orbs with advanced glow
  ctx.shadowBlur = 20;
  ctx.shadowColor = type === 'PROFIT' ? 'rgba(255,215,0,0.6)' : 'rgba(255,99,71,0.6)';
  
  for (let i = 0; i < 15; i++) {
    const x = Math.random() * 800;
    const y = Math.random() * 500;
    const radius = Math.random() * 12 + 2;
    
    // Inner core
    ctx.fillStyle = type === 'PROFIT' ? 'rgba(255,215,0,0.5)' : 'rgba(255,99,71,0.5)';
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    
    // Outer glow
    ctx.fillStyle = type === 'PROFIT' ? 'rgba(255,215,0,0.15)' : 'rgba(255,99,71,0.15)';
    ctx.beginPath();
    ctx.arc(x, y, radius * 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  
  ctx.shadowBlur = 0;
  
  // Main title with luxury metallic effect
  ctx.textAlign = 'center';
  
  // Title shadow layers
  ctx.shadowBlur = 20;
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowOffsetX = 4;
  ctx.shadowOffsetY = 4;
  
  ctx.font = 'bold 48px "Arial Black", sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  const title = type === 'PROFIT' ? 'TARGET ACHIEVED' : 'STOP LOSS HIT';
  ctx.fillText(title, 402, 82);
  
  ctx.shadowBlur = 15;
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.fillText(title, 401, 81);
  
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  
  // Main title with gradient
  const titleGradient = ctx.createLinearGradient(300, 60, 500, 100);
  if (type === 'PROFIT') {
    titleGradient.addColorStop(0, '#FFD700');
    titleGradient.addColorStop(0.5, '#FFF8E7');
    titleGradient.addColorStop(1, '#FFD700');
  } else {
    titleGradient.addColorStop(0, '#FF6347');
    titleGradient.addColorStop(0.5, '#FFE4E1');
    titleGradient.addColorStop(1, '#FF6347');
  }
  ctx.fillStyle = titleGradient;
  ctx.fillText(title, 400, 80);
  
  // Premium text effects for values
  ctx.font = 'bold 36px Arial';
  
  // Shadow for value texts
  ctx.shadowBlur = 10;
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;
  
  if (type === 'PROFIT') {
    ctx.fillStyle = '#FFF8E7';
    ctx.fillText(`Target: ${amount} Ks`, 400, 160);
    
    // Profit with special glow
    ctx.shadowBlur = 20;
    ctx.shadowColor = 'rgba(255,215,0,0.8)';
    ctx.fillStyle = '#FFE55C';
    ctx.fillText(`Profit: +${currentProfit.toFixed(2)} Ks`, 400, 220);
  } else {
    ctx.fillStyle = '#FFE4E1';
    ctx.fillText(`Limit: ${amount} Ks`, 400, 160);
    
    // Loss with special glow
    ctx.shadowBlur = 20;
    ctx.shadowColor = 'rgba(255,99,71,0.8)';
    ctx.fillStyle = '#FFA07A';
    ctx.fillText(`Loss: ${Math.abs(currentProfit).toFixed(2)} Ks`, 400, 220);
  }
  
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  
  // Balance with crystal effect
  ctx.font = '28px Arial';
  ctx.fillStyle = '#FFFFFF';
  ctx.shadowBlur = 8;
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  const balanceText = isVirtual 
    ? `Virtual Balance: ${balance.toFixed(2)} Ks` 
    : `Real Balance: ${balance.toFixed(2)} Ks`;
  ctx.fillText(balanceText, 400, 300);
  
  // Elegant separator with diamond effect
  ctx.shadowBlur = 10;
  ctx.shadowColor = type === 'PROFIT' ? 'rgba(255,215,0,0.5)' : 'rgba(255,99,71,0.5)';
  
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(200, 340 + i);
    ctx.lineTo(600, 340 + i);
    ctx.strokeStyle = `rgba(255,255,255,${0.2 - i * 0.05})`;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  
  // Decorative separator elements
  for (let i = 0; i < 9; i++) {
    const x = 200 + i * 50;
    ctx.fillStyle = type === 'PROFIT' ? 'rgba(255,215,0,0.6)' : 'rgba(255,99,71,0.6)';
    ctx.beginPath();
    ctx.arc(x, 340, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath();
    ctx.arc(x, 340, 1, 0, Math.PI * 2);
    ctx.fill();
  }
  
  ctx.shadowBlur = 0;
  
  // TRADE watermark - exactly like the example
  ctx.save();
  ctx.translate(400, 380);
  ctx.font = 'bold 40px Arial';
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  ctx.fillText('RN RISK', 0, 0);
  ctx.restore();
  
  // User ID with elegant underline
  ctx.font = '20px Arial';
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.fillText(`User ID: ${userId}`, 400, 420);
  
  // Decorative underline for User ID
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(350, 430);
  ctx.lineTo(450, 430);
  ctx.stroke();
  
  // Time with vintage effect
  const now = new Date();
  ctx.font = '16px Arial';
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillText(now.toLocaleString(), 400, 460);
  
  // Time decorative border
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  ctx.fillRect(300, 445, 200, 1);
  ctx.fillRect(300, 475, 200, 1);
  
  // Sparkle effects
  for (let i = 0; i < 25; i++) {
    const x = Math.random() * 800;
    const y = Math.random() * 500;
    ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.3 + 0.1})`;
    ctx.beginPath();
    ctx.arc(x, y, Math.random() * 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
  
  const imagePath = path.join(__dirname, `result_${userId}_${Date.now()}.png`);
  const out = fs.createWriteStream(imagePath);
  const stream = canvas.createPNGStream();
  stream.pipe(out);
  
  return new Promise((resolve) => {
    out.on('finish', () => resolve(imagePath));
  });
}

async function bettingWorker(userId, ctx, bot) {
  const settings = userSettings[userId] || {};
  let session = userSessions[userId];
  ensureUserStatsInitialized(userId);
  const isSilent = userSilentMessages[userId]?.enabled || false;

  if (!settings || !session) {
    await sendMessageWithRetry(ctx, `${EMOJI.ERROR} Please login first`, makeMainKeyboard(false, userId === ADMIN_ID));
    settings.running = false;
    return;
  }
  
  if (!userStats[userId]) {
    if (settings.virtual_mode) {
      userStats[userId] = { 
        virtual_balance: settings.virtual_balance || 0,
        initial_balance: settings.virtual_balance || 0
      };
    } else {
      userStats[userId] = { start_balance: 0.0, profit: 0.0 };
    }
  }
  
  const timeRangeCheck = checkTimeRange(userId);
  if (userActiveTimeRange[userId] && !timeRangeCheck.shouldRun) {
    await sendMessageWithRetry(ctx, `${EMOJI.TIME} ${STYLE.BOLD('Outside of active time range')}\n\n${EMOJI.INFO} Bot will start when time range begins.`, makeMainKeyboard(true, userId === ADMIN_ID));
    settings.running = false;
    return;
  }
  
  settings.running = true;
  settings.last_issue = null;
  settings.consecutive_errors = 0;
  settings.consecutive_losses = 0;
  settings.current_layer = 0;
  settings.skip_betting = false;
  
  if (!isSilent) {
    if (userSilentMessages[userId] && userSilentMessages[userId].messageId && userSilentMessages[userId].chatId) {
      try {
        await bot.telegram.deleteMessage(userSilentMessages[userId].chatId, userSilentMessages[userId].messageId);
      } catch (error) {}
      delete userSilentMessages[userId];
    }
  } else {
    const isVirtual = settings.virtual_mode || false;
    let balance = 0;
    let startAmount = 0;
    
    if (isVirtual) {
      balance = userStats[userId].virtual_balance || 0;
      startAmount = userStats[userId].initial_balance || balance;
    } else {
      balance = await getBalance(session, parseInt(userId)) || 0;
      startAmount = userStats[userId].start_balance || balance;
    }
    
    const profit = isVirtual ? balance - startAmount : userStats[userId].profit || 0;
    const gameType = settings.game_type || "TRX";
    const strategy = settings.strategy || "TREND_FOLLOW";
    const betSizes = settings.bet_sizes || [];
    const betWrager = betSizes.length > 0 ? betSizes.join(', ') : 'Not set';
    
    try {
      const imagePath = await createLiveStatsImage(startAmount, profit, balance, isVirtual, gameType, strategy, betWrager, userId);
      const sentMessage = await ctx.replyWithPhoto(
        { source: imagePath },
        { 
          caption: convertToPremiumEmojis(`${EMOJI.LIVE} *LIVE STATS MONITORING*`).replace(/\*([^*]+)\*/g, '<b>$1</b>'),
          parse_mode: 'HTML'
        }
      );
      
      userSilentMessages[userId] = {
        enabled: true,
        messageId: sentMessage.message_id,
        chatId: sentMessage.chat.id
      };
      
      fs.unlinkSync(imagePath);
    } catch (error) {
      logging.error(`Failed to create live stats image for user ${userId}: ${error.message}`);
    }
  }
  
  if (settings.strategy === "CYBER_SNIPER") {
    settings.cyber_sniper_state = {
      active: false,
      direction: null,
      sequence: [],
      step: 0,
      hit_count: 0,
      got_same_result: false
    };
    userLastResults[userId] = [];
    logging.info(`CYBER_SNIPER initialized`);
  }

  if (settings.strategy === "OP_PATTERN") {
    settings.op_pattern_index = 0;
    logging.info(`OP_PATTERN initialized`);
  }
  if (settings.strategy === "CUSTOM_DIGIT") {
    settings.digit_mapping = DEFAULT_DIGIT_MAPPING;
    logging.info(`CUSTOM_DIGIT initialized`);
  }
  if (settings.strategy === "SHINE") {
    settings.shine_state = {
      consecutive_count: 0,
      last_result: null,
      pattern_index: 0
    };
    logging.info(`SHINE initialized`);
  }
  if (settings.strategy === "ALINKAR") {
    settings.alinkar_index = 0;
    logging.info(`ALINKAR initialized`);
  }
  if (settings.strategy === "PLUTO") {
    settings.pluto_state = {
      current_pattern: PLUTO_PATTERNS["0"],
      pattern_index: 0,
      last_digit: "0"
    };
    logging.info(`PLUTO initialized`);
  }
  if (settings.strategy === "DREAM") {
    logging.info(`DREAM initialized`);
  }
  if (settings.strategy === "DREAM_V2") {
    logging.info(`DREAM_V2 initialized`);
  }
  if (settings.strategy === "SNIPER_V1") {
    logging.info(`SNIPER_V1 initialized`);
  }

  if (settings.strategy === "COLOR_SNIPER") {
    settings.color_sniper_state = {
      active: false,
      step: 0,
      hit_count: 0,
      waiting_for_trigger: true
    };
    userLastResults[userId] = [];
    logging.info(`COLOR_SNIPER initialized`);
  }

  if (settings.strategy === "TIME_WARP") {
    if (!settings.time_warp_pos) settings.time_warp_pos = 8;
    logging.info(`TIME_WARP initialized at pos ${settings.time_warp_pos}`);
  }
  
  if (["CYBER_SNIPER", "COLOR_SNIPER"].includes(settings.strategy)) {
    settings.sniper_hit_count = 0;
    settings.sniper_loss_count = 0;
    logging.info(`Reset sniper counters for ${settings.strategy} - Hits: 0/${SNIPER_MAX_HITS}, Losses: 0/${SNIPER_MAX_LOSSES}`);
  }
  
  if (settings.original_martin_index === undefined) {
    settings.original_martin_index = 0;
  }
  if (settings.original_dalembert_units === undefined) {
    settings.original_dalembert_units = 1;
  }
  if (settings.original_custom_index === undefined) {
    settings.original_custom_index = 0;
  }
  
  userShouldSkipNext[userId] = false;
  delete userSLSkipWaitingForWin[userId];
  
  const entryLayer = settings.layer_limit || 1;
  const betType = settings.bet_type || "BS";
  
  if (entryLayer === 2) {
    settings.entry_layer_state = { waiting_for_lose: true };
  } else if (entryLayer === 3) {
    settings.entry_layer_state = { waiting_for_loses: true, consecutive_loses: 0 };
  }
  
  if (settings.strategy === "TREND_FOLLOW") {
    if (betType === "COLOR") {
      settings.color_trend_state = { last_result: null };
    } else {
      settings.trend_state = { last_result: null, skip_mode: false };
    }
    logging.info(`TREND_FOLLOW strategy initialized for user ${userId}`);
  }
  
  if (settings.strategy === "ALTERNATE") {
    settings.alternate_state = { last_result: null, skip_mode: false };
    logging.info(`ALTERNATE strategy initialized for user ${userId}`);
  }
  
  if (settings.strategy === "BS_ORDER") {
    if (!settings.pattern || settings.pattern.length === 0) {
      settings.pattern = DEFAULT_BS_ORDER;
      settings.pattern_index = 0;
      if (!isSilent) {
        await sendMessageWithRetry(ctx,
          `${EMOJI.INFO} No BS pattern found, using default: ${DEFAULT_BS_ORDER}`,
          makeMainKeyboard(true, userId === ADMIN_ID)
        );
      }
    } else {
      const pattern = settings.pattern;
      if (!pattern.split('').every(c => c === 'B' || c === 'S')) {
        if (!isSilent) {
          await sendMessageWithRetry(ctx,
            `${EMOJI.ERROR} Invalid BS pattern! Using default pattern instead.`,
            makeMainKeyboard(true, userId === ADMIN_ID)
          );
        }
        settings.pattern = DEFAULT_BS_ORDER;
        settings.pattern_index = 0;
      }
    }
    
    settings.pattern_index = 0;
    
    const pattern = settings.pattern;
    const firstBet = pattern && pattern.length > 0 ? pattern[0] : 'B';
    
    if (!isSilent) {
      await sendMessageWithRetry(ctx,
        `${EMOJI.PATTERN} ${STYLE.BOLD('BS ORDER Strategy Active')}\n` +
        `${STYLE.ITEM(`Pattern: ${pattern}`)}\n` +
        `${STYLE.ITEM(`Length: ${pattern.length}`)}\n` +
        `${STYLE.LAST_ITEM(`First bet will be: ${firstBet === 'B' ? 'BIG' : 'SMALL'}`)}`
      );
    }
    
    logging.info(`BS_ORDER strategy initialized for user ${userId}, Pattern: ${settings.pattern}, Index: 0`);
  }
  
  if (!userLastResults[userId]) {
    userLastResults[userId] = [];
  }
  
  let currentBalance = null;
  if (settings.virtual_mode) {
    currentBalance = userStats[userId].virtual_balance || settings.virtual_balance || 0;
  } else {
    let balanceRetrieved = false;
    for (let attempt = 0; attempt < MAX_BALANCE_RETRIES; attempt++) {
      try {
        const balanceResult = await getBalance(session, parseInt(userId));
        if (balanceResult !== null) {
          currentBalance = balanceResult;
          userStats[userId].start_balance = currentBalance;
          balanceRetrieved = true;
          break;
        }
      } catch (error) {
        logging.error(`Balance check attempt ${attempt + 1} failed: ${error.message}`);
      }
      
      if (attempt < MAX_BALANCE_RETRIES - 1) {
        await new Promise(resolve => setTimeout(resolve, BALANCE_RETRY_DELAY * 1000));
      }
    }
    
    if (!balanceRetrieved) {
      await sendMessageWithRetry(ctx, `${EMOJI.ERROR} Failed to check balance. Please try again.`, makeMainKeyboard(true, userId === ADMIN_ID));
      settings.running = false;
      return;
    }
  }
  
  const safeEscape = (text) => {
    if (text === null || text === undefined) return '';
    return String(text).replace(/[*_`\\[\]()~>#+\-=|{}.!]/g, '\\$&');
  };
  
  let strategyText = settings.strategy === "TREND_FOLLOW" ? "Trend Follow" :
                     settings.strategy === "ALTERNATE" ? "Alternate" :
                     settings.strategy === "BS_ORDER" ? "Bs Order" :
                     settings.strategy === "CYBER_SNIPER" ? "Cyber Sniper" :
                     settings.strategy === "RLDS_V2" ? "RLDS V2" :
                     settings.strategy === "RLDS" ? "RLDS Strategy" :
                     settings.strategy === "QUANTUM_CALC" ? "Quantum Calc" :
                     settings.strategy === "TIME_WARP" ? "Time Warp" :
                     settings.strategy === "COLOR_SNIPER" ? "Color Sniper" :
                     settings.strategy === "OP_PATTERN" ? "OP Pattern" :
                     settings.strategy === "CUSTOM_DIGIT" ? "Custom Digit" :
                     settings.strategy === "SHINE" ? "Shine" :
                     settings.strategy === "ALINKAR" ? "Alinkar" :
                     settings.strategy === "PLUTO" ? "Pluto" :
                     settings.strategy === "DREAM" ? "Dream" :
                     settings.strategy === "DREAM_V2" ? "Dream V2" :
                     settings.strategy === "SNIPER_V1" ? "Sniper V1" :
                     settings.strategy === "DYNAMIC_TREND_FLIP" ? "Dynamic Trend-Flip Strategy" :
                     settings.strategy === "MANUS_V1" ? "Manus V1" :
                      settings.strategy === "MANUS_V2" ? "Manus V2" :
                     settings.strategy === "CHI_SQUARE_ANOMALY_DETECTION" ? "Chi-Square Anomaly Detection" :
                     settings.strategy === "MULTIPLICATION_MATRIX" ? "Multiplication Matrix (Cross-Product Modulo)" :
                      settings.strategy === "AI_STEAGEY" ? "Ai steagey" :
                      settings.strategy === "XENN_STRAGEY" ? "Fire stragey" :
                      settings.strategy === "R_PAT" ? "R-PAT" :
                      safeEscape(settings.strategy);

  if (settings.strategy === "TREND_FOLLOW") {
    const bsWaitCount = settings.bs_sb_wait_count || 0;
    if (bsWaitCount > 0) {
      strategyText += ` (BS/SB Wait: ${bsWaitCount})`;
    }
  }
  
  if (settings.strategy === "ALTERNATE") {
    const bbWaitCount = settings.bb_ss_wait_count || 0;
    if (bbWaitCount > 0) {
      strategyText += ` (BB/SS Wait: ${bbWaitCount})`;
    }
  }

  const bettingStrategyText = settings.betting_strategy === "Martingale" ? "Martingale" :
                            settings.betting_strategy === "Anti-Martingale" ? "Anti-Martingale" :
                            settings.betting_strategy === "D'Alembert" ? "D'Alembert" :
                            settings.betting_strategy === "Custom" ? "Custom" : safeEscape(settings.betting_strategy);

  const profitTargetText = settings.target_profit ? `${settings.target_profit} Ks` : "Not Set";
  const stopLossText = settings.stop_loss ? `${settings.stop_loss} Ks` : "Not Set";
  const gameType = settings.game_type || "TRX";
  const betTypeText = settings.bet_type === "COLOR" ? "Color" : "Big/Small";

  if (!isSilent) {
    const startMessage = 
      `${EMOJI.START} *BOT ACTIVATED*\n` +
      `${STYLE.SEPARATOR}\n\n` +
      `${EMOJI.BALANCE} Balance: ${currentBalance} Ks\n\n` +
      `${EMOJI.GAME} Game: ${safeEscape(gameType)}\n` +
      `${EMOJI.MODE} Type: ${safeEscape(betTypeText)}\n` +
      `${EMOJI.STRATEGY} Strategy: ${strategyText}\n` +
      `${EMOJI.SETTINGS} Mode: ${safeEscape(bettingStrategyText)}\n\n` +
      `${EMOJI.TARGET} Target: ${safeEscape(profitTargetText)}\n` +
      `${EMOJI.STOP} Stop Loss: ${safeEscape(stopLossText)}\n\n` +
      `${STYLE.SEPARATOR}\n` +
      `${EMOJI.LOADING} Starting betting sequence...`;

    await sendMessageWithRetry(ctx, startMessage);
  } else {
    await updateLiveStats(userId, bot);
  }
  
  try {
    while (settings.running) {
      const timeRangeCheck = checkTimeRange(userId);
      if (userActiveTimeRange[userId] && !timeRangeCheck.shouldRun) {
        if (userTimeRangeForecastWin[userId]) {
          logging.info(`TIME RANGE: Outside range but Forecast Win enabled. Continuing until next win.`);
        } else {
          logging.info(`TIME RANGE: Outside range. Stopping bot.`);
          settings.running = false;
          break;
        }
      }
      
      if (userWaitingForResult[userId]) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
      
      if (userSkipResultWait[userId]) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
      
      if (settings.virtual_mode) {
        currentBalance = userStats[userId].virtual_balance || settings.virtual_balance || 0;
      } else {
        try {
          const balanceResult = await getBalance(session, parseInt(userId));
          if (balanceResult !== null) {
            currentBalance = balanceResult;
          }
        } catch (error) {
          logging.error(`Balance check failed: ${error.message}`);
        }
      }
      
      if (currentBalance === null) {
        logging.error(`Current balance is null for user ${userId}`);
        if (!isSilent) {
          await sendMessageWithRetry(ctx, `${EMOJI.ERROR} Failed to recover balance. Stopping...`, makeMainKeyboard(true, userId === ADMIN_ID));
        }
        settings.running = false;
        break;
      }
      
      const betSizes = settings.bet_sizes || [];
      if (!betSizes.length) {
        if (!isSilent) {
          await sendMessageWithRetry(ctx, `${EMOJI.ERROR} Bet_Wragers not set. Please configure first.`);
        }
        settings.running = false;
        break;
      }
      
      const minBetSize = Math.min(...betSizes);
      if (currentBalance < minBetSize) {
        const message = `${EMOJI.WARNING} ${STYLE.BOLD('Low Balance!')}\n` +
                        `${STYLE.SEPARATOR}\n` +
                        `${STYLE.ITEM(`Current: ${currentBalance.toFixed(2)} Ks`)}\n` +
                        `${STYLE.LAST_ITEM(`Minimum: ${minBetSize} Ks`)}`;
        if (!isSilent) {
          await sendMessageWithRetry(ctx, message, makeMainKeyboard(true, userId === ADMIN_ID));
        }
        settings.running = false;
        break;
      }
      
      const balanceWarningThreshold = minBetSize * 3;
      const now = Date.now();
      const lastWarning = userBalanceWarnings[userId] || 0;
      
      if (currentBalance < balanceWarningThreshold && currentBalance >= minBetSize && (now - lastWarning > 60000)) {
        const warningMessage = `${EMOJI.WARNING} ${STYLE.BOLD('Balance Warning!')}\n` +
                              `${STYLE.SEPARATOR}\n` +
                              `${STYLE.ITEM(`Current: ${currentBalance.toFixed(2)} Ks`)}\n` +
                              `${STYLE.LAST_ITEM(`Minimum: ${minBetSize} Ks`)}`;
        if (!isSilent) {
          await sendMessageWithRetry(ctx, warningMessage);
        }
        userBalanceWarnings[userId] = now;
      }
      
      let issueRes;
      try {
        issueRes = await getGameIssueRequest(session, gameType);
        if (!issueRes || issueRes.code !== 0) {
          settings.consecutive_errors++;
          if (settings.consecutive_errors >= MAX_CONSECUTIVE_ERRORS) {
            if (!isSilent) {
              await sendMessageWithRetry(ctx, `${EMOJI.ERROR} Too many errors. Stopping.`);
            }
            settings.running = false;
            break;
          }
          await new Promise(resolve => setTimeout(resolve, 2000));
          continue;
        }
      } catch (error) {
        logging.error(`Error getting issue: ${error.message}`);
        settings.consecutive_errors++;
        if (settings.consecutive_errors >= MAX_CONSECUTIVE_ERRORS) {
          if (!isSilent) {
            await sendMessageWithRetry(ctx, `${EMOJI.ERROR} Too many errors. Stopping.`);
          }
          settings.running = false;
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
        continue;
      }
      
      settings.consecutive_errors = 0;
      
      let currentIssue;
      const data = issueRes.data || {};
      
      if (gameType === "TRX") {
        currentIssue = data.predraw?.issueNumber;
      } else {
        currentIssue = data.issueNumber;
      }
      
      if (!currentIssue || currentIssue === settings.last_issue) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
      
      let ch;
      let shouldSkip = false;
      let skipReason = "";

      let strategyOutcomes = [];
      if (["R_PAT", "CHI_SQUARE_ANOMALY_DETECTION", "MULTIPLICATION_MATRIX"].includes(settings.strategy)) {
        strategyOutcomes = await refreshStrategyResults(userId, session, gameType);
      }
      if (settings.strategy === "R_PAT") {
        await refreshRPatResults(userId, session, gameType);
      }
      
      if (settings.strategy === "CHI_SQUARE_ANOMALY_DETECTION") {
        const prediction = getChiSquareAnomalyDetectionPrediction(strategyOutcomes);
        ch = prediction.choice;
        shouldSkip = prediction.shouldSkip;
        if (shouldSkip) skipReason = `(${prediction.skipReason || 'Chi-Square Anomaly Detection'})`;
      } else if (settings.strategy === "MULTIPLICATION_MATRIX") {
        const prediction = getMultiplicationMatrixPrediction(strategyOutcomes, currentIssue);
        ch = prediction.choice;
        shouldSkip = prediction.shouldSkip;
        if (shouldSkip) skipReason = `(${prediction.skipReason || 'Multiplication Matrix'})`;
      } else if (settings.strategy === "CYBER_SNIPER") {
        const prediction = getCyberSniperPrediction(userId);
        ch = prediction.choice;
        shouldSkip = prediction.shouldSkip;
        if (shouldSkip) skipReason = "(Waiting for 0 or 9)";
      } else if (settings.strategy === "COLOR_SNIPER") {
        const prediction = getColorSniperPrediction(userId);
        ch = prediction.choice;
        shouldSkip = prediction.shouldSkip;
        if (shouldSkip) skipReason = "(Waiting for 1 or 7)";
      } else if (settings.strategy === "RLDS_V2") {
        const prediction = getRldsV2Prediction(userId, currentIssue);
        ch = prediction.choice;
        shouldSkip = prediction.shouldSkip;
        if (shouldSkip) skipReason = `(${prediction.skipReason || 'RLDS V2'})`;
      } else if (settings.strategy === "RLDS") {
        const prediction = getRldsPrediction(userId, currentIssue);
        ch = prediction.choice;
        shouldSkip = prediction.shouldSkip;
        if (shouldSkip) skipReason = `(${prediction.skipReason || 'RLDS'})`;
      } else if (settings.strategy === "QUANTUM_CALC") {
        ch = getQuantumCalcPrediction(userId);
        shouldSkip = false;
      } else if (settings.strategy === "TIME_WARP") {
        ch = getTimeWarpPrediction(userId);
        shouldSkip = false;
      } else if (settings.strategy === "OP_PATTERN") {
        const prediction = getOpPatternPrediction(userId);
        ch = prediction.choice;
        shouldSkip = prediction.shouldSkip;
        if (shouldSkip) skipReason = "(OP Pattern)";
      } else if (settings.strategy === "CUSTOM_DIGIT") {
        const prediction = getCustomDigitPrediction(userId);
        ch = prediction.choice;
        shouldSkip = prediction.shouldSkip;
        if (shouldSkip) skipReason = "(Digit Mapping)";
      } else if (settings.strategy === "SHINE") {
        const prediction = getShinePrediction(userId);
        ch = prediction.choice;
        shouldSkip = prediction.shouldSkip;
        if (shouldSkip) skipReason = "(Shine Pattern)";
      } else if (settings.strategy === "ALINKAR") {
        const prediction = getAlinkarPrediction(userId);
        ch = prediction.choice;
        shouldSkip = prediction.shouldSkip;
        if (shouldSkip) skipReason = "(Alinkar Pattern)";
      } else if (settings.strategy === "PLUTO") {
        const prediction = getPlutoPrediction(userId);
        ch = prediction.choice;
        shouldSkip = prediction.shouldSkip;
        if (shouldSkip) skipReason = "(Pluto Pattern)";
      } else if (settings.strategy === "DREAM") {
        const prediction = getDreamPrediction(userId);
        ch = prediction.choice;
        shouldSkip = prediction.shouldSkip;
        if (shouldSkip) skipReason = "(Dream Mapping)";
      } else if (settings.strategy === "DREAM_V2") {
        const prediction = getDreamV2Prediction(userId);
        ch = prediction.choice;
        shouldSkip = prediction.shouldSkip;
        if (shouldSkip) skipReason = "(Dream V2 Analysis)";
      } else if (settings.strategy === "SNIPER_V1") {
        const prediction = getSniperV1Prediction(userId);
        ch = prediction.choice;
        shouldSkip = prediction.shouldSkip;
        if (shouldSkip) skipReason = "(Sniper V1)";
      } else if (settings.strategy === "DYNAMIC_TREND_FLIP") {
        const prediction = getDynamicTrendFlipPrediction(userId);
        ch = prediction.choice;
        shouldSkip = prediction.shouldSkip;
        if (shouldSkip) skipReason = "(Dynamic Trend-Flip Strategy skip)";
      } else if (settings.strategy === "MANUS_V1") {
        const prediction = getManusV1Prediction(userId);
        ch = prediction.choice;
        shouldSkip = prediction.shouldSkip;
      } else if (settings.strategy === "MANUS_V2") {
        const prediction = getManusV2Prediction(userId);
        ch = prediction.choice;
        shouldSkip = prediction.shouldSkip;
      } else if (settings.strategy === "AI_STEAGEY") {
        const prediction = getAiSteageyPrediction(userId);
        ch = prediction.choice;
        shouldSkip = prediction.shouldSkip;
        if (shouldSkip) skipReason = "(Ai steagey)";
      } else if (settings.strategy === "XENN_STRAGEY") {
        const prediction = getFireStrageyPrediction(userId);
        ch = prediction.choice;
        shouldSkip = prediction.shouldSkip;
        if (shouldSkip) skipReason = "(Fire stragey)";
      } else if (settings.strategy === "R_PAT") {
        const prediction = getRPatPrediction(userId);
        ch = prediction.choice;
        shouldSkip = prediction.shouldSkip;
        if (shouldSkip) skipReason = prediction.skipReason || "(R-PAT scanning)";
      } else if (settings.strategy === "TREND_FOLLOW") {
        const prediction = getTrendFollowPrediction(userId);
        ch = prediction.choice;
        shouldSkip = prediction.shouldSkip;
        if (shouldSkip) skipReason = "(Trend Follow)";
      } else if (settings.strategy === "ALTERNATE") {
        const prediction = getAlternatePrediction(userId);
        ch = prediction.choice;
        shouldSkip = prediction.shouldSkip;
        if (shouldSkip) skipReason = "(Alternate)";
      } else if (settings.strategy === "BS_ORDER") {
        const prediction = getBsOrderPrediction(userId);
        ch = prediction.choice;
        shouldSkip = prediction.shouldSkip;
        if (shouldSkip) skipReason = "(BS Order)";
      } else {
        ch = 'B';
        logging.info(`Default bet: B`);
      }
      
      const selectType = getSelectMap(gameType, betType)[ch];

      if (selectType === undefined) {
        logging.error(`Invalid selectType: ${ch}`);
        settings.consecutive_errors++;
        await new Promise(resolve => setTimeout(resolve, 2000));
        continue;
      }
      
      logging.info(`Bet Choice: ${ch}, SelectType: ${selectType}`);
      
      if (entryLayer === 1) {
        if (!shouldSkip) {
          shouldSkip = userShouldSkipNext[userId] || false;
          if (shouldSkip) {
            skipReason = "(SL Layer Skip)";
          }
        }
      } else if (entryLayer === 2) {
        if (settings.entry_layer_state && settings.entry_layer_state.waiting_for_lose) {
          shouldSkip = true;
          skipReason = "(Entry Layer 2 - Wait for Lose)";
        } else {
          if (!shouldSkip) {
            shouldSkip = userShouldSkipNext[userId] || false;
            if (shouldSkip) skipReason = "(SL Layer Skip)";
          }
        }

        if (settings.entry_layer_state && settings.entry_layer_state.waiting_for_lose && shouldSkip) {
          settings.entry_layer_state.waiting_for_lose = false;
          logging.info(`Entry Layer 2: Got loss, now resuming normal betting for user ${userId}`);
        }
      } else if (entryLayer === 3) {
        if (settings.entry_layer_state && settings.entry_layer_state.waiting_for_loses) {
          shouldSkip = true;
          skipReason = `(Entry Layer 3 - Wait for ${settings.entry_layer_state.consecutive_loses || 0}/2 Loses)`;
        } else {
          if (!shouldSkip) {
            shouldSkip = userShouldSkipNext[userId] || false;
            if (shouldSkip) skipReason = "(SL Layer Skip)";
          }
        }
        if (settings.entry_layer_state && settings.entry_layer_state.waiting_for_lose && shouldSkip) {
          settings.entry_layer_state.waiting_for_lose = false;
          logging.info(`Entry Layer 3: Got 2 loss, now resuming normal betting for user ${userId}`);
        }
      }
      
      const betEmoji = getBetIndexEmoji(settings);
      const gameId = `${EMOJI.GAME} ${gameType} : ${currentIssue}`;
      
      if (shouldSkip) {
        let betChoiceText;
        if (betType === "COLOR") {
          betChoiceText = getColorName(ch);
        } else {
          betChoiceText = ch === 'B' ? `BIG` : `SMALL`;
        }
        
        if (!isSilent) {
          let betMsg = `${EMOJI.SKIP} SKIPPING\n\n${safeEscape(gameId)}\n${EMOJI.STRATEGY} Strategy: ${strategyText}`;
          await sendMessageWithRetry(ctx, betMsg);
        }
        
        if (!userSkippedBets[userId]) {
          userSkippedBets[userId] = {};
        }
        userSkippedBets[userId][currentIssue] = [ch, settings.virtual_mode];
        
        userSkipResultWait[userId] = currentIssue;
        
        let resultAvailable = false;
        let waitAttempts = 0;
        const maxWaitAttempts = 60;
        
        while (!resultAvailable && waitAttempts < maxWaitAttempts && settings.running) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          if (!userSkippedBets[userId] || !userSkippedBets[userId][currentIssue]) {
            resultAvailable = true;
          }
          waitAttempts++;
        }
        
        if (!resultAvailable) {
          if (userSkipResultWait[userId] === currentIssue) {
            delete userSkipResultWait[userId];
          }
        }
      } else {
        let desiredAmount;
        try {
          desiredAmount = calculateBetAmount(settings, currentBalance);
        } catch (error) {
          if (!isSilent) {
            await sendMessageWithRetry(ctx, `${EMOJI.ERROR} Error: ${error.message}`, makeMainKeyboard(true, userId === ADMIN_ID));
          }
          settings.running = false;
          break;
        }
        
        const { unitAmount, betCount, actualAmount } = computeBetDetails(desiredAmount);
        
        if (actualAmount === 0) {
          if (!isSilent) {
            await sendMessageWithRetry(ctx, `${EMOJI.ERROR} Invalid bet amount.`, makeMainKeyboard(true, userId === ADMIN_ID));
          }
          settings.running = false;
          break;
        }
        
        if (currentBalance < actualAmount) {
          if (!isSilent) {
            await sendMessageWithRetry(ctx, `${EMOJI.ERROR} Insufficient balance.`, makeMainKeyboard(true, userId === ADMIN_ID));
          }
          settings.running = false;
          break;
        }
        
        let betChoiceText;
        if (betType === "COLOR") {
          betChoiceText = getColorName(ch);
        } else {
          betChoiceText = ch === 'B' ? `BIG` : `SMALL`;
        }
        
        let patternInfo = "";
        if (settings.strategy === "BS_ORDER" && settings.pattern) {
          const currentIndex = settings.pattern_index !== undefined ? 
                              (settings.pattern_index === 0 ? settings.pattern.length - 1 : settings.pattern_index - 1) : 0;
          patternInfo = ` (Pattern Index: ${currentIndex})`;
        }
        
        if (!isSilent) {
          let betMsg = `${safeEscape(gameId)}\n${betEmoji} Order: ${safeEscape(betChoiceText)} → ${actualAmount} Ks\n${EMOJI.STRATEGY} Strategy: ${safeEscape(strategyText)}`;
          await sendMessageWithRetry(ctx, betMsg);
        }
        
        if (settings.virtual_mode) {
          if (!userPendingBets[userId]) {
            userPendingBets[userId] = {};
          }
          userPendingBets[userId][currentIssue] = [ch, actualAmount, true];
          userWaitingForResult[userId] = true;
        } else {
          const betResp = await placeBetRequest(session, currentIssue, selectType, unitAmount, betCount, gameType, parseInt(userId));
          
          if (betResp.error || betResp.code !== 0) {
            if (!isSilent) {
              await sendMessageWithRetry(ctx, `${EMOJI.ERROR} Bet error: ${betResp.msg || betResp.error}. Retrying...`);
            }
            await new Promise(resolve => setTimeout(resolve, 5000));
            continue;
          }
          
          if (!userPendingBets[userId]) {
            userPendingBets[userId] = {};
          }
          userPendingBets[userId][currentIssue] = [ch, actualAmount, false];
          userWaitingForResult[userId] = true;
        }
      }
      
      settings.last_issue = currentIssue;
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } catch (error) {
    logging.error(`Betting worker error: ${error.message}`);
    if (!isSilent) {
      await sendMessageWithRetry(ctx, `${EMOJI.ERROR} Error: ${error.message}. Stopping...`);
    }
    settings.running = false;
  } finally {
    settings.running = false;
    delete userWaitingForResult[userId];
    delete userShouldSkipNext[userId];
    delete userBalanceWarnings[userId];
    delete userSkipResultWait[userId];
    delete userSLSkipWaitingForWin[userId];
    
    if (settings.strategy === "CYBER_SNIPER") {
      delete settings.cyber_sniper_state;
    }
    if (settings.strategy === "COLOR_SNIPER") {
      delete settings.color_sniper_state;
    }
    if (settings.strategy === "TIME_WARP") {
      delete settings.time_warp_pos;
    }
    
    if (settings.strategy === "TREND_FOLLOW") {
      delete settings.trend_state;
      delete settings.color_trend_state;
    }
    
    if (settings.strategy === "ALTERNATE") {
      delete settings.alternate_state;
    }
    if (settings.strategy === "DYNAMIC_TREND_FLIP") {
      delete settings.dynamic_trend_flip_state;
    }
    
    if (settings.strategy === "BS_ORDER") {
      settings.pattern_index = 0;
    }
    
    let totalProfit = 0;
    let balanceText = "";
    
    if (settings.virtual_mode) {
      totalProfit = (userStats[userId]?.virtual_balance || 0) - (userStats[userId]?.initial_balance || 0);
      balanceText = `${EMOJI.VIRTUAL} Virtual Balance: ${(userStats[userId]?.virtual_balance || 0).toFixed(2)} Ks\n`;
    } else {
      totalProfit = userStats[userId]?.profit || 0;
      try {
        const finalBalance = await getBalance(session, parseInt(userId));
        balanceText = `${EMOJI.BALANCE} Final Balance: ${finalBalance?.toFixed(2) || '0.00'} Ks\n`;
      } catch (error) {
        balanceText = `${EMOJI.BALANCE} Final Balance: Unknown\n`;
      }
    }
    
    let profitIndicator = "";
    if (totalProfit > 0) profitIndicator = "+";
    else if (totalProfit < 0) profitIndicator = "-";
    
    delete userStats[userId];
    settings.martin_index = 0;
    settings.dalembert_units = 1;
    settings.custom_index = 0;
    
    if (!userStopInitiated[userId]) {
      if (userSilentMessages[userId] && userSilentMessages[userId].messageId && userSilentMessages[userId].chatId) {
        try {
          const isVirtual = settings.virtual_mode || false;
          let finalBalance = 0;
          if (isVirtual) {
            finalBalance = userStats[userId]?.virtual_balance || 0;
          } else {
            finalBalance = await getBalance(session, parseInt(userId)) || 0;
          }
          const startAmount = userStats[userId]?.initial_balance || finalBalance;
          
          const imagePath = await createLiveStatsImage(
            startAmount,
            totalProfit,
            finalBalance,
            isVirtual,
            settings.game_type || "TRX",
            settings.strategy || "TREND_FOLLOW",
            (settings.bet_sizes || []).join(', '),
            userId
          );
          
          await bot.telegram.editMessageMedia(
            userSilentMessages[userId].chatId,
            userSilentMessages[userId].messageId,
            null,
            {
              type: 'photo',
              media: { source: imagePath },
              caption: `${EMOJI.STOP} *SESSION TERMINATED*\n${balanceText}${EMOJI.PROFIT} Total Profit: ${profitIndicator}${totalProfit.toFixed(2)} Ks`,
              parse_mode: 'Markdown'
            }
          );
          fs.unlinkSync(imagePath);
        } catch (error) {
          logging.error(`Failed to update final live stats for user ${userId}: ${error.message}`);
        }
        delete userSilentMessages[userId];
      } else {
        const message = `${EMOJI.STOP} ${STYLE.BOLD('SESSION TERMINATED')}\n${balanceText}${EMOJI.PROFIT} Total Profit: ${profitIndicator}${totalProfit.toFixed(2)} Ks`;
        await sendMessageWithRetry(ctx, message, makeMainKeyboard(true, userId === ADMIN_ID));
      }
    }
    
    delete userStopInitiated[userId];
    delete userAllResults[userId];
  }
}

function makePlatformKeyboard() {
  return Markup.keyboard([
    [`${PLATFORMS["6LOTTERY"].color} ${PLATFORMS["6LOTTERY"].name}`]
  ]).resize().oneTime(false);
}

function makeMainKeyboard(loggedIn = false, isAdmin = false) {
  if (!loggedIn) {
    return Markup.keyboard([[`${EMOJI.LOGIN} Login`]]).resize().oneTime(false);
  }
  
  const silentStatus = (userId) => {
    return userSilentMessages[userId]?.enabled ? `${EMOJI.SILENT} Silent Mode (ON)` : `${EMOJI.SILENT} Silent Mode (OFF)`;
  };
  
  let keyboard = [
    [`${EMOJI.START} Activate`, `${EMOJI.STOP} Deactivate`],
    [`${EMOJI.SILENT} Silent Mode`, `${EMOJI.TIME} Time Range`],
    [`${EMOJI.BETWRAGER} Bet_Wrager`, `${EMOJI.GAME} Game Mode`],
    [`${EMOJI.TARGET} Game Type`, `${EMOJI.COLOR} Bet Type`, `${EMOJI.STRATEGY} Strategy`],
    [`${EMOJI.SETTINGS} Betting Settings`, `${EMOJI.RISK} Risk Management`],
    [`${EMOJI.INFO} Account Info`, `${EMOJI.LOGOUT} Re-Login`]
  ];
  
  if (isAdmin) {
    keyboard.push([`${EMOJI.ADMIN} Admin Panel`]);
  }
  
  console.log(`Creating keyboard for ${isAdmin ? 'admin' : 'regular'} user`);
  return Markup.keyboard(keyboard).resize().oneTime(false);
}

function makeRiskManagementSubmenu() {
  return Markup.keyboard([
    [`${EMOJI.TARGET} Profit Target`, `${EMOJI.STOP} Stop Loss`],
    [`${EMOJI.LAYER} Entry Layer`, `${EMOJI.WARNING} Bet SL`],
    [`${EMOJI.BACK} Back`]
  ]).resize().oneTime(false);
}

function makeAdminPanelKeyboard() {
  return Markup.keyboard([
    [`${EMOJI.ADD} Add User`, `${EMOJI.REMOVE} Remove User`],
    [`${EMOJI.STATS} User Stats`, `${EMOJI.MENU} Allowed IDs`],
    [`${EMOJI.ENABLE} Enable Free`, `${EMOJI.DISABLE} Disable Free`],
    [`${EMOJI.BROADCAST} Broadcast`, `${EMOJI.CHECK} Check Free Mode`],
    [`${EMOJI.MENU} Main Menu`]
  ]).resize().oneTime(false);
}

function makeSilentModeKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback(`${EMOJI.SILENT} Enable Silent Mode`, "silent:on")],
    [Markup.button.callback(`${EMOJI.SOUND} Disable Silent Mode`, "silent:off")],
    [Markup.button.callback(`${EMOJI.BACK} Back`, "silent:back")]
  ]);
}

function makeActivateSilentPromptKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback(`${EMOJI.SILENT} Enable Silent Mode`, "silent:on")],
    [Markup.button.callback(`${EMOJI.SOUND} Disable Silent Mode`, "silent:off")],
    [Markup.button.callback(`${EMOJI.CANCEL} Cancel Activation`, "silent:cancel")]
  ]);
}

function makeTimeRangeKeyboard() {
  return Markup.keyboard([
    [`${EMOJI.ADD} Add Time Range`, `${EMOJI.MENU} View Ranges`],
    [`${EMOJI.REMOVE} Remove Range`, `${EMOJI.FORECAST} Forecast Win`],
    [`${EMOJI.BACK} Back`]
  ]).resize().oneTime(false);
}

function makeTimeRangeInlineKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback(`${EMOJI.ADD} Add New Range`, "timerange:add")],
    [Markup.button.callback(`${EMOJI.MENU} View Ranges`, "timerange:view")],
    [Markup.button.callback(`${EMOJI.REMOVE} Remove Range`, "timerange:remove")],
    [Markup.button.callback(`${EMOJI.FORECAST} Toggle Forecast Win`, "timerange:toggle_forecast")]
  ]);
}

function makeRiskManagementKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback(`${EMOJI.TARGET} Profit Target`, "risk:profit_target")],
    [Markup.button.callback(`${EMOJI.STOP} Stop Loss`, "risk:stop_loss")],
    [Markup.button.callback(`${EMOJI.LAYER} Entry Layer`, "risk:entry_layer")],
    [Markup.button.callback(`${EMOJI.WARNING} Bet SL`, "risk:bet_sl")]
  ]);
}

function makeStrategyKeyboard(userId = null) {
  if (userId && userSettings[userId] && userSettings[userId].bet_type === "COLOR") {
    const keyboard = [
      [
        Markup.button.callback(`${EMOJI.TREND} TREND_FOLLOW`, "strategy:TREND_FOLLOW")
      ],
      [
        Markup.button.callback(`🎯 COLOR SNIPER`, "strategy:COLOR_SNIPER")
      ]
    ];
    return Markup.inlineKeyboard(keyboard);
  }

  const keyboard = [
    [
      Markup.button.callback(`${EMOJI.TREND} TREND_FOLLOW`, "strategy:TREND_FOLLOW"),
      Markup.button.callback(`${EMOJI.ALTERNATE} ALTERNATE`, "strategy:ALTERNATE")
    ],
    [
      Markup.button.callback(`${EMOJI.PATTERN} BS ORDER`, "strategy:BS_ORDER"),
      Markup.button.callback(`🤖 CYBER_SNIPER`, "strategy:CYBER_SNIPER")
    ],
    [
      Markup.button.callback(`🔮 QUANTUM_CALC`, "strategy:QUANTUM_CALC"),
      Markup.button.callback(`⏳ TIME_WARP`, "strategy:TIME_WARP")
    ],
    [
      Markup.button.callback(`🧮 RLDS Strategy`, "strategy:RLDS"),
      Markup.button.callback(`🔁 RLDS V2`, "strategy:RLDS_V2")
    ],
    [
      Markup.button.callback(`🔥 OP PATTERN`, "strategy:OP_PATTERN"),
      Markup.button.callback(`🎲 DIGIT MAP`, "strategy:CUSTOM_DIGIT")
    ],
    [
      Markup.button.callback(`✨ SHINE`, "strategy:SHINE"),
      Markup.button.callback(`🔗 ALINKAR`, "strategy:ALINKAR")
    ],
    [
      Markup.button.callback(`🪐 PLUTO`, "strategy:PLUTO"),
      Markup.button.callback(`💭 DREAM`, "strategy:DREAM")
    ],
    [
      Markup.button.callback(`🏄 DREAM V2`, "strategy:DREAM_V2"),
      Markup.button.callback(`🎯 SNIPER V1`, "strategy:SNIPER_V1")
    ],
    [
      Markup.button.callback(`🛡️ Dynamic Trend-Flip Strategy`, "strategy:DYNAMIC_TREND_FLIP"),
      Markup.button.callback(`🤖 Manus V1`, "strategy:MANUS_V1")
    ],
    [
      Markup.button.callback(`🧠 Manus V2`, "strategy:MANUS_V2")
    ],
    [
      Markup.button.callback(`📐 Chi-Square Anomaly Detection`, "strategy:CHI_SQUARE_ANOMALY_DETECTION")
    ],
    [
      Markup.button.callback(`✖️ Multiplication Matrix (Cross-Product Modulo)`, "strategy:MULTIPLICATION_MATRIX")
    ],
    [
      Markup.button.callback(`🤖 Ai steagey`, "strategy:AI_STEAGEY"),
      Markup.button.callback(`🧠 Fire stragey`, "strategy:XENN_STRAGEY"),
      Markup.button.callback(`🧩 R-PAT`, "strategy:R_PAT")
    ]
  ];
  
  return Markup.inlineKeyboard(keyboard);
}

function makeBetTypeKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback(`Big/Small`, "bet_type:BS")],
    [Markup.button.callback(`Color`, "bet_type:COLOR")]
  ]);
}

function makeBSWaitCountKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("1", "bs_wait_count:1"), Markup.button.callback("2", "bs_wait_count:2"), Markup.button.callback("3", "bs_wait_count:3")],
    [Markup.button.callback("4", "bs_wait_count:4"), Markup.button.callback("5", "bs_wait_count:5"), Markup.button.callback("6", "bs_wait_count:6")],
    [Markup.button.callback(`${EMOJI.CHECK} 0 (Disable)`, "bs_wait_count:0")]
  ]);
}

function makeBBWaitCountKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("1", "bb_wait_count:1"), Markup.button.callback("2", "bb_wait_count:2"), Markup.button.callback("3", "bb_wait_count:3")],
    [Markup.button.callback("4", "bb_wait_count:4"), Markup.button.callback("5", "bb_wait_count:5"), Markup.button.callback("6", "bb_wait_count:6")],
    [Markup.button.callback(`${EMOJI.CHECK} 0 (Disable)`, "bb_wait_count:0")]
  ]);
}

function makeBettingStrategyKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback(`${EMOJI.ANTI_MARTINGALE} Anti-Martingale`, "betting_strategy:Anti-Martingale")],
    [Markup.button.callback(`${EMOJI.MARTINGALE} Martingale`, "betting_strategy:Martingale")],
    [Markup.button.callback(`${EMOJI.DALEMBERT} D'Alembert`, "betting_strategy:D'Alembert")]
  ]);
}

function makeGameTypeKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback(`${EMOJI.GAME} WINGO`, "game_type:WINGO_SELECT")],
    [Markup.button.callback(`${EMOJI.GAME} TRX`, "game_type:TRX")]
  ]);
}

function makeWINGOSelectionKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback(`${EMOJI.GAME} WINGO 30s`, "game_type:WINGO_30S"),
     Markup.button.callback(`${EMOJI.GAME} WINGO 1min`, "game_type:WINGO")],
    [Markup.button.callback(`${EMOJI.GAME} WINGO 3min`, "game_type:WINGO_3MIN"),
     Markup.button.callback(`${EMOJI.GAME} WINGO 5min`, "game_type:WINGO_5MIN")]
  ]);
}

function makeEntryLayerKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("1 - Direct For BET", "entry_layer:1")],
    [Markup.button.callback("2 - Wait for 1 Lose", "entry_layer:2")],
    [Markup.button.callback("3 - Wait for 2 Loses", "entry_layer:3")]
  ]);
}

function makeSLLayerKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback(`${EMOJI.CHECK} 0 - Disabled`, "sl_layer:0")],
    [Markup.button.callback("1", "sl_layer:1"), Markup.button.callback("2", "sl_layer:2"), Markup.button.callback("3", "sl_layer:3")],
    [Markup.button.callback("4", "sl_layer:4"), Markup.button.callback("5", "sl_layer:5"), Markup.button.callback("6", "sl_layer:6")],
    [Markup.button.callback("7", "sl_layer:7"), Markup.button.callback("8", "sl_layer:8"), Markup.button.callback("9", "sl_layer:9")]
  ]);
}

function makeModeSelectionKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback(`${EMOJI.VIRTUAL} Virtual Mode`, "mode:virtual")],
    [Markup.button.callback(`${EMOJI.REAL} Real Mode`, "mode:real")]
  ]);
}

async function checkUserAuthorized(ctx) {
  const userId = ctx.from.id;
  if (!userSessions[userId]) {
    await sendMessageWithRetry(ctx, `${EMOJI.ERROR} Please login first`, makeMainKeyboard(false, userId === ADMIN_ID));
    return false;
  }
  if (!userSettings[userId]) {
    const platformKey = userPlatforms[userId] || "6LOTTERY";
    userSettings[userId] = {
      platform: platformKey,
      strategy: "TREND_FOLLOW",
      betting_strategy: "Martingale",
      game_type: "TRX",
      bet_type: "BS",
      martin_index: 0,
      dalembert_units: 1,
      pattern_index: 0,
      running: false,
      consecutive_losses: 0,
      current_layer: 0,
      skip_betting: false,
      sl_layer: null,
      original_martin_index: 0,
      original_dalembert_units: 1,
      original_custom_index: 0,
      custom_index: 0,
      layer_limit: 1,
      virtual_mode: false,
      bs_sb_wait_count: 0,
      bb_ss_wait_count: 0
    };
  }
  return true;
}

function escapeMarkdown(text) {
  if (typeof text !== 'string') return text;
  // Only escape characters that actually need escaping
  return text.replace(/([_*[\]()~`>#+\-=|{}.!])/g, '\\$1');
}

async function cmdStartHandler(ctx) {
  const userId = ctx.from.id;
  const userName = ctx.from.username || ctx.from.first_name || "User";
  const isAdmin = userId === ADMIN_ID;
  
  console.log(`[USER_ACTIVITY] User ${userName} (ID: ${userId}) sent /start message`);
  
  activeUsers.add(userId);
  
  if (!userSettings[userId]) {
    userSettings[userId] = {
      strategy: "TREND_FOLLOW",
      betting_strategy: "Martingale",
      game_type: "TRX",
      bet_type: "BS",
      martin_index: 0,
      dalembert_units: 1,
      pattern_index: 0,
      running: false,
      consecutive_losses: 0,
      current_layer: 0,
      skip_betting: false,
      sl_layer: null,
      original_martin_index: 0,
      original_dalembert_units: 1,
      original_custom_index: 0,
      custom_index: 0,
      layer_limit: 1,
      virtual_mode: false,
      bs_sb_wait_count: 0,
      bb_ss_wait_count: 0
    };
  }
  
  userLastResults[userId] = [];
  
  const loggedIn = !!userSessions[userId];
  
  let profilePhotoId = null;
  try {
    const photos = await ctx.telegram.getUserProfilePhotos(userId, 0, 1);
    if (photos.total_count > 0) {
      profilePhotoId = photos.photos[0][0].file_id;
    }
  } catch (e) {
    logging.warning("Could not fetch profile photo");
  }

  const safeUserName = escapeMarkdown(userName);
  const safeUserId = escapeMarkdown(userId.toString());
  const silentStatus = userSilentMessages[userId]?.enabled ? 'ON 🔇' : 'OFF 🔊';
  const timeRangeCount = userTimeRanges[userId]?.length || 0;
  
    const welcomeMessage =
    `RN TEAM ULTRA BOT ကိုအသုံးပြုချင်ပါက\n\n` +
    `<tg-emoji emoji-id="6213241428609345342">🔴</tg-emoji> ` +
    `https://www.6win999.com/#/register?invitationCode=74587792885\n\n` +
    `အဲ့ဒီလင့်ကနေ အကောင့်ဖွင့်ပြီး Admin ရှိကို ငွေသွင်းပြီး\n` +
    `သင့် ID နဲ့ အကောင့်ဖွင့်ထားတဲ့ပုံကို ပို့ပေးပါ။\n\n` +
    `Admin ဆက်သွယ်ရန်\n\n` +
    `@RNRISK <tg-emoji emoji-id="6300705383870633320">✅</tg-emoji>`;
  
  const premiumWelcomeMessage = convertToPremiumEmojis(welcomeMessage);

  if (profilePhotoId) {
    await ctx.replyWithPhoto(profilePhotoId, {
      caption: premiumWelcomeMessage,
      parse_mode: 'HTML',
      reply_markup: makeMainKeyboard(loggedIn, isAdmin).reply_markup
    });
  } else {
    await ctx.reply(premiumWelcomeMessage, {
      parse_mode: 'HTML',
      reply_markup: makeMainKeyboard(loggedIn, isAdmin).reply_markup
    });
  }
}

async function cmdAllowHandler(ctx) {
  const userId = ctx.from.id;
  if (userId !== ADMIN_ID) {
    await sendMessageWithRetry(ctx, `${EMOJI.ERROR} Admin only!`, makeMainKeyboard(true, userId === ADMIN_ID));
    return;
  }
  
  const args = ctx.message.text.split(' ').slice(1);
  if (!args.length || !args[0].match(/^\d+$/)) {
    await sendMessageWithRetry(ctx, `${EMOJI.INFO} Usage: /allow {6lottery_id}`, makeAdminPanelKeyboard());
    return;
  }
  
  const sixlotteryId = parseInt(args[0]);
  if (allowedsixlotteryIds.has(sixlotteryId)) {
    await sendMessageWithRetry(ctx, `${EMOJI.INFO} User ${sixlotteryId} already added`, makeAdminPanelKeyboard());
  } else {
    allowedsixlotteryIds.add(sixlotteryId);
    saveAllowedUsers();
    await sendMessageWithRetry(ctx, `${EMOJI.SUCCESS} User ${sixlotteryId} added`, makeAdminPanelKeyboard());
  }
}

async function cmdRemoveHandler(ctx) {
  const userId = ctx.from.id;
  if (userId !== ADMIN_ID) {
    await sendMessageWithRetry(ctx, `${EMOJI.ERROR} Admin only!`, makeMainKeyboard(true, userId === ADMIN_ID));
    return;
  }
  
  const args = ctx.message.text.split(' ').slice(1);
  if (!args.length || !args[0].match(/^\d+$/)) {
    await sendMessageWithRetry(ctx, `${EMOJI.INFO} Usage: /remove {6lottery_id}`, makeAdminPanelKeyboard());
    return;
  }
  
  const sixlotteryId = parseInt(args[0]);
  if (!allowedsixlotteryIds.has(sixlotteryId)) {
    await sendMessageWithRetry(ctx, `${EMOJI.INFO} User ${sixlotteryId} not found`, makeAdminPanelKeyboard());
  } else {
    allowedsixlotteryIds.delete(sixlotteryId);
    saveAllowedUsers();
    await sendMessageWithRetry(ctx, `${EMOJI.SUCCESS} User ${sixlotteryId} removed`, makeAdminPanelKeyboard());
  }
}

async function cmdShowIdHandler(ctx) {
  const userId = ctx.from.id;
  if (userId !== ADMIN_ID) {
    await sendMessageWithRetry(ctx, `${EMOJI.ERROR} Admin only!`);
    return;
  }
  
  try {
    let allowedIds = [];
    if (fs.existsSync('users_6lottery.json')) {
      const data = JSON.parse(fs.readFileSync('users_6lottery.json', 'utf8'));
      allowedIds = data.allowed_ids || [];
    } else {
      allowedIds = Array.from(allowedsixlotteryIds);
    }
    
    if (allowedIds.length === 0) {
      await sendMessageWithRetry(ctx, `${EMOJI.INFO} No allowed IDs found.`);
      return;
    }
  
  let message = `${EMOJI.MENU} ${STYLE.BOLD('List of Allowed IDs')}:\n\n`;
    allowedIds.forEach((id, index) => {
      message += `${index + 1}. ${STYLE.CODE(id.toString())}\n`;
    });
    
    message += `\n${EMOJI.INFO} Total: ${allowedIds.length} allowed users`;
    
    await sendMessageWithRetry(ctx, message);
  } catch (error) {
    logging.error(`Error showing allowed IDs: ${error.message}`);
    await sendMessageWithRetry(ctx, `${EMOJI.ERROR} Error retrieving allowed IDs.`);
  }
}

async function cmdUsersHandler(ctx) {
  const userId = ctx.from.id;
  if (userId !== ADMIN_ID) {
    await sendMessageWithRetry(ctx, `${EMOJI.ERROR} Admin only!`);
    return;
  }
  
  try {
    const telegramUserIds = Array.from(activeUsers);
    
    if (telegramUserIds.length === 0) {
      await sendMessageWithRetry(ctx, `${EMOJI.INFO} No active users found.`);
      return;
    }
    
    let message = `${EMOJI.MENU} ${STYLE.BOLD('List of Active Users')}:\n\n`;
    
    for (const telegramId of telegramUserIds) {
      const userInfo = userGameInfo[telegramId];
      const userName = userInfo?.nickname || userInfo?.username || "Unknown";
      const gameUserId = userInfo?.user_id || "Not logged in";
      const balance = userInfo?.balance || 0;
      const isRunning = userSettings[telegramId]?.running || false;
      const isSilent = userSilentMessages[telegramId]?.enabled || false;
      
      message += `${EMOJI.USER} ${userName}\n`;
      message += `${STYLE.ITEM(`Telegram ID: ${STYLE.CODE(telegramId.toString())}`)}\n`;
      message += `${STYLE.ITEM(`Game ID: ${gameUserId}`)}\n`;
      message += `${STYLE.ITEM(`Balance: ${balance.toFixed(2)} Ks`)}\n`;
      message += `${STYLE.ITEM(`Silent: ${isSilent ? 'ON 🔇' : 'OFF 🔊'}`)}\n`;
      message += `${STYLE.LAST_ITEM(`Status: ${isRunning ? '🟢 Running' : '🔴 Stopped'}`)}\n\n`;
    }
    
    message += `\n${EMOJI.INFO} Total: ${telegramUserIds.length} active users`;
    
    await sendMessageWithRetry(ctx, message);
  } catch (error) {
    logging.error(`Error showing users: ${error.message}`);
    await sendMessageWithRetry(ctx, `${EMOJI.ERROR} Error retrieving user list.`);
  }
}

async function cmdSendHandler(ctx) {
  await sendMessageWithRetry(ctx, `${EMOJI.INFO} Please use Broadcast button in Admin Panel.`, makeMainKeyboard(true, ctx.from.id === ADMIN_ID));
}

async function cmdEnableFreeMode(ctx) {
  const userId = ctx.from.id;
  freeModeEnabled = true;
  saveFreeModeSetting();
  
  await sendMessageWithRetry(ctx,
    `${EMOJI.ENABLE} ${STYLE.BOLD('Free Mode ENABLED')}`,
    makeAdminPanelKeyboard()
  );
  
  const telegramUserIds = Array.from(activeUsers);
  if (telegramUserIds.length > 0) {
    const notificationMessage = `${EMOJI.SUCCESS} ${STYLE.BOLD('NOTICE')}\n\n${EMOJI.INFO} Free Mode has been ENABLED by admin.\n${EMOJI.INFO} All users can now use the bot without restrictions.`;
    
    for (const telegramId of telegramUserIds) {
      try {
        await ctx.telegram.sendMessage(telegramId, convertToPremiumEmojis(notificationMessage), { parse_mode: 'HTML' });
      } catch (error) {
        logging.error(`Failed to notify user ${telegramId} about free mode change: ${error.message}`);
      }
    }
  }
  
  logging.info(`Admin ${userId} enabled Free Mode`);
}

async function cmdDisableFreeMode(ctx) {
  const userId = ctx.from.id;
  freeModeEnabled = false;
  saveFreeModeSetting();
  
  await sendMessageWithRetry(ctx,
    `${EMOJI.DISABLE} ${STYLE.BOLD('Free Mode DISABLED')}`,
    makeAdminPanelKeyboard()
  );
  
  const telegramUserIds = Array.from(activeUsers);
  if (telegramUserIds.length > 0) {
    const notificationMessage = `${EMOJI.WARNING} ${STYLE.BOLD('NOTICE')}\n\n${EMOJI.INFO} Free Mode has been DISABLED by admin.\n${EMOJI.INFO} Only authorized users can continue using the bot.`;
    
    for (const telegramId of telegramUserIds) {
      try {
        await ctx.telegram.sendMessage(telegramId, convertToPremiumEmojis(notificationMessage), { parse_mode: 'HTML' });
      } catch (error) {
        logging.error(`Failed to notify user ${telegramId} about free mode change: ${error.message}`);
      }
    }
  }
  
  logging.info(`Admin ${userId} disabled Free Mode`);
}

async function cmdCheckFreeMode(ctx) {
  const userId = ctx.from.id;
  const status = freeModeEnabled ? "ENABLED ✅" : "DISABLED ❌";
  const description = freeModeEnabled 
    ? `${STYLE.ITEM(`ALL users can login`)}\n${STYLE.LAST_ITEM(`No ID checking`)}`
    : `${STYLE.ITEM(`Only authorized users can login`)}\n${STYLE.LAST_ITEM(`ID checking is required`)}`;
  
  await sendMessageWithRetry(ctx,
    `${EMOJI.INFO} ${STYLE.BOLD('Free Mode Status:')} ${status}\n\n${description}`,
    makeAdminPanelKeyboard()
  );
}

async function callbackQueryHandler(ctx) {
  await ctx.answerCbQuery();
  const userId = ctx.from.id;
  const data = ctx.callbackQuery.data;
  
  console.log(`[CALLBACK] User: ${userId}, Data: ${data}`);
  
  // ==================== RESTART BOT ====================
  if (data.startsWith("restart_bot:")) {
    const userIdFromCallback = parseInt(data.split(":")[1]);
    
    if (userIdFromCallback !== userId) {
      await ctx.reply(convertToPremiumEmojis(`${EMOJI.ERROR} Unauthorized action`), { parse_mode: 'HTML' });
      return;
    }
    
    await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } });
    
    const settings = userSettings[userId] || {};
    
    if (!settings.bet_sizes) {
      await ctx.reply(convertToPremiumEmojis(`${EMOJI.ERROR} Please set Bet_Wrager first!`), { parse_mode: 'HTML' });
      return;
    }
    
    if (settings.running) {
      await ctx.reply(convertToPremiumEmojis(`${EMOJI.INFO} Bot is already running!`), { parse_mode: 'HTML' });
      return;
    }
    
    settings.running = true;
    settings.consecutive_errors = 0;
    saveUserSettings();
    
    const entryLayer = settings.layer_limit || 1;
    
    if (entryLayer === 2) {
      settings.entry_layer_state = { waiting_for_lose: true };
    } else if (entryLayer === 3) {
      settings.entry_layer_state = { waiting_for_loses: true, consecutive_loses: 0 };
    }
    
    if (settings.strategy === "TREND_FOLLOW") {
      const betType = settings.bet_type || "BS";
      if (betType === "COLOR") {
        settings.color_trend_state = { last_result: null };
      } else {
        settings.trend_state = { last_result: null, skip_mode: false };
      }
    }
    
    if (settings.strategy === "ALTERNATE") {
      settings.alternate_state = { last_result: null, skip_mode: false };
    }
    
    if (settings.strategy === "CYBER_SNIPER") {
      settings.cyber_sniper_state = {
        active: false,
        direction: null,
        sequence: [],
        step: 0,
        hit_count: 0,
        got_same_result: false
      };
    }
    if (settings.strategy === "COLOR_SNIPER") {
      settings.color_sniper_state = {
        active: false,
        step: 0,
        hit_count: 0,
        waiting_for_trigger: true
      };
    }
    if (settings.strategy === "TIME_WARP" && !settings.time_warp_pos) {
      settings.time_warp_pos = 8;
    }
    
    if (["CYBER_SNIPER", "COLOR_SNIPER"].includes(settings.strategy)) {
      settings.sniper_hit_count = 0;
      settings.sniper_loss_count = 0;
      logging.info(`Reset sniper counters for ${settings.strategy} on restart`);
    }
    
    delete userSkippedBets[userId];
    userShouldSkipNext[userId] = false;
    delete userSLSkipWaitingForWin[userId];
    userWaitingForResult[userId] = false;
    
    await ctx.reply(convertToPremiumEmojis(`${EMOJI.START} Bot restarted successfully!`), { parse_mode: 'HTML' });
    bettingWorker(userId, ctx, ctx.telegram);
    return;
  }
  
  // ==================== SILENT MODE ====================
  if (data.startsWith("silent:")) {
    const action = data.split(":")[1];
    
    if (action === "on") {
      if (!userSilentMessages[userId]) {
        userSilentMessages[userId] = { enabled: false };
      }
      userSilentMessages[userId].enabled = true;
      await sendMessageWithRetry(ctx, `${EMOJI.SILENT} ${STYLE.BOLD('Silent Mode ENABLED')}\n\n${EMOJI.INFO} Bet and result messages will be hidden. Live stats will be shown instead.`, makeMainKeyboard(true, userId === ADMIN_ID));
      await safeDeleteMessage(ctx);
      
      // Silent Mode ဖွင့်ပြီးရင် Activate ချက်ချင်းလုပ်မလား မေးမယ်
      const settings = userSettings[userId] || {};
      if (settings.bet_sizes && !settings.running) {
        const activateKeyboard = Markup.inlineKeyboard([
          [Markup.button.callback(`${EMOJI.START} Activate Now`, `silent:activate_after_on`)],
          [Markup.button.callback(`${EMOJI.MENU} Main Menu`, `silent:back`)]
        ]);
        await ctx.reply(`${EMOJI.START} Silent Mode enabled. Do you want to activate the bot now?`, activateKeyboard);
      }
    } else if (action === "off") {
      if (userSilentMessages[userId]) {
        userSilentMessages[userId].enabled = false;
        if (userSilentMessages[userId].messageId && userSilentMessages[userId].chatId) {
          try {
            await ctx.telegram.deleteMessage(userSilentMessages[userId].chatId, userSilentMessages[userId].messageId);
          } catch (error) {}
        }
      }
      await sendMessageWithRetry(ctx, `${EMOJI.SOUND} ${STYLE.BOLD('Silent Mode DISABLED')}\n\n${EMOJI.INFO} Bet and result messages will be shown normally.`, makeMainKeyboard(true, userId === ADMIN_ID));
      await safeDeleteMessage(ctx);
      
      // Silent Mode ပိတ်ပြီးရင် Activate ချက်ချင်းလုပ်မလား မေးမယ်
      const settings = userSettings[userId] || {};
      if (settings.bet_sizes && !settings.running) {
        const activateKeyboard = Markup.inlineKeyboard([
          [Markup.button.callback(`${EMOJI.START} Activate Now`, `silent:activate_after_off`)],
          [Markup.button.callback(`${EMOJI.MENU} Main Menu`, `silent:back`)]
        ]);
        await ctx.reply(`${EMOJI.SOUND} Silent Mode disabled. Do you want to activate the bot now?`, activateKeyboard);
      }
    } else if (action === "activate_after_on" || action === "activate_after_off") {
      // Activate Now ကို နှိပ်လိုက်ရင်
      await safeDeleteMessage(ctx);
      
      // Activate လုပ်မယ်
      const settings = userSettings[userId] || {};
      
      if (!settings.bet_sizes) {
        await ctx.reply(`${EMOJI.ERROR} Please set Bet_Wrager first!`, makeMainKeyboard(true, userId === ADMIN_ID));
        return;
      }
      
      if (settings.running) {
        await ctx.reply(`${EMOJI.INFO} Bot is already running!`, makeMainKeyboard(true, userId === ADMIN_ID));
        return;
      }
      
      settings.running = true;
      settings.consecutive_errors = 0;
      saveUserSettings();
      
      // Betting Worker ကို စတင်မယ်
      bettingWorker(userId, ctx, ctx.telegram);
    } else if (action === "back") {
      await sendMessageWithRetry(ctx, `${EMOJI.BACK} Returning to main menu...`, makeMainKeyboard(true, userId === ADMIN_ID));
      await safeDeleteMessage(ctx);
    } else if (action === "cancel") {
      await sendMessageWithRetry(ctx, `${EMOJI.INFO} Activation cancelled. Please configure Silent Mode first.`, makeMainKeyboard(true, userId === ADMIN_ID));
      await safeDeleteMessage(ctx);
    }
    
    saveUserSettings();
    return;
  }
  
  // ==================== TIME RANGE ====================
  if (data.startsWith("timerange:")) {
    const parts = data.split(":");
    const action = parts[1];
    
    console.log(`[TIMERANGE] User: ${userId}, Action: ${action}, Full data: ${data}`);
    
    // === REMOVE INDEX HANDLER - ပထမဆုံးထားပါ ===
    if (action === "remove_index" && parts.length >= 3) {
  try {
    const index = parseInt(parts[2]);
    console.log(`[TIMERANGE] Removing index ${index} for user ${userId}`);
    
    if (userTimeRanges[userId] && userTimeRanges[userId][index]) {
      const removedRange = userTimeRanges[userId][index];
      let displayStart = removedRange.displayStart || convert24to12(removedRange.start);
      let displayEnd = removedRange.displayEnd || convert24to12(removedRange.end);
      
      userTimeRanges[userId].splice(index, 1);
      
      if (userTimeRanges[userId].length === 0) {
        delete userTimeRanges[userId];
        delete userActiveTimeRange[userId];
      }
      
      saveUserSettings();
      
      try {
        await ctx.editMessageText(`✅ *Time Range Removed!*\n\nRemoved: ${displayStart} → ${displayEnd}`, {
          parse_mode: 'Markdown'
        });
      } catch (editError) {
        console.log(`[TIMERANGE] Edit error: ${editError.message}`);
        await ctx.reply(`✅ *Time Range Removed!*\n\nRemoved: ${displayStart} → ${displayEnd}`, {
          parse_mode: 'Markdown'
        });
      }
      
      await sendMessageWithRetry(ctx, `${EMOJI.TIME} Time range settings:`, makeTimeRangeKeyboard());
    } else {
      try {
        await ctx.editMessageText(`❌ *Error:* Time range not found!`, {
          parse_mode: 'Markdown'
        });
      } catch (editError) {
        await ctx.reply(`❌ *Error:* Time range not found!`, {
          parse_mode: 'Markdown'
        });
      }
      await sendMessageWithRetry(ctx, `${EMOJI.TIME} Time range settings:`, makeTimeRangeKeyboard());
    }
  } catch (error) {
    logging.error(`Error removing time range: ${error.message}`);
    await ctx.reply(convertToPremiumEmojis(`${EMOJI.ERROR} Failed to remove time range.`), { parse_mode: 'HTML' });
  }
  return;
}
    
    // === ADD TIME RANGE ===
    if (action === "add") {
      userState[userId] = { state: "INPUT_TIME_RANGE_START" };
      await sendMessageWithRetry(ctx, 
        `${EMOJI.TIME} *Add Time Range - Step 1/2*\n\n` +
        `${EMOJI.INFO} Enter start time (HH:MM) in 24-hour format:\n\n` +
        `${STYLE.CODE('Example: 9:00 AM')}`
      );
      await safeDeleteMessage(ctx);
      return;
    }
    
    // === VIEW TIME RANGES ===
    if (action === "view") {
      if (!userTimeRanges[userId] || userTimeRanges[userId].length === 0) {
        await sendMessageWithRetry(ctx, `${EMOJI.INFO} No time ranges configured.`, makeTimeRangeKeyboard());
      } else {
        let message = `${EMOJI.TIME} *Your Time Ranges:*\n\n`;
        userTimeRanges[userId].forEach((range, index) => {
          message += `${index + 1}. ${range.start} → ${range.end}\n`;
        });
        message += `\n${EMOJI.FORECAST} Forecast Win: ${userTimeRangeForecastWin[userId] ? 'ON' : 'OFF'}`;
        message += `\n${EMOJI.INFO} Current status: ${checkTimeRange(userId).shouldRun ? 'Active' : 'Inactive'}`;
        await sendMessageWithRetry(ctx, message, makeTimeRangeKeyboard());
      }
      await safeDeleteMessage(ctx);
      return;
    }
    
    // === REMOVE MENU ===
    if (action === "remove") {
      if (!userTimeRanges[userId] || userTimeRanges[userId].length === 0) {
        await sendMessageWithRetry(ctx, `${EMOJI.INFO} No time ranges to remove.`, makeTimeRangeKeyboard());
        await safeDeleteMessage(ctx);
      } else {
        let message = `${EMOJI.REMOVE} *Select range to remove:*\n\n`;
        const keyboard = [];
        userTimeRanges[userId].forEach((range, index) => {
          message += `${index + 1}. ${range.start} → ${range.end}\n`;
          keyboard.push([Markup.button.callback(`❌ Remove #${index + 1}`, `timerange:remove_index:${index}`)]);
        });
        keyboard.push([Markup.button.callback(`${EMOJI.BACK} Back`, `timerange:back`)]);
        
        await ctx.reply(message, {
          parse_mode: 'Markdown',
          reply_markup: Markup.inlineKeyboard(keyboard).reply_markup
        });
        
        if (ctx.callbackQuery?.message) {
          try {
            await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
          } catch (error) {}
        }
      }
      return;
    }
    
    // === TOGGLE FORECAST WIN ===
    if (action === "toggle_forecast") {
      userTimeRangeForecastWin[userId] = !userTimeRangeForecastWin[userId];
      saveUserSettings();
      await sendMessageWithRetry(ctx, 
        `${EMOJI.SUCCESS} Forecast Win: ${userTimeRangeForecastWin[userId] ? 'ON' : 'OFF'}`,
        makeTimeRangeKeyboard()
      );
      await safeDeleteMessage(ctx);
      return;
    }
    
    // === BACK BUTTON ===
    if (action === "back") {
      await sendMessageWithRetry(ctx, 
        `${EMOJI.BACK} Returning to main menu...`,
        makeMainKeyboard(true, userId === ADMIN_ID)
      );
      await safeDeleteMessage(ctx);
      return;
    }
    
    return;
  }
  
  // ==================== CHECK USER AUTHORIZED ====================
  if (!await checkUserAuthorized(ctx)) {
    return;
  }
  
  // ==================== RISK MANAGEMENT ====================
  if (data.startsWith("risk:")) {
    const riskOption = data.split(":")[1];
    
    switch (riskOption) {
      case "profit_target":
        userState[userId] = { state: "INPUT_PROFIT_TARGET" };
        await sendMessageWithRetry(ctx, 
          `${EMOJI.TARGET} ${STYLE.BOLD('Profit Target Settings')}\n\n` +
          `${EMOJI.INFO} Please enter your desired profit target amount (in Ks):\n\n` +
          `${STYLE.CODE('Example: 10000')}`
        );
        break;
      case "stop_loss":
        userState[userId] = { state: "INPUT_STOP_LIMIT" };
        await sendMessageWithRetry(ctx, 
          `${EMOJI.STOP} ${STYLE.BOLD('Stop Loss Settings')}\n\n` +
          `${EMOJI.INFO} Please enter your stop loss limit amount (in Ks):\n\n` +
          `${STYLE.CODE('Example: 5000')}`
        );
        break;
      case "entry_layer":
        await sendMessageWithRetry(ctx, 
          `${EMOJI.LAYER} ${STYLE.BOLD('Entry Layer Settings')}\n\n` +
          `${EMOJI.INFO} Select when to start betting:`,
          makeEntryLayerKeyboard()
        );
        break;
      case "bet_sl":
        await sendMessageWithRetry(ctx, 
          `${EMOJI.WARNING} ${STYLE.BOLD('Stop Loss Layer Settings')}\n\n` +
          `${EMOJI.INFO} Select how many consecutive losses before skipping bets:`,
          makeSLLayerKeyboard()
        );
        break;
      default:
        await sendMessageWithRetry(ctx, `${EMOJI.ERROR} Invalid option`);
    }
    await safeDeleteMessage(ctx);
    return;
  }
  
  if (data.startsWith("risk:")) {
    const riskOption = data.split(":")[1];
    
    switch (riskOption) {
      case "profit_target":
        userState[userId] = { state: "INPUT_PROFIT_TARGET" };
        await sendMessageWithRetry(ctx, `${EMOJI.TARGET} ${STYLE.BOLD('Profit Target Settings')}\n\n${EMOJI.INFO} Please enter your desired profit target amount (in Ks):\n\n${STYLE.CODE('Example: 10000')}`);
        break;
      case "stop_loss":
        userState[userId] = { state: "INPUT_STOP_LIMIT" };
        await sendMessageWithRetry(ctx, `${EMOJI.STOP} ${STYLE.BOLD('Stop Loss Settings')}\n\n${EMOJI.INFO} Please enter your stop loss limit amount (in Ks):\n\n${STYLE.CODE('Example: 5000')}`);
        break;
      case "entry_layer":
        await sendMessageWithRetry(ctx, `${EMOJI.LAYER} ${STYLE.BOLD('Entry Layer Settings')}\n\n${EMOJI.INFO} Select when to start betting:`, makeEntryLayerKeyboard());
        break;
      case "bet_sl":
        await sendMessageWithRetry(ctx, `${EMOJI.WARNING} ${STYLE.BOLD('Stop Loss Layer Settings')}\n\n${EMOJI.INFO} Select how many consecutive losses before skipping bets:`, makeSLLayerKeyboard());
        break;
      default:
        await sendMessageWithRetry(ctx, `${EMOJI.ERROR} Invalid option`);
    }
    await safeDeleteMessage(ctx);
    return;
  }
  
  if (data.startsWith("strategy:")) {
    const strategy = data.split(":")[1];
    userSettings[userId].strategy = strategy;
    
    if (strategy === "BS_ORDER") {
      userState[userId] = { state: "INPUT_BS_PATTERN" };
      await sendMessageWithRetry(ctx, `${EMOJI.PATTERN} ${STYLE.BOLD('BS Pattern Settings')}\n\n${EMOJI.INFO} Please enter your BS pattern (B and S only):\n\n${STYLE.CODE('Example: BSBSSBBS')}`);
    } else if (strategy === "TREND_FOLLOW") {
      const betType = userSettings[userId].bet_type || "BS";
      if (betType === "COLOR") {
        await sendMessageWithRetry(ctx, `${EMOJI.SUCCESS} ${STYLE.BOLD('Strategy: Trend Follow (Color Mode)')}`, makeMainKeyboard(true, userId === ADMIN_ID));
      } else {
        await sendMessageWithRetry(ctx, `${EMOJI.TREND} ${STYLE.BOLD('Trend Follow Settings')}\n\n${EMOJI.INFO} Select BS/SB Wait Count:`, makeBSWaitCountKeyboard());
      }
    } else if (strategy === "ALTERNATE") {
      await sendMessageWithRetry(ctx, `${EMOJI.ALTERNATE} ${STYLE.BOLD('Alternate Settings')}\n\n${EMOJI.INFO} Select BB/SS Wait Count:`, makeBBWaitCountKeyboard());
    } else if (strategy === "CYBER_SNIPER") {
      await sendMessageWithRetry(ctx, `🤖 ${STYLE.BOLD('CYBER_SNIPER Activated')}\n\n${EMOJI.INFO} • Session terminates after ${SNIPER_MAX_HITS} hits`, makeMainKeyboard(true, userId === ADMIN_ID));
    } else if (strategy === "COLOR_SNIPER") {
      await sendMessageWithRetry(ctx, `🎯 ${STYLE.BOLD('COLOR_SNIPER Activated')}\n\n${EMOJI.INFO} • Session terminates after ${SNIPER_MAX_HITS} hits`, makeMainKeyboard(true, userId === ADMIN_ID));
    } else if (strategy === "RLDS_V2") {
      await sendMessageWithRetry(ctx, `🔁 ${STYLE.BOLD('RLDS V2 Activated')}` +
        `\n\n${EMOJI.INFO} Uses exactly 2 history items and reverses the original BIG/SMALL signal.`,
        makeMainKeyboard(true, userId === ADMIN_ID));
    } else if (strategy === "RLDS") {
      await sendMessageWithRetry(ctx, `🧮 ${STYLE.BOLD('RLDS Strategy Activated')}` +
        `\n\n${EMOJI.INFO} Uses exactly 2 history items: latest issue and previous result.`,
        makeMainKeyboard(true, userId === ADMIN_ID));
    } else if (strategy === "QUANTUM_CALC") {
      await sendMessageWithRetry(ctx, `🔮 ${STYLE.BOLD('QUANTUM_CALC Activated')}`, makeMainKeyboard(true, userId === ADMIN_ID));
    } else if (strategy === "TIME_WARP") {
      await sendMessageWithRetry(ctx, `⏳ ${STYLE.BOLD('TIME_WARP Activated')}`, makeMainKeyboard(true, userId === ADMIN_ID));
    } else if (strategy === "OP_PATTERN") {
      await sendMessageWithRetry(ctx, `🔥 ${STYLE.BOLD('OP PATTERN Activated')}`, makeMainKeyboard(true, userId === ADMIN_ID));
    } else if (strategy === "CUSTOM_DIGIT") {
      await sendMessageWithRetry(ctx, `🎲 ${STYLE.BOLD('CUSTOM DIGIT Activated')}`, makeMainKeyboard(true, userId === ADMIN_ID));
    } else if (strategy === "SHINE") {
      await sendMessageWithRetry(ctx, `✨ ${STYLE.BOLD('SHINE Activated')}`, makeMainKeyboard(true, userId === ADMIN_ID));
    } else if (strategy === "ALINKAR") {
      await sendMessageWithRetry(ctx, `🔗 ${STYLE.BOLD('ALINKAR Activated')}`, makeMainKeyboard(true, userId === ADMIN_ID));
    } else if (strategy === "PLUTO") {
      await sendMessageWithRetry(ctx, `🪐 ${STYLE.BOLD('PLUTO Activated')}`, makeMainKeyboard(true, userId === ADMIN_ID));
    } else if (strategy === "DREAM") {
      await sendMessageWithRetry(ctx, `💭 ${STYLE.BOLD('DREAM Activated')}`, makeMainKeyboard(true, userId === ADMIN_ID));
    } else if (strategy === "DREAM_V2") {
      await sendMessageWithRetry(ctx, `🏄 ${STYLE.BOLD('DREAM V2 Activated')}`, makeMainKeyboard(true, userId === ADMIN_ID));
    } else if (strategy === "SNIPER_V1") {
      await sendMessageWithRetry(ctx, `${EMOJI.SUCCESS} ${STYLE.BOLD('🎯 SNIPER V1 Activated')}`, makeMainKeyboard(true, userId === ADMIN_ID));
    } else if (["CHI_SQUARE_ANOMALY_DETECTION", "MULTIPLICATION_MATRIX"].includes(strategy)) {
      const strategyLabel = strategy === "CHI_SQUARE_ANOMALY_DETECTION"
        ? "Chi-Square Anomaly Detection"
        : "Multiplication Matrix (Cross-Product Modulo)";
      await sendMessageWithRetry(ctx, `${EMOJI.SUCCESS} ${STYLE.BOLD(`${strategyLabel} Activated`)}`,
        makeMainKeyboard(true, userId === ADMIN_ID));
    } else if (["DYNAMIC_TREND_FLIP", "MANUS_V1", "MANUS_V2"].includes(strategy)) {
      const strategyLabel = strategy === "DYNAMIC_TREND_FLIP"
        ? "Dynamic Trend-Flip Strategy"
        : strategy;
      await sendMessageWithRetry(ctx, `${EMOJI.SUCCESS} ${STYLE.BOLD(`${strategyLabel} Activated`)}`, makeMainKeyboard(true, userId === ADMIN_ID));
    } else if (["AI_STEAGEY", "XENN_STRAGEY"].includes(strategy)) {
      const strategyLabel = strategy === "AI_STEAGEY" ? "Ai steagey" : "Fire stragey";
      await sendMessageWithRetry(ctx, `${EMOJI.SUCCESS} ${STYLE.BOLD(`${strategyLabel} Activated`)}`, makeMainKeyboard(true, userId === ADMIN_ID));
    } else if (strategy === "R_PAT") {
      userSettings[userId].rpat_state = {
        total_bets: 0,
        wins: 0,
        losses: 0,
        max_streak: 0,
        current_loss_streak: 0
      };
      await sendMessageWithRetry(ctx, `${EMOJI.SUCCESS} ${STYLE.BOLD('R-PAT Activated')}

${EMOJI.INFO} Uses up to 500 recent patterns with 4-sequence and 3-sequence fallback.`, makeMainKeyboard(true, userId === ADMIN_ID));
    } else {
      await sendMessageWithRetry(ctx, `${EMOJI.SUCCESS} ${STYLE.BOLD('Strategy set')}`, makeMainKeyboard(true, userId === ADMIN_ID));
    }
    
    saveUserSettings();
    await safeDeleteMessage(ctx);
    return;
  }
  
  if (data.startsWith("bet_type:")) {
    const betType = data.split(":")[1];
    userSettings[userId].bet_type = betType;
    
    if (betType === "COLOR") {
      await sendMessageWithRetry(ctx,
        `${EMOJI.SUCCESS} ${STYLE.BOLD('Bet Type: Color')}\n` +
        `${EMOJI.INFO} Please select a strategy compatible with color betting.`,
        makeMainKeyboard(true, userId === ADMIN_ID)
      );
    } else {
      await sendMessageWithRetry(ctx, `${EMOJI.SUCCESS} ${STYLE.BOLD('Bet Type: Big/Small')}`, makeMainKeyboard(true, userId === ADMIN_ID));
    }
    
    saveUserSettings();
    await safeDeleteMessage(ctx);
    return;
  }
  
  if (data.startsWith("bs_wait_count:")) {
    const waitCount = parseInt(data.split(":")[1]);
    userSettings[userId].bs_sb_wait_count = waitCount;
    let message = waitCount === 0 ? `${EMOJI.SUCCESS} BS/SB Wait disabled` : `${EMOJI.SUCCESS} BS/SB Wait: ${waitCount}`;
    await sendMessageWithRetry(ctx, message, makeMainKeyboard(true, userId === ADMIN_ID));
    saveUserSettings();
    await safeDeleteMessage(ctx);
    return;
  }
  
  if (data.startsWith("bb_wait_count:")) {
    const waitCount = parseInt(data.split(":")[1]);
    userSettings[userId].bb_ss_wait_count = waitCount;
    let message = waitCount === 0 ? `${EMOJI.SUCCESS} BB/SS Wait disabled` : `${EMOJI.SUCCESS} BB/SS Wait: ${waitCount}`;
    await sendMessageWithRetry(ctx, message, makeMainKeyboard(true, userId === ADMIN_ID));
    saveUserSettings();
    await safeDeleteMessage(ctx);
    return;
  }
  
  if (data.startsWith("betting_strategy:")) {
    const bettingStrategy = data.split(":")[1];
    userSettings[userId].betting_strategy = bettingStrategy;
    userSettings[userId].martin_index = 0;
    userSettings[userId].dalembert_units = 1;
    userSettings[userId].consecutive_losses = 0;
    userSettings[userId].skip_betting = false;
    userSettings[userId].custom_index = 0;
    
    await sendMessageWithRetry(ctx, `${EMOJI.SUCCESS} ${STYLE.BOLD('Betting Strategy:')} ${bettingStrategy}`, makeMainKeyboard(true, userId === ADMIN_ID));
    saveUserSettings();
    await safeDeleteMessage(ctx);
    return;
  }
  
  if (data.startsWith("game_type:")) {
    const gameType = data.split(":")[1];
    
    if (gameType === "WINGO_SELECT") {
      await sendMessageWithRetry(ctx, `${EMOJI.GAME} ${STYLE.BOLD('Select WINGO Game Type')}`, makeWINGOSelectionKeyboard());
      await safeDeleteMessage(ctx);
      return;
    }
    
    userSettings[userId].game_type = gameType;
    await sendMessageWithRetry(ctx, `${EMOJI.SUCCESS} ${STYLE.BOLD('Game Type set')}`, makeMainKeyboard(true, userId === ADMIN_ID));
    saveUserSettings();
    await safeDeleteMessage(ctx);
    return;
  }

  if (data.startsWith("entry_layer:")) {
    const layerValue = parseInt(data.split(":")[1]);
    const settings = userSettings[userId];
    
    if (!settings) {
      await sendMessageWithRetry(ctx, `${EMOJI.ERROR} User settings not found`);
      return;
    }
    
    settings.layer_limit = layerValue;
    
    if (layerValue === 2) {
      settings.entry_layer_state = { waiting_for_lose: true };
    } else if (layerValue === 3) {
      settings.entry_layer_state = { waiting_for_loses: true, consecutive_loses: 0 };
    }
    
    let description = layerValue === 1 ? "Bet immediately" : layerValue === 2 ? "Wait for 1 lose" : "Wait for 2 loses";
    await sendMessageWithRetry(ctx, `${EMOJI.SUCCESS} ${STYLE.BOLD(`Entry Layer: ${layerValue}`)}\n\n${EMOJI.INFO} ${description}`, makeRiskManagementSubmenu());
    saveUserSettings();
    await safeDeleteMessage(ctx);
    return;
  }

  if (data.startsWith("sl_layer:")) {
    const slValue = parseInt(data.split(":")[1]);
    userSettings[userId].sl_layer = slValue > 0 ? slValue : null;
    userSettings[userId].consecutive_losses = 0;
    userSettings[userId].skip_betting = false;
    
    userSettings[userId].original_martin_index = 0;
    userSettings[userId].original_dalembert_units = 1;
    userSettings[userId].original_custom_index = 0;
    
    let description = slValue === 0 ? "Disabled" : `Skip after ${slValue} losses`;
    await sendMessageWithRetry(ctx, `${EMOJI.SUCCESS} ${STYLE.BOLD(`SL Layer: ${slValue}`)}\n\n${EMOJI.INFO} ${description}`, makeRiskManagementSubmenu());
    saveUserSettings();
    await safeDeleteMessage(ctx);
    return;
  }
  
  if (data.startsWith("mode:")) {
    const mode = data.split(":")[1];
    const settings = userSettings[userId];
    
    if (mode === "virtual") {
      userState[userId] = { state: "INPUT_VIRTUAL_BALANCE" };
      await sendMessageWithRetry(ctx, `${EMOJI.VIRTUAL} ${STYLE.BOLD('Virtual Mode Settings')}\n\n${EMOJI.INFO} Please enter your virtual balance amount (in Ks):\n\n${STYLE.CODE('Example: 10000')}`);
    } else if (mode === "real") {
      settings.virtual_mode = false;
      await sendMessageWithRetry(ctx, `${EMOJI.SUCCESS} ${STYLE.BOLD('Switched to Real Mode')}`, makeMainKeyboard(true, userId === ADMIN_ID));
      saveUserSettings();
    }
    
    await safeDeleteMessage(ctx);
    return;
  }
  
  logging.warning(`Unhandled callback: ${data}`);
  await sendMessageWithRetry(ctx, `${EMOJI.ERROR} Invalid action.`, makeMainKeyboard(true, userId === ADMIN_ID));
}

async function textMessageHandler(ctx) {
  const userId = ctx.from.id;
  const userName = ctx.from.username || ctx.from.first_name || "Unknown";
  const rawText = ctx.message.text;
  const isAdmin = userId === ADMIN_ID;
  
  const buttonText = rawText.trim();
 
  console.log(`Received button text: "${buttonText}" from user ${userName} (${userId})`);

  for (const [platformKey, platform] of Object.entries(PLATFORMS)) {
    if (buttonText === `${platform.color} ${platform.name}`) {
      userState[userId] = {
        state: "PLATFORM_SELECTED",
        platform: platformKey
      };
      await sendMessageWithRetry(ctx,
        `${platform.color} ${STYLE.BOLD(`Selected: ${platform.name}`)}\n\n` +
        `${EMOJI.LOGIN} Please login using the format:\n\n` +
        `${STYLE.CODE('phone')}\n` +
        `${STYLE.CODE('password')}`,
        Markup.keyboard([[`${EMOJI.BACK} Back`]]).resize().oneTime(false)
      );
      return;
    }
  }
  
  if (buttonText === `${EMOJI.SILENT} Silent Mode`) {
    await sendMessageWithRetry(ctx, `${EMOJI.SILENT} ${STYLE.BOLD('Silent Mode Settings')}\n\n${EMOJI.INFO} When enabled, bet and result messages will be hidden and live stats will be shown instead.`, makeSilentModeKeyboard());
    return;
  }
  
  if (buttonText === `${EMOJI.SILENT} Silent Mode (ON)` || buttonText === `${EMOJI.SILENT} Silent Mode (OFF)`) {
    await sendMessageWithRetry(ctx, `${EMOJI.SILENT} ${STYLE.BOLD('Silent Mode Settings')}\n\n${EMOJI.INFO} Current status: ${userSilentMessages[userId]?.enabled ? 'ON 🔇' : 'OFF 🔊'}`, makeSilentModeKeyboard());
    return;
  }
  
  if (buttonText === `${EMOJI.TIME} Time Range`) {
    await sendMessageWithRetry(ctx, `${EMOJI.TIME} ${STYLE.BOLD('Time Range Settings')}\n\n${EMOJI.INFO} Configure time ranges for auto activation.`, makeTimeRangeKeyboard());
    return;
  }
  
  if (buttonText === `${EMOJI.ADD} Add Time Range`) {
    userState[userId] = { state: "INPUT_TIME_RANGE_START" };
    await sendMessageWithRetry(ctx, `${EMOJI.TIME} ${STYLE.BOLD('Add Time Range - Step 1/2')}\n\n${EMOJI.INFO} Enter start time (HH:MM) in 24-hour format:\n\n${STYLE.CODE('Example: 9:00 AM')}`);
    return;
  }
  
  if (buttonText === `${EMOJI.MENU} View Ranges`) {
  if (!userTimeRanges[userId] || userTimeRanges[userId].length === 0) {
    await sendMessageWithRetry(ctx, `${EMOJI.INFO} No time ranges configured.`, makeTimeRangeKeyboard());
  } else {
    let message = `${EMOJI.TIME} ${STYLE.BOLD('Your Time Ranges:')}\n\n`;
    userTimeRanges[userId].forEach((range, index) => {
      // Try to use stored display times, or convert from 24-hour format
      let displayStart = range.displayStart || convert24to12(range.start);
      let displayEnd = range.displayEnd || convert24to12(range.end);
      message += `${index + 1}. ${displayStart} → ${displayEnd}\n`;
    });
    message += `\n${EMOJI.FORECAST} Forecast Win: ${userTimeRangeForecastWin[userId] ? 'ON' : 'OFF'}`;
    message += `\n${EMOJI.INFO} Current status: ${checkTimeRange(userId).shouldRun ? 'Active' : 'Inactive'}`;
    await sendMessageWithRetry(ctx, message, makeTimeRangeKeyboard());
  }
  return;
}
  
  if (buttonText === `${EMOJI.REMOVE} Remove Range`) {
  if (!userTimeRanges[userId] || userTimeRanges[userId].length === 0) {
    await sendMessageWithRetry(ctx, `${EMOJI.INFO} No time ranges to remove.`, makeTimeRangeKeyboard());
  } else {
    let message = `${EMOJI.REMOVE} ${STYLE.BOLD('Select range to remove:')}\n\n`;
    const keyboard = [];
    userTimeRanges[userId].forEach((range, index) => {
      let displayStart = range.displayStart || convert24to12(range.start);
      let displayEnd = range.displayEnd || convert24to12(range.end);
      message += `${index + 1}. ${displayStart} → ${displayEnd}\n`;
      keyboard.push([Markup.button.callback(`❌ Remove #${index + 1}`, `timerange:remove_index:${index}`)]);
    });
    keyboard.push([Markup.button.callback(`${EMOJI.BACK} Back`, `timerange:back`)]);
    
    await sendMessageWithRetry(ctx, message, Markup.inlineKeyboard(keyboard));
  }
  return;
}
  
  if (buttonText === `${EMOJI.FORECAST} Forecast Win`) {
    userTimeRangeForecastWin[userId] = !userTimeRangeForecastWin[userId];
    saveUserSettings();
    await sendMessageWithRetry(ctx, `${EMOJI.SUCCESS} Forecast Win: ${userTimeRangeForecastWin[userId] ? 'ON' : 'OFF'}`, makeTimeRangeKeyboard());
    return;
  }
  
  if (isAdmin) {
    console.log(`User is admin, checking admin commands...`);
    
    if (buttonText === `${EMOJI.STATS} User Stats` || buttonText === "User Stats" || buttonText === "📊 User Stats") {
      console.log(`Admin pressed User Stats button`);
      ctx.message.text = "/users";
      await cmdUsersHandler(ctx);
      return;
    }
    
    if (buttonText === `${EMOJI.MENU} Allowed IDs` || buttonText === "Allowed IDs" || buttonText === "📋 Allowed IDs") {
      console.log(`Admin pressed Allowed IDs button`);
      ctx.message.text = "/showid";
      await cmdShowIdHandler(ctx);
      return;
    }
    
    if (buttonText === `${EMOJI.ENABLE} Enable Free` || buttonText === "Enable Free" || buttonText === "🔓 Enable Free") {
      console.log(`Admin pressed Enable Free button`);
      ctx.message.text = "/enable";
      await cmdEnableFreeMode(ctx);
      return;
    }
    
    if (buttonText === `${EMOJI.DISABLE} Disable Free` || buttonText === "Disable Free" || buttonText === "🔒 Disable Free") {
      console.log(`Admin pressed Disable Free button`);
      ctx.message.text = "/disable";
      await cmdDisableFreeMode(ctx);
      return;
    }
    
    if (buttonText === `${EMOJI.ADD} Add User` || buttonText === "Add User" || buttonText === "➕ Add User") {
      console.log(`Admin pressed Add User button`);
      userState[userId] = { state: "ADMIN_ADD_USER" };
      await sendMessageWithRetry(ctx, `${EMOJI.ADD} Enter user ID to add:`, makeAdminPanelKeyboard());
      return;
    }
    
    if (buttonText === `${EMOJI.REMOVE} Remove User` || buttonText === "Remove User" || buttonText === "➖ Remove User") {
      console.log(`Admin pressed Remove User button`);
      userState[userId] = { state: "ADMIN_REMOVE_USER" };
      await sendMessageWithRetry(ctx, `${EMOJI.REMOVE} Enter user ID to remove:`, makeAdminPanelKeyboard());
      return;
    }
    
    if (buttonText === `${EMOJI.BROADCAST} Broadcast` || buttonText === "Broadcast" || buttonText === "📢 Broadcast") {
      console.log(`Admin pressed Broadcast button`);
      userState[userId] = { state: "ADMIN_BROADCAST" };
      await sendMessageWithRetry(ctx, `${EMOJI.BROADCAST} Enter broadcast message:`, makeAdminPanelKeyboard());
      return;
    }
    
    if (buttonText === `${EMOJI.CHECK} Check Free Mode` || buttonText === "Check Free Mode" || buttonText === "🔄 Check Free Mode") {
      console.log(`Admin pressed Check Free Mode button`);
      ctx.message.text = "/freemode";
      await cmdCheckFreeMode(ctx);
      return;
    }
    
    if (buttonText === `${EMOJI.MENU} Main Menu` || buttonText === "Main Menu" || buttonText === "🏠 Main Menu") {
      console.log(`Admin pressed Main Menu button`);
      const loggedIn = !!userSessions[userId];
      await sendMessageWithRetry(ctx, `${EMOJI.MENU} Returning to main menu...`, makeMainKeyboard(loggedIn, isAdmin));
      return;
    }
  }

  if (buttonText === `${EMOJI.ADMIN} Admin Panel` || buttonText === "Admin Panel" || buttonText === "👑 Admin Panel") {
    console.log(`User ${userName} (${userId}) pressed Admin Panel button`);
    if (isAdmin) {
      await sendMessageWithRetry(ctx, `${EMOJI.ADMIN} ${STYLE.BOLD('Admin Panel')}\n\n${EMOJI.INFO} Select an admin action:`, makeAdminPanelKeyboard());
    } else {
      await sendMessageWithRetry(ctx, `${EMOJI.ERROR} Admin only!`, makeMainKeyboard(true, false));
    }
    return;
  }
  
  if (isAdmin && userState[userId]?.state === "ADMIN_ADD_USER") {
    const userIdToAdd = rawText.trim();
    if (!userIdToAdd.match(/^\d+$/)) {
      await sendMessageWithRetry(ctx, `${EMOJI.ERROR} Invalid user ID.`, makeAdminPanelKeyboard());
      return;
    }
    ctx.message.text = `/allow ${userIdToAdd}`;
    await cmdAllowHandler(ctx);
    delete userState[userId];
    return;
  }
  
  if (isAdmin && userState[userId]?.state === "ADMIN_REMOVE_USER") {
    const userIdToRemove = rawText.trim();
    if (!userIdToRemove.match(/^\d+$/)) {
      await sendMessageWithRetry(ctx, `${EMOJI.ERROR} Invalid user ID.`, makeAdminPanelKeyboard());
      return;
    }
    ctx.message.text = `/remove ${userIdToRemove}`;
    await cmdRemoveHandler(ctx);
    delete userState[userId];
    return;
  }
  
  if (isAdmin && userState[userId]?.state === "ADMIN_BROADCAST") {
    const messageToSend = rawText.trim();
    if (!messageToSend) {
      await sendMessageWithRetry(ctx, `${EMOJI.INFO} Please provide a message.`, makeAdminPanelKeyboard());
      delete userState[userId];
      return;
    }
    
    try {
      const telegramUserIds = Array.from(activeUsers);
      if (telegramUserIds.length === 0) {
        await sendMessageWithRetry(ctx, `${EMOJI.INFO} No active users.`, makeAdminPanelKeyboard());
        delete userState[userId];
        return;
      }
      
      let successCount = 0;
      const broadcastMessage = `${EMOJI.BROADCAST} ${STYLE.BOLD('Admin Broadcast:')}\n\n${messageToSend}`;
      
      for (const telegramId of telegramUserIds) {
        try {
          await ctx.telegram.sendMessage(telegramId, convertToPremiumEmojis(broadcastMessage), { parse_mode: 'HTML' });
          successCount++;
        } catch (error) {
          logging.error(`Failed to send message to user ${telegramId}: ${error.message}`);
        }
      }
      
      const resultMessage = `${EMOJI.SUCCESS} Message sent to ${successCount} users`;
      await sendMessageWithRetry(ctx, resultMessage, makeAdminPanelKeyboard());
      logging.info(`Admin broadcast sent to ${successCount}/${telegramUserIds.length} users`);
    } catch (error) {
      logging.error(`Error sending admin broadcast: ${error.message}`);
      await sendMessageWithRetry(ctx, `${EMOJI.ERROR} Error sending message.`, makeAdminPanelKeyboard());
    }
    
    delete userState[userId];
    return;
  }
  
  if (isAdmin && rawText.startsWith("/allow ")) { await cmdAllowHandler(ctx); return; }
  if (isAdmin && rawText.startsWith("/remove ")) { await cmdRemoveHandler(ctx); return; }
  if (isAdmin && rawText.startsWith("/send ")) { await cmdSendHandler(ctx); return; }
  
  if (buttonText === `${EMOJI.INFO} Account Info`) {
    await showUserStats(ctx, userId);
    return;
  }
  
  if (buttonText === `${EMOJI.TARGET} Game Type`) {
    await sendMessageWithRetry(ctx, `${EMOJI.GAME} Select Game Type:`, makeGameTypeKeyboard());
    return;
  }
  
  if (buttonText === `${EMOJI.TARGET} Profit Target`) {
    userState[userId] = { state: "INPUT_PROFIT_TARGET" };
    await sendMessageWithRetry(ctx, `${EMOJI.TARGET} ${STYLE.BOLD('Profit Target Settings')}\n\n${EMOJI.INFO} Please enter your desired profit target amount (in Ks):\n\n${STYLE.CODE('Example: 10000')}`);
    return;
  }
  
  if (buttonText === `${EMOJI.STOP} Stop Loss`) {
    userState[userId] = { state: "INPUT_STOP_LIMIT" };
    await sendMessageWithRetry(ctx, `${EMOJI.STOP} ${STYLE.BOLD('Stop Loss Settings')}\n\n${EMOJI.INFO} Please enter your stop loss limit amount (in Ks):\n\n${STYLE.CODE('Example: 5000')}`);
    return;
  }
  
  if (buttonText === `${EMOJI.LAYER} Entry Layer`) {
    await sendMessageWithRetry(ctx, `${EMOJI.LAYER} ${STYLE.BOLD('Entry Layer Settings')}\n\n${EMOJI.INFO} Select when to start betting:`, makeEntryLayerKeyboard());
    return;
  }
  
  if (buttonText === `${EMOJI.WARNING} Bet SL`) {
    await sendMessageWithRetry(ctx, `${EMOJI.WARNING} ${STYLE.BOLD('Stop Loss Layer Settings')}\n\n${EMOJI.INFO} Select how many consecutive losses before skipping bets:`, makeSLLayerKeyboard());
    return;
  }
  
  if (buttonText === `${EMOJI.BACK} Back`) {
    if (userState[userId]?.state === "PLATFORM_SELECTED") {
      const loggedIn = !!userSessions[userId];
      await sendMessageWithRetry(ctx, `${EMOJI.BACK} Returning to main menu...`, makeMainKeyboard(loggedIn, isAdmin));
      delete userState[userId];
      return;
    }
    
    const isOnPlatformKeyboard = Object.values(PLATFORMS).some(p =>
      buttonText.includes(p.name) || buttonText.includes(p.color)
    );
    
    if (isOnPlatformKeyboard) {
      const loggedIn = !!userSessions[userId];
      await sendMessageWithRetry(ctx, `${EMOJI.BACK} Returning to main menu...`, makeMainKeyboard(loggedIn, isAdmin));
    } else {
      const loggedIn = !!userSessions[userId];
      if (!loggedIn) {
        await sendMessageWithRetry(ctx,
          `${EMOJI.LOGIN} ${STYLE.BOLD('Select Platform')}\n\n` +
          `${EMOJI.INFO} Choose your lottery platform:`,
          makePlatformKeyboard()
        );
      } else {
        await sendMessageWithRetry(ctx, `${EMOJI.BACK} Returning to main menu...`, makeMainKeyboard(loggedIn, isAdmin));
      }
    }
    
    delete userState[userId];
    return;
  }
  
  if (buttonText === `${EMOJI.RISK} Risk Management`) {
    await sendMessageWithRetry(ctx, `${EMOJI.RISK} ${STYLE.BOLD('Risk Management')}\n\n${EMOJI.INFO} Configure your betting safety settings below:`, makeRiskManagementSubmenu());
    return;
  }
  
  if (buttonText === `${EMOJI.START} Activate`) {
  console.log(`[USER_ACTIVITY] User ${userName} (ID: ${userId}) started the bot`);
  
  const settings = userSettings[userId] || {};
  
  if (!settings.bet_sizes) {
    await sendMessageWithRetry(ctx, `${EMOJI.ERROR} Please set Bet_Wrager first!`, makeMainKeyboard(true, isAdmin));
    return;
  }
  
  if (userActiveTimeRange[userId] && !checkTimeRange(userId).shouldRun && !userTimeRangeForecastWin[userId]) {
    await sendMessageWithRetry(ctx, `${EMOJI.TIME} ${STYLE.BOLD('Outside of active time range')}\n\n${EMOJI.INFO} Bot will start when time range begins.`, makeMainKeyboard(true, isAdmin));
    return;
  }
  
  if (settings.strategy === "BS_ORDER" && !settings.pattern) {
    settings.pattern = DEFAULT_BS_ORDER;
    settings.pattern_index = 0;
    await sendMessageWithRetry(ctx, `${EMOJI.INFO} Using default order: ${DEFAULT_BS_ORDER}`, makeMainKeyboard(true, isAdmin));
  }
  
  if (settings.betting_strategy === "D'Alembert" && settings.bet_sizes.length > 1) {
    await sendMessageWithRetry(ctx, `${EMOJI.ERROR} D'Alembert requires only ONE Bet_Wrager.`, makeMainKeyboard(true, isAdmin));
    return;
  }
  
  if (settings.running) {
    await sendMessageWithRetry(ctx, `${EMOJI.INFO} Bot is already running!`, makeMainKeyboard(true, isAdmin));
    return;
  }
  
  // Silent Mode မသတ်မှတ်ရသေးရင် OFF အနေနဲ့ Auto-activate လုပ်မယ်
  if (userSilentMessages[userId]?.enabled === undefined) {
    userSilentMessages[userId] = { enabled: false };
    saveUserSettings();
    logging.info(`Silent Mode auto-set to OFF for user ${userId}`);
  }
  
  settings.running = true;
  settings.consecutive_errors = 0;
  saveUserSettings();
  
  const entryLayer = settings.layer_limit || 1;
  
  if (entryLayer === 2) {
    settings.entry_layer_state = { waiting_for_lose: true };
  } else if (entryLayer === 3) {
    settings.entry_layer_state = { waiting_for_loses: true, consecutive_loses: 0 };
  }
  
  if (settings.strategy === "TREND_FOLLOW") {
    const betType = settings.bet_type || "BS";
    if (betType === "COLOR") {
      settings.color_trend_state = { last_result: null };
    } else {
      settings.trend_state = { last_result: null, skip_mode: false };
    }
  }
  
  if (settings.strategy === "ALTERNATE") {
    settings.alternate_state = { last_result: null, skip_mode: false };
  }
  if (settings.strategy === "DYNAMIC_TREND_FLIP") {
    settings.dynamic_trend_flip_state = {
      last_bet: null,
      last_result: null,
      next_bet: null,
      mode: 'STRAIGHT',
      loss_count: 0,
      skip_next: false
    };
  }
  
  if (settings.strategy === "CYBER_SNIPER") {
    settings.cyber_sniper_state = {
      active: false,
      direction: null,
      sequence: [],
      step: 0,
      hit_count: 0,
      got_same_result: false
    };
  }
  if (settings.strategy === "COLOR_SNIPER") {
    settings.color_sniper_state = {
      active: false,
      step: 0,
      hit_count: 0,
      waiting_for_trigger: true
    };
  }
  if (settings.strategy === "TIME_WARP" && !settings.time_warp_pos) {
    settings.time_warp_pos = 8;
  }
  
  if (["CYBER_SNIPER", "COLOR_SNIPER"].includes(settings.strategy)) {
    settings.sniper_hit_count = 0;
    settings.sniper_loss_count = 0;
    logging.info(`Reset sniper counters for ${settings.strategy}`);
  }
  
  delete userSkippedBets[userId];
  userShouldSkipNext[userId] = false;
  delete userSLSkipWaitingForWin[userId];
  userWaitingForResult[userId] = false;
  
  // Silent Mode ဖွင့်ထားရင် Live Stats စတင်မယ်
  if (userSilentMessages[userId]?.enabled) {
    await bettingWorker(userId, ctx, ctx.telegram);
  } else {
    // Silent Mode ပိတ်ထားရင် ပုံမှန်အတိုင်း
    bettingWorker(userId, ctx, ctx.telegram);
  }
  return;
}
  
  if (buttonText === `${EMOJI.STOP} Deactivate`) {
    console.log(`[USER_ACTIVITY] User ${userName} (ID: ${userId}) stopped the bot`);
    
    const settings = userSettings[userId] || {};
    if (!settings.running) {
      await sendMessageWithRetry(ctx, `${EMOJI.INFO} Bot is not running!`, makeMainKeyboard(true, isAdmin));
      return;
    }
    
    userStopInitiated[userId] = true;
    settings.running = false;
    delete userWaitingForResult[userId];
    delete userShouldSkipNext[userId];
    delete userSLSkipWaitingForWin[userId];
    
    saveUserSettings();
    
    if (settings.strategy === "TREND_FOLLOW") {
      delete settings.trend_state;
      delete settings.color_trend_state;
    }
    if (settings.strategy === "ALTERNATE") {
      delete settings.alternate_state;
    }
    if (settings.strategy === "DYNAMIC_TREND_FLIP") {
      delete settings.dynamic_trend_flip_state;
    }
    
    if (settings.strategy === "CYBER_SNIPER") {
      delete settings.cyber_sniper_state;
    }
    if (settings.strategy === "COLOR_SNIPER") {
      delete settings.color_sniper_state;
    }
    if (settings.strategy === "TIME_WARP") {
      delete settings.time_warp_pos;
    }
    
    let totalProfit = 0;
    let balanceText = "";
    
    if (settings.virtual_mode) {
      totalProfit = (userStats[userId]?.virtual_balance || 0) - (userStats[userId]?.initial_balance || 0);
      balanceText = `${EMOJI.VIRTUAL} Virtual Balance: ${(userStats[userId]?.virtual_balance || 0).toFixed(2)} Ks\n`;
    } else {
      totalProfit = userStats[userId]?.profit || 0;
      try {
        const session = userSessions[userId];
        const finalBalance = await getBalance(session, parseInt(userId));
        balanceText = `${EMOJI.BALANCE} Final Balance: ${finalBalance?.toFixed(2) || '0.00'} Ks\n`;
      } catch (error) {
        balanceText = `${EMOJI.BALANCE} Final Balance: Unknown\n`;
      }
    }
    
    let profitIndicator = "";
    if (totalProfit > 0) profitIndicator = "+";
    else if (totalProfit < 0) profitIndicator = "-";
    
    delete userStats[userId];
    settings.martin_index = 0;
    settings.dalembert_units = 1;
    settings.custom_index = 0;
    
    saveUserSettings();
    
    const message = `${EMOJI.STOP} ${STYLE.BOLD('SESSION TERMINATED')}\n${balanceText}${EMOJI.PROFIT} Total Profit: ${profitIndicator}${totalProfit.toFixed(2)} Ks`;
    await sendMessageWithRetry(ctx, message, makeMainKeyboard(true, isAdmin));
    return;
  }
  
  if (buttonText === `${EMOJI.BETWRAGER} Bet_Wrager`) {
    userState[userId] = { state: "INPUT_BET_SIZES" };
    await sendMessageWithRetry(ctx, `${EMOJI.BALANCE} Enter Bet_Wragers (one per line):\n${STYLE.CODE('100')}\n${STYLE.CODE('200')}\n${STYLE.CODE('500')}`, makeMainKeyboard(true, isAdmin));
    return;
  }
  
  if (buttonText === `${EMOJI.STRATEGY} Strategy`) {
    await sendMessageWithRetry(ctx, `${EMOJI.STRATEGY} Choose strategy:`, makeStrategyKeyboard(userId));
    return;
  }
  
  if (buttonText === `${EMOJI.SETTINGS} Betting Settings`) {
    await sendMessageWithRetry(ctx, `${EMOJI.SETTINGS} Choose Betting Strategy`, makeBettingStrategyKeyboard());
    return;
  }
  
  if (buttonText === `${EMOJI.GAME} Game Mode`) {
    await sendMessageWithRetry(ctx, `${EMOJI.GAME} Select Mode:`, makeModeSelectionKeyboard());
    return;
  }
  
  if (buttonText === `${EMOJI.COLOR} Bet Type`) {
    const currentBetType = userSettings[userId]?.bet_type || "BS";
    const typeText = currentBetType === "COLOR" ? "Color" : "Big/Small";
    
    await sendMessageWithRetry(ctx,
      `${EMOJI.COLOR} ${STYLE.BOLD('Bet Type Settings')}\n\n` +
      `${EMOJI.INFO} Current: ${STYLE.BOLD(typeText)}\n` +
      `${EMOJI.INFO} Select your preferred betting mode:`,
      makeBetTypeKeyboard()
    );
    return;
  }
  
  if (buttonText === `${EMOJI.LOGIN} Login`) {
    await sendMessageWithRetry(ctx,
      `${EMOJI.LOGIN} ${STYLE.BOLD('Select Platform')}\n\n` +
      `${EMOJI.INFO} Choose your lottery platform:`,
      makePlatformKeyboard()
    );
    return;
  }
  
  if (buttonText === `${EMOJI.LOGOUT} Re-Login`) {
    delete userSessions[userId];
    delete userGameInfo[userId];
    delete userStats[userId];
    delete userLastResults[userId];
    delete userPlatforms[userId];
    
    await sendMessageWithRetry(ctx,
      `${EMOJI.LOGIN} ${STYLE.BOLD('Select Platform')}\n\n` +
      `${EMOJI.INFO} Choose your lottery platform:`,
      makePlatformKeyboard()
    );
    return;
  }
  
  const text = normalizeText(rawText);
  const lines = text.split('\n').map(line => line.trim()).filter(line => line);
  
  if (userState[userId]?.state === "PLATFORM_SELECTED" && lines.length >= 2) {
    const platformKey = userState[userId].platform;
    const platform = PLATFORMS[platformKey];
    const phone = lines[0];
    const password = lines[1];
    
    console.log(`[USER_ACTIVITY] User ${userName} (ID: ${userId}) logging into ${platform.name}`);
    activeUsers.add(userId);
    
    await sendMessageWithRetry(ctx, `${EMOJI.LOADING} Logging into ${platform.name}...`);
    
    userPlatforms[userId] = platformKey;
    
    const { response: res, session } = await loginRequest(phone, password, platform.baseUrl);
    
    if (session) {
      const userInfo = await getUserInfo(session, userId);
      if (userInfo && userInfo.user_id) {
        const gameUserId = userInfo.user_id;
        
        if (!freeModeEnabled && !allowedsixlotteryIds.has(gameUserId)) {
          await sendMessageWithRetry(ctx,
            `${EMOJI.ERROR} ${STYLE.BOLD('Unauthorized user ID.')}\n\n` +
            `${EMOJI.INFO} Free Mode is currently DISABLED.\n` +
            `${EMOJI.INFO} Please contact @RNRISK to add your ID:\n` +
            `${STYLE.ITEM(`Your ID: ${STYLE.CODE(gameUserId.toString())}`)}`,
            makeMainKeyboard(false, isAdmin)
          );
          return;
        }
        
        userSessions[userId] = session;
        userGameInfo[userId] = userInfo;
        userTemp[userId] = { password, platform: platformKey };
        
        userAllResults[userId] = [];
        userLastResults[userId] = [];
        
        const balance = await getBalance(session, parseInt(userId));
        
        if (!userSettings[userId]) {
          userSettings[userId] = {
            platform: platformKey,
            strategy: "TREND_FOLLOW",
            betting_strategy: "Martingale",
            game_type: "TRX",
            bet_type: "BS",
            martin_index: 0,
            dalembert_units: 1,
            pattern_index: 0,
            running: false,
            consecutive_losses: 0,
            current_layer: 0,
            skip_betting: false,
            sl_layer: null,
            original_martin_index: 0,
            original_dalembert_units: 1,
            original_custom_index: 0,
            custom_index: 0,
            layer_limit: 1,
            virtual_mode: false,
            bs_sb_wait_count: 0,
            bb_ss_wait_count: 0
          };
        } else {
          userSettings[userId].platform = platformKey;
        }
        
        if (!userStats[userId]) {
          userStats[userId] = { start_balance: parseFloat(balance || 0), profit: 0.0 };
        }
        
        const balanceDisplay = balance !== null ? balance : 0.0;
        const modeStatus = (false && !freeModeEnabled) ? "" : `${EMOJI.CHECK} (Free Mode)`;
        
        const loginMessage =
          `${platform.color} ${STYLE.BOLD(`${platform.name} Login Successful`)} ${modeStatus}\n\n` +
          `${EMOJI.USER} ${STYLE.BOLD('User ID:')} ${STYLE.CODE(userInfo.user_id.toString())}\n` +
          `${EMOJI.BALANCE} ${STYLE.BOLD('Balance:')} ${balanceDisplay} Ks\n\n` +
          `${EMOJI.START} Welcome back! Configure your settings.`;
        
        await sendMessageWithRetry(ctx, loginMessage, makeMainKeyboard(true, isAdmin));
        
        if (userSettings[userId].bet_sizes && userSettings[userId].pattern) {
          await showUserStats(ctx, userId);
        }
        
        saveUserSettings();
      } else {
        await sendMessageWithRetry(ctx, `${EMOJI.ERROR} Login failed: Could not get user info`, makeMainKeyboard(false, isAdmin));
      }
    } else {
      const msg = res.msg || "Login failed";
      await sendMessageWithRetry(ctx, `${EMOJI.ERROR} Login error: ${msg}`, makeMainKeyboard(false, isAdmin));
    }
    
    delete userState[userId];
    delete userTemp[userId];
    return;
  }
  
  const currentState = userState[userId]?.state;
  
  if (currentState === "INPUT_TIME_RANGE_START") {
  const time12Pattern = /^(0?[1-9]|1[0-2]):[0-5][0-9]\s?(AM|PM|am|pm|Am|Pm|aM|pM)$/;
  const startTime = text.trim();
  
  if (!isValid12HourTime(startTime)) {
    await sendMessageWithRetry(ctx, 
      `${EMOJI.ERROR} Invalid time format. Please use 12-hour format with AM/PM.\n\n` +
      `${STYLE.CODE('Example: 2:30 PM')}\n` +
      `${STYLE.CODE('Example: 09:45 AM')}\n` +
      `${STYLE.CODE('Example: 11:00PM')}`,
      makeTimeRangeKeyboard()
    );
    return;
  }
  
  const convertedTime = convert12to24(startTime);
  userState[userId] = { 
    state: "INPUT_TIME_RANGE_END", 
    startTime: startTime,
    convertedStartTime: convertedTime 
  };
  
  await sendMessageWithRetry(ctx, 
    `${EMOJI.TIME} ${STYLE.BOLD('Add Time Range - Step 2/2')}\n\n` +
    `${EMOJI.INFO} Start time: ${startTime}\n\n` +
    `${EMOJI.INFO} Enter end time (12-hour format with AM/PM):\n\n` +
    `${STYLE.CODE('Example: 10:00 PM')}\n` +
    `${STYLE.CODE('Example: 11:30PM')}`,
    makeTimeRangeKeyboard()
  );
  return;
}
  
  if (currentState === "INPUT_TIME_RANGE_END") {
  const endTime = text.trim();
  const startTime = userState[userId].startTime;
  
  if (!isValid12HourTime(endTime)) {
    await sendMessageWithRetry(ctx, 
      `${EMOJI.ERROR} Invalid time format. Please use 12-hour format with AM/PM.\n\n` +
      `${STYLE.CODE('Example: 10:30 PM')}\n` +
      `${STYLE.CODE('Example: 11:45AM')}`,
      makeTimeRangeKeyboard()
    );
    return;
  }
  
  const convertedEndTime = convert12to24(endTime);
  const convertedStartTime = userState[userId].convertedStartTime || convert12to24(startTime);
  
  if (!userTimeRanges[userId]) {
    userTimeRanges[userId] = [];
  }
  
  userTimeRanges[userId].push({ 
    start: convertedStartTime, 
    end: convertedEndTime,
    displayStart: startTime,
    displayEnd: endTime 
  });
  userActiveTimeRange[userId] = true;
  
  saveUserSettings();
  
  await sendMessageWithRetry(ctx, 
    `${EMOJI.SUCCESS} ${STYLE.BOLD('Time Range Added')}\n\n` +
    `${startTime} → ${endTime}\n` +
    `${STYLE.INFO(`(24-hour: ${convertedStartTime} → ${convertedEndTime})`)}\n\n` +
    `${EMOJI.INFO} Bot will automatically activate during this period.`,
    makeTimeRangeKeyboard()
  );
  delete userState[userId];
  return;
}
  
  if (currentState === "INPUT_VIRTUAL_BALANCE") {
    const balance = parseFloat(text);
    if (isNaN(balance) || balance <= 0) {
      await sendMessageWithRetry(ctx, `${EMOJI.ERROR} Invalid balance amount.`);
      return;
    }
    const settings = userSettings[userId];
    settings.virtual_mode = true;
    settings.virtual_balance = balance;
    
    if (!userStats[userId]) {
      userStats[userId] = {};
    }
    userStats[userId].virtual_balance = balance;
    userStats[userId].initial_balance = balance;
    
    await sendMessageWithRetry(ctx, `${EMOJI.SUCCESS} ${STYLE.BOLD('Virtual Mode:')} ${balance} Ks`, makeMainKeyboard(true, isAdmin));
    delete userState[userId];
    saveUserSettings();
    return;
  }
  
  if (!await checkUserAuthorized(ctx) && text.toLowerCase() !== "login") {
    return;
  }
  
  if (currentState === "INPUT_BET_SIZES") {
    const betSizes = lines.filter(s => s.match(/^\d+$/)).map(Number);
    if (betSizes.length === 0) {
      await sendMessageWithRetry(ctx, `${EMOJI.ERROR} No valid numbers entered.`, makeMainKeyboard(true, isAdmin));
      return;
    }
    
    const settings = userSettings[userId];
    if (settings.betting_strategy === "D'Alembert" && betSizes.length > 1) {
      await sendMessageWithRetry(ctx, `${EMOJI.ERROR} D'Alembert requires only ONE Bet_Wrager.`, makeMainKeyboard(true, isAdmin));
      return;
    }
    
    userSettings[userId].bet_sizes = betSizes;
    userSettings[userId].dalembert_units = 1;
    userSettings[userId].martin_index = 0;
    userSettings[userId].custom_index = 0;
    
    await sendMessageWithRetry(ctx, `${EMOJI.SUCCESS} ${STYLE.BOLD('Bet_Wrager set:')} ${betSizes.join(',')} Ks`, makeMainKeyboard(true, isAdmin));
    delete userState[userId];
    saveUserSettings();
  } else if (currentState === "INPUT_BS_PATTERN") {
    const pattern = text.toUpperCase().trim();
    
    if (!pattern) {
      await sendMessageWithRetry(ctx, `${EMOJI.ERROR} Pattern cannot be empty.`, makeMainKeyboard(true, isAdmin));
      return;
    }
    
    if (!pattern.split('').every(c => c === 'B' || c === 'S')) {
      await sendMessageWithRetry(ctx, `${EMOJI.ERROR} Pattern can only contain 'B' and 'S'.`, makeMainKeyboard(true, isAdmin));
      return;
    }
    
    if (pattern.length < 3) {
      await sendMessageWithRetry(ctx, `${EMOJI.ERROR} Pattern must be at least 3 characters long.`, makeMainKeyboard(true, isAdmin));
      return;
    }
    
    userSettings[userId].pattern = pattern;
    userSettings[userId].pattern_index = 0;
    
    await sendMessageWithRetry(ctx,
      `${EMOJI.SUCCESS} ${STYLE.BOLD('BS Pattern set:')} ${pattern}\n` +
      `${EMOJI.INFO} Pattern length: ${pattern.length} characters\n` +
      `${EMOJI.INFO} First bet will be: ${pattern[0]}`,
      makeMainKeyboard(true, isAdmin)
    );
    
    delete userState[userId];
    saveUserSettings();
  } else if (currentState === "INPUT_PROFIT_TARGET") {
    const target = parseFloat(text);
    if (isNaN(target) || target <= 0) {
      await sendMessageWithRetry(ctx, `${EMOJI.ERROR} Invalid profit target.`, makeRiskManagementSubmenu());
      return;
    }
    userSettings[userId].target_profit = target;
    await sendMessageWithRetry(ctx, `${EMOJI.SUCCESS} ${STYLE.BOLD('TARGET set:')} ${target} Ks`, makeRiskManagementSubmenu());
    delete userState[userId];
    saveUserSettings();
  } else if (currentState === "INPUT_STOP_LIMIT") {
    const stopLoss = parseFloat(text);
    if (isNaN(stopLoss) || stopLoss <= 0) {
      await sendMessageWithRetry(ctx, `${EMOJI.ERROR} Invalid stop loss.`, makeRiskManagementSubmenu());
      return;
    }
    userSettings[userId].stop_loss = stopLoss;
    await sendMessageWithRetry(ctx, `${EMOJI.SUCCESS} ${STYLE.BOLD('STOP LOSS set:')} ${stopLoss} Ks`, makeRiskManagementSubmenu());
    delete userState[userId];
    saveUserSettings();
  } else {
    if (userSessions[userId] && text.trim() !== "") {
      if (text.length > 1 && !text.match(/^\/[a-zA-Z]/)) {
        await sendMessageWithRetry(ctx, `${EMOJI.ERROR} Unknown command.`, makeMainKeyboard(true, isAdmin));
      }
    }
  }
}

async function showUserStats(ctx, userId) {
  const session = userSessions[userId];
  const userInfo = userGameInfo[userId];
  
  if (!userInfo) {
    await sendMessageWithRetry(ctx, `${EMOJI.ERROR} Failed to get user info. Please login first.`, makeMainKeyboard(!!userSessions[userId], userId === ADMIN_ID));
    return;
  }
  
  const settings = userSettings[userId] || {};
  const betSizes = settings.bet_sizes || [];
  const strategy = settings.strategy || "TREND_FOLLOW";
  const bettingStrategy = settings.betting_strategy || "Martingale";
  const gameType = settings.game_type || "TRX";
  const betType = settings.bet_type || "BS";
  const virtualMode = settings.virtual_mode || false;
  const profitTarget = settings.target_profit;
  const stopLoss = settings.stop_loss;
  const slLayer = settings.sl_layer;
  const layerLimit = settings.layer_limit || 1;
  const isSilent = userSilentMessages[userId]?.enabled || false;
  const timeRangeCount = userTimeRanges[userId]?.length || 0;
  const forecastWin = userTimeRangeForecastWin[userId] || false;
  
  const platformKey = settings.platform || "6LOTTERY";
  const platform = PLATFORMS[platformKey];
  
  let balance;
  
  if (virtualMode) {
    balance = userStats[userId]?.virtual_balance || settings.virtual_balance || 0;
  } else {
    if (session) {
      balance = await getBalance(session, parseInt(userId));
    } else {
      balance = userInfo.balance || 0;
    }
  }
  
  let betOrder = "N/A";
  if (strategy === "BS_ORDER") {
    betOrder = settings.pattern || "BS-Order";
  }
  
  let entryLayerDesc = layerLimit === 1 ? "Bet immediately" : layerLimit === 2 ? "Wait for 1 lose" : "Wait for 2 loses";
  let slStatus = userSLSkipWaitingForWin[userId] ? " (Waiting for Skip Win)" : (settings.consecutive_losses > 0 ? ` (${settings.consecutive_losses}/${slLayer || 0})` : "");
  
  const modeText = virtualMode ? `${EMOJI.VIRTUAL} Virtual Mode` : `${EMOJI.REAL} Real Mode`;
  const betTypeText = betType === "COLOR" ? `Color` : `Big/Small`;
  const freeModeStatus = freeModeEnabled ? `${EMOJI.ENABLE} Free Mode` : `${EMOJI.DISABLE} Restricted Mode`;
  const silentStatus = isSilent ? 'ON 🔇' : 'OFF 🔊';
  
  const safeText = (text) => {
  if (text === null || text === undefined) return '';
  // Don't escape numbers and common punctuation
  return escapeMarkdown(String(text));
};
  
  const betWrager = betSizes.join(', ') || 'Not set';
  
  const infoText =
    `${EMOJI.STATS} *ACCOUNT INFO*\n` +
    `${STYLE.SEPARATOR}\n\n` +
    
    `${EMOJI.USER} *USER DETAILS*\n` +
    `${STYLE.ITEM(`User ID: \`${safeText(userInfo.user_id?.toString() || 'N/A')}\``)}\n` +
    `${STYLE.ITEM(`Username: ${safeText(userInfo.nickname || userInfo.username || 'Unknown')}`)}\n` +
    `${STYLE.ITEM(`Platform: ${safeText(platform.name)} ${platform.color}`)}\n` +
    `${STYLE.LAST_ITEM(`Login Date: ${safeText(userInfo.login_date || 'N/A')}`)}\n` +
    `${STYLE.SEPARATOR}\n\n` +
    
    `${EMOJI.BALANCE} *BALANCE INFORMATION*\n` +
    `${STYLE.ITEM(`Balance: ${safeText(balance !== null && balance !== undefined ? balance.toFixed(2) : 'N/A')} Ks`)}\n` +
    `${STYLE.ITEM(`Mode: ${safeText(modeText)}`)}\n` +
    `${STYLE.LAST_ITEM(`Status: ${safeText(freeModeStatus)}`)}\n` +
    `${STYLE.SEPARATOR}\n\n` +
    
    `${EMOJI.GAME} *GAME SETTINGS*\n` +
    `${STYLE.ITEM(`Game: ${safeText(gameType)}`)}\n` +
    `${STYLE.ITEM(`Type: ${safeText(betTypeText)}`)}\n` +
    `${STYLE.ITEM(`Strategy: ${safeText(strategy)}`)}\n` +
    `${STYLE.ITEM(`Betting: ${safeText(bettingStrategy)}`)}\n` +
    `${STYLE.LAST_ITEM(`Bet_Wragers: ${safeText(betWrager)}`)}\n` +
    `${STYLE.ITEM(`Silent Mode: ${safeText(silentStatus)}`)}\n` +
    `${STYLE.ITEM(`Time Ranges: ${safeText(timeRangeCount)}`)}\n` +
    `${STYLE.ITEM(`Forecast Win: ${forecastWin ? 'ON' : 'OFF'}`)}\n` +
    `${STYLE.SEPARATOR}\n\n` +
    
    `${EMOJI.STRATEGY} *STRATEGY CONFIGURATION*\n` +
    `${STYLE.ITEM(`BS Order: ${safeText(betOrder)}`)}\n` +
    `${STYLE.ITEM(`Profit Target: ${safeText(profitTarget ? profitTarget + ' Ks' : 'Not set')}`)}\n` +
    `${STYLE.ITEM(`Stop Loss: ${safeText(stopLoss ? stopLoss + ' Ks' : 'Not set')}`)}\n` +
    `${STYLE.ITEM(`SL Layer: ${safeText(slLayer ? slLayer + ' Layer' + slStatus : 'Not set')}`)}\n` +
    `${STYLE.LAST_ITEM(`Entry Layer: ${safeText(layerLimit.toString())} - ${safeText(entryLayerDesc)}`)}\n` +
    `${STYLE.SEPARATOR}\n\n` +
    `${EMOJI.START} *BOT STATUS*\n` +
    `${STYLE.LAST_ITEM(`Status: ${settings.running ? '🟢 ' : '🔴 '}${safeText(settings.running ? 'Running' : 'Stopped')}`)}\n\n` +
    `${STYLE.SEPARATOR}`;
  
  await sendMessageWithRetry(ctx, infoText, makeMainKeyboard(!!userSessions[userId], userId === ADMIN_ID));
}

const BASE_URL = PLATFORMS["6LOTTERY"].baseUrl;
const BOT_TOKEN = "8502114253:AAGM1-Px_57WB-xRD0FBOKwSiBrLsPcTK2w";
const ADMIN_ID = 6173861930;
const IGNORE_SSL = true;
const WIN_LOSE_CHECK_INTERVAL = 2;
const MAX_RESULT_WAIT_TIME = 60;
const MAX_BALANCE_RETRIES = 10;
const BALANCE_RETRY_DELAY = 5;
const BALANCE_API_TIMEOUT = 20000;
const BET_API_TIMEOUT = 30000;
const MAX_BET_RETRIES = 5;
const BET_RETRY_DELAY = 5;
const MAX_CONSECUTIVE_ERRORS = 10;
const MESSAGE_RATE_LIMIT_SECONDS = 10;
const MAX_TELEGRAM_RETRIES = 3;
const TELEGRAM_RETRY_DELAY = 2000;
const DEFAULT_BS_ORDER = "BSBBSBSSSB";
const SNIPER_NOTIFICATIONS = true;
const SNIPER_MAX_HITS = 2;
const SNIPER_MAX_LOSSES = 4;

const DEFAULT_DIGIT_MAPPING = {
  '0': 'B', '1': 'B', '2': 'S', '3': 'S', '4': 'B',
  '5': 'S', '6': 'S', '7': 'B', '8': 'B', '9': 'S',
  'DEFAULT': 'B'
};

const PLUTO_PATTERNS = {
  "0": "BSBS", "1": "BSBB", "2": "SBSS", "3": "BBSS",
  "4": "BSBB", "5": "BBBB", "6": "SBBS", "7": "BBBB",
  "8": "SSSS", "9": "SSBB"
};

function main() {
  loadAllowedUsers();
  loadUserSettings();
  loadFreeModeSetting();
  
  setInterval(() => {
    const previousState = freeModeEnabled;
    loadFreeModeSetting();
    if (previousState !== freeModeEnabled) {
      logging.info(`Free Mode state changed: ${previousState ? 'ENABLED' : 'DISABLED'} → ${freeModeEnabled ? 'ENABLED' : 'DISABLED'}`);
    }
  }, 30000);
  
  const bot = new Telegraf(BOT_TOKEN);
  
  bot.start(cmdStartHandler);
  bot.command('allow', cmdAllowHandler);
  bot.command('remove', cmdRemoveHandler);
  bot.command('showid', cmdShowIdHandler);
  bot.command('users', cmdUsersHandler);
  bot.command('send', cmdSendHandler);
  bot.command('enable', cmdEnableFreeMode);
  bot.command('disable', cmdDisableFreeMode);
  bot.command('freemode', cmdCheckFreeMode);
  bot.on('callback_query', callbackQueryHandler);
  bot.on('text', textMessageHandler);
  
  winLoseChecker(bot).catch(error => {
    logging.error(`Win/lose checker failed: ${error.message}`);
  });
  
  bot.launch().then(() => {
    logging.info('🚀 Bot started successfully');
  }).catch(error => {
    logging.error(`❌ Bot failed to start: ${error.message}`);
  });

  process.on('uncaughtException', (error) => {
    logging.error(`💥 Uncaught Exception: ${error.message}`);
    logging.error(error.stack);
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    logging.error(`⚠️ Unhandled Rejection at: ${promise}, reason: ${reason}`);
  });
  
  process.once('SIGINT', () => {
    saveUserSettings();
    bot.stop('SIGINT');
  });
  
  process.once('SIGTERM', () => {
    saveUserSettings();
    bot.stop('SIGTERM');
  });
}

if (require.main === module) {
  main();
}
