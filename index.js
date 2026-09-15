 // Config
const BASE_URLS = {"6Lottery": "https://6lotteryapi.com/api/webapi/","777BIGWIN": "https://api.bigwinqaz.com/api/webapi/"};
const DEFAULT_SITE = "6Lottery";
const BOT_TOKEN = "8911400810:AAGZmfeIXDRUJpUCa_zqD3pi5-Ug5qy1yOs";//*replace your bot token
const ADMIN_ID = 6546167490; //*replace
const IGNORE_SSL = true;
const WIN_LOSE_CHECK_INTERVAL = 2;
const MAX_RESULT_WAIT_TIME = 60;
const MAX_BALANCE_RETRIES = 10;
const BALANCE_RETRY_DELAY = 5;
const BALANCE_API_TIMEOUT = 20000;
const BET_API_TIMEOUT = 30000;
const MAX_BET_RETRIES = 3;
const BET_RETRY_DELAY = 2;
const MAX_CONSECUTIVE_ERRORS = 10;
const MAX_TELEGRAM_RETRIES = 3;
const TELEGRAM_RETRY_DELAY = 1000;



// Login configpai
const logging = {
  info: (msg) => console.log(`[INFO] ${new Date().toISOString()} - ${msg}`),
  warning: (msg) => console.log(`[WARN] ${new Date().toISOString()} - ${msg}`),
  error: (msg) => console.log(`[ERROR] ${new Date().toISOString()} - ${msg}`),
  debug: (msg) => console.log(`[DEBUG] ${new Date().toISOString()} - ${msg}`)
};

// Strategy
const DEFAULT_BS_ORDER = "BSBSBSBSBS";
const DREAM2_PATTERN = "BSBSBSBSBS";
const LEO_BIG_PATTERN = "BBSBBSBBSB";
const LEO_SMALL_PATTERN = "SSBSSBSSBS";

// dependencies
const { Telegraf, Markup } = require('telegraf');
const session = require('telegraf/session');
const crypto = require('crypto');
const fs = require('fs');
const https = require('https');
const moment = require('moment-timezone');
const { createCanvas, loadImage } = require('canvas');
const path = require('path');
const axios = require('axios');


// userstored
const userState = {};
const userTemp = {};
const userSessions = {};
let userSettings = {};
let userStats = {};
let userGameInfo = {};
const userPendingBets = {};
const userWaitingForResult = {};
const userSkippedBets = {};
const userShouldSkipNext = {};
const userBalanceWarnings = {};
const userSkipResultWait = {};
const userLast10Results = {};
const userLyzoRoundCount = {};
const userAILast10Results = {};
const userAIRoundCount = {};
const userStopInitiated = {};
const userSLSkipWaitingForWin = {};
const userAllResults = {};
const userPendingProfitStopMessages = {};
const userSelectedSite = {};
let userLastNumbers = [];
let allowedsixuserid = new Set();
let patterns = {};
let dreamPatterns = {};
let publicAccessEnabled = false;

let userManualBetHistory = {};

// Track users who /start the bot and logged in user
const activeUsers = new Set();

// Colors
const COLORS = {
  GREEN: { name: 'Green', id: 11, numbers: [1, 3, 7, 9] },
  VIOLET: { name: 'Violet', id: 12, numbers: [0, 5] },
  RED: { name: 'Red', id: 10, numbers: [2, 4, 6, 8] }
};

// Save user settings to JSON file
function saveUserSettings() {
  try {
    const settingsData = {
      userSettings: userSettings,
      userGameInfo: userGameInfo,
      userStats: userStats,
      userLastNumbers: userLastNumbers,
      userManualBetHistory: userManualBetHistory 
    };
    fs.writeFileSync('user_settings.json', JSON.stringify(settingsData, null, 4));
    logging.info("User settings saved to file");
  } catch (error) {
    logging.error(`Error saving user settings: ${error}`);
  }
}

// Load user settings from JSON file
function loadUserSettings() {
  try {
    if (fs.existsSync('user_settings.json')) {
      const data = JSON.parse(fs.readFileSync('user_settings.json', 'utf8'));
      userSettings = data.userSettings || {};
      userGameInfo = data.userGameInfo || {};
      userStats = data.userStats || {};
      userLastNumbers = data.userLastNumbers || {};
      userManualBetHistory = data.userManualBetHistory || {}; 
      logging.info("User settings loaded from file");
    } else {
      logging.info("user_settings.json not found. Starting with empty settings");
    }
  } catch (error) {
    logging.error(`Error loading user settings: ${error}`);
  }
}

async function createResultsTableImage(results, gameType, timeLeftInfo) {
  try {
    const canvas = createCanvas(800, 600);
    const ctx = canvas.getContext('2d');
    
    // Set background
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#0f3460');
    gradient.addColorStop(1, '#16213e');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // border
    ctx.strokeStyle = '#e94560';
    ctx.lineWidth = 3;
    ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
    
    // inner border
    ctx.strokeStyle = '#533483';
    ctx.lineWidth = 1;
    ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);
    
    // Title 
    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // title
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    ctx.fillText(`${gameType} - RESULTS`, canvas.width / 2, 50);
    
    // shadow
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    
    ctx.font = '15px Arial';
    ctx.fillStyle = '#ffd700'; 
    
    let yPos = 90;
    
    
    if (timeLeftInfo) {
      if (timeLeftInfo.currentIssue && timeLeftInfo.currentIssue.trim() !== "") {
        const displayIssue = timeLeftInfo.currentIssue.length > 5 ? 
                           timeLeftInfo.currentIssue.slice(-5) : 
                           timeLeftInfo.currentIssue;
        ctx.fillText(`Current Period: ${displayIssue}`, canvas.width / 2, yPos);
        yPos += 25;
      }
      
      if (timeLeftInfo.secondsLeft !== undefined && timeLeftInfo.secondsLeft !== null) {
        const secondsLeft = parseInt(timeLeftInfo.secondsLeft);
        if (secondsLeft > 0) {
          const minutes = Math.floor(secondsLeft / 60);
          const seconds = secondsLeft % 60;
          
          ctx.fillText(`Time Left: ${secondsLeft}s`, canvas.width / 2, yPos);
          yPos += 25;
        } else if (secondsLeft === 0) {
          ctx.fillText(`Time Left: 00:00 (0s)`, canvas.width / 2, yPos);
          yPos += 25;
        }
      } else if (timeLeftInfo.timeLeftDisplay && timeLeftInfo.timeLeftDisplay.trim() !== "") {
        ctx.fillText(`Time Left: ${timeLeftInfo.timeLeftDisplay}`, canvas.width / 2, yPos);
        yPos += 25;
      }
    }
    
    ctx.font = 'bold 22px Arial';
    ctx.fillStyle = '#ffd700';
    const headerY = yPos + 10; 
    const colWidth = canvas.width / 4;
    
    ctx.fillStyle = 'rgba(233, 69, 96, 0.3)';
    ctx.fillRect(40, headerY - 25, canvas.width - 80, 40);
    
    ctx.fillStyle = '#ffd700';
    ctx.fillText('Period', colWidth * 0.5, headerY);
    ctx.fillText('Number', colWidth * 1.5, headerY);
    ctx.fillText('Big/Small', colWidth * 2.5, headerY);
    ctx.fillText('Color', colWidth * 3.5, headerY);
    
    ctx.font = '20px Arial';
    yPos = headerY + 50;
    
    results.slice(0, 10).forEach((result, index) => {
      const number = result.number || "0";
      const period = result.issueNumber ? result.issueNumber.slice(-5) : "N/A";
      const colorNum = parseInt(number) % 10;
      
      if (index % 2 === 0) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.fillRect(40, yPos - 15, canvas.width - 80, 30);
      }
      
      let colorDisplay = "";
      let colorEmoji = "";
      if (COLORS.GREEN.numbers.includes(colorNum)) {
        colorDisplay = "GREEN";
        colorEmoji = "🟢";
      } else if (COLORS.VIOLET.numbers.includes(colorNum)) {
        colorDisplay = "VIOLET";
        colorEmoji = "🟣";
      } else if (COLORS.RED.numbers.includes(colorNum)) {
        colorDisplay = "RED";
        colorEmoji = "🔴";
      }
      
      // BIG/SMALL
      const isBig = colorNum >= 5;
      const bigSmallText = isBig ? 'BIG' : 'SMALL';
      
      ctx.fillStyle = '#ffffff';
      ctx.fillText(period, colWidth * 0.5, yPos);
      ctx.fillText(number, colWidth * 1.5, yPos);
      ctx.fillText(`${bigSmallText}`, colWidth * 2.5, yPos);
      ctx.fillText(`${colorDisplay}`, colWidth * 3.5, yPos);
      
      yPos += 35;
    });
    
    // footer
    ctx.font = '16px Arial';
    ctx.fillStyle = '#888888';
    ctx.fillText('Click "Results" again to refresh', canvas.width / 2, canvas.height - 30);
    
    return canvas.toBuffer('image/png');
  } catch (error) {
    logging.error(`Error creating results table image: ${error.message}`);
    return null;
  }
}

async function createRecentBetTableImage(bets, userId) {
  try {
    const canvas = createCanvas(800, 600);
    const ctx = canvas.getContext('2d');
    
    // Set background
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#0f3460');
    gradient.addColorStop(1, '#16213e');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // border
    ctx.strokeStyle = '#ff6b6b';
    ctx.lineWidth = 3;
    ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
    
    // inner border
    ctx.strokeStyle = '#533483';
    ctx.lineWidth = 1;
    ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);
    
    // Title
    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // main title
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    ctx.fillText('RECENT MANUAL BETS', canvas.width / 2, 50);
    
    // shadow
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    
    let totalWins = 0;
    let totalLosses = 0;
    let totalProfit = 0;
    
    bets.forEach(bet => {
      if (bet.result === "WIN") {
        totalWins++;
        totalProfit += bet.winAmount || 0;
      } else if (bet.result === "LOSE") {
        totalLosses++;
        totalProfit -= bet.amount || 0;
      }
    });
    
let mostRecentBalance = 0;
if (bets.length > 0 && bets[0].balance !== undefined) {
  mostRecentBalance = bets[0].balance;
}

ctx.font = '20px Arial';
ctx.fillStyle = '#ffd700';
ctx.fillText(`Summary: ${totalWins}W ${totalLosses}L | Profit: ${totalProfit >= 0 ? '+' : ''}${Math.round(totalProfit)} Ks | Current Balance: ${Math.round(mostRecentBalance)} Ks`, canvas.width / 2, 110);
    ctx.font = 'bold 22px Arial';
    ctx.fillStyle = '#ffd700';
    const headerY = 170;
    const colWidth = canvas.width / 3;
    
    ctx.fillStyle = 'rgba(255, 107, 107, 0.3)';
    ctx.fillRect(40, headerY - 25, canvas.width - 80, 40);
    
    ctx.fillStyle = '#ffd700';
    ctx.fillText('Period', colWidth * 0.5, headerY);
    ctx.fillText('Result', colWidth * 1.5, headerY);
    ctx.fillText('Amount', colWidth * 2.5, headerY);
    
    ctx.font = '20px Arial';
    let yPos = headerY + 50;
    
    bets.slice(0, 10).forEach((bet, index) => {
      const period = bet.period ? bet.period.slice(-5) : "N/A";
      const result = bet.result || "PENDING";
      const amount = bet.amount || 0;
      const winAmount = bet.winAmount || 0;
      
      if (index % 2 === 0) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.fillRect(40, yPos - 15, canvas.width - 80, 30);
      }
      
      let resultColor = '#ffa500'; 
      let resultText = result;
      let resultEmoji = '⏳';
      
      if (result === "WIN") {
        resultColor = '#00ff00';
        resultText = 'WIN';
        resultEmoji = '✅';
      } else if (result === "LOSE") {
        resultColor = '#ff4444';
        resultText = 'LOSE';
        resultEmoji = '❌';
      }
      
      let amountText = "";
      if (result === "WIN") {
        amountText = `+${Math.round(winAmount)} Ks`;
      } else if (result === "LOSE") {
        amountText = `-${amount} Ks`;
      } else {
        amountText = `${amount} Ks`;
      }
      
      ctx.fillStyle = '#ffffff';
      ctx.fillText(period, colWidth * 0.5, yPos);
      
      ctx.fillStyle = resultColor;
      ctx.fillText(`${resultText}`, colWidth * 1.5, yPos);
      
      ctx.fillStyle = result === "WIN" ? '#00ff00' : (result === "LOSE" ? '#ff4444' : '#ffffff');
      ctx.fillText(amountText, colWidth * 2.5, yPos);
      
      yPos += 35;
    });
    
    //  footer
    ctx.font = '16px Arial';
    ctx.fillStyle = '#888888';
    ctx.fillText('Last 10 manual bets shown', canvas.width / 2, canvas.height - 30);
    
    return canvas.toBuffer('image/png');
  } catch (error) {
    logging.error(`Error creating recent bet table image: ${error.message}`);
    return null;
  }
}

async function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const agent = new https.Agent({ rejectUnauthorized: !IGNORE_SSL });
    
    const defaultOptions = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        'User-Agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36',
        'Connection': 'Keep-Alive'
      },
      timeout: 15000
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
      allowedsixuserid = new Set(data.allowed_ids || []);
      logging.info(`Loaded ${allowedsixuserid.size} users`);
    } else {
      logging.warning("users_6lottery.json not found. Starting new");
      allowedsixuserid = new Set();
    }
  } catch (error) {
    logging.error(`Error loading users_6lottery.json: ${error}`);
    allowedsixuserid = new Set();
  }
}

function saveAllowedUsers() {
  try {
    fs.writeFileSync('users_6lottery.json', JSON.stringify({ 
      allowed_ids: Array.from(allowedsixuserid) 
    }, null, 4));
    logging.info(`Saved ${allowedsixuserid.size} users`);
  } catch (error) {
    logging.error(`Error saving user list: ${error}`);
  }
}

function normalizeText(text) {
  return text.normalize('NFKC').trim();
}

// Generate Signature
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
      "G": 11,  // Green
      "V": 12,  // Violet  
      "R": 10   // Red
    };
  } else {
    return { 
      "B": 13,  // Big
      "S": 14   // Small
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
    case 'G': return '🟢 GREEN';
    case 'V': return '🟣 VIOLET';
    case 'R': return '🔴 RED';
    default: return 'Unknown';
  }
}

// patterns load for Lyzo strategy
function loadPatterns() {
  try {
    if (fs.existsSync('patterns.json')) {
      const data = JSON.parse(fs.readFileSync('patterns.json', 'utf8'));
      patterns = data;
      logging.info(`Loaded ${Object.keys(patterns).length} patterns for Lyzo strategy`);
    } else {
      logging.warning("patterns.json not found. Lyzo strategy will not work properly.");
      patterns = {};
    }
  } catch (error) {
    logging.error(`Error loading patterns.json: ${error}`);
    patterns = {};
  }
}

// patterns load for DREAM strategy
function loadDreamPatterns() {
  try {
    if (fs.existsSync('dream.json')) {
      const data = JSON.parse(fs.readFileSync('dream.json', 'utf8'));
      dreamPatterns = data;
      logging.info(`Loaded ${Object.keys(dreamPatterns).length} patterns for DREAM strategy`);
    } else {
      logging.warning("dream.json not found. DREAM strategy will not work properly.");
      dreamPatterns = {
        "0": "SBBSBSSBBS",
        "1": "BBSBSBSBBS",
        "2": "SBSBBSBSBB",
        "3": "BSBSBSSBSB",
        "4": "SBBSBSBBSS",
        "5": "BSSBSBBSBS",
        "6": "BSBSSBSBSB",
        "7": "SBSBSBSSBB",
        "8": "BSBBSBSBSB",
        "9": "SBSBBSSBSB"
      };
    }
  } catch (error) {
    logging.error(`Error loading dream.json: ${error}`);
    dreamPatterns = {
      "0": "SBBSBSSBBS",
      "1": "BBSBSBSBBS",
      "2": "SBSBBSBSBB",
      "3": "BSBSBSSBSB",
      "4": "SBBSBSBBSS",
      "5": "BSSBSBBSBS",
      "6": "BSBSSBSBSB",
      "7": "SBSBSBSSBB",
      "8": "BSBBSBSBSB",
      "9": "SBSBBSSBSB"
    };
  }
}

async function loadImageFromUrl(url) {
  try {
    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'arraybuffer'
    });
    
    const image = await loadImage(Buffer.from(response.data));
    return image;
  } catch (error) {
    logging.error(`Error loading image from URL ${url}: ${error.message}`);
    throw error;
  }
}

// Images URL
const PROFIT_TEMPLATE_URL = "https://i.ibb.co/VYvNh7H8/PROFIT-TARGET.jpg";
const LOSS_TEMPLATE_URL = "https://i.ibb.co/Lz2jXZT6/STOP-LOSS.jpg";

const DEFAULT_COLORS = {
    startedAmount: '#FFD700',  
    finalBalance: '#FFD700',   
    positiveProfit: '#00FF00', 
    negativeProfit: '#FF0000' 
};

// Text positions
const PERFECT_SETTINGS = {
    fontSize: 60,
    fontFamily: 'Arial',
    isBold: true,
    textAlign: 'right',
    shadow: {
        enabled: true,
        color: '#000000',
        blur: 2,
        offsetX: 1,
        offsetY: 1
    },
    positions: {
        started: { 
            x: 0.900,
            y: 0.248
        },
        profit: { 
            x: 0.900,
            y: 0.537
        },
        balance: { 
            x: 0.900,
            y: 0.825
        }
    },
    offsets: {
        started: { x: -20, y: 0 },
        profit: { x: -20, y: 0 },
        balance: { x: -20, y: 0 }
    }
};

function getProfitColor(profitText) {
    const cleanText = profitText.trim();
    const firstChar = cleanText.charAt(0);
    
    if (firstChar === '+') {
        return DEFAULT_COLORS.positiveProfit;
    } else if (firstChar === '-') {
        return DEFAULT_COLORS.negativeProfit;
    } else {
        const numMatch = cleanText.match(/[-+]?\d[\d,.]*/);
        if (numMatch) {
            const num = parseFloat(numMatch[0].replace(/,/g, ''));
            return isNaN(num) ? DEFAULT_COLORS.startedAmount : 
                   num >= 0 ? DEFAULT_COLORS.positiveProfit : DEFAULT_COLORS.negativeProfit;
        } else {
            return DEFAULT_COLORS.startedAmount;
        }
    }
}

// Function to create edited image
async function createEditedImageFromUrl(templateUrl, startedAmount, profit, finalBalance) {
  try {
    const image = await loadImageFromUrl(templateUrl);
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');
    
    ctx.drawImage(image, 0, 0);
    
    const fontStyle = (PERFECT_SETTINGS.isBold ? 'bold ' : '') + PERFECT_SETTINGS.fontSize + 'px ' + PERFECT_SETTINGS.fontFamily;
    ctx.font = fontStyle;
    ctx.textAlign = PERFECT_SETTINGS.textAlign;
    ctx.textBaseline = 'middle';
    
    const texts = [
      { 
        text: startedAmount, 
        type: 'started',
        color: DEFAULT_COLORS.startedAmount
      },
      { 
        text: profit, 
        type: 'profit',
        color: getProfitColor(profit)
      },
      { 
        text: finalBalance, 
        type: 'balance',
        color: DEFAULT_COLORS.finalBalance
      }
    ];
    
    texts.forEach(item => {
      const pos = PERFECT_SETTINGS.positions[item.type];
      const offset = PERFECT_SETTINGS.offsets[item.type];
      const x = (image.width * pos.x) + offset.x;
      const y = (image.height * pos.y) + offset.y;
      
      if (PERFECT_SETTINGS.shadow.enabled) {
        ctx.fillStyle = PERFECT_SETTINGS.shadow.color;
        ctx.fillText(item.text, 
          x + PERFECT_SETTINGS.shadow.offsetX, 
          y + PERFECT_SETTINGS.shadow.offsetY);
      }
      
      ctx.fillStyle = item.color;
      ctx.fillText(item.text, x, y);
    });
    
    return canvas.toBuffer('image/png');
  } catch (error) {
    logging.error(`Error creating edited image from URL: ${error.message}`);
    return null;
  }
}

async function sendProfitTargetImage(userId, bot, targetProfit, currentProfit, startAmount, finalBalance) {
  try {
    const startedAmount = `${parseFloat(startAmount).toFixed(2)} Ks`;
    const profit = `+${parseFloat(currentProfit).toFixed(2)} Ks`;
    const balance = `${parseFloat(finalBalance).toFixed(2)} Ks`;
    
    const imageBuffer = await createEditedImageFromUrl(PROFIT_TEMPLATE_URL, startedAmount, profit, balance);
    
    if (imageBuffer) {
      const caption = `🔺 PROFIT TARGET REACHED\n\n` +
                    `🏆 Target: ${targetProfit} Ks\n` +
                    `💰 Received: +${parseFloat(currentProfit).toFixed(2)} Ks\n` +
                    `⛷ Started Amount: ${parseFloat(startAmount).toFixed(2)} Ks\n` +
                    `💳 Final Balance: ${parseFloat(finalBalance).toFixed(2)} Ks`;
      
      await bot.telegram.sendPhoto(userId, 
        { source: imageBuffer }, 
        {
          caption: caption,
          reply_markup: makeReactivateInlineKeyboard().reply_markup
        }
      );
      
      return true;
    }
  } catch (error) {
    logging.error(`Error sending profit target image from URL: ${error.message}`);
  }
  return false;
}

// send stop loss limit hit image
async function sendStopLossImage(userId, bot, stopLossLimit, currentLoss, startAmount, finalBalance) {
  try {
    const startedAmount = `${parseFloat(startAmount).toFixed(2)} Ks`;
    const loss = `-${Math.abs(parseFloat(currentLoss)).toFixed(2)} Ks`;
    const balance = `${parseFloat(finalBalance).toFixed(2)} Ks`;
    
    const imageBuffer = await createEditedImageFromUrl(LOSS_TEMPLATE_URL, startedAmount, loss, balance);
    
    if (imageBuffer) {
      const caption = `🔻 STOP LOSS LIMIT HIT\n\n` +
                    `⚠️ SL SET: ${stopLossLimit} Ks\n` +
                    `📉 Loss: -${Math.abs(parseFloat(currentLoss)).toFixed(2)} Ks\n` +
                    `⛷ Started Amount: ${parseFloat(startAmount).toFixed(2)} Ks\n` +
                    `💳 Final Balance: ${parseFloat(finalBalance).toFixed(2)} Ks`;
      
      await bot.telegram.sendPhoto(userId, 
        { source: imageBuffer }, 
        {
          caption: caption,
          reply_markup: makeReactivateInlineKeyboard().reply_markup
        }
      );
      
      return true;
    }
  } catch (error) {
    logging.error(`Error sending stop loss image from URL: ${error.message}`);
  }
  return false;
}

// Babio Strategy
async function getBabioPrediction(userId, gameType) {
  try {
    if (!userAILast10Results[userId]) {
      userAILast10Results[userId] = [];
    }
    if (!userAIRoundCount[userId]) {
      userAIRoundCount[userId] = 0;
    }
    
    userAIRoundCount[userId]++;
    
    if (userAILast10Results[userId].length === 0) {
      logging.info(`Babio: No results available, defaulting to B`);
      return { result: 'B', percent: '50.0' };
    }
    
    const availableResults = userAILast10Results[userId].slice(-10);
    logging.debug(`Babio: Available results: ${availableResults.join(', ')}`);
    
    const settings = userSettings[userId] || {};
    
    if (!settings.babio_state) {
      settings.babio_state = {
        current_position: 8,
        last_result: null
      };
    }
    
    const babioState = settings.babio_state;
    let prediction;
    
    if (availableResults.length >= 8) {
      prediction = availableResults[7];
      logging.info(`Babio: Using 8th position result: ${prediction}`);
    } else if (availableResults.length >= 5) {
      prediction = availableResults[4];
      logging.info(`Babio: Using 5th position result: ${prediction}`);
    } else {
      prediction = availableResults[availableResults.length - 1];
      logging.info(`Babio: Using last result: ${prediction}`);
    }
    
    return { result: prediction, percent: 'N/A' };
  } catch (error) {
    logging.error(`Error getting Babio prediction: ${error}`);
    return { result: 'B', percent: '50.0' };
  }
}

// ALINKAR Strategy 
function getAlinkarPrediction(userId) {
  try {
    if (!userAllResults[userId]) {
      userAllResults[userId] = [];
    }
    
    if (userAllResults[userId].length < 1) {
      const randomPrediction = Math.random() < 0.5 ? 'B' : 'S';
      logging.info(`ALINKAR: First bet is random (${randomPrediction})`);
      return randomPrediction;
    }
    
    const lastResults = userAllResults[userId].slice(-5);
    logging.debug(`ALINKAR: Last results: ${lastResults.join(', ')}`);
    
    let consecutiveCount = 1;
    let lastOutcome = lastResults[lastResults.length - 1];
    
    for (let i = lastResults.length - 2; i >= 0; i--) {
      if (lastResults[i] === lastOutcome) {
        consecutiveCount++;
      } else {
        break;
      }
    }
    
    logging.info(`ALINKAR: ${consecutiveCount} consecutive ${lastOutcome} outcomes`);
    
    let prediction;
    if (consecutiveCount === 1) {
      // တစ်ခါလွဲဘက်ကန်
      prediction = lastOutcome === 'B' ? 'S' : 'B';
      logging.info(`ALINKAR: Betting opposite (${prediction}) to single ${lastOutcome}`);
    } else if (consecutiveCount === 2) {
      // နှစ်ခါလာလိုက်လောင်း
      prediction = lastOutcome;
      logging.info(`ALINKAR: Betting follow (${prediction}) to double ${lastOutcome}`);
    } else if (consecutiveCount === 3) {
      // သုံးခါလာဘက်ကန်
      prediction = lastOutcome === 'B' ? 'S' : 'B';
      logging.info(`ALINKAR: Betting opposite (${prediction}) to triple ${lastOutcome}`);
    } else {
      // လေးခါနဲ့လေးခါအထက်လိုက်လောင်း
      prediction = lastOutcome;
      logging.info(`ALINKAR: Betting follow (${prediction}) to ${consecutiveCount}+ ${lastOutcome}`);
    }
    
    return prediction;
  } catch (error) {
    logging.error(`Error getting ALINKAR prediction: ${error}`);
    const randomPrediction = Math.random() < 0.5 ? 'B' : 'S';
    return randomPrediction;
  }
}

//  MAY BARANI
async function getMayBaraniPrediction(userId) {
  try {
    if (!userAllResults[userId]) {
      userAllResults[userId] = [];
    }
    
    if (userAllResults[userId].length === 0) {
      logging.info(`MAY BARANI: No results available, defaulting to B`);
      return 'B';
    }
    
    if (userAllResults[userId].length < 5) {
      const lastResult = userAllResults[userId][userAllResults[userId].length - 1];
      logging.info(`MAY BARANI: Not enough results (${userAllResults[userId].length}), using last result: ${lastResult}`);
      return lastResult;
    }
    
    const latest5Results = userAllResults[userId].slice(-5);
    logging.debug(`MAY BARANI: Latest 5 results: ${latest5Results.join(', ')}`);

    const numericResults = latest5Results.map(result => result === 'B' ? 7 : 2);
    
    // Sum the latest 5 results
    const sum = numericResults.reduce((acc, val) => acc + val, 0);
    logging.info(`MAY BARANI: Sum of latest 5 results: ${sum}`);
    
    let remainingSum = 0;
    if (userAllResults[userId].length > 5) {
      const remainingResults = userAllResults[userId].slice(0, -5);
      const numericRemaining = remainingResults.map(result => result === 'B' ? 7 : 2);
      remainingSum = numericRemaining.reduce((acc, val) => acc + val, 0);
      logging.info(`MAY BARANI: Sum of remaining results: ${remainingSum}`);
    }
    
    // Calculate final result
    let finalResult = sum - remainingSum;
    logging.info(`MAY BARANI: Final calculation: ${sum} - ${remainingSum} = ${finalResult}`);
    
    finalResult = Math.abs(finalResult);
    logging.info(`MAY BARANI: Absolute value: ${finalResult}`);
    
    if (finalResult >= 10) {
      finalResult = finalResult % 10;
      logging.info(`MAY BARANI: Last digit of 2-digit number: ${finalResult}`);
    }
    
    let prediction;
    const isTwoDigitCalculation = (sum - remainingSum) >= 10;
    
    if (isTwoDigitCalculation) {
      if (finalResult >= 5) {
        prediction = 'S'; 
        logging.info(`MAY BARANI: Two-digit result ${finalResult} >= 5, betting Small (opposite)`);
      } else {
        prediction = 'B';
        logging.info(`MAY BARANI: Two-digit result ${finalResult} < 5, betting Big (opposite)`);
      }
    } else {

      if (finalResult >= 5) {
        prediction = 'B';
        logging.info(`MAY BARANI: Single-digit result ${finalResult} >= 5, betting Big (same)`);
      } else {
        prediction = 'S';
        logging.info(`MAY BARANI: Single-digit result ${finalResult} < 5, betting Small (same)`);
      }
    }
    
    return prediction;
  } catch (error) {
    logging.error(`Error getting MAY BARANI prediction: ${error}`);
    return 'B';
  }
}

// AI Prediction strategy 
async function getAIPrediction(userId, gameType) {
  try {
    if (!userAILast10Results[userId]) {
      userAILast10Results[userId] = [];
    }
    if (!userAIRoundCount[userId]) {
      userAIRoundCount[userId] = 0;
    }
    
    userAIRoundCount[userId]++;
    
    if (userAILast10Results[userId].length === 0) {
      logging.info(`AI Prediction: No results available, defaulting to B`);
      return { result: 'B', percent: '50.0' };
    }
    
    const availableResults = userAILast10Results[userId].slice(-10);
    logging.debug(`AI Prediction: Available results: ${availableResults.join(', ')}`);
    
    if (availableResults.length >= 3) {
      const lastThree = availableResults.slice(-3).join('');
      
      if (lastThree === 'BBB') {
        logging.info(`AI Prediction: S (based on BBB pattern)`);
        return { result: 'S', percent: '70.0' };
      } else if (lastThree === 'SSS') {
        logging.info(`AI Prediction: B (based on SSS pattern)`);
        return { result: 'B', percent: '70.0' };
      }
    }
    
    const counts = { B: 0, S: 0 };
    for (const result of availableResults) {
      counts[result]++;
    }
    
    let prediction;
    if (counts.B > counts.S) {
      prediction = 'B';
      logging.info(`AI Prediction: B (B appeared ${counts.B} times, S appeared ${counts.S} times)`);
    } else if (counts.S > counts.B) {
      prediction = 'S';
      logging.info(`AI Prediction: S (S appeared ${counts.S} times, B appeared ${counts.B} times)`);
    } else {
      prediction = availableResults[availableResults.length - 1];
      logging.info(`AI Prediction: Using last result (${prediction}) due to tie (B: ${counts.B}, S: ${counts.S})`);
    }
    
    const diff = Math.abs(counts.B - counts.S);
    const confidence = 50 + (diff * 5);
    const percent = Math.min(confidence, 95).toFixed(1);
    
    return { result: prediction, percent };
  } catch (error) {
    logging.error(`Error getting AI prediction: ${error}`);
    return { result: 'B', percent: '50.0' };
  }
}

// Lyzo strategy
async function getLyzoPrediction(userId, gameType) {
  try {
    if (Object.keys(patterns).length === 0) {
      logging.warning("No patterns loaded for Lyzo strategy");
    
      if (!userLast10Results[userId] || userLast10Results[userId].length === 0) {
        logging.info(`Lyzo: No results available, defaulting to B`);
        return { result: 'B', percent: '50.0' };
      }
      const lastResult = userLast10Results[userId][userLast10Results[userId].length - 1];
      logging.info(`Lyzo: Using last result as prediction: ${lastResult}`);
      return { result: lastResult, percent: '50.0' };
    }
  
    if (!userLast10Results[userId]) {
      userLast10Results[userId] = [];
    }
    if (!userLyzoRoundCount[userId]) {
      userLyzoRoundCount[userId] = 0;
    }
    
    userLyzoRoundCount[userId]++;
    
    if (userLast10Results[userId].length < 10) {
      if (userLast10Results[userId].length > 0) {
        const lastResult = userLast10Results[userId][userLast10Results[userId].length - 1];
        logging.info(`Lyzo: Not enough results (${userLast10Results[userId].length}), using last result: ${lastResult}`);
        return { result: lastResult, percent: '50.0' };
      } else {
        logging.info(`Lyzo: No results available, defaulting to B`);
        return { result: 'B', percent: '50.0' };
      }
    }
    
    const lastTenResults = userLast10Results[userId].slice(-10);
    logging.debug(`Lyzo Prediction: Last 10 results: ${lastTenResults.join(', ')}`);
    
    const patternString = lastTenResults.join('');
    logging.debug(`Lyzo Prediction: Pattern string: ${patternString}`);
    
    const prediction = patterns[patternString];
    
    if (prediction) {
      logging.info(`Lyzo Prediction: ${prediction} (matched pattern: ${patternString})`);
      return { result: prediction, percent: 'N/A' };
    } else {
      const counts = { B: 0, S: 0 };
      for (const result of lastTenResults) {
        counts[result]++;
      }
      
      let deterministicPrediction;
      if (counts.B > counts.S) {
        deterministicPrediction = 'B';
      } else if (counts.S > counts.B) {
        deterministicPrediction = 'S';
      } else {
        deterministicPrediction = lastTenResults[lastTenResults.length - 1];
      }
      
      logging.info(`Lyzo Prediction: ${deterministicPrediction} (no pattern matched, using deterministic approach)`);
      return { result: deterministicPrediction, percent: '50.0' };
    }
  } catch (error) {
    logging.error(`Error getting Lyzo prediction: ${error}`);
    return { result: 'B', percent: '50.0' };
  }
}

// BEATRIX Strategy
async function getBeatrixPrediction(userId, gameType) {
  try {
    if (!userSettings[userId]) {
      userSettings[userId] = {};
    }
    
    if (!userSettings[userId].beatrix_state) {
      userSettings[userId].beatrix_state = {
        waiting_for_seven: true,
        last_period_with_seven: null
      };
    }
    
    const beatrixState = userSettings[userId].beatrix_state;
    
    if (beatrixState.waiting_for_seven) {
      logging.info(`BEATRIX: Waiting for a result of 7`);
      return { result: null, skip: true };
    }
    
    if (beatrixState.last_period_with_seven) {
      const lastDigit = parseInt(beatrixState.last_period_with_seven.slice(-1));
      
      let prediction;
      if (lastDigit === 0 || lastDigit === 1 || lastDigit === 2 || lastDigit === 3 || lastDigit === 7) {
        prediction = 'S'; 
      } else {
        prediction = 'B';
      }
      
      logging.info(`BEATRIX: Period ${beatrixState.last_period_with_seven} ends with ${lastDigit}, predicting ${prediction === 'B' ? 'BIG' : 'SMALL'}`);
      return { result: prediction, skip: false };
    }
    
    // wait for 7
    logging.info(`BEATRIX: No period with 7 found, waiting`);
    return { result: null, skip: true };
  } catch (error) {
    logging.error(`Error getting BEATRIX prediction: ${error}`);
    return { result: null, skip: true };
  }
}

// TREND FOLLOW Strategy(Color Betting)
async function getColorTrendFollowPrediction(userId) {
  try {
    if (!userSettings[userId]) {
      userSettings[userId] = {};
    }
    
    if (!userSettings[userId].color_trend_state) {
      userSettings[userId].color_trend_state = {
        last_result: null
      };
    }
    
    const trendState = userSettings[userId].color_trend_state;
    
    if (trendState.last_result === null) {
      const colors = ['G', 'V', 'R'];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];
      logging.info(`Color Trend Follow: First bet is random (${randomColor})`);
      return randomColor;
    } else {
      logging.info(`Color Trend Follow: Following last result (${trendState.last_result})`);
      return trendState.last_result;
    }
  } catch (error) {
    logging.error(`Error getting Color Trend Follow prediction: ${error}`);
    return 'G';
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
  
  logging.debug(`Calculating bet amount - Strategy: ${bettingStrategy}, Bet Wrager: [${betSizes.join(', ')}]`);
  
  if (bettingStrategy === "D'Alembert") {
    if (betSizes.length > 1) {
      throw new Error("D'Alembert strategy requires only ONE bet wrager");
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
      // After win, move
      if (actualIndex > 0) {
        settings.custom_index = actualIndex - 1;
      } else {
        settings.custom_index = 0;
      }
      logging.info(`Custom: Win - Move to index ${settings.custom_index}`);
    } else {
      // After loss, move 
      if (actualIndex < betSizes.length - 1) {
        settings.custom_index = actualIndex + 1;
      } else {
        settings.custom_index = betSizes.length - 1;
      }
      logging.info(`Custom: Loss - Move to index ${settings.custom_index}`);
    }
  }
}

// error handle 
async function loginRequest(phone, password, site = "6Lottery") {
  const baseUrl = BASE_URLS[site] || BASE_URLS["6Lottery"];
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
    logging.error(`Login error for ${site}: ${error.message}`);
    return { response: { error: error.message }, session: null };
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
  body.signature = generateSignature(body).toUpperCase();
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
  const apiGameType = betType === "COLOR" ? 0 : 2;
  
  if (!selectType || isNaN(selectType)) {
    logging.error(`Invalid selectType: ${selectType} for user ${userId}`);
    return { error: "Invalid bet selection type" };
  }
  
  const betBody = {
    "typeId": typeId,
    "issuenumber": issueNumber,
    "language": 7,
    "gameType": apiGameType,
    "amount": unitAmount,
    "betCount": betCount,
    "selectType": parseInt(selectType),
    "random": "f9ec46840a374a65bb2abad44dfc4dc3"
  };
    betBody.signature = generateSignature(betBody).toUpperCase();
  betBody.timestamp = Math.floor(Date.now() / 1000);
  
  logging.info(`🔧 Bet request details for user ${userId}:`);
  logging.info(`  Game Type: ${gameType}, Bet Type: ${betType}`);
  logging.info(`  API endpoint: ${endpoint}, typeId: ${typeId}`);
  logging.info(`  API gameType: ${apiGameType} (${apiGameType === 0 ? 'COLOR' : 'BIG/SMALL'})`);
  logging.info(`  Issue: ${issueNumber}, SelectType: ${selectType}`);
  logging.info(`  Amount: ${unitAmount * betCount} Ks, BetCount: ${betCount}`);
  logging.info(`  Full request body: ${JSON.stringify(betBody)}`);
  
  for (let attempt = 0; attempt < MAX_BET_RETRIES; attempt++) {
    try {
      const response = await session.post(endpoint, betBody);
      const res = response.data;
      
      logging.info(`📤 Bet request response for user ${userId}:`);
      logging.info(`  Code: ${res.code}, Message: ${res.msg}`);
      
      if (res.code === 0) {
        logging.info(`✅ Bet placed successfully for user ${userId}`);
      } else {
        logging.error(`❌ Bet failed for user ${userId}: ${res.msg || 'Unknown error'}`);
      }
      
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

// TRX
async function getTRXGameResultsNew(session, gameType = "TRX") {
  try {
    const url = "https://draw.ar-lottery01.com/TrxWinGo/TrxWinGo_1M/GetHistoryIssuePage.json";
    
    const timestamp = Date.now();
    const fullUrl = `${url}?ts=${timestamp}`;
    
    logging.info(`Fetching TRX results from: ${fullUrl}`);
    
    const response = await makeRequest(fullUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'User-Agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36',
        'Connection': 'Keep-Alive'
      }
    });
    
    const data = response.data;
    
    logging.info(`TRX API Response received: ${JSON.stringify(data).substring(0, 200)}...`);
    
    if (data && data.list) {
      logging.info(`Successfully fetched ${data.list.length} TRX results from direct API`);
      return { code: 0, data: { list: data.list } };
    } else if (data && data.data && data.data.list) {
      logging.info(`Successfully fetched ${data.data.list.length} TRX results from structured API`);
      return { code: 0, data: data.data };
    } else {
      logging.error(`Failed to get TRX results: Invalid response structure`);
      return { code: -1, msg: "Invalid response structure from TRX API" };
    }
  } catch (error) {
    logging.error(`Error getting TRX results from direct API: ${error.message}`);
    
    try {
      logging.info("Trying fallback TRX API method...");
      const body = {
        "pageNo": 1,
        "pageSize": 10,
        "gameCode": "TrxWinGo_1M",
        "language": 7,
        "random": "367817611041"
      };
      
      body.signature = generateSignature(body).toUpperCase();
      body.timestamp = Math.floor(Date.now() / 1000);
      
      const response = await session.post("GetHistoryIssuePage", body);
      const data = response.data;
      
      if (data && data.code === 0 && data.data && data.data.list) {
        logging.info(`Successfully fetched ${data.data.list.length} TRX results from fallback API`);
        return data;
      } else {
        logging.error(`Fallback TRX API also failed: ${data?.msg || 'Unknown error'}`);
        return data;
      }
    } catch (fallbackError) {
      logging.error(`Both TRX API methods failed: ${fallbackError.message}`);
      return { error: fallbackError.message };
    }
  }
}

// get recent bets
async function getRecentBets(userId, session) {
  try {
    const body = {
      "pageNo": 1,
      "pageSize": 10,
      "language": 7,
      "random": "71ebd56cff7d4679971c482807c33f6f"
    };
    
    body.signature = generateSignature(body).toUpperCase();
    body.timestamp = Math.floor(Date.now() / 1000);
    
    const response = await session.post("GetBetRecord", body);
    const data = response.data;
    
    if (data && data.code === 0 && data.data && data.data.list) {
      return data.data.list;
    }
    return [];
  } catch (error) {
    logging.error(`Error getting recent bets: ${error.message}`);
    return [];
  }
}

function makeAmountKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("100", "amount:100"),
      Markup.button.callback("1000", "amount:1000"),
    ],
    [
      Markup.button.callback("10000", "amount:10000"),
      Markup.button.callback("100000", "amount:100000")
    ]
  ]);
}

function makeMultiplierKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("×1", "multiplier:1"),
      Markup.button.callback("×5", "multiplier:5"), 
      Markup.button.callback("×10", "multiplier:10")
      
    ],
    [
      Markup.button.callback("×20", "multiplier:20"),
      Markup.button.callback("×50", "multiplier:50"),
      Markup.button.callback("×100", "multiplier:100"),

    ],
    [
            Markup.button.callback("Custom", "multiplier:custom")
    ]
  ]);
}

function makeBetConfirmationKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("✅ Confirm Bet", "confirm_bet:yes"),
      Markup.button.callback("❌ Cancel", "confirm_bet:no")
    ]
  ]);
}

function makeReactivateInlineKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("🔄 Re-activate", "reactivate:yes")]
  ]);
}

async function placeManualBet(userId, session, betChoice, gameType, ctx) {
  try {
    const settings = userSettings[userId] || {};

    const currentGameType = gameType || settings.game_type || "TRX";

    const betType = (betChoice === 'B' || betChoice === 'S') ? "BS" : "COLOR";

    userState[userId] = { 
      state: "MANUAL_BET_AMOUNT_SELECT",
      betChoice: betChoice,
      gameType: currentGameType,
      betType: betType
    };
    
    let betChoiceText;
    if (betChoice === 'B' || betChoice === 'S') {
      betChoiceText = betChoice === 'B' ? 'BIG' : 'SMALL';
    } else {
      betChoiceText = getColorName(betChoice);
    }

    let currentBalance = 0;
    try {
      const session = userSessions[userId];
      if (session) {
        const balanceResult = await getBalance(session, userId);
        if (balanceResult !== null) {
          currentBalance = balanceResult;
        }
      }
    } catch (error) {
      logging.error(`Error getting current balance: ${error.message}`);
      currentBalance = 0;
    }
    
    await sendMessageWithRetry(ctx, 
      `🎯 You selected: ${betChoiceText}\n` +
      `🎮 Game: ${currentGameType}\n` +
      `━━━━━━━━━━━━━━━━━\n\n` +
      `💳 Current Balance: ${Math.round(currentBalance)} Ks\n`+
      `💰 Select your bet amount:`,
      makeAmountKeyboard()
    );
    
  } catch (error) {
    logging.error(`Manual bet error for user ${userId}: ${error.message}`);
    await sendMessageWithRetry(ctx, `❌ Bet error: ${error.message}`);
  }
}



async function processManualBetAmount(userId, betAmount, ctx, betChoice, gameType) {
  try {
    const session = userSessions[userId];
    const settings = userSettings[userId] || {};
    
    if (!session) {
      await sendMessageWithRetry(ctx, "❌ Please login first");
      delete userState[userId];
      return;
    }

   let currentBalance = 0;
    try {
      const balanceResult = await getBalance(session, userId);
      if (balanceResult !== null) {
        currentBalance = balanceResult;
      }
    } catch (error) {
      logging.error(`Error getting balance: ${error.message}`);
      await sendMessageWithRetry(ctx, "❌ Failed to get balance");
      delete userState[userId];
      return;
    }

    let betType;
    if (betChoice === 'B' || betChoice === 'S') {
      betType = "BS";
    } else if (betChoice === 'G' || betChoice === 'V' || betChoice === 'R') {
      betType = "COLOR";
    } else {
      await sendMessageWithRetry(ctx, `❌ Invalid bet choice: ${betChoice}`);
      delete userState[userId];
      return;
    }
    
    // Get current period
    const issueRes = await getGameIssueRequest(session, gameType);
    if (!issueRes || issueRes.code !== 0) {
      await sendMessageWithRetry(ctx, "❌ Failed to get current issue");
      delete userState[userId];
      return;
    }
    
    const data = issueRes.data || {};
    let currentIssue;
    
    if (gameType === "TRX") {
      currentIssue = data.predraw?.issueNumber;
    } else {
      currentIssue = data.issueNumber;
    }
    
    if (!currentIssue) {
      await sendMessageWithRetry(ctx, "❌ Failed to get current issue number");
      delete userState[userId];
      return;
    }
    
    //select type for the bet
    const selectMap = getSelectMap(gameType, betType);
    const selectType = selectMap[betChoice];
    
    if (!selectType) {
      await sendMessageWithRetry(ctx, `❌ Invalid bet selection: ${betChoice} for bet type: ${betType}`);
      delete userState[userId];
      return;
    }

    const { unitAmount, betCount, actualAmount } = computeBetDetails(betAmount);
    
    if (actualAmount === 0) {
      await sendMessageWithRetry(ctx, `❌ Invalid bet amount: ${betAmount} Ks`);
      delete userState[userId];
      return;
    }
    
    // Check balance
    const balance = await getBalance(session, userId);
    if (balance === null || balance < actualAmount) {
      await sendMessageWithRetry(ctx, `❌ Insufficient balance. Available: ${balance} Ks, Required: ${actualAmount} Ks`);
      delete userState[userId];
      return;
    }

    logging.info(`🎯 Manual Bet Details for user ${userId}:`);
    logging.info(`  Bet Choice: ${betChoice} (${betType})`);
    logging.info(`  Select Type: ${selectType}`);
    logging.info(`  Game Type: ${gameType}`);
    logging.info(`  Amount: ${actualAmount} Ks (${unitAmount} × ${betCount})`);
    logging.info(`  Issue: ${currentIssue}`);

    const originalBetType = settings.bet_type;
    settings.bet_type = betType; 
    
    try {
      const betResp = await placeBetRequest(session, currentIssue, selectType, unitAmount, betCount, gameType, userId);
      
      settings.bet_type = originalBetType;
      
      if (betResp.error || betResp.code !== 0) {
        let errorMsg = betResp.msg || betResp.error || 'Unknown error';
        await sendMessageWithRetry(ctx, `❌ Bet failed: ${errorMsg}`);
        delete userState[userId];
        return;
      }

      let currentBalance = 0;
          try {
            const session = userSessions[userId];
            if (session) {
              const balanceResult = await getBalance(session, userId);
              if (balanceResult !== null) {
                currentBalance = balanceResult;
              }
            }
          } catch (error) {
            logging.error(`Error getting current balance: ${error.message}`);
            currentBalance = 0;
          }

      let betChoiceText;
      if (betChoice === 'B') betChoiceText = 'BIG';
      else if (betChoice === 'S') betChoiceText = 'SMALL';
      else if (betChoice === 'R') betChoiceText = '🔴 RED';
      else if (betChoice === 'G') betChoiceText = '🟢 GREEN';
      else if (betChoice === 'V') betChoiceText = '🟣 VIOLET';
      
      const message = `✅ BET PLACED SUCCESSFUL\n` +
                     `━━━━━━━━━━━━━━\n`+
                     `🎫 ${gameType}: ${currentIssue}\n` +
                     `🎯 Bet: ${betChoiceText} • ${actualAmount} Ks\n` +
                     `━━━━━━━━━━━━━━\n`+
                     `💳 Current Balance: ${Math.round(currentBalance)} Ks\n\n`+
                     `⏳ Waiting for result...`;
      
      await sendMessageWithRetry(ctx, message, makeManualBetKeyboard());

      if (!userPendingBets[userId]) {
        userPendingBets[userId] = {};
      }
      userPendingBets[userId][currentIssue] = [betChoice, actualAmount, false];
      userWaitingForResult[userId] = true;

      if (!userManualBetHistory[userId]) {
        userManualBetHistory[userId] = [];
      }
      userManualBetHistory[userId].unshift({
        period: currentIssue,
        betChoice: betChoice,
        amount: actualAmount,
        result: "PENDING",
        winAmount: 0,
        timestamp: Date.now(),
        betType: betType
      });

      if (userManualBetHistory[userId].length > 20) {
        userManualBetHistory[userId] = userManualBetHistory[userId].slice(0, 20);
      }
      
    } catch (error) {
      settings.bet_type = originalBetType;
      throw error;
    }
    
    delete userState[userId];
    
  } catch (error) {
    logging.error(`Manual bet processing error for user ${userId}: ${error.message}`);
    await sendMessageWithRetry(ctx, `❌ Bet error: ${error.message}`);
    delete userState[userId];
  }
}

// Tg message
async function sendMessageWithRetry(ctx, text, replyMarkup = null) {
  for (let attempt = 0; attempt < MAX_TELEGRAM_RETRIES; attempt++) {
    try {
      if (replyMarkup) {
        await ctx.reply(text, replyMarkup);
      } else {
        await ctx.reply(text);
      }
      return true;
    } catch (error) {
      logging.error(`Telegram message error, attempt ${attempt + 1}: ${error.message}`);
      if (attempt < MAX_TELEGRAM_RETRIES - 1) {
        await new Promise(resolve => setTimeout(resolve, TELEGRAM_RETRY_DELAY));
        continue;
      }
      return false;
    }
  }
  return false;
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

function ensureUserStats(userId, settings) {
  if (!userStats[userId]) {
    if (settings && settings.virtual_mode) {
      userStats[userId] = {
        virtual_balance: settings.virtual_balance || 0,
        initial_balance: settings.virtual_balance || 0
      };
    } else {
      userStats[userId] = {
        start_balance: 0,
        profit: 0.0
      };
    }
  }
  return userStats[userId];
}

// Check profit and stop loss
async function checkProfitAndStopLoss(userId, bot) {
  const settings = userSettings[userId] || {};
  
  const isInManualBetMode = userState[userId]?.isInManualBetMode || false;
  
  if (isInManualBetMode) {
    return false;
  }
  
  ensureUserStats(userId, settings);
  
  let startAmount;
  if (settings.virtual_mode) {
    startAmount = userStats[userId].initial_balance || settings.virtual_balance || 0;
  } else {
    startAmount = userStats[userId].start_balance || 0;
  }

  if (settings.strategy === "SNIPER") {
    const stopLossLimit = settings.stop_loss;
    
    if (!stopLossLimit) {
      return false;
    }
    
    let currentProfit;
    let finalBalance;
    
    if (settings.virtual_mode) {
      currentProfit = (userStats[userId].virtual_balance || 0) - startAmount;
      finalBalance = userStats[userId].virtual_balance || 0;
    } else {
      currentProfit = userStats[userId].profit || 0;
      const session = userSessions[userId];
      if (session) {
        finalBalance = await getBalance(session, parseInt(userId));
      }
    }
    
    // Check for stop loss limit reached
    if (stopLossLimit && currentProfit <= -stopLossLimit) {
      settings.running = false;
      delete userWaitingForResult[userId];
      delete userShouldSkipNext[userId];
      
      settings.martin_index = 0;
      settings.dalembert_units = 1;
      settings.custom_index = 0;
      delete settings.dream_state;
      delete settings.leo_state;
      delete settings.trend_state;
      delete settings.sniper_state;

      userPendingProfitStopMessages[userId] = {
        type: 'STOP_LOSS',
        message: `🔻 STOP LOSS LIMIT HIT\n\n` +
                `⚠️ SL SET: ${stopLossLimit} Ks\n` +
                `📉 Loss: -${Math.abs(parseFloat(currentProfit)).toFixed(2)} Ks\n` +
                `⛷ Started Amount: ${startAmount.toFixed(2)} Ks\n` +
                `💳 Final Balance: ${finalBalance?.toFixed(2) || '0.00'} Ks`,
        data: {
          stopLossLimit: stopLossLimit,
          currentLoss: Math.abs(currentProfit),
          startAmount: startAmount,
          finalBalance: finalBalance || 0
        }
      };
      
      return true;
    }
    
    return false;
  }
  
  const targetProfit = settings.target_profit;
  const stopLossLimit = settings.stop_loss;
  
  if (!targetProfit && !stopLossLimit) {
    return false;
  }
  
  let currentProfit;
  let finalBalance;
  
  if (settings.virtual_mode) {
    currentProfit = (userStats[userId].virtual_balance || 0) - startAmount;
    finalBalance = userStats[userId].virtual_balance || 0;
  } else {
    currentProfit = userStats[userId].profit || 0;
    const session = userSessions[userId];
    if (session) {
      finalBalance = await getBalance(session, parseInt(userId));
    }
  }
  
  // Check for profit target reached
  if (targetProfit && currentProfit >= targetProfit) {
    settings.running = false;
    delete userWaitingForResult[userId];
    delete userShouldSkipNext[userId];
    
    settings.martin_index = 0;
    settings.dalembert_units = 1;
    settings.custom_index = 0;
    delete settings.dream_state;
    delete settings.leo_state;
    delete settings.trend_state;
    delete settings.sniper_state;

    userPendingProfitStopMessages[userId] = {
      type: 'PROFIT_TARGET',
      message: `🔺 PROFIT TARGET REACHED\n\n` +
              `🏆 Target: ${targetProfit} Ks\n` +
              `💰 Received: +${parseFloat(currentProfit).toFixed(2)} Ks\n` +
              `⛷ Started Amount: ${startAmount.toFixed(2)} Ks\n` +
              `💳 Final Balance: ${finalBalance?.toFixed(2) || '0.00'} Ks`,
      data: {
        targetProfit: targetProfit,
        currentProfit: currentProfit,
        startAmount: startAmount,
        finalBalance: finalBalance || 0
      }
    };
    
    settings.profit_target_reached = true;
    
    return true;
  }
  
  // Check for stop loss limit reached
  if (stopLossLimit && currentProfit <= -stopLossLimit) {
    settings.running = false;
    delete userWaitingForResult[userId];
    delete userShouldSkipNext[userId];
    
    settings.martin_index = 0;
    settings.dalembert_units = 1;
    settings.custom_index = 0;
    delete settings.dream_state;
    delete settings.leo_state;
    delete settings.trend_state;
    delete settings.sniper_state;

    userPendingProfitStopMessages[userId] = {
      type: 'STOP_LOSS',
      message: `🔻 STOP LOSS LIMIT HIT\n\n` +
              `⚠️ SL SET: ${stopLossLimit} Ks\n` +
              `📉 Loss: -${Math.abs(parseFloat(currentProfit)).toFixed(2)} Ks\n` +
              `⛷ Started Amount: ${startAmount.toFixed(2)} Ks\n` +
              `💳 Final Balance: ${finalBalance?.toFixed(2) || '0.00'} Ks`,
      data: {
        stopLossLimit: stopLossLimit,
        currentLoss: Math.abs(currentProfit),
        startAmount: startAmount,
        finalBalance: finalBalance || 0
      }
    };
    
    settings.stop_loss_reached = true;
    
    return true;
  }
  
  return false;
}

async function winLoseChecker(bot) {
  logging.info("Win/lose checker started");
  while (true) {
    try {
      for (const [userId, session] of Object.entries(userSessions)) {
        if (!session) continue;
        let currentBalance = null;
        
        const settings = userSettings[userId] || {};
        const gameType = settings.game_type || "TRX";
        const isLeslayStrategy = settings.strategy === "SNIPER";
        const betType = settings.bet_type || "BS";
        
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
          // Get TRX results
          const trxRes = await getTRXGameResultsNew(session, gameType);
          
          if (!trxRes || trxRes.code !== 0) {
            logging.error(`Failed to get TRX results: ${trxRes?.msg || 'Unknown error'}`);
            continue;
          }
          data = trxRes.data?.list || [];
          
          logging.info(`TRX: Retrieved ${data.length} results from API`);
        }

        if (gameType === "WINGO" || gameType === "WINGO_30S" || gameType === "WINGO_3MIN" || gameType === "WINGO_5MIN") {
          if (!userAILast10Results[userId]) userAILast10Results[userId] = [];
          if (!userLast10Results[userId]) userLast10Results[userId] = [];
          if (!userAllResults[userId]) userAllResults[userId] = [];

          for (let i = 0; i < Math.min(data.length, 10); i++) {
            const result = data[i];
            if (result && result.number) {
              const number = parseInt(result.number || "0") % 10;
              const bigSmall = number >= 5 ? "B" : "S";
              const color = numberToColor(number);
              
              // Store for AI strategy
              if (settings.strategy === "AI_PREDICTION" || settings.strategy === "BABIO") {
                if (!userAILast10Results[userId].includes(bigSmall)) {
                  userAILast10Results[userId].push(bigSmall);
                  if (userAILast10Results[userId].length > 10) {
                    userAILast10Results[userId] = userAILast10Results[userId].slice(-10);
                  }
                }
              }
              
              // Store for Lyzo strategy
              if (settings.strategy === "LYZO") {
                if (!userLast10Results[userId].includes(bigSmall)) {
                  userLast10Results[userId].push(bigSmall);
                  if (userLast10Results[userId].length > 10) {
                    userLast10Results[userId] = userLast10Results[userId].slice(-10);
                  }
                }
              }
              
              // Store for all strategies
              if (!userAllResults[userId].includes(bigSmall)) {
                userAllResults[userId].push(bigSmall);
                if (userAllResults[userId].length > 20) {
                  userAllResults[userId] = userAllResults[userId].slice(-20);
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

              if (!userLastNumbers[userId]) {
                userLastNumbers[userId] = [];
              }
              userLastNumbers[userId].push(number.toString());
              if (userLastNumbers[userId].length > 10) {
                userLastNumbers[userId] = userLastNumbers[userId].slice(-10);
              }
              
              // Store result for AI strategy
              if (settings.strategy === "AI_PREDICTION") {
                if (!userAILast10Results[userId]) {
                  userAILast10Results[userId] = [];
                }
                userAILast10Results[userId].push(bigSmall);
                if (userAILast10Results[userId].length > 10) {
                  userAILast10Results[userId] = userAILast10Results[userId].slice(-10);
                }
                logging.debug(`Stored result for AI: ${bigSmall} (now have ${userAILast10Results[userId].length} results)`);
              }
              
              // Store result for Babio strategy
              if (settings.strategy === "BABIO") {
                if (!userAILast10Results[userId]) {
                  userAILast10Results[userId] = [];
                }
                userAILast10Results[userId].push(bigSmall);
                if (userAILast10Results[userId].length > 10) {
                  userAILast10Results[userId] = userAILast10Results[userId].slice(-10);
                }
                logging.debug(`Stored result for Babio: ${bigSmall} (now have ${userAILast10Results[userId].length} results)`);
              }
              
              if (settings.strategy === "LYZO") {
                if (!userLast10Results[userId]) {
                  userLast10Results[userId] = [];
                }
                userLast10Results[userId].push(bigSmall);
                if (userLast10Results[userId].length > 10) {
                  userLast10Results[userId] = userLast10Results[userId].slice(-10);
                }
                logging.debug(`Stored result for Lyzo: ${bigSmall} (now have ${userLast10Results[userId].length} results)`);
              }
              
              if (!userAllResults[userId]) {
                userAllResults[userId] = [];
              }
              userAllResults[userId].push(bigSmall);
              if (userAllResults[userId].length > 20) {
                userAllResults[userId] = userAllResults[userId].slice(-20);
              }

              
              // manual bet history with result
if (userManualBetHistory[userId]) {
  const manualBetIndex = userManualBetHistory[userId].findIndex(bet => bet.period === period);
  if (manualBetIndex !== -1) {
    userManualBetHistory[userId][manualBetIndex].result = isWin ? "WIN" : "LOSE";
    userManualBetHistory[userId][manualBetIndex].winAmount = isWin ? amount * 0.96 : 0;
    
    let balanceForHistory;
    if (isVirtual) {
      balanceForHistory = userStats[userId]?.virtual_balance || 0;
    } else {
      balanceForHistory = await getBalance(session, parseInt(userId));
    }
    
    userManualBetHistory[userId][manualBetIndex].balance = balanceForHistory;
  }
}



if (userManualBetHistory[userId]) {
  const manualBetIndex = userManualBetHistory[userId].findIndex(bet => bet.period === period);
  if (manualBetIndex !== -1) {
    try {
      const manualBets = userManualBetHistory[userId].slice(0, 10);
      
      if (manualBets.length > 0) {
        const imageBuffer = await createRecentBetTableImage(manualBets, userId);
        
        if (imageBuffer) {
          await bot.telegram.sendPhoto(userId, 
            { source: imageBuffer },
            {
              caption: `📝 Recent Manual Bets - Last 10 bets`
            }
          );
        }
      }
    } catch (error) {
      logging.error(`Error sending recent bets table after manual bet: ${error.message}`);
    }
  }
}
              
              // BEATRIX strategy result processing
              if (settings.strategy === "BEATRIX") {
                if (!userSettings[userId].beatrix_state) {
                  userSettings[userId].beatrix_state = {
                    waiting_for_seven: true,
                    last_period_with_seven: null
                  };
                }
                
                const beatrixState = userSettings[userId].beatrix_state;
                
                if (number === 7) {
                  beatrixState.waiting_for_seven = false;
                  beatrixState.last_period_with_seven = period;
                  logging.info(`BEATRIX: Found result 7 in period ${period}, ready to bet on next period`);
                } else {
                  // If not 7, we're waiting
                  beatrixState.waiting_for_seven = true;
                  logging.info(`BEATRIX: Result is ${number}, not 7, continuing to wait`);
                }
              }

              if (settings.strategy === "LEO" && settings.leo_state) {
                settings.leo_state.last_result = bigSmall;
                settings.leo_state.pattern_index = (settings.leo_state.pattern_index + 1) % 
                  (bigSmall === 'B' ? LEO_BIG_PATTERN.length : LEO_SMALL_PATTERN.length);
                logging.info(`LEO strategy: Updated last_result to ${bigSmall}, pattern_index to ${settings.leo_state.pattern_index}`);
              }

              if (settings.strategy === "TREND_FOLLOW" && settings.trend_state) {
                settings.trend_state.last_result = bigSmall;
                logging.info(`TREND_FOLLOW strategy: Updated last_result to ${bigSmall}`);
              }

              if (betType === "COLOR" && settings.strategy === "TREND_FOLLOW" && settings.color_trend_state) {
                settings.color_trend_state.last_result = color;
                logging.info(`Color TREND_FOLLOW strategy: Updated last_result to ${color}`);
              }

              if (settings.strategy === "ALTERNATE" && settings.alternate_state) {
                settings.alternate_state.last_result = bigSmall;

                if (settings.alternate_state.skip_mode) {
                  if (isWin) {
                    settings.alternate_state.skip_mode = false;
                    logging.info(`ALTERNATE strategy: Win in skip mode. Resuming normal betting.`);
                  }
                  logging.info(`ALTERNATE strategy: Updated last_result to ${bigSmall} (still in skip mode)`);
                } else {
                  logging.info(`ALTERNATE strategy: Updated last_result to ${bigSmall} (normal mode)`);
                }
              }
              
              if (isLeslayStrategy && settings.sniper_state && settings.sniper_state.active) {
                if (isWin) {
                  settings.sniper_state.hit_count = (settings.sniper_state.hit_count || 0) + 1;
                  
                  if (settings.sniper_state.hit_count >= 2) {
                    settings.sniper_hit_twice = true;
                    logging.info(`SNIPER: Second hit recorded, will show message after win/lose notification`);
                    
                    // STOP THE BOT when sniper hits 2 times
                    settings.running = false;
                    delete userWaitingForResult[userId];
                    delete userShouldSkipNext[userId];
                    delete userSLSkipWaitingForWin[userId];
                  } else {
                    // First hit
                    settings.sniper_hit_once = true;
                    logging.info(`SNIPER: First hit recorded (${settings.sniper_state.hit_count}/2)`);
                  }

                  const hitCount = settings.sniper_state.hit_count;
                  settings.sniper_state.active = false;
                  settings.sniper_state.direction = null;
                  settings.sniper_state.current_index = 0;
                  settings.sniper_state.bet_sequence = [];
                  settings.sniper_state.got_same_result = false;
                  settings.sniper_state.hit_count = hitCount;
                } else {
                  settings.sniper_state.current_index++;
 
                  if (settings.sniper_state.current_index >= 4) {

                    settings.running = false;

                    settings.sniper_max_reached = true;
                    logging.info(`SNIPER: Reached max bets without win, stopping bot`);
                  }
                  

                  const lastNumber = userLastNumbers[userId] && userLastNumbers[userId].length > 1 
                    ? userLastNumbers[userId][userLastNumbers[userId].length - 2] 
                    : null;
                  
                  const currentNumber = userLastNumbers[userId] && userLastNumbers[userId].length > 0 
                    ? userLastNumbers[userId][userLastNumbers[userId].length - 1] 
                    : null;
                  

                  if (lastNumber === currentNumber && settings.sniper_state.current_index === 1) {
                    settings.sniper_state.got_same_result = true;
                    
                    if (currentNumber === "0") {

                      settings.sniper_state.bet_sequence = ["B", "S", "B", "B"];
                      logging.info(`SNIPER: Got 0 again, sequence: B -> S -> B -> B`);
                    } else if (currentNumber === "9") {
                      
                      settings.sniper_state.bet_sequence = ["S", "B", "S", "S"];
                      logging.info(`SNIPER: Got 9 again, sequence: S -> B -> S -> S`);
                    }
                  } else if (!settings.sniper_state.got_same_result) {
              
                    if (settings.sniper_state.direction === "B") {
     
                      if (settings.sniper_state.current_index === 2) {
                        settings.sniper_state.bet_sequence.push("B");
                      } else if (settings.sniper_state.current_index === 3) {
                        settings.sniper_state.bet_sequence.push("B");
                      }
                    } else {
                 
                      if (settings.sniper_state.current_index === 2) {
                        settings.sniper_state.bet_sequence.push("S");
                      } else if (settings.sniper_state.current_index === 3) {
                        settings.sniper_state.bet_sequence.push("S");
                      }
                    }
                  }
                }
              }
              

              if (settings.strategy === "BABIO" && settings.babio_state) {
                if (!isWin) {
                  settings.babio_state.current_position = settings.babio_state.current_position === 8 ? 5 : 8;
                }
              }
              
              const entryLayer = settings.layer_limit || 1;
              
              if (!isLeslayStrategy) {
                if (entryLayer === 2) {
                  if (!settings.entry_layer_state) {
                    settings.entry_layer_state = { waiting_for_lose: true };
                  }
                  
                  if (isWin) {
                    settings.entry_layer_state.waiting_for_lose = true;
                  } else {
                    if (settings.entry_layer_state.waiting_for_lose) {
                      settings.entry_layer_state.waiting_for_lose = false;
                    }
                  }
                } else if (entryLayer === 3) {
                  if (!settings.entry_layer_state) {
                    settings.entry_layer_state = { waiting_for_loses: true, consecutive_loses: 0 };
                  }
                  
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
              
              if (!isLeslayStrategy && settings.sl_layer && settings.sl_layer > 0) {
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
                    logging.warning(`SL Layer triggered! Skipping next bet after ${settings.consecutive_losses} consecutive losses. Waiting for skip win.`);
                  }
                }
              } else {
                updateBettingStrategy(settings, isWin, amount);
              }
              
              ensureUserStats(userId, settings);
              
              if (isVirtual) {
                if (isWin) {
                  userStats[userId].virtual_balance += amount * 0.96;
                } else {
                  userStats[userId].virtual_balance -= amount;
                }
              } else {
                if (amount > 0) {
                  if (isWin) {
                    const profitChange = amount * 0.96;
                    userStats[userId].profit += profitChange;
                  } else {
                    userStats[userId].profit -= amount;
                  }
                }
              }
              

              if (settings.strategy === "DREAM" && settings.dream_state) {
                const dreamState = settings.dream_state;
                
                const resultNumber = parseInt(settled.number || "0") % 10;
                logging.info(`DREAM strategy: Result number is ${resultNumber}`);
                
                if (dreamState.first_bet) {
                  dreamState.first_bet = false;
                  dreamState.current_pattern = dreamPatterns[resultNumber.toString()] || dreamPatterns["0"];
                  dreamState.current_index = 0;
                  logging.info(`DREAM strategy: First bet complete. Using pattern for result ${resultNumber}: ${dreamState.current_pattern}`);
                } else {
                  if (isWin) {
                    dreamState.current_pattern = dreamPatterns[resultNumber.toString()] || dreamPatterns["0"];
                    dreamState.current_index = 0;
                    logging.info(`DREAM strategy: Win! Changed to pattern for result ${resultNumber}: ${dreamState.current_pattern}`);
                  } else {
                    dreamState.current_index = (dreamState.current_index + 1) % dreamState.current_pattern.length;
                    logging.info(`DREAM strategy: Loss. Moving to index ${dreamState.current_index} in current pattern: ${dreamState.current_pattern}`);
                  }
                }
              }
              
              const currentBalance = isVirtual 
                ? (userStats[userId]?.virtual_balance || 0)
                : await getBalance(session, parseInt(userId));
              
              const botStopped = await checkProfitAndStopLoss(userId, bot);
              
              // Color display
              let colorDisplay = "";
              if (color === 'R') colorDisplay = "RED";
              else if (color === 'G') colorDisplay = "GREEN";
              else if (color === 'V') colorDisplay = "VIOLET";
              else colorDisplay = "UNKNOWN";
              
              if (isWin) {
  const winAmount = amount * 0.96;
  ensureUserStats(userId, settings);
  
  const totalProfit = isVirtual 
    ? (userStats[userId].virtual_balance - userStats[userId].initial_balance)
    : userStats[userId].profit;

  const message = `📢 WIN: ✅ +${winAmount.toFixed(2)} Ks\n` +
                 `━━━━━━━━━━━━━━\n` +
                 `🎫 ${gameType} : ${period}\n` +
                 `🏇 Result: ${number} • ${bigSmall === 'B' ? 'BIG' : 'SMALL'} • ${colorDisplay}\n` +
                 `💳 Balance: ${currentBalance?.toFixed(2) || '0.00'} Ks\n` +
                 `📊 Profit: +${totalProfit.toFixed(2)} Ks\n\n`;
                
  try {
    await bot.telegram.sendMessage(userId, message);
    
    if (userPendingProfitStopMessages[userId]) {
      const pendingMsg = userPendingProfitStopMessages[userId];
      delete userPendingProfitStopMessages[userId];
      
      if (pendingMsg.type === 'PROFIT_TARGET') {
        // Send the profit target reached image and message
        await sendProfitTargetImage(
          userId, 
          bot, 
          pendingMsg.data.targetProfit, 
          pendingMsg.data.currentProfit, 
          pendingMsg.data.startAmount, 
          pendingMsg.data.finalBalance
        );
      } else if (pendingMsg.type === 'STOP_LOSS') {
        // Send the stop loss limit hit image and message
        await sendStopLossImage(
          userId, 
          bot, 
          pendingMsg.data.stopLossLimit, 
          pendingMsg.data.currentLoss, 
          pendingMsg.data.startAmount, 
          pendingMsg.data.finalBalance
        );
      }
    }
  } catch (error) {
    logging.error(`Failed to send result to ${userId}: ${error.message}`);
  }
} else {
  ensureUserStats(userId, settings);
  
  const totalProfit = isVirtual 
    ? (userStats[userId].virtual_balance - userStats[userId].initial_balance)
    : userStats[userId].profit;
  const consecutiveLosses = settings.consecutive_losses || 0;
  
  let slStatusLine = '';
  if (!isLeslayStrategy && settings.sl_layer) {
    slStatusLine = `\🔴 Consecutive Losses: ${consecutiveLosses}/${settings.sl_layer}\n\n`;
  }
  
  const message = `📢 LOSE: ❌ -${amount} Ks\n` +
                 `━━━━━━━━━━━━━━\n` +
                 `🎫 ${gameType} : ${period}\n` +
                 `🏇 Result: ${number} • ${bigSmall === 'B' ? 'BIG' : 'SMALL'} • ${colorDisplay}\n` +
                 `💳 Balance: ${currentBalance?.toFixed(2) || '0.00'} Ks\n` +
                 `📊 Profit: ${totalProfit >= 0 ? '+' : ''}${totalProfit.toFixed(2)} Ks\n\n`;
                
  try {
    await bot.telegram.sendMessage(userId, message);
    
    // Check and send any pending profit/stop loss messages AFTER lose message
    if (userPendingProfitStopMessages[userId]) {
      const pendingMsg = userPendingProfitStopMessages[userId];
      delete userPendingProfitStopMessages[userId];
      
      if (pendingMsg.type === 'PROFIT_TARGET') {
        // Send the profit target reached image and message
        await sendProfitTargetImage(
          userId, 
          bot, 
          pendingMsg.data.targetProfit, 
          pendingMsg.data.currentProfit, 
          pendingMsg.data.startAmount, 
          pendingMsg.data.finalBalance
        );
      } else if (pendingMsg.type === 'STOP_LOSS') {
        // Send the stop loss limit hit image and message
        await sendStopLossImage(
          userId, 
          bot, 
          pendingMsg.data.stopLossLimit, 
          pendingMsg.data.currentLoss, 
          pendingMsg.data.startAmount, 
          pendingMsg.data.finalBalance
        );
      }
    }
  } catch (error) {
    logging.error(`Failed to send result to ${userId}: ${error.message}`);
  }
}
              
              // Check for sniper hit messages
              if (isLeslayStrategy) {
                if (settings.sniper_hit_twice) {
                  try {
                    await bot.telegram.sendMessage(userId, "🎯 SNIPER HIT 2/2!✅ Target acquired successfully!🤖  Bot deactivated.");
                    settings.sniper_hit_twice = false;
                  } catch (error) {
                    logging.error(`Failed to send sniper hit message to ${userId}: ${error.message}`);
                  }
                } else if (settings.sniper_hit_once) {
                  try {
                    await bot.telegram.sendMessage(userId, "✅ First Target Hit!🎯 One more target to go!");
                    settings.sniper_hit_once = false;
                  } catch (error) {
                    logging.error(`Failed to send sniper hit message to ${userId}: ${error.message}`);
                  }
                }
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
              
              if (!userLastNumbers[userId]) {
                userLastNumbers[userId] = [];
              }
              userLastNumbers[userId].push(number.toString());
              if (userLastNumbers[userId].length > 10) {
                userLastNumbers[userId] = userLastNumbers[userId].slice(-10);
              }
              
              if (settings.strategy === "AI_PREDICTION") {
                if (!userAILast10Results[userId]) {
                  userAILast10Results[userId] = [];
                }
                userAILast10Results[userId].push(bigSmall);
                if (userAILast10Results[userId].length > 10) {
                  userAILast10Results[userId] = userAILast10Results[userId].slice(-10);
                }
                logging.debug(`Stored result for AI (skipped bet): ${bigSmall} (now have ${userAILast10Results[userId].length} results)`);
              }

              if (settings.strategy === "BABIO") {
                if (!userAILast10Results[userId]) {
                  userAILast10Results[userId] = [];
                }
                userAILast10Results[userId].push(bigSmall);
                if (userAILast10Results[userId].length > 10) {
                  userAILast10Results[userId] = userAILast10Results[userId].slice(-10);
                }
                logging.debug(`Stored result for Babio (skipped bet): ${bigSmall} (now have ${userAILast10Results[userId].length} results)`);
              }
              
              if (settings.strategy === "LYZO") {
                if (!userLast10Results[userId]) {
                  userLast10Results[userId] = [];
                }
                userLast10Results[userId].push(bigSmall);
                if (userLast10Results[userId].length > 10) {
                  userLast10Results[userId] = userLast10Results[userId].slice(-10);
                }
                logging.debug(`Stored result for Lyzo (skipped bet): ${bigSmall} (now have ${userLast10Results[userId].length} results)`);
              }

              if (!userAllResults[userId]) {
                userAllResults[userId] = [];
              }
              userAllResults[userId].push(bigSmall);
              if (userAllResults[userId].length > 20) {
                userAllResults[userId] = userAllResults[userId].slice(-20);
              }

              if (settings.strategy === "BEATRIX") {
                if (!userSettings[userId].beatrix_state) {
                  userSettings[userId].beatrix_state = {
                    waiting_for_seven: true,
                    last_period_with_seven: null
                  };
                }
                
                const beatrixState = userSettings[userId].beatrix_state;

                if (number === 7) {
                  beatrixState.waiting_for_seven = false;
                  beatrixState.last_period_with_seven = period;
                  logging.info(`BEATRIX: Found result 7 in period ${period}, ready to bet on next period`);
                } else {
                  beatrixState.waiting_for_seven = true;
                  logging.info(`BEATRIX: Result is ${number}, not 7, continuing to wait`);
                }
              }

              if (settings.strategy === "TREND_FOLLOW" && settings.trend_state) {
                settings.trend_state.last_result = bigSmall;

                if (settings.trend_state.skip_mode) {
                  if (isWin) {
                    settings.trend_state.skip_mode = false;
                    logging.info(`TREND_FOLLOW strategy: Win in skip mode. Resuming normal betting.`);
                  }
                  logging.info(`TREND_FOLLOW strategy: Updated last_result to ${bigSmall}`);
                }
              }
              
              if (betType === "COLOR" && settings.strategy === "TREND_FOLLOW" && settings.color_trend_state) {
                settings.color_trend_state.last_result = color;
                logging.info(`Color TREND_FOLLOW strategy: Updated last_result to ${color}`);
              }
              
              if (settings.strategy === "ALTERNATE" && settings.alternate_state) {
                settings.alternate_state.last_result = bigSmall;
                
                if (settings.alternate_state.skip_mode) {

                  if (isWin) {
                    settings.alternate_state.skip_mode = false;
                    logging.info(`ALTERNATE strategy: Win in skip mode. Resuming normal betting.`);
                  }
                  logging.info(`ALTERNATE strategy: Updated last_result to ${bigSmall} (still in skip mode)`);
                } else {
                  logging.info(`ALTERNATE strategy: Updated last_result to ${bigSmall} (normal mode)`);
                }
              }
              
              if (settings.strategy === "LEO" && settings.leo_state) {
                settings.leo_state.last_result = bigSmall;
                settings.leo_state.pattern_index = (settings.leo_state.pattern_index + 1) % 
                  (bigSmall === 'B' ? LEO_BIG_PATTERN.length : LEO_SMALL_PATTERN.length);
                logging.info(`LEO strategy: Updated last_result to ${bigSmall}, pattern_index to ${settings.leo_state.pattern_index}`);
              }
              
              if (isLeslayStrategy && settings.sniper_state && settings.sniper_state.active) {
                if (isWin) {
                  settings.sniper_state.hit_count = (settings.sniper_state.hit_count || 0) + 1;
                  
                  if (settings.sniper_state.hit_count >= 2) {
                    settings.sniper_hit_twice = true;
                    logging.info(`SNIPER: Second hit recorded, will show message after win/lose notification`);
                    
                    settings.running = false;
                    delete userWaitingForResult[userId];
                    delete userShouldSkipNext[userId];
                    delete userSLSkipWaitingForWin[userId];
                  } else {
                    settings.sniper_hit_once = true;
                    logging.info(`SNIPER: First hit recorded (${settings.sniper_state.hit_count}/2)`);
                  }
                  
                  const hitCount = settings.sniper_state.hit_count;
                  settings.sniper_state.active = false;
                  settings.sniper_state.direction = null;
                  settings.sniper_state.current_index = 0;
                  settings.sniper_state.bet_sequence = [];
                  settings.sniper_state.got_same_result = false;
                  settings.sniper_state.hit_count = hitCount;
                } else {
                  settings.sniper_state.current_index++;
                  
                  if (settings.sniper_state.current_index >= 4) {

                    settings.running = false;
                    settings.sniper_max_reached = true;
                    logging.info(`SNIPER: Reached max bets without win, stopping bot`);
                  }
                  
                  const lastNumber = userLastNumbers[userId] && userLastNumbers[userId].length > 1 
                    ? userLastNumbers[userId][userLastNumbers[userId].length - 2] 
                    : null;
                  
                  const currentNumber = userLastNumbers[userId] && userLastNumbers[userId].length > 0 
                    ? userLastNumbers[userId][userLastNumbers[userId].length - 1] 
                    : null;
                  
                  if (lastNumber === currentNumber && settings.sniper_state.current_index === 1) {
                    settings.sniper_state.got_same_result = true;
                    
                    if (currentNumber === "0") {
                      settings.sniper_state.bet_sequence = ["B", "S", "B", "B"];
                      logging.info(`SNIPER: Got 0 again, sequence: B -> S -> B -> B`);
                    } else if (currentNumber === "9") {
                      settings.sniper_state.bet_sequence = ["S", "B", "S", "S"];
                      logging.info(`SNIPER: Got 9 again, sequence: S -> B -> S -> S`);
                    }
                  } else if (!settings.sniper_state.got_same_result) {

                    if (settings.sniper_state.direction === "B") {

                      if (settings.sniper_state.current_index === 2) {
                        settings.sniper_state.bet_sequence.push("B");
                      } else if (settings.sniper_state.current_index === 3) {
                        settings.sniper_state.bet_sequence.push("B");
                      }
                    } else {
          
                      if (settings.sniper_state.current_index === 2) {
                        settings.sniper_state.bet_sequence.push("S");
                      } else if (settings.sniper_state.current_index === 3) {
                        settings.sniper_state.bet_sequence.push("S");
                      }
                    }
                  }
                }
              }
              
              if (settings.strategy === "BABIO" && settings.babio_state) {
                if (!isWin) {
                  settings.babio_state.current_position = settings.babio_state.current_position === 8 ? 5 : 8;
                }
              }
              
              if (!isLeslayStrategy && userSLSkipWaitingForWin[userId] && isWin) {

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
              
              const entryLayer = settings.layer_limit || 1;

              let colorDisplay = "";
              if (color === 'R') colorDisplay = "RED";
              else if (color === 'G') colorDisplay = "GREEN";
              else if (color === 'V') colorDisplay = "VIOLET";
              else colorDisplay = "UNKNOWN";


              if (!isLeslayStrategy) {
                if (entryLayer === 1) {
                  if (!settings.entry_layer_state) {
                    settings.entry_layer_state = { waiting_for_lose: true };
                  }
                  
                  if (isWin) {
                    settings.entry_layer_state.waiting_for_lose = true;
                    
                    const winMessage = 
                      `✅ WIN IN SKIP\n` +
                      `━━━━━━━━━━━━━━\n`+
                      `🎫 ${gameType} : ${period}\n` +
                      `🏇 Result: ${number} • ${bigSmall === 'B' ? 'BIG' : 'SMALL'} • ${colorDisplay}`;
                    
                    try {
                      await bot.telegram.sendMessage(userId, winMessage);
                      if (userPendingProfitStopMessages[userId]) {
        const pendingMsg = userPendingProfitStopMessages[userId];
        delete userPendingProfitStopMessages[userId];
        
        if (pendingMsg.type === 'PROFIT_TARGET') {
          await sendProfitTargetImage(
            userId, 
            bot, 
            pendingMsg.data.targetProfit, 
            pendingMsg.data.currentProfit, 
            pendingMsg.data.startAmount, 
            pendingMsg.data.finalBalance
          );
        } else if (pendingMsg.type === 'STOP_LOSS') {
          await sendStopLossImage(
            userId, 
            bot, 
            pendingMsg.data.stopLossLimit, 
            pendingMsg.data.currentLoss, 
            pendingMsg.data.startAmount, 
            pendingMsg.data.finalBalance
          );
        }
      }
                    } catch (error) {
                      logging.error(`Failed to send virtual win message to ${userId}: ${error.message}`);
                    }
                  } else {
                    if (settings.entry_layer_state.waiting_for_lose) {
                      settings.entry_layer_state.waiting_for_lose = false;
                    }
                    
                    const loseMessage = 
                      `❌ LOSE IN SKIP\n` +
                      `━━━━━━━━━━━━━━\n`+
                      `🎫 ${gameType} : ${period}\n` +
                      `🏇 Result: ${number} • ${bigSmall === 'B' ? 'BIG' : 'SMALL'} • ${colorDisplay}`;
                    
                    try {
                      await bot.telegram.sendMessage(userId, loseMessage);
                      if (userPendingProfitStopMessages[userId]) {
        const pendingMsg = userPendingProfitStopMessages[userId];
        delete userPendingProfitStopMessages[userId];
        
        if (pendingMsg.type === 'PROFIT_TARGET') {
          await sendProfitTargetImage(
            userId, 
            bot, 
            pendingMsg.data.targetProfit, 
            pendingMsg.data.currentProfit, 
            pendingMsg.data.startAmount, 
            pendingMsg.data.finalBalance
          );
        } else if (pendingMsg.type === 'STOP_LOSS') {
          await sendStopLossImage(
            userId, 
            bot, 
            pendingMsg.data.stopLossLimit, 
            pendingMsg.data.currentLoss, 
            pendingMsg.data.startAmount, 
            pendingMsg.data.finalBalance
          );
        }
      }
                    } catch (error) {
                      logging.error(`Failed to send virtual lose message to ${userId}: ${error.message}`);
                    }
                  }
                } else if (entryLayer === 2) {
                  if (!settings.entry_layer_state) {
                    settings.entry_layer_state = { waiting_for_lose: true };
                  }
                  
                  if (isWin) {
                    settings.entry_layer_state.waiting_for_lose = true;
                    
                    const winMessage = 
                      `✅ WIN IN SKIP\n` +
                      `━━━━━━━━━━━━━━\n`+
                      `🎫 ${gameType} : ${period}\n` +
                      `🏇 Result: ${number} • ${bigSmall === 'B' ? 'BIG' : 'SMALL'} • ${colorDisplay}`;
                    
                    try {
                      await bot.telegram.sendMessage(userId, winMessage);
                    } catch (error) {
                      logging.error(`Failed to send virtual win message to ${userId}: ${error.message}`);
                    }
                  } else {
                    if (settings.entry_layer_state.waiting_for_lose) {
                      settings.entry_layer_state.waiting_for_lose = false;
                    }
                    
                    const loseMessage = 
                      `❌ LOSE IN SKIP\n` +
                      `━━━━━━━━━━━━━━\n`+
                      `🎫 ${gameType} : ${period}\n` +
                      `🏇 Result: ${number} • ${bigSmall === 'B' ? 'BIG' : 'SMALL'} • ${colorDisplay}`;
                    
                    try {
                      await bot.telegram.sendMessage(userId, loseMessage);
                    } catch (error) {
                      logging.error(`Failed to send virtual lose message to ${userId}: ${error.message}`);
                    }
                  }
                } else if (entryLayer === 3) {
                  if (!settings.entry_layer_state) {
                    settings.entry_layer_state = { waiting_for_loses: true, consecutive_loses: 0 };
                  }
                  
                  if (isWin) {
                    settings.entry_layer_state.waiting_for_loses = true;
                    settings.entry_layer_state.consecutive_loses = 0;
                    
                    const winMessage = 
                      `✅ WIN IN SKIP\n` +
                      `━━━━━━━━━━━━━━\n`+
                      `🎫 ${gameType} : ${period}\n` +
                      `🏇 Result: ${number} • ${bigSmall === 'B' ? 'BIG' : 'SMALL'} • ${colorDisplay}`;
                    
                    try {
                      await bot.telegram.sendMessage(userId, winMessage);
                    } catch (error) {
                      logging.error(`Failed to send virtual win message to ${userId}: ${error.message}`);
                    }
                  } else {
                    settings.entry_layer_state.consecutive_loses++;
                    
                    if (settings.entry_layer_state.consecutive_loses >= 2) {
                      settings.entry_layer_state.waiting_for_loses = false;
                      
                      const loseMessage = 
                        `❌ LOSE IN SKIP\n` +
                        `━━━━━━━━━━━━━━\n`+
                        `🎫 ${gameType} : ${period}\n` +
                        `🏇 Result: ${number} • ${bigSmall === 'B' ? 'BIG' : 'SMALL'} • ${colorDisplay}`;
                      
                      try {
                        await bot.telegram.sendMessage(userId, loseMessage);
                      } catch (error) {
                        logging.error(`Failed to send virtual lose message to ${userId}: ${error.message}`);
                      }
                    } else {
                      const loseMessage = 
                        `❌ LOSE IN SKIP\n` +
                        `━━━━━━━━━━━━━━\n`+
                        `🎫 ${gameType} : ${period}\n` +
                        `🏇 Result: ${number} • ${bigSmall === 'B' ? 'BIG' : 'SMALL'} • ${colorDisplay}\n` +
                        `⏳ Waiting for ${2 - settings.entry_layer_state.consecutive_loses} more lose(s)`;
                      
                      try {
                        await bot.telegram.sendMessage(userId, loseMessage);
                      } catch (error) {
                        logging.error(`Failed to send virtual lose message to ${userId}: ${error.message}`);
                      }
                    }
                  }
                } else {
                  let bsWaitStatus = "";
                  if (settings.strategy === "TREND_FOLLOW" && settings.trend_state && settings.trend_state.skip_mode) {
                    bsWaitStatus = isWin ? "\n🔄 BS/SB Wait: Win detected, resuming normal betting" : "\n🔄 BS/SB Wait: Continue skipping until win";
                  }
                  
                  let bbWaitStatus = "";
                  if (settings.strategy === "ALTERNATE" && settings.alternate_state && settings.alternate_state.skip_mode) {
                    bbWaitStatus = isWin ? "\n🔄 BB/SS Wait: Win detected, resuming normal betting" : "\n🔄 BB/SS Wait: Continue skipping until win";
                  }
                  
                  let sniperStatus = "";
                  if (isLeslayStrategy && settings.sniper_state && settings.sniper_state.active) {
                    sniperStatus = isWin ? "\n🎯 SNIPER: Win detected, resetting state" : "\n🎯 SNIPER: Loss, continuing sequence";
                  }
                  
                  let beatrixStatus = "";
                  if (settings.strategy === "BEATRIX" && settings.beatrix_state) {
                    beatrixStatus = number === 7 ? "\n👑 BEATRIX: Found 7, ready to bet" : "\n👑 BEATRIX: Waiting for 7";
                  }
                  
                  const resultMessage = isWin ? 
                      `✅ WIN IN SKIP\n` +
                      `━━━━━━━━━━━━━━\n`+
                      `🎫 ${gameType} : ${period}\n` +
                      `🏇 Result: ${number} • ${bigSmall === 'B' ? 'BIG' : 'SMALL'} • ${colorDisplay}\n`+
                      `${bsWaitStatus}${bbWaitStatus}${sniperStatus}${beatrixStatus}` :
                    `❌ LOSE IN SKIP\n` +
                    `━━━━━━━━━━━━━━\n`+
                    `🎫 ${gameType} : ${period}\n` +
                    `🏇 Result: ${number} • ${bigSmall === 'B' ? 'BIG' : 'SMALL'} • ${colorDisplay}\n`+
                    `${bsWaitStatus}${bbWaitStatus}${sniperStatus}${beatrixStatus}`;
                  
                  try {
                    await bot.telegram.sendMessage(userId, resultMessage);
                  } catch (error) {
                    logging.error(`Failed to send virtual result to ${userId}: ${error.message}`);
                  }
                }
              } else {
                let sniperStatus = "";
                if (settings.sniper_state && settings.sniper_state.active) {
                  sniperStatus = isWin ? "\n🎯 SNIPER: Win detected, resetting state" : "\n🎯 SNIPER: Loss, continuing sequence";
                }

                let beatrixStatus = "";
                if (settings.strategy === "BEATRIX" && settings.beatrix_state) {
                  beatrixStatus = number === 7 ? "\n👑 BEATRIX: Found 7, ready to bet" : "\n👑 BEATRIX: Waiting for 7";
                }
                
                const resultMessage = isWin ? 
                  `✅ WIN IN SKIP\n` +
                  `━━━━━━━━━━━━━━\n`+
                  `🎫 ${gameType} : ${period}\n` +
                  `🏇 Result: ${number} • ${bigSmall === 'B' ? 'BIG' : 'SMALL'} • ${colorDisplay}\n`+
                  `${sniperStatus}${beatrixStatus}` :
                  `❌ LOSE IN SKIP\n` +
                  `━━━━━━━━━━━━━━\n`+
                  `🎫 ${gameType} : ${period}\n` +
                  `🏇 Result: ${number} • ${bigSmall === 'B' ? 'BIG' : 'SMALL'} • ${colorDisplay}\n` +
                  `${sniperStatus}${beatrixStatus}`;
                
                try {
                  await bot.telegram.sendMessage(userId, resultMessage);
                } catch (error) {
                  logging.error(`Failed to send virtual result to ${userId}: ${error.message}`);
                }
              }
              
              logging.debug(`Skipped bet result processed - NOT counting towards SL layer: ${isWin ? 'WIN' : 'LOSS'}`);
              
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
  } else if (settings.strategy === "SNIPER" && settings.sniper_state) {
    betIndex = settings.sniper_state.current_index || 0;
  }
  
  return betIndex === 0 ? "🔺" : "🔻";
}

async function bettingWorker(userId, ctx, bot) {
  const settings = userSettings[userId] || {};
  let session = userSessions[userId];
  if (!settings || !session) {
    await sendMessageWithRetry(ctx, "Please login first");
    settings.running = false;
    return;
  }
  
  ensureUserStats(userId, settings);
  
  settings.running = true;
  settings.last_issue = null;
  settings.consecutive_errors = 0;
  settings.consecutive_losses = 0;
  settings.current_layer = 0;
  settings.skip_betting = false;

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

  const isLeslayStrategy = settings.strategy === "SNIPER";
  const entryLayer = settings.layer_limit || 1;
  const betType = settings.bet_type || "BS";
  
  if (!isLeslayStrategy) {
    if (entryLayer === 2) {
      settings.entry_layer_state = { waiting_for_lose: true };
    } else if (entryLayer === 3) {
      settings.entry_layer_state = { waiting_for_loses: true, consecutive_loses: 0 };
    }
  }

  if (settings.strategy === "DREAM") {
    settings.dream_state = {
      first_bet: true,
      current_pattern: "",
      current_index: 0
    };
  }

  if (settings.strategy === "BABIO") {
    settings.babio_state = {
      current_position: 8,
      last_result: null
    };
  }

  if (settings.strategy === "LEO") {
    settings.leo_state = {
      last_result: null,
      pattern_index: 0
    };
    logging.info(`LEO strategy initialized for user ${userId}`);
  }

  if (settings.strategy === "TREND_FOLLOW") {
    settings.trend_state = {
      last_result: null,
      skip_mode: false
    };
    logging.info(`TREND_FOLLOW strategy initialized for user ${userId}`);
  }

  if (betType === "COLOR" && settings.strategy === "TREND_FOLLOW") {
    settings.color_trend_state = {
      last_result: null
    };
    logging.info(`Color TREND_FOLLOW strategy initialized for user ${userId}`);
  }

  if (settings.strategy === "ALTERNATE") {
    settings.alternate_state = {
      last_result: null,
      skip_mode: false
    };
    logging.info(`ALTERNATE strategy initialized for user ${userId}`);
  }

  if (isLeslayStrategy) {

    settings.sniper_state = {
      active: false,
      direction: null,
      current_index: 0,
      hit_count: 0,
      bet_sequence: [],
      got_same_result: false
    };
    userLastNumbers[userId] = [];
    logging.info(`SNIPER strategy reset for user ${userId}`);
  }
  
  if (settings.strategy === "BEATRIX") {
    settings.beatrix_state = {
      waiting_for_seven: true,
      last_period_with_seven: null
    };
    logging.info(`BEATRIX strategy initialized for user ${userId}`);
  }
  
  if (settings.strategy === "AI_PREDICTION") {
    userAILast10Results[userId] = [];
    userAIRoundCount[userId] = 0;
    logging.info(`AI strategy initialized for user ${userId}`);
  }

  if (settings.strategy === "BABIO") {
    userAILast10Results[userId] = [];
    userAIRoundCount[userId] = 0;
    logging.info(`Babio strategy initialized for user ${userId}`);
  }

  if (settings.strategy === "LYZO") {
    userLast10Results[userId] = [];
    userLyzoRoundCount[userId] = 0;
    logging.info(`Lyzo strategy initialized for user ${userId}`);
  }

  if (!userLastNumbers[userId]) {
    userLastNumbers[userId] = [];
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
      await sendMessageWithRetry(ctx, "❌ Failed to check balance after multiple attempts. Please check your connection or try again.", makeMainMenuKeyboard(true));
      settings.running = false;
      return;
    }
  }
  let strategyText = settings.strategy === "AI_PREDICTION" ? "AI Prediction" :
                     settings.strategy === "LYZO" ? "Lyzo" :
                     settings.strategy === "DREAM" ? "Dream" :
                     settings.strategy === "BABIO" ? "Babio" :
                     settings.strategy === "BS_ORDER" ? "BS Order" :
                     settings.strategy === "LEO" ? "Leo" :
                     settings.strategy === "TREND_FOLLOW" ? "Trend Follow" :
                     settings.strategy === "ALTERNATE" ? "Alternate" :
                     settings.strategy === "SNIPER" ? "Leslay" :
                     settings.strategy === "ALINKAR" ? "Alinkar" :
                     settings.strategy === "MAY_BARANI" ? "May Barani" :
                     settings.strategy === "BEATRIX" ? "Beatrix" : settings.strategy;

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
                            settings.betting_strategy === "Custom" ? "Custom" : settings.betting_strategy;

  const profitTargetText = settings.target_profit ? `${settings.target_profit} Ks` : "Not Set";
  const stopLossText = settings.stop_loss ? `${settings.stop_loss} Ks` : "Not Set";
  const gameType = settings.game_type || "TRX";
  
  let timeRangeText = "";
  if (settings.time_range_start && settings.time_range_end) {
    timeRangeText = `\n🕒 Time Range: ${settings.time_range_start} - ${settings.time_range_end}`;
  }

  const betSizes = settings.bet_sizes || [];

 const startMessage = 
    `🍏 BOT ACTIVATED\n\n` +
    `💳 Balance: ${currentBalance} Ks\n` +
    `━━━━━━━━━━━━━━\n`+
    `🎲 Game: ${gameType}\n` +
    `🎯 Type: ${betType === "COLOR" ? "Color" : "Big/Small"}\n` +
    `━━━━━━━━━━━━━━\n`+
    `📚 Strategy: ${strategyText}\n` +
    `🕹 Betting: ${bettingStrategyText}\n` +
    `━━━━━━━━━━━━━━\n`+
    `🤿 Bet_Wrager: ${betSizes.join(',')} Ks\n`+
    `🔺 Profit Target: ${isLeslayStrategy ? "Disabled (Leslay)" : profitTargetText}\n` +
    `🔻 Stop Loss: ${stopLossText}\n` +
    `━━━━━━━━━━━━━━`+
    timeRangeText;

  await sendMessageWithRetry(ctx, startMessage);
  
  try {
    while (settings.running) {
if (settings.time_range_start && settings.time_range_end) {
  // Use Asia/Yangon timezone
  const nowYangon = moment().tz('Asia/Yangon');
  const currentTime = nowYangon.hours() * 60 + nowYangon.minutes();
  
  const startTime = parseTimeToMinutes(settings.time_range_start);
  const endTime = parseTimeToMinutes(settings.time_range_end);
  
  if (startTime !== null && endTime !== null) {
    let isWithinTimeRange;
    
    if (endTime > startTime) {
     
      isWithinTimeRange = currentTime >= startTime && currentTime < endTime;
    } else {

      isWithinTimeRange = currentTime >= startTime || currentTime < endTime;
    }
    
    if (!isWithinTimeRange) {
      const nextStartTime = getNextTimeString(startTime);
      const nextEndTime = getNextTimeString(endTime);
      
      await sendMessageWithRetry(ctx, 
        `⏸️ Bot paused - Outside time range\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `🕒 Time Range: ${settings.time_range_start} - ${settings.time_range_end}\n` +
        `⏰ Current Time (Yangon): ${formatTime(nowYangon.toDate())}\n\n` +
        `Bot will resume at ${nextStartTime}`,
        makeAutoBetKeyboard()
      );
      
      await waitForTimeRange(startTime, endTime);
      continue;
    }
  }
}

function getCurrentYangonTime() {
  return moment().tz('Asia/Yangon').format('YYYY-MM-DD HH:mm:ss');
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
          } else {
            logging.warning(`Balance check returned null for user ${userId}, using previous value`);
          }
        } catch (error) {
          logging.error(`Balance check failed: ${error.message}`);
          if (currentBalance === null) {
            currentBalance = userStats[userId].start_balance || 0;
            logging.warning(`Using default balance value: ${currentBalance}`);
          }
        }
      }

      if (currentBalance === null) {
        logging.error(`Current balance is null for user ${userId}, attempting to recover`);
        let recovered = false;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const balanceResult = await getBalance(session, parseInt(userId));
            if (balanceResult !== null) {
              currentBalance = balanceResult;
              recovered = true;
              break;
            }
            await new Promise(resolve => setTimeout(resolve, 2000));
          } catch (error) {
            logging.error(`Balance recovery attempt ${attempt + 1} failed: ${error.message}`);
          }
        }
        
        if (!recovered) {
          await sendMessageWithRetry(ctx, "❌ Failed to recover balance. Stopping bot to prevent errors.", makeMainMenuKeyboard(true));
          settings.running = false;
          break;
        }
      }
      
      const betSizes = settings.bet_sizes || [];
      if (!betSizes.length) {
        await sendMessageWithRetry(ctx, "Bet sizes not set. Please set BET SIZE first.");
        settings.running = false;
        break;
      }
      
      const minBetSize = Math.min(...betSizes);
      if (currentBalance < minBetSize) {
        const message = `❌ Insufficient balance!\n` +
                        `Current Balance: ${currentBalance.toFixed(2)} Ks\n` +
                        `Minimum Bet Required: ${minBetSize} Ks\n` +
                        `Please add funds to continue betting.`;
        await sendMessageWithRetry(ctx, message, makeMainMenuKeyboard(true));
        settings.running = false;
        break;
      }
      
      // Balance warning check
      const balanceWarningThreshold = minBetSize * 3;
      const now = Date.now();
      const lastWarning = userBalanceWarnings[userId] || 0;
      
      if (currentBalance < balanceWarningThreshold && currentBalance >= minBetSize && (now - lastWarning > 60000)) {
        const warningMessage = `⚠️ BALANCE WARNING\n\n` +
                       `💳 Current: ${currentBalance.toFixed(2)} Ks\n` +
                       `💰 Minimum Bet: ${minBetSize} Ks\n` +
                       `🔔 Make an additional Deposit`;
        await sendMessageWithRetry(ctx, warningMessage);
        userBalanceWarnings[userId] = now;
      }
      
      // Get current issue
      let issueRes;
      try {
        issueRes = await getGameIssueRequest(session, gameType);
        if (!issueRes || issueRes.code !== 0) {
          settings.consecutive_errors++;
          if (settings.consecutive_errors >= MAX_CONSECUTIVE_ERRORS) {
            await sendMessageWithRetry(ctx, `Too many consecutive errors (${MAX_CONSECUTIVE_ERRORS}). Stopping bot`);
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
          await sendMessageWithRetry(ctx, `Too many consecutive errors (${MAX_CONSECUTIVE_ERRORS}). Stopping bot`);
          settings.running = false;
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
        continue;
      }
      
      settings.consecutive_errors = 0;
      
      // Get current issue number
      let currentIssue;
      const data = issueRes.data || {};
      
      if (gameType === "TRX") {
        currentIssue = data.predraw?.issueNumber;
      } else if (gameType === "WINGO_30S" || gameType === "WINGO_3MIN" || gameType === "WINGO_5MIN") {
        currentIssue = data.issueNumber;
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
      
      if (isLeslayStrategy) {
        if (!settings.sniper_state) {
          settings.sniper_state = {
            active: false,
            direction: null,
            current_index: 0,
            hit_count: 0,
            bet_sequence: [],
            got_same_result: false
          };
        }
        
        const sniperState = settings.sniper_state;
        const lastNumbers = userLastNumbers[userId] || [];
        const lastNumber = lastNumbers.length > 0 ? lastNumbers[lastNumbers.length - 1] : null;
        
        if (!sniperState.active && lastNumber) {
          if (lastNumber === "0") {
            sniperState.active = true;
            sniperState.direction = "B";
            sniperState.current_index = 0;
            sniperState.bet_sequence = ["B"];
            sniperState.got_same_result = false;
            logging.info(`SNIPER: Found 0, starting to bet BIG`);
          } else if (lastNumber === "9") {
            sniperState.active = true;
            sniperState.direction = "S";
            sniperState.current_index = 0;
            sniperState.bet_sequence = ["S"];
            sniperState.got_same_result = false;
            logging.info(`SNIPER: Found 9, starting to bet SMALL`);
          }
        }
        
        if (sniperState.active) {
          if (sniperState.current_index < sniperState.bet_sequence.length) {
            ch = sniperState.bet_sequence[sniperState.current_index];
          } else {
            ch = sniperState.direction;
          }
          
          shouldSkip = false;
        } else {
          shouldSkip = true;
          skipReason = "(SNIPER: Wait and Get Ready for Snipe)";
          ch = "B";
        }
      } else if (settings.strategy === "BEATRIX") {
        const prediction = await getBeatrixPrediction(userId, gameType);
        if (prediction.skip) {
          shouldSkip = true;
          skipReason = "(BEATRIX: Waiting for result 7)";
          ch = 'B';
        } else {
          ch = prediction.result;
        }
      } else if (settings.strategy === "BABIO") {
        const prediction = await getBabioPrediction(userId, gameType);
        if (prediction) {
          ch = prediction.result;
        } else {
          ch = 'B';
          logging.warning("Babio prediction failed, using default B");
        }
      } else if (settings.strategy === "ALINKAR") {
        ch = getAlinkarPrediction(userId);
        logging.info(`ALINKAR strategy: Prediction is ${ch}`);
      } else if (settings.strategy === "MAY_BARANI") {
        ch = await getMayBaraniPrediction(userId);
        logging.info(`MAY BARANI strategy: Prediction is ${ch}`);
      } else if (settings.strategy === "TREND_FOLLOW") {
        if (betType === "COLOR") {
          // Use color trend follow strategy
          if (!settings.color_trend_state) {
            settings.color_trend_state = {
              last_result: null
            };
          }
          
          if (settings.color_trend_state.last_result === null) {
            const colors = ['G', 'V', 'R'];
            ch = colors[Math.floor(Math.random() * colors.length)];
            logging.info(`Color TREND_FOLLOW strategy: First bet is random (${ch})`);
          } else {
            ch = settings.color_trend_state.last_result;
            logging.info(`Color TREND_FOLLOW strategy: Following last result (${ch})`);
          }
        } else {
          if (!settings.trend_state) {
            settings.trend_state = {
              last_result: null,
              skip_mode: false
            };
          }

          const bsWaitCount = settings.bs_sb_wait_count || 0;
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
                logging.info(`TREND_FOLLOW strategy: Pattern ${actualPattern} found. Skipping next bet.`);
              } else {
                shouldSkip = false;
                settings.trend_state.skip_mode = false;
              }
            } else {
              shouldSkip = false;
              settings.trend_state.skip_mode = false;
            }
          }
          
          if (settings.trend_state.skip_mode) {
            shouldSkip = true;
            skipReason = "(BS/SB Wait)";
            if (settings.trend_state.last_result !== null) {
              ch = settings.trend_state.last_result;
            } else {
              ch = 'B';
            }
            logging.info(`TREND_FOLLOW strategy: Using ${ch} for recording (skip mode).`);
          } else {
            if (settings.trend_state.last_result === null) {
              ch = 'B';
              logging.info(`TREND_FOLLOW strategy: First bet is default: ${ch}`);
            } else {
              ch = settings.trend_state.last_result;
              logging.info(`TREND_FOLLOW strategy: Following last result: ${ch}`);
            }
          }
        }
      } else if (settings.strategy === "ALTERNATE") {
        if (!settings.alternate_state) {
          settings.alternate_state = {
            last_result: null,
            skip_mode: false
          };
        }

        const bbWaitCount = settings.bb_ss_wait_count || 0;
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
              logging.info(`ALTERNATE strategy: Pattern ${actualPattern} found. Skipping next bet.`);
            } else {
              shouldSkip = false;
              settings.alternate_state.skip_mode = false;
            }
          } else {
            shouldSkip = false;
            settings.alternate_state.skip_mode = false;
          }
        }
        
        if (settings.alternate_state.skip_mode) {
          shouldSkip = true;
          skipReason = "(BB/SS Wait)";
          if (settings.alternate_state.last_result === null) {
            ch = 'B';
          } else {
            ch = settings.alternate_state.last_result === 'B' ? 'S' : 'B';
          }
          logging.info(`ALTERNATE strategy: Using ${ch} for recording (skip mode) - opposite of last result ${settings.alternate_state.last_result}`);
        } else {
          if (settings.alternate_state.last_result === null) {
            ch = 'B';
            logging.info(`ALTERNATE strategy: First bet is default: ${ch}`);
          } else {
            ch = settings.alternate_state.last_result === 'B' ? 'S' : 'B';
            logging.info(`ALTERNATE strategy: Last result was ${settings.alternate_state.last_result}, betting opposite: ${ch}`);
          }
        }
      } else if (settings.strategy === "AI_PREDICTION") {
        const prediction = await getAIPrediction(userId, gameType);
        if (prediction) {
          ch = prediction.result;
        } else {
          ch = 'B';
          logging.warning("AI prediction failed, using default B");
        }
      } else if (settings.strategy === "LYZO") {
        const prediction = await getLyzoPrediction(userId, gameType);
        if (prediction) {
          ch = prediction.result;
        } else {
          ch = 'B';
          logging.warning("Lyzo prediction failed, using default B");
        }
      } else if (settings.strategy === "DREAM") {
        if (!settings.dream_state) {
          settings.dream_state = {
            first_bet: true,
            current_pattern: "",
            current_index: 0
          };
        }
        
        const dreamState = settings.dream_state;
        
        if (dreamState.first_bet) {
          ch = 'B';
          logging.info(`DREAM strategy: First bet is default: ${ch}`);
        } else if (dreamState.current_pattern && dreamState.current_index < dreamState.current_pattern.length) {
          ch = dreamState.current_pattern[dreamState.current_index];
          logging.info(`DREAM strategy: Using pattern ${dreamState.current_pattern} at index ${dreamState.current_index}: ${ch}`);
        } else {
          ch = 'B';
          logging.warning("DREAM strategy pattern invalid, using default B");
        }
      } else if (settings.strategy === "DREAM2") {
        const patternIndex = settings.pattern_index || 0;
        ch = DREAM2_PATTERN[patternIndex % DREAM2_PATTERN.length];
        logging.info(`DREAM 2 strategy: Using pattern ${DREAM2_PATTERN} at index ${patternIndex}: ${ch}`);
      } else if (settings.strategy === "BS_ORDER") {
        if (!settings.pattern) {
          settings.pattern = DEFAULT_BS_ORDER;
          settings.pattern_index = 0;
          await sendMessageWithRetry(ctx, `No BS order provided. Using default: ${DEFAULT_BS_ORDER}`, makeMainMenuKeyboard(true));
        }
        
        const pattern = settings.pattern;
        const patternIndex = settings.pattern_index || 0;
        ch = pattern[patternIndex % pattern.length];
      } else if (settings.strategy === "LEO") {
        if (!settings.leo_state) {
          settings.leo_state = {
            last_result: null,
            pattern_index: 0
          };
        }
        
        if (settings.leo_state.last_result === null) {
          ch = 'B';
          logging.info(`LEO strategy: First bet is default: ${ch}`);
        } else {
          const pattern = settings.leo_state.last_result === 'B' ? LEO_BIG_PATTERN : LEO_SMALL_PATTERN;
          ch = pattern[settings.leo_state.pattern_index % pattern.length];
          logging.info(`LEO strategy: Using ${settings.leo_state.last_result === 'B' ? 'BIG' : 'SMALL'} pattern at index ${settings.leo_state.pattern_index}: ${ch}`);
        }
      } else {
        ch = 'B';
        logging.info(`Using default B prediction`);
      }
      
      const selectType = getSelectMap(gameType, betType)[ch];

      if (selectType === undefined) {
        logging.error(`Invalid selectType for bet choice ${ch}, gameType ${gameType}, betType ${betType}`);
        await sendMessageWithRetry(ctx, `Invalid bet selection: ${ch}. Please check your strategy settings.`);
        settings.consecutive_errors++;
        if (settings.consecutive_errors >= MAX_CONSECUTIVE_ERRORS) {
          await sendMessageWithRetry(ctx, `Too many consecutive errors (${MAX_CONSECUTIVE_ERRORS}). Stopping bot`);
          settings.running = false;
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
        continue;
      }

      logging.info(`Placing bet for user ${userId}:`);
      logging.info(`  Bet Choice: ${ch} (${betType === "COLOR" ? getColorName(ch) : (ch === 'B' ? 'Big' : 'Small')})`);
      logging.info(`  SelectType: ${selectType}, GameType API: ${betType === "COLOR" ? 0 : 2}`);

      if (!isLeslayStrategy) {
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
            skipReason = "(Entry Layer 2 - Waiting for Lose)";
          } else {
            if (!shouldSkip) {
              shouldSkip = userShouldSkipNext[userId] || false;
              if (shouldSkip) {
                skipReason = "(SL Layer Skip)";
              }
            }
          }
        } else if (entryLayer === 3) {
          if (settings.entry_layer_state && settings.entry_layer_state.waiting_for_loses) {
            shouldSkip = true;
            skipReason = `(Entry Layer 3 - Waiting for ${settings.entry_layer_state.consecutive_loses || 0}/2 Loses)`;
          } else {
            if (!shouldSkip) {
              shouldSkip = userShouldSkipNext[userId] || false;
              if (shouldSkip) {
                skipReason = "(SL Layer Skip)";
              }
            }
          }
        }
      }
      
      if (userSLSkipWaitingForWin[userId]) {
        skipReason += "-";
      }
      
      const betEmoji = getBetIndexEmoji(settings);
      
      const gameId = `🎫 ${gameType} : ${currentIssue}`;
      
      if (shouldSkip) {
        let betChoiceText;
        if (betType === "COLOR") {
          betChoiceText = getColorName(ch);
        } else {
          betChoiceText = ch === 'B' ? 'BIG' : 'SMALL';
        }
        
        let betMsg = `⏭️ SKIP BET\n` +
             `🎫 ${gameType} : ${currentIssue}`;
        
        if (!userSkippedBets[userId]) {
          userSkippedBets[userId] = {};
        }
        userSkippedBets[userId][currentIssue] = [ch, settings.virtual_mode];
        
        userSkipResultWait[userId] = currentIssue;
        
        await sendMessageWithRetry(ctx, betMsg);
        
        // Wait for result
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
          logging.warning(`Result not available for skipped bet ${currentIssue} after ${maxWaitAttempts} seconds`);
          if (userSkipResultWait[userId] === currentIssue) {
            delete userSkipResultWait[userId];
          }
        }
      } else {

        let desiredAmount;
        if (isLeslayStrategy && settings.sniper_state && settings.sniper_state.active) {
          const sniperState = settings.sniper_state;
          desiredAmount = settings.bet_sizes[sniperState.current_index];
        } else {
          try {
            desiredAmount = calculateBetAmount(settings, currentBalance);
          } catch (error) {
            await sendMessageWithRetry(ctx, 
              `❌ ${error.message}\n` +
              `Please stop bot and set Bet Wrager again.`,
              makeMainMenuKeyboard(true)
            );
            settings.running = false;
            break;
          }
        }
        
        const { unitAmount, betCount, actualAmount } = computeBetDetails(desiredAmount);
        
        if (actualAmount === 0) {
          await sendMessageWithRetry(ctx, 
            `❌ Invalid bet amount: ${desiredAmount} Ks\n` +
            `Minimum bet amount is ${unitAmount} Ks\n` +
            `Please increase your bet wrager.`,
            makeMainMenuKeyboard(true)
          );
          settings.running = false;
          break;
        }

        if (currentBalance < actualAmount) {
          const message = `❌ Insufficient balance for next bet!\n` +
                          `Current Balance: ${currentBalance.toFixed(2)} Ks\n` +
                          `Required Bet Amount: ${actualAmount.toFixed(2)} Ks\n` +
                          `Please add funds to continue betting.`;
          await sendMessageWithRetry(ctx, message, makeMainMenuKeyboard(true));
          settings.running = false;
          break;
        }

        let betChoiceText;
        if (betType === "COLOR") {
          betChoiceText = getColorName(ch);
        } else {
          betChoiceText = ch === 'B' ? 'BIG' : 'SMALL';
        }
        
        let betMsg = `${gameId}\n${betEmoji} Order: ${betChoiceText} | ${actualAmount} Ks\n📚 Strategy: ${strategyText}\n`;

        if (isLeslayStrategy && settings.sniper_state && settings.sniper_state.active) {
          const hitCount = settings.sniper_state.hit_count || 0;
          betMsg += `\n🎯 SNIPER: Bet ${settings.sniper_state.current_index + 1}/4`;
          betMsg += `\n🎯 Hits: ${hitCount}/2`;
          betMsg += `\n📍 Normal Bet: ${betChoiceText}`;
        }

        if (settings.strategy === "BEATRIX" && settings.beatrix_state) {
          const beatrixState = settings.beatrix_state;
          if (beatrixState.last_period_with_seven) {
            const lastDigit = parseInt(beatrixState.last_period_with_seven.slice(-1));
            betMsg += `\n👑 BEATRIX: Period ${beatrixState.last_period_with_seven} ends with ${lastDigit}`;
          }
        }
        
        await sendMessageWithRetry(ctx, betMsg);
        
        if (settings.virtual_mode) {
          if (!userPendingBets[userId]) {
            userPendingBets[userId] = {};
          }
          userPendingBets[userId][currentIssue] = [ch, actualAmount, true];
          userWaitingForResult[userId] = true;
        } else {
          const betResp = await placeBetRequest(session, currentIssue, selectType, unitAmount, betCount, gameType, parseInt(userId));
          
          if (betResp.error || betResp.code !== 0) {
            logging.error(`Bet placement failed for user ${userId}: ${betResp.msg || betResp.error}`);
            logging.error(`Bet details: issue=${currentIssue}, selectType=${selectType}, amount=${unitAmount * betCount}, gameType=${gameType}`);
            
            await sendMessageWithRetry(ctx, `Bet error: ${betResp.msg || betResp.error}. Retrying🔄...`);
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
      if (settings.strategy === "DREAM2") {
        settings.pattern_index = (settings.pattern_index + 1) % DREAM2_PATTERN.length;
      } else if (settings.strategy === "BS_ORDER" && settings.pattern) {
        settings.pattern_index = (settings.pattern_index + 1) % settings.pattern.length;
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } catch (error) {
    logging.error(`Betting worker error for user ${userId}: ${error.message}`);
    await sendMessageWithRetry(ctx, `Betting error: ${error.message}. Stopping...`);
    settings.running = false;
  } finally {
    settings.running = false;
    delete userWaitingForResult[userId];
    delete userShouldSkipNext[userId];
    delete userBalanceWarnings[userId];
    delete userSkipResultWait[userId];
    delete userSLSkipWaitingForWin[userId];

    if (settings.strategy === "AI_PREDICTION") {
      delete userAILast10Results[userId];
      delete userAIRoundCount[userId];
    }

    if (settings.strategy === "BABIO") {
      delete userAILast10Results[userId];
      delete userAIRoundCount[userId];
      delete settings.babio_state;
    }

    if (settings.strategy === "LYZO") {
      delete userLast10Results[userId];
      delete userLyzoRoundCount[userId];
    }

    if (settings.strategy === "LEO") {
      delete settings.leo_state;
    }

    if (settings.strategy === "TREND_FOLLOW") {
      delete settings.trend_state;
      delete settings.color_trend_state;
    }

    if (settings.strategy === "ALTERNATE") {
      delete settings.alternate_state;
    }

    if (isLeslayStrategy) {
      delete settings.sniper_state;
    }

    if (settings.strategy === "BEATRIX") {
      delete settings.beatrix_state;
    }

    let totalProfit = 0;
    let balanceText = "";
    
    if (settings.virtual_mode) {
      totalProfit = (userStats[userId]?.virtual_balance || 0) - (userStats[userId]?.initial_balance || 0);
      balanceText = `Final Balance: ${(userStats[userId]?.virtual_balance || 0).toFixed(2)} Ks\n`;
    } else {
      totalProfit = userStats[userId]?.profit || 0;
      try {
        const finalBalance = await getBalance(session, userId);
        balanceText = `Final Balance: ${finalBalance?.toFixed(2) || '0.00'} Ks\n`;
      } catch (error) {
        logging.error(`Failed to get final balance: ${error.message}`);
        balanceText = "Final Balance: Unknown\n";
      }
    }
    
    // Calculate profit
    let profitIndicator = "";
    if (totalProfit > 0) {
      profitIndicator = "+";
    } else if (totalProfit < 0) {
      profitIndicator = "-";
    }

    delete userStats[userId];
    settings.martin_index = 0;
    settings.dalembert_units = 1;
    settings.custom_index = 0;
    delete settings.dream_state;

    if (settings.sniper_hit_twice) {
      await sendMessageWithRetry(ctx, "🎯 SNIPER HIT 2/2! Hit All Target! Bot deactivated.", makeMainMenuKeyboard(true));
      settings.sniper_hit_twice = false;
    }

    if (settings.sniper_max_reached) {
      await sendMessageWithRetry(ctx, "🔄 Next Time Better Luck", makeMainMenuKeyboard(true));
      settings.sniper_max_reached = false;
    }

    if (!userStopInitiated[userId]) {
  const message = `🍎 BOT DEACTIVATED\n\n` +
                `💳 ${balanceText}` +
                `💰 Total Profit: ${profitIndicator}${totalProfit.toFixed(2)} Ks`;
  
  await bot.telegram.sendMessage(userId, message);
}

    delete userStopInitiated[userId];

    delete userAllResults[userId];

    delete userPendingProfitStopMessages[userId];
  }
}

function makeMainMenuKeyboard(loggedIn = false, userId = null) {
  const isAdmin = userId && userId === ADMIN_ID;

  if (!loggedIn) {
    return Markup.keyboard([
      ["🔐 Login"]
    ]).resize().oneTime(false);
  }

  if (isAdmin) {
    // Keyboard for Admin
    return Markup.keyboard([
      ["🎮 Manual Bet", "🤖 Auto Bet"],
      ["🛠️ Admin Panel", "📺 Watch Tutorial"],
      ["🔐 Login Again"]
    ]).resize().oneTime(false);
  } else {
    // Keyboard for users
    return Markup.keyboard([
      ["🎮 Manual Bet", "🤖 Auto Bet"],
      ["📺 Watch Tutorial", "🔐 Login Again"]
    ]).resize().oneTime(false);
  }
}

function makeSiteSelectionKeyboard() {
  return Markup.keyboard([
    ["777BIGWIN", "6Lottery"],
    ["🔙 Back to Main Menu"]
  ]).resize().oneTime(false);
}

function makeAdminPanelKeyboard() {
  return Markup.keyboard([
    ["👤 Add User", "🗑️ Remove User"],
    ["📊 User Stats", "📋 Allowed IDs"],
    ["✅ Enable Free Mode", "❌ Disable Free Mode"],
    ["📢 Broadcast", "🔍 Check Free Mode"],
    ["🔙 Back to Main Menu"]
  ]).resize().oneTime(false);
}

function makeManualBetKeyboard() {
  return Markup.keyboard([
    ["💰 Balance", "📊 Results", "📝 Recent Bet"],
    ["🎯 Bet Big", "🎯 Bet Small"],
    ["🔴 Bet Red", "🟢 Bet Green", "🟣 Bet Violet"],
    ["⏳ Time Left", "🔧 Debug API", "🎲 Game Type"],
    ["🔐 Login Again", "🤖 Auto Bet", "🔙 Back to Main Menu"]
  ]).resize().oneTime(false);
}

function makeRiskControlKeyboard() {
  return Markup.keyboard([
    ["🔺 Profit Target", "🔻 Stop Loss Limit"],
    ["⛳ Entry Layer", "💥 Bet_SL"],
    ["🕒 Time Range",  "📚 Strategy"],
    ["🔙 Back"] 
  ]).resize().oneTime(false);
}

function makeBetPlaceSettingsKeyboard() {
  return Markup.keyboard([
    ["🕹 Anti/Martingale", "🎲 Game Type"],
    ["🎯 Bet Type", "🔙 Back to Auto Bet"]
  ]).resize().oneTime(false);
}

function makeAutoBetKeyboard() {
  return Markup.keyboard([
    ["🍏 Activate", "🍎 Deactivate"],
    ["🤿 Bet_Wrager", "🎛 Virtual/Real Mode"],
    ["📟 Risk Control", "⚙️ Bet Place Settings"],
    ["📂 Info", "🔐 Login Again"],
    ["🎮 Manual Bet", "🔙 Back to Main Menu"]
  ]).resize().oneTime(false);
}

function makeStrategyKeyboard(userId = null) {
  const gameType = userId && userSettings[userId] ? userSettings[userId].game_type || "TRX" : "TRX";
  const betType = userId && userSettings[userId] ? userSettings[userId].bet_type || "BS" : "BS";

  let keyboard = [];

  if (gameType === "TRX") {
    keyboard = [
      [
        Markup.button.callback("📜 BS-Order", "strategy:BS_ORDER"),
        Markup.button.callback("📈 TREND_FOLLOW", "strategy:TREND_FOLLOW")
      ],
      [
        Markup.button.callback("🔄 AlTERNATE", "strategy:ALTERNATE"),
        Markup.button.callback("🤖 CHAT GPT V1", "strategy:AI_PREDICTION")
      ],
      [
        Markup.button.callback("💭 DREAM", "strategy:DREAM")
      ],
      [
        Markup.button.callback("🌙 BABIO", "strategy:BABIO"),
        Markup.button.callback("🦁 LEO", "strategy:LEO")
      ],
      [
        Markup.button.callback("🔫LESLAY", "strategy:SNIPER"),
        Markup.button.callback("🚬 ALINKAR", "strategy:ALINKAR")
      ],
      [
        Markup.button.callback("🐰MAY BARANI", "strategy:MAY_BARANI")
      ]
    ];
  } else {
    keyboard = [
      [
        Markup.button.callback("📜 BS-Order", "strategy:BS_ORDER"),
        Markup.button.callback("📈 TREND_FOLLOW", "strategy:TREND_FOLLOW")
      ],
      [
        Markup.button.callback("🔄 AlTERNATE", "strategy:ALTERNATE"),
        Markup.button.callback("🤖 CHAT GPT V1", "strategy:AI_PREDICTION")
      ],
      [
        Markup.button.callback("🔮 LYZO", "strategy:LYZO"),
        Markup.button.callback("💭 DREAM", "strategy:DREAM")
      ],
      [
        Markup.button.callback("🌙 BABIO", "strategy:BABIO"),
        Markup.button.callback("🦁 LEO", "strategy:LEO")
      ],
      [
        Markup.button.callback("🔫LESLAY", "strategy:SNIPER"),
        Markup.button.callback("🚬 ALINKAR", "strategy:ALINKAR")
      ],
      [
        Markup.button.callback("🐰MAY BARANI", "strategy:MAY_BARANI"),
        Markup.button.callback("👑BEATRIX", "strategy:BEATRIX")
      ]
    ];
  }

  if (betType === "COLOR") {
    keyboard = [
      [Markup.button.callback("📈 TREND_FOLLOW", "strategy:TREND_FOLLOW")]
    ];
  }
  
  return Markup.inlineKeyboard(keyboard);
}

function makeBetTypeKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("🧿 Big/Small", "bet_type:BS")],
    [Markup.button.callback("🖌 Color", "bet_type:COLOR")]
  ]);
}

function makeBSWaitCountKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("1", "bs_wait_count:1"), Markup.button.callback("2", "bs_wait_count:2"), Markup.button.callback("3", "bs_wait_count:3")],
    [Markup.button.callback("4", "bs_wait_count:4"), Markup.button.callback("5", "bs_wait_count:5"), Markup.button.callback("6", "bs_wait_count:6")],
    [Markup.button.callback("7", "bs_wait_count:7"), Markup.button.callback("8", "bs_wait_count:8"), Markup.button.callback("9", "bs_wait_count:9")],
    [Markup.button.callback("0 (Disable)", "bs_wait_count:0")]
  ]);
}

function makeBBWaitCountKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("1", "bb_wait_count:1"), Markup.button.callback("2", "bb_wait_count:2"), Markup.button.callback("3", "bb_wait_count:3")],
    [Markup.button.callback("4", "bb_wait_count:4"), Markup.button.callback("5", "bb_wait_count:5"), Markup.button.callback("6", "bb_wait_count:6")],
    [Markup.button.callback("7", "bb_wait_count:7"), Markup.button.callback("8", "bb_wait_count:8"), Markup.button.callback("9", "bb_wait_count:9")],
    [Markup.button.callback("0 (Disable)", "bb_wait_count:0")]
  ]);
}

function makeBettingStrategyKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("Anti-Martingale", "betting_strategy:Anti-Martingale")],
    [Markup.button.callback("Martingale", "betting_strategy:Martingale")],
    [Markup.button.callback("D'Alembert", "betting_strategy:D'Alembert")]
  ]);
}

function makeGameTypeKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("🎰 WINGO", "game_type:WINGO_SELECT")],
    [Markup.button.callback("💎 TRX", "game_type:TRX")]
  ]);
}

function makeWINGOSelectionKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("⚡ WINGO 30s", "game_type:WINGO_30S"), 
     Markup.button.callback("⏱️ WINGO 1min", "game_type:WINGO")],
    [Markup.button.callback("⏰ WINGO 3min", "game_type:WINGO_3MIN"), 
     Markup.button.callback("🕐 WINGO 5min", "game_type:WINGO_5MIN")]
  ]);
}

function makeEntryLayerKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("1 - Direct  For BET", "entry_layer:1")],
    [Markup.button.callback("2 - Wait for 1 Lose", "entry_layer:2")],
    [Markup.button.callback("3 - Wait for 2 Loses", "entry_layer:3")]
  ]);
}

function makeSLLayerKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("0 - Disabled", "sl_layer:0")],
    [Markup.button.callback("1", "sl_layer:1"), Markup.button.callback("2", "sl_layer:2"), Markup.button.callback("3", "sl_layer:3")],
    [Markup.button.callback("4", "sl_layer:4"), Markup.button.callback("5", "sl_layer:5"), Markup.button.callback("6", "sl_layer:6")],
    [Markup.button.callback("7", "sl_layer:7"), Markup.button.callback("8", "sl_layer:8"), Markup.button.callback("9", "sl_layer:9")]
  ]);
}

function makeModeSelectionKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("🖥️ Virtual Mode", "mode:virtual")],
    [Markup.button.callback("💵 Real Mode", "mode:real")]
  ]);
}

function makeTimeRangeKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("Set Start Time", "time_range:start"),
      Markup.button.callback("Set End Time", "time_range:end")
    ],
    [
      Markup.button.callback("Clear Time Range", "time_range:clear"),
      Markup.button.callback("Show Current", "time_range:show")
    ]
  ]);
}

async function checkUserAuthorized(ctx) {
  const userId = ctx.from.id;
  if (!userSessions[userId]) {
    await sendMessageWithRetry(ctx, "Please login first", makeMainMenuKeyboard(false));
    return false;
  }
  if (!userSettings[userId]) {
    userSettings[userId] = {
      strategy: "AI_PREDICTION",
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

async function handleAdminPanelCommand(ctx, userId, userName, command) {
  if (userId !== ADMIN_ID) {
    await sendMessageWithRetry(ctx, "❌ Admin only command!");
    return;
  }

  switch (command) {
    case "👤 Add User":
    case "ADD USER":
    case "ADD":
      userState[userId] = { state: "INPUT_ADD_USER" };
      await sendMessageWithRetry(ctx, "Please enter the 6lottery ID to add:");
      break;

    case "🗑️ Remove User":
    case "REMOVE USER":
    case "REMOVE":
      userState[userId] = { state: "INPUT_REMOVE_USER" };
      await sendMessageWithRetry(ctx, "Please enter the 6lottery ID to remove:");
      break;

    case "📊 User Stats":
    case "USER STATS":
    case "USERS":
      await cmdUsersHandler(ctx);
      break;

    case "📋 Allowed IDs":
    case "ALLOWED IDS":
    case "SHOWID":
      await cmdShowIdHandler(ctx);
      break;

    case "✅ Enable Free Mode":
    case "ENABLE FREE MODE":
    case "ENABLE":
      await cmdEnableHandler(ctx);
      break;

    case "❌ Disable Free Mode":
    case "DISABLE FREE MODE":
    case "DISABLE":
      await cmdDisableHandler(ctx);
      break;

    case "📢 Broadcast":
    case "BROADCAST":
    case "SEND":
      userState[userId] = { state: "INPUT_BROADCAST_MESSAGE" };
      await sendMessageWithRetry(ctx, "Please enter the message to broadcast to all users:");
      break;

    case "🔍 Check Free Mode":
    case "CHECK FREE MODE":
      const status = global.publicAccessEnabled ? "✅ Enabled" : "❌ Disabled";
      await sendMessageWithRetry(ctx, `Free Mode Status: ${status}`);
      break;

    case "🔙 Back to Main Menu":
    case "BACK TO MAIN MENU":
      await cmdStartHandler(ctx);
      break;

    default:
      await sendMessageWithRetry(ctx, "Unknown command. Please select from the Admin Panel.");
      break;
  }
}

async function cmdAdminPanelHandler(ctx) {
  const userId = ctx.from.id;
  
  if (userId !== ADMIN_ID) {
    await sendMessageWithRetry(ctx, "❌ Admin only command!");
    return;
  }
  
  const welcomeMessage = 
    `🛠️ <b>Admin Panel</b>\n\n` +
    `Welcome, Admin!\n` +
    `Select an option below:`;
  
  try {
    await ctx.reply(welcomeMessage, { 
      reply_markup: makeAdminPanelKeyboard().reply_markup,
      parse_mode: 'HTML'
    });
  } catch (error) {
    logging.error(`Error displaying admin panel: ${error.message}`);
    await sendMessageWithRetry(ctx, "Error displaying admin panel. Please try again.");
  }
}

async function handleResultsCommand(ctx, userId) {
  try {
    const session = userSessions[userId];
    const settings = userSettings[userId] || {};
    const gameType = settings.game_type || "TRX";

    if (!session) {
      await sendMessageWithRetry(ctx, "❌ Please login first");
      return;
    }

    await sendMessageWithRetry(ctx, "⏳ Fetching last 10 results...");

    let resultsData;
    
    if (gameType === "TRX") {
      resultsData = await getTRXGameResultsNew(session, gameType);
    } else {
      resultsData = await getWingoGameResults(session, gameType);
    }
    
    const apiGameType = gameType === "TRX" ? "WINGO" : gameType;
    try {
      const issueRes = await getGameIssueRequest(session, apiGameType);
      if (issueRes && issueRes.code === 0 && issueRes.data) {
        timeLeftInfo = issueRes.data;
        logging.info(`Time left API response from ${apiGameType} (for ${gameType}): ${JSON.stringify(timeLeftInfo)}`);
      }
    } catch (error) {
      logging.error(`Error getting time left from ${apiGameType}: ${error.message}`);
    }

    const timeLeftInfo = await getCurrentPeriodTimeLeft(userId);
    
    if (resultsData && resultsData.code === 0 && resultsData.data && resultsData.data.list) {
  const results = resultsData.data.list.slice(0, 10);
  
  const imageBuffer = await createResultsTableImage(results, gameType, timeLeftInfo);
  
  if (imageBuffer) {
    await ctx.replyWithPhoto(
      { source: imageBuffer },
      {
        caption: `📊 ${gameType} - Last 10 Results`
      }
    );
  } else {
        let message = `🗒 <b>${gameType} - Results</b>\n`;
        message += `═══════════════\n\n`;
        
        if (timeLeftInfo) {
          let currentIssue = "";
          let timeLeftDisplay = "";
          let secondsLeft = 0;
          
          if (gameType === "TRX") {
            const trxIssueRes = await getGameIssueRequest(session, "TRX");
            if (trxIssueRes && trxIssueRes.code === 0 && trxIssueRes.data) {
              if (trxIssueRes.data.predraw) {
                currentIssue = trxIssueRes.data.predraw.issueNumber || "";
              }
            }
          } else {
            currentIssue = timeLeftInfo.issueNumber || "";
          }
          
          if (timeLeftInfo.endTime && timeLeftInfo.serviceTime) {
            try {
              const endTime = new Date(timeLeftInfo.endTime.replace(' ', 'T'));
              const serviceTime = new Date(timeLeftInfo.serviceTime.replace(' ', 'T'));
              const timeDiffMs = endTime.getTime() - serviceTime.getTime();
              secondsLeft = Math.max(0, Math.floor(timeDiffMs / 1000));
              
              const minutesLeft = Math.floor(secondsLeft / 60);
              const secondsRemaining = secondsLeft % 60;
              timeLeftDisplay = `${minutesLeft.toString().padStart(2, '0')}:${secondsRemaining.toString().padStart(2, '0')}`;
            } catch (error) {
              logging.error(`Error parsing timestamps: ${error.message}`);
            }
          }
          
          if (currentIssue) {
            const displayIssue = currentIssue.length > 5 ? currentIssue.slice(-5) : currentIssue;
            message += `<b>📅 Current Period: ${displayIssue}</b>\n`;
          }
          
          if (secondsLeft > 0) {
            message += `<b>⏳ Time Left: ${timeLeftDisplay} (${secondsLeft}s)</b>\n`;
            message += `\n`;
          }
        }
        
        message += `<code>Period   Numbers     Colors</code>\n`;
        message += `<code>───────────────────────</code>\n`;

        results.forEach((result) => {
          const number = result.number || "0";
          const period = result.issueNumber ? result.issueNumber.slice(-5) : "N/A";
          const colorNum = parseInt(number) % 10;
          
          let color = "";
          if (COLORS.GREEN.numbers.includes(colorNum)) color = "G";
          else if (COLORS.VIOLET.numbers.includes(colorNum)) color = "V";
          else if (COLORS.RED.numbers.includes(colorNum)) color = "R";
          
          let colorDisplay = "";
          if (color === 'R') colorDisplay = "     🔴";
          else if (color === 'G') colorDisplay = "     🟢";
          else if (color === 'V') colorDisplay = "     🟣";

          if (colorNum === 0) {
            colorDisplay = "    🔴🟣";
          } else if (colorNum === 5) {
            colorDisplay = "    🟢🟣"; 
          }

          const isBig = colorNum >= 5;
          const bigSmallText = isBig ? 'BIG' : 'SMALL';

          const periodDisplay = period.padEnd(6, ' ');
          const numberDisplay = `   ${number}(${bigSmallText})`.padEnd(11, ' ');
          
          message += `<code>${periodDisplay}${numberDisplay}${colorDisplay}</code>\n`;
        });
        
        message += `\n🔄 Click "📊 Results" again to refresh`;
        
        await ctx.reply(message, { parse_mode: 'HTML' });
      }
    } else {
      await sendMessageWithRetry(ctx, "❌ Failed to fetch results");
    }
  } catch (error) {
    logging.error(`Error fetching results: ${error.message}`);
    await sendMessageWithRetry(ctx, "❌ Error fetching results");
  }
}

async function getCurrentPeriodTimeLeft(userId) {
  try {
    const session = userSessions[userId];
    if (!session) {
      return null;
    }
    
    const settings = userSettings[userId] || {};
    const gameType = settings.game_type || "TRX";
    
    const apiGameType = gameType === "TRX" ? "WINGO" : gameType;
    
    const issueRes = await getGameIssueRequest(session, apiGameType);
    if (!issueRes || issueRes.code !== 0 || !issueRes.data) {
      logging.info(`No issue response for ${apiGameType}`);
      return null;
    }
    
    const data = issueRes.data;
    let currentIssue = "";
    let secondsLeft = 0;
    let timeLeftDisplay = "";
    
    logging.info(`${apiGameType} API Raw Data (for ${gameType}): ${JSON.stringify(data)}`);
    
    if (apiGameType === "TRX" && data.predraw) {
      currentIssue = data.predraw.issueNumber || data.predraw.issue || "";
    } else {
      currentIssue = data.issueNumber || "";
    }
    
    if (!currentIssue && gameType === "TRX") {
      const trxIssueRes = await getGameIssueRequest(session, "TRX");
      if (trxIssueRes && trxIssueRes.code === 0 && trxIssueRes.data) {
        if (trxIssueRes.data.predraw) {
          currentIssue = trxIssueRes.data.predraw.issueNumber || trxIssueRes.data.predraw.issue || "";
        }
      }
    }
    
    if (data.endTime && data.serviceTime) {
      try {
        const endTime = new Date(data.endTime.replace(' ', 'T'));
        const serviceTime = new Date(data.serviceTime.replace(' ', 'T'));
        const timeDiffMs = endTime.getTime() - serviceTime.getTime();
        secondsLeft = Math.max(0, Math.floor(timeDiffMs / 1000));
        logging.info(`${gameType} time from ${apiGameType} API: ${secondsLeft}s`);
      } catch (error) {
        logging.error(`Error parsing timestamps: ${error.message}`);
      }
    } else if (data.timeLeft) {
      const cleanTime = data.timeLeft.replace(/[^0-9:]/g, '');
      const timeParts = cleanTime.split(':');
      
      if (timeParts.length === 3) {
        const hours = parseInt(timeParts[0]) || 0;
        const minutes = parseInt(timeParts[1]) || 0;
        const seconds = parseInt(timeParts[2]) || 0;
        secondsLeft = (hours * 3600) + (minutes * 60) + seconds;
      } else if (timeParts.length === 2) {
        const minutes = parseInt(timeParts[0]) || 0;
        const seconds = parseInt(timeParts[1]) || 0;
        secondsLeft = (minutes * 60) + seconds;
      }
    }
    
    // Format display string
    if (secondsLeft > 0) {
      const minutesLeft = Math.floor(secondsLeft / 60);
      const secondsRemaining = secondsLeft % 60;
      
      if (minutesLeft > 0) {
        timeLeftDisplay = `${minutesLeft.toString().padStart(2, '0')}:${secondsRemaining.toString().padStart(2, '0')}`;
      } else {
        timeLeftDisplay = `00:${secondsRemaining.toString().padStart(2, '0')}`;
      }
    }
    
    logging.info(`${gameType} Final Result - Issue: ${currentIssue}, TimeLeft: ${timeLeftDisplay} (${secondsLeft}s) from ${apiGameType} API`);
    
    return {
      currentIssue: currentIssue,
      secondsLeft: secondsLeft,
      timeLeftDisplay: timeLeftDisplay,
      gameType: gameType
    };
    
  } catch (error) {
    logging.error(`Error getting current period time: ${error.message}`);
    return null;
  }
}

async function handleRecentBetsCommand(ctx, userId) {
  try {
    if (!userManualBetHistory[userId]) {
      userManualBetHistory[userId] = [];
    }
    
    const manualBets = userManualBetHistory[userId].slice(0, 10); // Get last 10 bets
    
    if (manualBets.length > 0) {
      // Create and send image
      const imageBuffer = await createRecentBetTableImage(manualBets, userId); 
      
      if (imageBuffer) {
        await ctx.replyWithPhoto(
          { source: imageBuffer },
          {
            caption: `📝 Recent Manual Bets - Last 10 bets`
          }
        );
      } else {
        let message = `📝 <b>Recent Manual Bets</b>\n`;
        message += `═══════════\n\n`;
        message += `<code>Period     W/L      Amount</code>\n`;
        
        let totalWins = 0;
        let totalLosses = 0;
        let totalProfit = 0;
        
        manualBets.forEach((bet) => {
          const period = bet.period ? bet.period.slice(-5) : "N/A";
          const result = bet.result || "PENDING";
          const amount = bet.amount || 0;
          const winAmount = bet.winAmount || 0;

          let amountText = "";
          if (result === "WIN") {
            amountText = `+${Math.round(winAmount)} Ks`;
            totalWins++;
            totalProfit += winAmount;
          } else if (result === "LOSE") {
            amountText = `-${amount} Ks`;
            totalLosses++;
            totalProfit -= amount;
          } else {
            amountText = `${amount} Ks`;
          }

          const periodPad = period.padEnd(11, ' ');
          const resultPad = result.padEnd(9, ' ');
          
          message += `<code>${periodPad}${resultPad}${amountText}</code>\n`;
        });

        message += `<code>─────────────────────────</code>\n`;

        let profitColor = totalProfit >= 0 ? '🟢' : '🔴';
        let profitSign = totalProfit >= 0 ? '+' : '';
         let currentBalance = 0;
    if (userId && userGameInfo[userId]) {
      currentBalance = userGameInfo[userId].balance || 0;
    }
        

      message += `<b>${profitColor} Summary: ${totalWins}W ${totalLosses}L | Profit: ${profitSign}${Math.round(totalProfit)} Ks | Current Balance: ${currentBalance.toFixed(2)} Ks</b>\n\n`;

        await ctx.reply(message, { parse_mode: 'HTML' });
      }
    } else {
      await sendMessageWithRetry(ctx, "No manual bets found");
    }
  } catch (error) {
    logging.error(`Error showing recent bets: ${error.message}`);
    await sendMessageWithRetry(ctx, "❌ Error fetching recent bets");
  }
}

async function cmdStartHandler(ctx) {
  const userId = ctx.from.id;
  const userName = ctx.from.username || ctx.from.first_name || "Unknown";
  const firstName = ctx.from.first_name || "User";
  
  console.log(`[USER_ACTIVITY] User ${userName} (ID: ${userId}) sent /start message`);
  
  activeUsers.add(userId);
  
  if (!userSettings[userId]) {
    userSettings[userId] = {
      strategy: "AI_PREDICTION",
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
  
  userLastNumbers[userId] = [];
  
  const loggedIn = !!userSessions[userId];

  try {
    const photos = await ctx.telegram.getUserProfilePhotos(userId, 0, 1);
    
    if (photos.total_count > 0) {
      const fileId = photos.photos[0][0].file_id;
      
      const welcomeKeyboard = Markup.inlineKeyboard([
        [Markup.button.callback("📺 Watch Tutorial", "tutorial:watch")],
        [Markup.button.url("📢 Join Updates Group", "https://t.me/CHEATBYOXIDE")]
      ]);
      
      const welcomeCaption = 
        `🤖 LOTTERY AUTOBET VERSION 1.1\n\n` +
        `Welcome, ${firstName}! 👋\n\n` +
        `This is the most advanced\n` +
        `lottery betting system!\n\n` +
        `🎯 Multiple Strategies\n` +
        `⚡ Real-time Betting\n` +
        `📊 Advanced Analytics\n` +
        `📺 Click "Watch Tutorial" button to learn how to use the bot\n\n` +
        `Developed by: @Mlopp67`;
      
      await ctx.replyWithPhoto(fileId, {
        caption: welcomeCaption,
        reply_markup: welcomeKeyboard.reply_markup,
        parse_mode: 'HTML'
      });
      
    } else {
      const welcomeKeyboard = Markup.inlineKeyboard([
        [Markup.button.callback("📺 Watch Tutorial", "tutorial:watch")],
        [Markup.button.url("📢 Join Updates Group", "https://t.me/CHEATBYOXIDE")]
      ]);
      
      const welcomeMessage = 
        `🤖 LOTTERY AUTOBET VERSION 1.1\n\n` +
        `Welcome, ${firstName}! 👋\n\n` +
        `This is the most advanced\n` +
        `lottery betting system!\n\n` +
        `🎯 Multiple Strategies\n` +
        `⚡ Real-time Betting\n` +
        `📊 Advanced Analytics\n` +
        `📺 Click "Watch Tutorial" button to learn how to use the bot\n\n` +
        `Developed by: @Mlopp67`;
      
      await ctx.reply(welcomeMessage, welcomeKeyboard);
    }
  } catch (error) {
    logging.error(`Error getting user profile photo: ${error.message}`);
    
    const welcomeKeyboard = Markup.inlineKeyboard([
      [Markup.button.callback("📺 Watch Tutorial", "tutorial:watch")],
      [Markup.button.url("📢 Join Updates Group", "https://t.me/CHEATBYOXIDE")]
    ]);
    
    const welcomeMessage = 
      `🤖 LOTTERY AUTOBET VERSION 1.1\n\n` +
      `Welcome, ${firstName}! 👋\n\n` +
      `This is the most advanced\n` +
      `lottery betting system!\n\n` +
      `🎯 Multiple Strategies\n` +
      `⚡ Real-time Betting\n` +
      `📊 Advanced Analytics\n` +
      `📺 Click "Watch Tutorial" button to learn how to use the bot\n\n` +
      `Developed by: @Mlopp67`;
    
    await ctx.reply(welcomeMessage, welcomeKeyboard);
  }
  
  if (!loggedIn) {
    await ctx.reply("Please login to continue:", makeMainMenuKeyboard(false, userId));
  } else {
    if (userId === ADMIN_ID) {
      await ctx.reply("Welcome back, Admin!", makeMainMenuKeyboard(true, userId));
    } else {
      await ctx.reply("Welcome back!", makeMainMenuKeyboard(true, userId));
    }
  }
}

async function tutorialCallbackHandler(ctx) {
  try {
    await ctx.answerCbQuery();
    
    await bot.telegram.sendVideo(ctx.chat.id, "https://t.me/leolotterydev/4306");
    
    await ctx.reply("☃️ Here's the tutorial video");
    
  } catch (error) {
    logging.error(`Error sending tutorial video: ${error.message}`);
  }
}

async function cmdAllowHandler(ctx) {
  const userId = ctx.from.id;
  if (userId !== ADMIN_ID) {
    await sendMessageWithRetry(ctx, "Admin only!");
    return;
  }
  const args = ctx.message.text.split(' ').slice(1);
  if (!args.length || !args[0].match(/^\d+$/)) {
    await sendMessageWithRetry(ctx, "Usage: /add {6lottery_id}");
    return;
  }
  const sixId = parseInt(args[0]);
  if (allowedsixuserid.has(sixId)) {
    await sendMessageWithRetry(ctx, `User ${sixId} already added`);
  } else {
    allowedsixuserid.add(sixId);
    saveAllowedUsers();
    await sendMessageWithRetry(ctx, `User ${sixId} added`);
  }
  
  await ctx.reply("Admin Panel:", makeAdminPanelKeyboard());
}

async function cmdRemoveHandler(ctx) {
  const userId = ctx.from.id;
  if (userId !== ADMIN_ID) {
    await sendMessageWithRetry(ctx, "Admin only!");
    return;
  }
  const args = ctx.message.text.split(' ').slice(1);
  if (!args.length || !args[0].match(/^\d+$/)) {
    await sendMessageWithRetry(ctx, "Usage: /remove {6lottery_id}");
    return;
  }
  const sixId = parseInt(args[0]);
  if (!allowedsixuserid.has(sixId)) {
    await sendMessageWithRetry(ctx, `User ${sixId} not found`);
  } else {
    allowedsixuserid.delete(sixId);
    saveAllowedUsers();
    await sendMessageWithRetry(ctx, `User ${sixId} removed`);
  }
  

  await ctx.reply("Admin Panel:", makeAdminPanelKeyboard());
}

async function cmdEnableHandler(ctx) {
  const userId = ctx.from.id;
  
  if (userId !== ADMIN_ID) {
    await sendMessageWithRetry(ctx, "❌ Owner only command!");
    return;
  }

  global.publicAccessEnabled = true;
  
  await sendMessageWithRetry(ctx, "✅ Public access enabled! Now anyone can use the bot without ID checking.");
  logging.info(`Owner ${userId} enabled public access`);
  
  await ctx.reply("Admin Panel:", makeAdminPanelKeyboard());
}

async function cmdDisableHandler(ctx) {
  const userId = ctx.from.id;

  if (userId !== ADMIN_ID) {
    await sendMessageWithRetry(ctx, "❌ Owner only command!");
    return;
  }
  
  // Disable
  global.publicAccessEnabled = false;
  
  await sendMessageWithRetry(ctx, "❌ Public access disabled! Now only allowed IDs can use the bot.");
  logging.info(`Owner ${userId} disabled public access`);
  
  await ctx.reply("Admin Panel:", makeAdminPanelKeyboard());
}

async function cmdShowIdHandler(ctx) {
  const userId = ctx.from.id;
  if (userId !== ADMIN_ID) {
    await sendMessageWithRetry(ctx, "Admin only!");
    return;
  }
  
  try {
    let allowedIds = [];
    
    if (fs.existsSync('users_6lottery.json')) {
      const data = JSON.parse(fs.readFileSync('users_6lottery.json', 'utf8'));
      allowedIds = data.allowed_ids || [];
    } else {
      allowedIds = Array.from(allowedsixuserid);
    }
    
    if (allowedIds.length === 0) {
      await sendMessageWithRetry(ctx, "No allowed IDs found.");
    } else {
      let message = "📋 List of Allowed IDs:\n\n";
      allowedIds.forEach((id, index) => {
        message += `${index + 1}. ${id}\n`;
      });
      
      message += `\nTotal: ${allowedIds.length} allowed users`;
      
      await sendMessageWithRetry(ctx, message);
    }
  } catch (error) {
    logging.error(`Error showing allowed IDs: ${error.message}`);
    await sendMessageWithRetry(ctx, "Error retrieving allowed IDs. Please try again later.");
  }
  
  await ctx.reply("Admin Panel:", makeAdminPanelKeyboard());
}

async function cmdUsersHandler(ctx) {
  const userId = ctx.from.id;
  if (userId !== ADMIN_ID) {
    await sendMessageWithRetry(ctx, "Admin only!");
    return;
  }
  
  try {
    const telegramUserIds = Array.from(activeUsers);
    
    if (telegramUserIds.length === 0) {
      await sendMessageWithRetry(ctx, "No active users found.");
    } else {
      let message = "📋 List of Active Users:\n\n";
      
      for (const telegramId of telegramUserIds) {
        const userInfo = userGameInfo[telegramId];
        const userName = userInfo?.nickname || userInfo?.username || "Unknown";
        const gameUserId = userInfo?.user_id || "Not logged in";
        const balance = userInfo?.balance || 0;
        const isRunning = userSettings[telegramId]?.running || false;
        
        message += `👤 ${userName}\n`;
        message += `   Telegram ID: ${telegramId}\n`;
        message += `   Game ID: ${gameUserId}\n`;
        message += `   Balance: ${balance.toFixed(2)} Ks\n`;
        message += `   Status: ${isRunning ? '🍏 Activate' : '🍎 Deactivate'}\n\n`;
      }
      
      message += `Total: ${telegramUserIds.length} active users`;
      
      await sendMessageWithRetry(ctx, message);
    }
  } catch (error) {
    logging.error(`Error showing users: ${error.message}`);
    await sendMessageWithRetry(ctx, "Error retrieving user list. Please try again later.");
  }
  
  await ctx.reply("Admin Panel:", makeAdminPanelKeyboard());
}

async function cmdSendHandler(ctx) {
  const userId = ctx.from.id;
  if (userId !== ADMIN_ID) {
    await sendMessageWithRetry(ctx, "Admin only!");
    return;
  }
  
  const messageText = ctx.message.text;
  const messageToSend = messageText.substring(6).trim();
  
  if (!messageToSend) {
    await sendMessageWithRetry(ctx, "Please provide a message to send. Usage: /send Your message here");
    return;
  }
  
  try {
    const telegramUserIds = Array.from(activeUsers);
    
    if (telegramUserIds.length === 0) {
      await sendMessageWithRetry(ctx, "No active users found to send message to.");
    } else {
      let successCount = 0;
      let failedCount = 0;
      
      for (const telegramId of telegramUserIds) {
        try {
          await ctx.telegram.sendMessage(telegramId, `📢 Admin Broadcast:\n\n${messageToSend}`);
          successCount++;
        } catch (error) {
          logging.error(`Failed to send message to user ${telegramId}: ${error.message}`);
          failedCount++;
        }
      }

      const resultMessage = `✅ Message sent to ${successCount} users` + 
                            (failedCount > 0 ? `\n❌ Failed to send to ${failedCount} users` : "");
      await sendMessageWithRetry(ctx, resultMessage);
      
      logging.info(`Admin broadcast sent to ${successCount}/${telegramUserIds.length} users`);
    }
  } catch (error) {
    logging.error(`Error sending admin broadcast: ${error.message}`);
    await sendMessageWithRetry(ctx, "Error sending message. Please try again later.");
  }
  
  await ctx.reply("Admin Panel:", makeAdminPanelKeyboard());
}

function getKeyboardForCurrentMode(userId) {
  const isInManualBetMode = userState[userId]?.isInManualBetMode || false;
  
  if (isInManualBetMode) {
    return makeManualBetKeyboard();
  } else {
    return makeAutoBetKeyboard();
  }
}

function parseTimeToMinutes(timeStr) {
  if (!timeStr) return null;
  
  try {
    // Asia/Yangon timezone
    const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!timeMatch) return null;
    
    let hours = parseInt(timeMatch[1]);
    const minutes = parseInt(timeMatch[2]);
    const ampm = timeMatch[3].toUpperCase();
    
    if (ampm === "PM" && hours < 12) {
      hours += 12;
    } else if (ampm === "AM" && hours === 12) {
      hours = 0;
    }
    
    return hours * 60 + minutes;
  } catch (error) {
    logging.error(`Error parsing time ${timeStr}: ${error.message}`);
    return null;
  }
}

function formatTime(date) {
  // Asia/Yangon timezone
  const yangonTime = moment(date).tz('Asia/Yangon');
  
  let hours = yangonTime.hours();
  const minutes = yangonTime.minutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  
  hours = hours % 12;
  hours = hours ? hours : 12; 
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${ampm}`;
}

function getNextTimeString(timeInMinutes) {
  let hours = Math.floor(timeInMinutes / 60) % 24;
  const minutes = timeInMinutes % 60;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  
  hours = hours % 12;
  hours = hours ? hours : 12; 
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${ampm}`;
}

async function waitForTimeRange(startTime, endTime) {
  // Get current time in Asia/Yangon
  const nowYangon = moment().tz('Asia/Yangon');
  const currentTime = nowYangon.hours() * 60 + nowYangon.minutes();
  
  let waitTime = 0;
  
  if (endTime > startTime) {
    if (currentTime < startTime) {
      waitTime = startTime - currentTime;
    } else if (currentTime >= endTime) {
      waitTime = (24 * 60 - currentTime) + startTime;
    }
  } else {
    if (currentTime >= endTime && currentTime < startTime) {
      waitTime = startTime - currentTime;
    }
  }
  
  if (waitTime > 0) {
    const waitMinutes = waitTime % 60;
    const waitHours = Math.floor(waitTime / 60);
    
    logging.info(`Waiting ${waitHours}h ${waitMinutes}m for time range to start (Yangon time)`);
    await new Promise(resolve => setTimeout(resolve, waitTime * 60 * 1000));
  }
}

async function callbackQueryHandler(ctx) {
  try {
    await ctx.answerCbQuery();
  } catch (error) {
    if (error.description && error.description.includes('query is too old')) {
      return;
    }
    logging.error(`Callback query error: ${error.message}`);
  }
  
  const userId = ctx.from.id;
  const data = ctx.callbackQuery.data;
  
  // Tutorial
  if (data.startsWith("tutorial:")) {
    const action = data.split(":")[1];
    if (action === "watch") {
      await tutorialCallbackHandler(ctx);
      return;
    }
  }
  
  // Check authorization
  if (!await checkUserAuthorized(ctx)) {
    return;
  }
  
  // mode selection
  if (data.startsWith("mode:")) {
    const mode = data.split(":")[1];
    const settings = userSettings[userId] || {};
    
    if (mode === "virtual") {
      userState[userId] = { state: "INPUT_VIRTUAL_BALANCE" };
      await sendMessageWithRetry(ctx, "Enter virtual balance amount:\n\nExample: 10000");
    } else if (mode === "real") {
      settings.virtual_mode = false;
      await sendMessageWithRetry(ctx, "💵 Switched to Real Mode", getKeyboardForCurrentMode(userId));
      saveUserSettings();
    }
    
    await safeDeleteMessage(ctx);
    return;
  }

if (data.startsWith("amount:")) {
  const amount = parseInt(data.split(":")[1]);
  const state = userState[userId] || {};
  
  if (state.state === "MANUAL_BET_AMOUNT_SELECT") {
    state.amount = amount;
    state.state = "MANUAL_BET_MULTIPLIER_SELECT";
    
    let currentBalance = 0;
    try {
      const session = userSessions[userId];
      if (session) {
        const balanceResult = await getBalance(session, userId);
        if (balanceResult !== null) {
          currentBalance = balanceResult;
        }
      }
    } catch (error) {
      logging.error(`Error getting current balance: ${error.message}`);
      currentBalance = 0;
    }
    
    await sendMessageWithRetry(ctx, 
      `💰 Selected amount: ${amount} Ks\n\n` +
      `📊 Select multiplier:`,
      makeMultiplierKeyboard()
    );
  }
  
  await safeDeleteMessage(ctx);
  return;
}

// multiplier selection
if (data.startsWith("multiplier:")) {
  const multiplierValue = data.split(":")[1];
  const state = userState[userId] || {};
  
  if (state.state === "MANUAL_BET_MULTIPLIER_SELECT") {
    if (multiplierValue === "custom") {
      state.state = "MANUAL_BET_CUSTOM_MULTIPLIER";
      await sendMessageWithRetry(ctx, 
        "📊 Enter custom multiplier (e.g., 23):"
      );
    } else {
      const multiplier = parseInt(multiplierValue);
      state.multiplier = multiplier;
      state.state = "MANUAL_BET_CONFIRM";
      
      const totalAmount = state.amount * multiplier;
      
      let betChoiceText;
      if (state.betChoice === 'B' || state.betChoice === 'S') {
        betChoiceText = state.betChoice === 'B' ? 'BIG' : 'SMALL';
      } else {
        betChoiceText = getColorName(state.betChoice);
      }
      
      await sendMessageWithRetry(ctx,
        `🎯 Bet Confirmation\n\n` +
        `▫️ Type: ${betChoiceText}\n` +
        `▫️ Amount: ${state.amount} Ks\n` +
        `▫️ Multiplier: ×${multiplier}\n` +
        `▫️ Total: ${totalAmount} Ks\n\n` +
        `Confirm this bet?`,
        makeBetConfirmationKeyboard()
      );
    }
  }
  
  await safeDeleteMessage(ctx);
  return;
}

// bet confirmation
if (data.startsWith("confirm_bet:")) {
  const action = data.split(":")[1];
  const state = userState[userId] || {};
  
  if (state.state === "MANUAL_BET_CONFIRM") {
    if (action === "yes") {
      const totalAmount = state.amount * (state.multiplier || 1);
      await processManualBetAmount(userId, totalAmount, ctx, state.betChoice, state.gameType);
    } else {
      await sendMessageWithRetry(ctx, "Bet cancelled.", makeManualBetKeyboard());
      delete userState[userId];
    }
  }
  
  await safeDeleteMessage(ctx);
  return;
}
  
  // time range confirmation
  if (data.startsWith("time_range_confirm:")) {
    const action = data.split(":")[1];
    const settings = userSettings[userId];
    const pendingData = userTemp[userId];
    
    if (action === "yes" && pendingData && pendingData.pending_end_time) {
      settings.time_range_end = pendingData.pending_end_time;
      settings.time_range_auto_start = true;
      
      const now = new Date();
      const currentTime = formatTime(now);
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const startTimeInMinutes = parseTimeToMinutes(settings.time_range_start);
      const endTimeInMinutes = parseTimeToMinutes(settings.time_range_end);
      
      let autoStartMessage = "";
      if (settings.running) {
        autoStartMessage = "\n\n⚠️ Bot is already running. Time range will be applied on next bet cycle.";
      } else {
        autoStartMessage = "\n\n✅ Auto Start is enabled. Bot will start automatically at the start time.";
        
        if (currentMinutes >= startTimeInMinutes && currentMinutes < endTimeInMinutes) {
          autoStartMessage += "\n🟢 Within time range now! You can start the bot.";
        }
      }
      
      await sendMessageWithRetry(ctx, 
        `✅ Time Range Set Successfully!\n\n` +
        `⏰ Time Range: ${settings.time_range_start} - ${settings.time_range_end}\n` +
        `🕒 Current Time: ${currentTime}\n` +
        autoStartMessage,
        makeRiskControlKeyboard()
      );
      
      delete userState[userId];
      delete userTemp[userId];
      saveUserSettings();
    } else if (action === "no") {
      userState[userId] = { state: "INPUT_TIME_RANGE_END" };
      await sendMessageWithRetry(ctx, 
        "Please enter a different end time (format: 00:00 AM/PM):\n\n" +
        "Examples:\n" +
        "• 04:00 PM\n" +
        "• 10:30 AM\n" +
        "• 02:00 AM"
      );
    }
    
    await safeDeleteMessage(ctx);
    return;
  }

// reactivate button
if (data.startsWith("reactivate:")) {
  const action = data.split(":")[1];
  if (action === "yes") {
    const settings = userSettings[userId] || {};
    
    settings.martin_index = 0;
    settings.dalembert_units = 1;
    settings.custom_index = 0;
    settings.running = false;
    settings.profit_target_reached = false;
    settings.stop_loss_reached = false;
    delete settings.dream_state;
    delete settings.leo_state;
    delete settings.trend_state;
    delete settings.sniper_state;
    delete settings.beatrix_state;
    
    delete userPendingProfitStopMessages[userId];
    delete userStopInitiated[userId];
    
    try {
      await ctx.editMessageReplyMarkup({ reply_markup: {} });
    } catch (error) {
      logging.error(`Failed to edit message: ${error.message}`);
    }
    
    await sendMessageWithRetry(ctx, 
      "🍏 Bot has been re-activated automatically with current settings.",
      makeAutoBetKeyboard()
    );
    
    if (!settings.bet_sizes) {
      await sendMessageWithRetry(ctx, "Please set BET WRAGER first!", makeAutoBetKeyboard());
    } else if (settings.strategy === "SNIPER" && settings.bet_sizes.length !== 4) {
      await sendMessageWithRetry(ctx, "SNIPER strategy requires exactly 4 bet wrager. Please set 4 bet wrager first.", makeAutoBetKeyboard());
    } else {
      settings.running = true;
      settings.consecutive_errors = 0;
      saveUserSettings();
      
      const isLeslayStrategy = settings.strategy === "SNIPER";
      const entryLayer = settings.layer_limit || 1;
      
      if (!isLeslayStrategy) {
        if (entryLayer === 2) {
          settings.entry_layer_state = { waiting_for_lose: true };
        } else if (entryLayer === 3) {
          settings.entry_layer_state = { waiting_for_loses: true, consecutive_loses: 0 };
        }
      }

      if (settings.strategy === "DREAM") {
        settings.dream_state = {
          first_bet: true,
          current_pattern: "",
          current_index: 0
        };
      }

      if (settings.strategy === "BABIO") {
        settings.babio_state = {
          current_position: 8,
          last_result: null
        };
      }

      if (settings.strategy === "LEO") {
        settings.leo_state = {
          last_result: null,
          pattern_index: 0
        };
      }

      if (settings.strategy === "TREND_FOLLOW") {
        settings.trend_state = {
          last_result: null,
          skip_mode: false
        };
      }

      const betType = settings.bet_type || "BS";
      if (betType === "COLOR" && settings.strategy === "TREND_FOLLOW") {
        settings.color_trend_state = {
          last_result: null
        };
      }

      if (settings.strategy === "ALTERNATE") {
        settings.alternate_state = {
          last_result: null,
          skip_mode: false
        };
      }
      
      if (isLeslayStrategy) {
        settings.sniper_state = {
          active: false,
          direction: null,
          current_index: 0,
          hit_count: 0,
          bet_sequence: [],
          got_same_result: false
        };
        userLastNumbers[userId] = [];
      }
      
      if (settings.strategy === "BEATRIX") {
        settings.beatrix_state = {
          waiting_for_seven: true,
          last_period_with_seven: null
        };
      }

      if (settings.strategy === "AI_PREDICTION") {
        userAILast10Results[userId] = [];
        userAIRoundCount[userId] = 0;
      }

      if (settings.strategy === "BABIO") {
        userAILast10Results[userId] = [];
        userAIRoundCount[userId] = 0;
      }
      
      if (settings.strategy === "LYZO") {
        userLast10Results[userId] = [];
        userLyzoRoundCount[userId] = 0;
      }
      
      delete userSkippedBets[userId];
      userShouldSkipNext[userId] = false;
      delete userSLSkipWaitingForWin[userId];
      
      userWaitingForResult[userId] = false;
      
      bettingWorker(userId, ctx, bot || ctx.telegram.bot || ctx.telegram);
    }
    
    saveUserSettings();
  }
  
  return;
}
  
  // Strategy
  if (data.startsWith("strategy:")) {
    const strategy = data.split(":")[1];
    
    if (strategy === "disabled") {
      await sendMessageWithRetry(ctx, "This strategy is not available for TRX game.ဒီStrategyကိုသုံးဖို့ WINGOကိုရွေးပါ");
      await safeDeleteMessage(ctx);
      return;
    }
    
    userSettings[userId].strategy = strategy;
    
    if (strategy === "SNIPER") {
      userSettings[userId].betting_strategy = "Martingale";
      
      const betSizes = userSettings[userId].bet_sizes || [];
      if (betSizes.length !== 4) {
        await sendMessageWithRetry(ctx, "SNIPER strategy requires exactly 4 bet wrager. Please set 4 bet wrager first.");
        userState[userId] = { state: "INPUT_4_BET_SIZES" };
      } else {
        await sendMessageWithRetry(ctx, `Strategy set to: Leslay (SNIPER) with Martingale betting\n\nThe bot will stop after 2 successful sniper hits.`);
      }
    } else if (strategy === "BEATRIX") {
      userSettings[userId].beatrix_state = {
        waiting_for_seven: true,
        last_period_with_seven: null
      };
      await sendMessageWithRetry(ctx, `Strategy set to: Beatrix\n\nSniper strategyဖြစ်နာမို့ Targetမတွေ့မချင်းစောင့်ပါမယ်`);
    } else if (strategy === "BS_ORDER") {
      userState[userId] = { state: "INPUT_BS_PATTERN" };
      await sendMessageWithRetry(ctx, "Please enter your BS pattern (B and S only, e.g., BSBSSBBS):");
    } else if (strategy === "TREND_FOLLOW") {
      const betType = userSettings[userId].bet_type || "BS";
      
      if (betType === "COLOR") {
        await sendMessageWithRetry(ctx, `Strategy set to: Trend Follow (Color Mode)`);
      } else {
        await sendMessageWithRetry(ctx, "Select BS/SB Wait Count:", makeBSWaitCountKeyboard());
      }
    } else if (strategy === "ALTERNATE") {
      await sendMessageWithRetry(ctx, "Select BB/SS Wait Count:", makeBBWaitCountKeyboard());
    } else if (strategy === "BABIO") {
      userSettings[userId].babio_state = {
        current_position: 8,
        last_result: null
      };
      await sendMessageWithRetry(ctx, `Strategy set to: Babio`);
    } else if (strategy === "MAY_BARANI") {
      await sendMessageWithRetry(ctx, `Strategy set to: May Barani`);
    } else {
      await sendMessageWithRetry(ctx, `Strategy set to: ${strategy === "ALINKAR" ? "Alinkar" : strategy}`);
    }
    
    saveUserSettings();
    
    await safeDeleteMessage(ctx);
    return;
  }
  
  // Bet type
  if (data.startsWith("bet_type:")) {
    const betType = data.split(":")[1];
    userSettings[userId].bet_type = betType;
    
    if (betType === "COLOR") {
      userSettings[userId].strategy = "TREND_FOLLOW";
      
      userSettings[userId].color_trend_state = {
        last_result: null
      };
      
      await sendMessageWithRetry(ctx, `Bet Type set to: Color\nStrategy automatically set to: Trend Follow`, makeBetPlaceSettingsKeyboard());
    } else {
      await sendMessageWithRetry(ctx, `Bet Type set to: Big/Small`, makeBetPlaceSettingsKeyboard());
    }
    
    saveUserSettings();
    
    await safeDeleteMessage(ctx);
    return;
  }
  
  // BS wait count
  if (data.startsWith("bs_wait_count:")) {
    const waitCount = parseInt(data.split(":")[1]);
    userSettings[userId].bs_sb_wait_count = waitCount;
    let message = "";
    if (waitCount === 0) {
      message = "BS/SB Wait feature disabled";
    } else {
      const patternBS = 'BS'.repeat(waitCount);
      const patternSB = 'SB'.repeat(waitCount);
      message = `BS/SB Wait Count set to: ${waitCount}\n`;
    }
    await sendMessageWithRetry(ctx, message, getKeyboardForCurrentMode(userId));
    
    saveUserSettings();
    
    await safeDeleteMessage(ctx);
    return;
  }
  
  // BB wait count
  if (data.startsWith("bb_wait_count:")) {
    const waitCount = parseInt(data.split(":")[1]);
    userSettings[userId].bb_ss_wait_count = waitCount;
    let message = "";
    if (waitCount === 0) {
      message = "BB/SS Wait feature disabled";
    } else {
      const patternBB = 'BB'.repeat(waitCount);
      const patternSS = 'SS'.repeat(waitCount);
      message = `BB/SS Wait Count set to: ${waitCount}\n`;
    }
    await sendMessageWithRetry(ctx, message, getKeyboardForCurrentMode(userId));
    
    saveUserSettings();
    
    await safeDeleteMessage(ctx);
    return;
  }
  
  // Betting strategy
  if (data.startsWith("betting_strategy:")) {
    const bettingStrategy = data.split(":")[1];
    const settings = userSettings[userId] || {};
    
    if (settings.strategy === "SNIPER") {
      await sendMessageWithRetry(ctx, "SNIPER strategy only supports Martingale betting strategy!", makeBetPlaceSettingsKeyboard());
      return;
    }
    
    userSettings[userId].betting_strategy = bettingStrategy;
    
    userSettings[userId].martin_index = 0;
    userSettings[userId].dalembert_units = 1;
    userSettings[userId].consecutive_losses = 0;
    userSettings[userId].skip_betting = false;
    userSettings[userId].custom_index = 0;
    
    await sendMessageWithRetry(ctx, `Betting Strategy: ${bettingStrategy}`, makeBetPlaceSettingsKeyboard());
    
    saveUserSettings();
    
    await safeDeleteMessage(ctx);
    return;
  }
  
  // Game type 
  if (data.startsWith("game_type:")) {
    const gameType = data.split(":")[1];

    if (gameType === "WINGO_SELECT") {
      await sendMessageWithRetry(ctx, "Select WINGO game type:", makeWINGOSelectionKeyboard());
      await safeDeleteMessage(ctx);
      return;
    }
    
    userSettings[userId].game_type = gameType;
    
    let gameTypeDisplay = gameType;
    if (gameType === "WINGO_30S") {
      gameTypeDisplay = "WINGO 30s";
    } else if (gameType === "WINGO_3MIN") {
      gameTypeDisplay = "WINGO 3min";
    } else if (gameType === "WINGO_5MIN") {
      gameTypeDisplay = "WINGO 5min";
    } else if (gameType === "WINGO") {
      gameTypeDisplay = "WINGO 1min";
    }

    const currentStrategy = userSettings[userId].strategy;
    if ((currentStrategy === "LYZO" || currentStrategy === "BEATRIX") && gameType === "TRX") {
      userSettings[userId].strategy = "AI_PREDICTION";
      await sendMessageWithRetry(ctx, `Game Type set to: ${gameTypeDisplay}\n\nNote: ${currentStrategy} strategy သည် TRXမှာအလုပ်မလုပ်ပါ Ai prediction ကိုပဲauto setလုပ်ပါမယ်.`, makeBetPlaceSettingsKeyboard());
    } else {
      await sendMessageWithRetry(ctx, `Game Type set to: ${gameTypeDisplay}`, makeBetPlaceSettingsKeyboard());
    }

    saveUserSettings();

    await safeDeleteMessage(ctx);
    return;
  }
  
  // Entry layer 
  if (data.startsWith("entry_layer:")) {
    const layerValue = parseInt(data.split(":")[1]);
    userSettings[userId].layer_limit = layerValue;

    if (layerValue === 2) {
      userSettings[userId].entry_layer_state = { waiting_for_lose: true };
    } else if (layerValue === 3) {
      userSettings[userId].entry_layer_state = { waiting_for_loses: true, consecutive_loses: 0 };
    }
    
    let description = "";
    if (layerValue === 1) {
      description = "Bet immediately according to strategy";
    } else if (layerValue === 2) {
      description = "Wait for 1 lose before betting";
    } else if (layerValue === 3) {
      description = "Wait for 2 consecutive loses before betting";
    }
    
    if (!userState[userId]) userState[userId] = {};
    userState[userId].lastKeyboard = 'risk_control';
    
    await sendMessageWithRetry(ctx, `Entry Layer : ${layerValue} (${description})`, makeRiskControlKeyboard());
    
    saveUserSettings();
    
    await safeDeleteMessage(ctx);
    return;
  }

  // SL layer
  if (data.startsWith("sl_layer:")) {
    const slValue = parseInt(data.split(":")[1]);
    userSettings[userId].sl_layer = slValue > 0 ? slValue : null;
    userSettings[userId].consecutive_losses = 0;
    userSettings[userId].skip_betting = false;
    
    userSettings[userId].original_martin_index = 0;
    userSettings[userId].original_dalembert_units = 1;
    userSettings[userId].original_custom_index = 0;
    
    let description = "";
    if (slValue === 0) {
      description = "Disabled";
    } else {
      description = ` ${slValue} ပွဲloseပြီးရင် bet skipပါမယ်`;
    }

    if (!userState[userId]) userState[userId] = {};
    userState[userId].lastKeyboard = 'risk_control';
    
    await sendMessageWithRetry(ctx, `SL Layer : ${slValue} (${description})`, makeRiskControlKeyboard());
    
    saveUserSettings();
    
    await safeDeleteMessage(ctx);
    return;
  }

  // Time range
  if (data.startsWith("time_range:")) {
    const action = data.split(":")[1];
    const settings = userSettings[userId];
    
    if (action === "start") {
      userState[userId] = { state: "INPUT_TIME_RANGE_START" };
      await sendMessageWithRetry(ctx, 
        "Enter start time (format: 00:00 AM/PM)\n\n" +
        "Examples:\n" +
        "• 03:00 PM\n" +
        "• 09:30 AM\n" +
        "• 11:45 PM"
      );
    } else if (action === "end") {
      userState[userId] = { state: "INPUT_TIME_RANGE_END" };
      await sendMessageWithRetry(ctx, 
        "Enter end time (format: 00:00 AM/PM)\n\n" +
        "Examples:\n" +
        "• 04:00 PM\n" +
        "• 10:30 AM\n" +
        "• 02:00 AM (next day)"
      );
    } else if (action === "clear") {
      delete settings.time_range_start;
      delete settings.time_range_end;
      await sendMessageWithRetry(ctx, "✅ Time range cleared", makeRiskControlKeyboard());
      saveUserSettings();
    } else if (action === "show") {
      const now = new Date();
      const currentTime = formatTime(now);
      let message = `🕒 Current Time: ${currentTime}\n\n`;
      
      if (settings.time_range_start && settings.time_range_end) {
        message += `⏰ Time Range: ${settings.time_range_start} - ${settings.time_range_end}\n\n`;
        
        const startTime = parseTimeToMinutes(settings.time_range_start);
        const endTime = parseTimeToMinutes(settings.time_range_end);
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        
        if (startTime !== null && endTime !== null) {
          let isWithinTimeRange;
          
          if (endTime > startTime) {
            // Normal range
            isWithinTimeRange = currentMinutes >= startTime && currentMinutes < endTime;
          } else {
            // Cross midnight range
            isWithinTimeRange = currentMinutes >= startTime || currentMinutes < endTime;
          }
          
          message += isWithinTimeRange ? "🟢 Within time range" : "🔴 Outside time range";
        }
      } else {
        message += "No time range set";
      }
      
      await sendMessageWithRetry(ctx, message, makeRiskControlKeyboard());
    }
    
    await safeDeleteMessage(ctx);
    return;
  }
} 

async function showUserStats(ctx, userId) {
  try {
    const settings = userSettings[userId] || {};
    const session = userSessions[userId];
    const gameInfo = userGameInfo[userId];
    const stats = userStats[userId];
     const selectedSite = userSelectedSite[userId];
    
    if (!session) {
      await sendMessageWithRetry(ctx, "❌ Please login first");
      return;
    }
    
    let message = `📊 <b>Bot Configuration & Stats</b>\n\n`;
    
    // User Info
    if (gameInfo) {
      message += `👤 <b>User Info:</b>\n`;
      message += `├─ Site: ${selectedSite}\n`;
      message += `├─ ID: ${gameInfo.user_id || 'N/A'}\n`;
      message += `├─ Username: ${gameInfo.username || 'N/A'}\n`;
      message += `├─ Nickname: ${gameInfo.nickname || 'N/A'}\n`;
      message += `└─ Balance: ${(gameInfo.balance || 0).toFixed(2)} Ks\n\n`;
    }
    
    // Game Settings
    message += `🎮 <b>Game Settings:</b>\n`;               
    message += `├─ Game Type: ${settings.game_type || 'TRX'}\n`;
    message += `├─ Bet Type: ${settings.bet_type === 'COLOR' ? 'Color' : 'Big/Small'}\n`;
    
    // Strategy
    let strategyDisplay = settings.strategy || 'AI_PREDICTION';
    if (strategyDisplay === 'AI_PREDICTION') strategyDisplay = 'CHAT GPT V1';
    else if (strategyDisplay === 'LYZO') strategyDisplay = 'LYZO';
    else if (strategyDisplay === 'DREAM') strategyDisplay = 'DREAM';
    else if (strategyDisplay === 'BABIO') strategyDisplay = 'BABIO';
    else if (strategyDisplay === 'BS_ORDER') strategyDisplay = 'BS-Order';
    else if (strategyDisplay === 'LEO') strategyDisplay = 'LEO';
    else if (strategyDisplay === 'TREND_FOLLOW') strategyDisplay = 'TREND_FOLLOW';
    else if (strategyDisplay === 'ALTERNATE') strategyDisplay = 'AlTERNATE';
    else if (strategyDisplay === 'SNIPER') strategyDisplay = 'LESLAY';
    else if (strategyDisplay === 'ALINKAR') strategyDisplay = 'ALINKAR';
    else if (strategyDisplay === 'MAY_BARANI') strategyDisplay = 'MAY BARANI';
    else if (strategyDisplay === 'BEATRIX') strategyDisplay = 'BEATRIX';
    
    message += `├─ Strategy: ${strategyDisplay}\n`;
    
    // Betting Strategy
    let bettingStrategyDisplay = settings.betting_strategy || 'Martingale';
    message += `└─ Betting: ${bettingStrategyDisplay}\n\n`;
    
    // Bet Sizes
    if (settings.bet_sizes && settings.bet_sizes.length > 0) {
      message += `💰 <b>Bet Wrager:</b>\n`;
      message += `└─ ${settings.bet_sizes.join(' - ')} Ks\n\n`;
    }
    
    // Risk Control
    message += `⚙️ <b>Risk Control:</b>\n`;
    message += `├─ Entry Layer: ${settings.layer_limit || 1}\n`;
    message += `├─ SL Layer: ${settings.sl_layer || 'Disabled'}\n`;
    message += `├─ Profit Target: ${settings.target_profit ? settings.target_profit + ' Ks' : 'Not Set'}\n`;
    message += `└─ Stop Loss: ${settings.stop_loss ? settings.stop_loss + ' Ks' : 'Not Set'}\n\n`;
    
    // Mode
    message += `🎛 <b>Mode:</b>\n`;
    if (settings.virtual_mode) {
      const virtualBalance = stats?.virtual_balance || settings.virtual_balance || 0;
      message += `└─ Virtual Mode (${virtualBalance.toFixed(2)} Ks)\n\n`;
    } else {
      message += `└─ Real Mode\n\n`;
    }
    
    // Status
    message += `📈 <b>Status:</b>\n`;
    message += `└─ Bot: ${settings.running ? '🟢 Running' : '🔴 Stopped'}\n\n`;
    
    // Statistics
    if (stats && !settings.virtual_mode) {
      const profit = stats.profit || 0;
      const startBalance = stats.start_balance || 0;
      const currentBalance = gameInfo?.balance || 0;
      
      message += `📊 <b>Statistics:</b>\n`;
      message += `├─ Start Balance: ${startBalance.toFixed(2)} Ks\n`;
      message += `├─ Current Balance: ${currentBalance.toFixed(2)} Ks\n`;
      message += `└─ Total Profit: ${profit >= 0 ? '+' : ''}${profit.toFixed(2)} Ks\n\n`;
    }
    
    // Time Range
    if (settings.time_range_start && settings.time_range_end) {
      message += `⏰ <b>Time Range:</b>\n`;
      message += `└─ ${settings.time_range_start} - ${settings.time_range_end}\n\n`;
    }
    
    // Strategy-specific info
    if (settings.strategy === "TREND_FOLLOW" && settings.bs_sb_wait_count > 0) {
      message += `📈 <b>TREND_FOLLOW Settings:</b>\n`;
      message += `└─ BS/SB Wait: ${settings.bs_sb_wait_count}\n\n`;
    }
    
    if (settings.strategy === "ALTERNATE" && settings.bb_ss_wait_count > 0) {
      message += `🔄 <b>ALTERNATE Settings:</b>\n`;
      message += `└─ BB/SS Wait: ${settings.bb_ss_wait_count}\n\n`;
    }
    
    if (settings.strategy === "BS_ORDER" && settings.pattern) {
      message += `📜 <b>BS Pattern:</b>\n`;
      message += `└─ ${settings.pattern}\n\n`;
    }
    
    message += `━━━━━━━━━━━━━━━━━━\n`;
    message += `📱 Bot Version: 1.1\n`;
    message += `👨‍💻 Developer: @Mlopp67`;
    
    await ctx.reply(message, { parse_mode: 'HTML' });
    
  } catch (error) {
    logging.error(`Error showing user stats: ${error.message}`);
    await sendMessageWithRetry(ctx, "❌ Error retrieving stats");
  }
}

async function textMessageHandler(ctx) {
  const userId = ctx.from.id;
  const userName = ctx.from.username || ctx.from.first_name || "Unknown";
  const rawText = ctx.message.text;
  const text = normalizeText(rawText);
  const lines = text.split('\n').map(line => line.trim()).filter(line => line);
  
  // === BACK BUTTON HANDLING ===
  if (rawText.includes("🔙 Back") || rawText === "Back" || 
      rawText.includes("🔙 Back to Main Menu") || rawText === "Back to Main Menu") {
    
    const isInRiskControl = userState[userId]?.lastKeyboard === 'risk_control';
    
    if (isInRiskControl) {
      if (!userState[userId]) userState[userId] = {};
      userState[userId].isInManualBetMode = false;
      userState[userId].isInBetPlaceSettings = false;
      delete userState[userId].lastKeyboard;
      
      await sendMessageWithRetry(ctx, "🤖 Auto Bet Settings", makeAutoBetKeyboard());
      return;
    }
    
    const isInBetPlaceSettings = userState[userId]?.isInBetPlaceSettings || false;
    if (isInBetPlaceSettings) {
      if (!userState[userId]) userState[userId] = {};
      userState[userId].isInManualBetMode = false;
      userState[userId].isInBetPlaceSettings = false;
      
      await sendMessageWithRetry(ctx, "🤖 Auto Bet Mode\n\nSelect an option:", makeAutoBetKeyboard());
      return;
    }
    
    //  Go to Main Menu
    if (userState[userId]) {
      userState[userId].isInManualBetMode = false;
      userState[userId].isInBetPlaceSettings = false;
      delete userState[userId].lastKeyboard;
    }
    await sendMessageWithRetry(ctx, "🏠 Main Menu", makeMainMenuKeyboard(true, userId));
    return;
  }

  // === "BACK TO AUTO BET" BUTTON ===
  if (rawText.includes("🔙 Back to Auto Bet") || rawText.includes("Back to Auto Bet")) {
    if (!userState[userId]) userState[userId] = {};
    userState[userId].isInManualBetMode = false;
    userState[userId].isInBetPlaceSettings = false;
    delete userState[userId].lastKeyboard;
    
    await sendMessageWithRetry(ctx, "🤖 Auto Bet Mode\n\nSelect an option:", makeAutoBetKeyboard());
    return;
  }

  // === LOGIN BUTTON  ===
  if (rawText.includes("🔐 Login") || rawText === "Login") {
    // Show site selection
    userState[userId] = { state: "SELECT_LOGIN_SITE" };
    await sendMessageWithRetry(ctx, "Please select a site to login:", makeSiteSelectionKeyboard());
    return;
  }

   // === ADMIN PANEL BUTTON HANDLING ===

  if (rawText.includes("🛠️ Admin Panel") || rawText.includes("Admin Panel") || 
    rawText.includes("admin panel") || rawText.includes("ADMIN PANEL")) {
  await cmdAdminPanelHandler(ctx);
  return;
}

  // === TUTORIAL BUTTON HANDLING ===
  if (rawText.includes("📺 Watch Tutorial") || rawText.includes("Watch Tutorial")) {
    try {
      await bot.telegram.sendVideo(ctx.chat.id, "https://t.me/leolotterydev/4306");
      
      await ctx.reply("☃️ Here's the tutorial video");
    } catch (error) {
      logging.error(`Error sending tutorial video: ${error.message}`);
      await sendMessageWithRetry(ctx, "❌ Error sending tutorial video");
    }
    return;
  }
  
  // === SITE SELECTION HANDLING ===
  if (userState[userId]?.state === "SELECT_LOGIN_SITE") {
    if (rawText === "777BIGWIN") {
      userSelectedSite[userId] = "777BIGWIN";
      userState[userId] = { state: "INPUT_LOGIN_CREDENTIALS" };
      await sendMessageWithRetry(ctx, "You selected 777BIGWIN\n\nPlease enter your login credentials:\n\nLogin\nphone\npassword");
      return;
    } else if (rawText === "6Lottery") {
      userSelectedSite[userId] = "6Lottery";
      userState[userId] = { state: "INPUT_LOGIN_CREDENTIALS" };
      await sendMessageWithRetry(ctx, "You selected 6Lottery\n\nPlease enter your login credentials:\n\nLogin\nphone\npassword");
      return;
    } else if (rawText.includes("🔙 Back to Main Menu")) {
      delete userState[userId];
      await sendMessageWithRetry(ctx, "🏠 Main Menu", makeMainMenuKeyboard(false, userId));
      return;
    }
  }
  
  // === LOGIN CREDENTIALS HANDLING ===
  if (userState[userId]?.state === "INPUT_LOGIN_CREDENTIALS") {
    if (lines.length >= 3 && lines[0].toLowerCase() === "login") {
      const username = lines[1];
      const password = lines[2];
      const selectedSite = userSelectedSite[userId] || "6Lottery";

      console.log(`[USER_ACTIVITY] User ${userName} (ID: ${userId}) logged in to ${selectedSite}`);
      activeUsers.add(userId);
      
      await sendMessageWithRetry(ctx, "Checking...");
      const { response: res, session } = await loginRequest(username, password, selectedSite);
      if (session) {
        const userInfo = await getUserInfo(session, userId);
        if (userInfo && userInfo.user_id) {
          const gameUserId = userInfo.user_id;

          if (!global.publicAccessEnabled && !allowedsixuserid.has(gameUserId)) {
            await sendMessageWithRetry(ctx, 
              `⛔ YOUR ID ${gameUserId} IS NOT EXIST IN LIST\n` +
              `━━━━━━━━━━━━━━━━\n\n` +
              `Please contact admin to get access\n` +
              `Admin: @Mlopp67`
            );
            return;
          }
    
          userSessions[userId] = session;
          userGameInfo[userId] = userInfo;
          userTemp[userId] = { password };
          userSelectedSite[userId] = selectedSite;

          userAllResults[userId] = [];
          userLastNumbers[userId] = [];
          
          const balance = await getBalance(session, userId);
          
          if (!userSettings[userId]) {
            userSettings[userId] = {
              strategy: "AI_PREDICTION",
              betting_strategy: "Martingale",
              game_type: "TRX",
              bet_type: "BS",
              martin_index: 0,
              dalembert_units : 1,
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
          
          if (!userStats[userId]) {
            userStats[userId] = { start_balance: parseFloat(balance || 0), profit: 0.0 };
          }
          
          const balanceDisplay = balance !== null ? balance : 0.0;
          
          const userInfoMessage = 
            `✅ LOGIN SUCCESSFUL!\n\n` +
            `🌐 Site: ${selectedSite}\n` +
            `👤 User Information:\n` +
            `├─ User ID: ${userInfo.user_id}\n` +
            `├─ Username: ${userInfo.username || 'N/A'}\n` +
            `├─ Nickname: ${userInfo.nickname || 'N/A'}\n` +
            `├─ Balance: ${balanceDisplay} Ks\n` +
            `├─ Login Date: ${userInfo.login_date || 'N/A'}\n` +
            `└─ Allow Withdraw: ${userInfo.is_allow_withdraw ? 'Yes' : 'No'}\n\n` +
            `🎮 Select your betting mode:`;
          
          await sendMessageWithRetry(ctx, userInfoMessage, makeMainMenuKeyboard(true));
          
          const settings = userSettings[userId];
          if (settings.bet_sizes && settings.pattern) {
            await showUserStats(ctx, userId);
          }

          saveUserSettings();
        } else {
          await sendMessageWithRetry(ctx, "Login failed: Could not get user info", makeMainMenuKeyboard(false));
        }
      } else {
        const msg = res.msg || "Login failed";
        await sendMessageWithRetry(ctx, `Login error: ${msg}`, makeMainMenuKeyboard(false));
      }
      delete userState[userId];
      delete userTemp[userId];
      return;
    }
    await sendMessageWithRetry(ctx, "အောက်မှာပြထားသည့်အတိုင်း Login ၀င်ပါ:\n\nLogin\nphone\npassword");
    return;
  }

  // === LOGIN AGAIN ===
  if (rawText.includes("Login Again") || rawText.includes("login again")) {
    delete userSessions[userId];
    delete userGameInfo[userId];
    delete userStats[userId];
    delete userLastNumbers[userId];
    
    userState[userId] = { state: "SELECT_LOGIN_SITE" };
    await sendMessageWithRetry(ctx, "Please select a site to login:", makeSiteSelectionKeyboard());
    return;
  }

  // === MAIN MENU ===
  if (rawText.includes("🔙 Back to Main Menu")) {
    if (userState[userId]) {
      userState[userId].isInManualBetMode = false;
    }
    await sendMessageWithRetry(ctx, "🏠 Main Menu", makeMainMenuKeyboard(true, userId));
    return;
  }

  // === MANUAL BET MODE ===
  if (rawText.includes("🎮 Manual Bet")) {
    if (!userState[userId]) {
      userState[userId] = {};
    }
    userState[userId].isInManualBetMode = true;
    userState[userId].isInBetPlaceSettings = false;
    delete userState[userId].lastKeyboard;
    
    await sendMessageWithRetry(ctx, "🎮 Manual Bet Mode\n━━━━━━━━━━━━━━━\n\nSelect an option:", makeManualBetKeyboard());
    return;
  }

  // === AUTO BET MODE ===
  if (rawText.includes("🤖 Auto Bet")) {
    if (!userState[userId]) {
      userState[userId] = {};
    }
    userState[userId].isInManualBetMode = false;
    userState[userId].isInBetPlaceSettings = false;
    delete userState[userId].lastKeyboard;
    
    await sendMessageWithRetry(ctx, "🤖 Auto Bet Mode\n━━━━━━━━━━━━━━━\n\nSelect an option:", makeAutoBetKeyboard());
    return;
  }

  // === RISK CONTROL ===
  if (rawText.includes("📟 Risk Control") || rawText.includes("Risk Control")) {
    if (!userState[userId]) userState[userId] = {};
    userState[userId].lastKeyboard = 'risk_control';
    await sendMessageWithRetry(ctx, "📟 Risk Control Settings\n\nSelect an option:", makeRiskControlKeyboard());
    return;
  }

  // === BET PLACE SETTINGS ===
  if (rawText.includes("⚙️ Bet Place Settings") || rawText.includes("Bet Place Settings")) {
    if (!userState[userId]) {
      userState[userId] = {};
    }
    userState[userId].isInBetPlaceSettings = true;
    userState[userId].isInManualBetMode = false;
    await sendMessageWithRetry(ctx, "⚙️ Bet Place Settings\n\nSelect an option:", makeBetPlaceSettingsKeyboard());
    return;
  }

  // === RESULTS ===
  if (rawText.includes("📊 Results") || rawText.includes("Results")) {
    await handleResultsCommand(ctx, userId);
    return;
  }

  // === RECENT BET ===
  if (rawText.includes("📝 Recent Bet") || rawText.includes("Recent Bet")) {
    await handleRecentBetsCommand(ctx, userId);
    return;
  }

  // === TIME LEFT ===
  if (rawText.includes("⏳ Time Left") || rawText.includes("Time Left") || rawText.includes("time left")) {
    const timeLeftInfo = await getCurrentPeriodTimeLeft(userId);
    if (timeLeftInfo) {
      let message = `⏳ <b>Time Left Info</b>\n\n`;
      
      message += `🎮 Game: ${timeLeftInfo.gameType}\n`;
      
      if (timeLeftInfo.currentIssue) {
        const displayIssue = timeLeftInfo.currentIssue.length > 5 ? timeLeftInfo.currentIssue.slice(-5) : timeLeftInfo.currentIssue;
        message += `📅 Current Period: ${displayIssue}\n`;
      }
      
      if (timeLeftInfo.secondsLeft > 0) {
        message += `🕒 Time Left: ${timeLeftInfo.timeLeftDisplay} (${timeLeftInfo.secondsLeft}s)\n`;
      } else {
        message += `🕒 Time Left: Not available\n`;
      }
      
      await sendMessageWithRetry(ctx, message, { parse_mode: 'HTML' });
    } else {
      await sendMessageWithRetry(ctx, "❌ Unable to fetch time left information", makeManualBetKeyboard());
    }
    return;
  }

  // === DEBUG API ===
  if (rawText.includes("🔧 Debug API") || rawText.includes("debug api")) {
    try {
      const session = userSessions[userId];
      const settings = userSettings[userId] || {};
      const gameType = settings.game_type || "TRX";
      
      const issueRes = await getGameIssueRequest(session, gameType);
      if (issueRes) {
        let debugMessage = `🔧 <b>${gameType} API Debug</b>\n\n`;
        debugMessage += `<code>Status: ${issueRes.code === 0 ? '✅ Success' : '❌ Error'}</code>\n`;
        debugMessage += `<code>Message: ${issueRes.msg || 'No message'}</code>\n\n`;
        
        if (issueRes.code === 0 && issueRes.data) {
          debugMessage += `<b>Available Fields:</b>\n`;
          const fields = Object.keys(issueRes.data);
          debugMessage += `<code>${fields.join(', ')}</code>\n\n`;
          
          if (issueRes.data.predraw) {
            debugMessage += `<b>Predraw Fields:</b>\n`;
            const predrawFields = Object.keys(issueRes.data.predraw);
            debugMessage += `<code>${predrawFields.join(', ')}</code>\n\n`;
          }
          
          const dataStr = JSON.stringify(issueRes.data, null, 2);
          if (dataStr.length > 1500) {
            debugMessage += `<b>Data (truncated):</b>\n<code>${dataStr.substring(0, 1500)}...</code>`;
          } else {
            debugMessage += `<b>Data:</b>\n<code>${dataStr}</code>`;
          }
        }
        
        await sendMessageWithRetry(ctx, debugMessage, { parse_mode: 'HTML' });
      } else {
        await sendMessageWithRetry(ctx, "❌ No API response received");
      }
    } catch (error) {
      await sendMessageWithRetry(ctx, `❌ Debug Error: ${error.message}`);
    }
    return;
  }

   let currentBalance = 0;
    if (userId && userGameInfo[userId]) {
      currentBalance = userGameInfo[userId].balance || 0;
    }

  // === BALANCE ===
  if (userSessions[userId]) {
    const session = userSessions[userId];
    const settings = userSettings[userId] || {};
    const gameType = settings.game_type || "TRX";
    
    if (rawText.includes("💰 Balance") || rawText.includes("Balance") || rawText.includes("balance")) {
      const balance = await getBalance(session, userId);
      if (balance !== null) {
        await sendMessageWithRetry(ctx, `💰 Current Balance: ${currentBalance.toFixed(2)} Ks`, makeManualBetKeyboard());
      } else {
        await sendMessageWithRetry(ctx, "❌ Failed to get balance", makeManualBetKeyboard());
      }
      return;
    }
    
    // === MANUAL BET BUTTONS ===
    if (rawText.includes("🎯 Bet Big") || rawText.includes("Bet Big") || rawText.includes("bet big")) {
      await placeManualBet(userId, session, 'B', gameType, ctx);
      return;
    }
    
    if (rawText.includes("🎯 Bet Small") || rawText.includes("Bet Small") || rawText.includes("bet small")) {
      await placeManualBet(userId, session, 'S', gameType, ctx);
      return;
    }
    
    if (rawText.includes("🔴 Bet Red") || rawText.includes("Bet Red") || rawText.includes("bet red")) {
      await placeManualBet(userId, session, 'R', gameType, ctx);
      return;
    }
    
    if (rawText.includes("🟢 Bet Green") || rawText.includes("Bet Green") || rawText.includes("bet green")) {
      await placeManualBet(userId, session, 'G', gameType, ctx);
      return;
    }
    
    if (rawText.includes("🟣 Bet Violet") || rawText.includes("Bet Violet") || rawText.includes("bet violet")) {
      await placeManualBet(userId, session, 'V', gameType, ctx);
      return;
    }
  }

  // === STATE-BASED INPUT HANDLING ===
  const currentState = userState[userId]?.state || "";

  if (currentState === "INPUT_ADD_USER") {
    const sixId = parseInt(text);
    if (isNaN(sixId)) {
      await sendMessageWithRetry(ctx, "Invalid ID. Please enter a valid number:");
      return;
    }
    
    if (allowedsixuserid.has(sixId)) {
      await sendMessageWithRetry(ctx, `User ${sixId} already exists in the allowed list.`);
    } else {
      allowedsixuserid.add(sixId);
      saveAllowedUsers();
      await sendMessageWithRetry(ctx, `✅ User ${sixId} has been added to the allowed list.`);
    }
    
    delete userState[userId];
    await ctx.reply("Admin Panel:", makeAdminPanelKeyboard());
    return;
  }

  if (currentState === "INPUT_REMOVE_USER") {
    const sixId = parseInt(text);
    if (isNaN(sixId)) {
      await sendMessageWithRetry(ctx, "Invalid ID. Please enter a valid number:");
      return;
    }
    
    if (!allowedsixuserid.has(sixId)) {
      await sendMessageWithRetry(ctx, `User ${sixId} does not exist in the allowed list.`);
    } else {
      allowedsixuserid.delete(sixId);
      saveAllowedUsers();
      await sendMessageWithRetry(ctx, `✅ User ${sixId} has been removed from the allowed list.`);
    }
    
    delete userState[userId];
    await ctx.reply("Admin Panel:", makeAdminPanelKeyboard());
    return;
  }

  if (currentState === "INPUT_BROADCAST_MESSAGE") {
    const messageToSend = rawText.trim();
    
    if (!messageToSend) {
      await sendMessageWithRetry(ctx, "Message cannot be empty. Please enter a message to broadcast:");
      return;
    }
    
    try {
      const telegramUserIds = Array.from(activeUsers);
      
      if (telegramUserIds.length === 0) {
        await sendMessageWithRetry(ctx, "No active users found to send message to.");
      } else {
        let successCount = 0;
        let failedCount = 0;
        
        for (const telegramId of telegramUserIds) {
          try {
            await ctx.telegram.sendMessage(telegramId, `📢 Admin Broadcast:\n\n${messageToSend}`);
            successCount++;
          } catch (error) {
            logging.error(`Failed to send message to user ${telegramId}: ${error.message}`);
            failedCount++;
          }
        }

        const resultMessage = `✅ Message sent to ${successCount} users` + 
                              (failedCount > 0 ? `\n❌ Failed to send to ${failedCount} users` : "");
        await sendMessageWithRetry(ctx, resultMessage);
        
        logging.info(`Admin broadcast sent to ${successCount}/${telegramUserIds.length} users`);
      }
    } catch (error) {
      logging.error(`Error sending admin broadcast: ${error.message}`);
      await sendMessageWithRetry(ctx, "Error sending message. Please try again later.");
    }
    
    delete userState[userId];
    await ctx.reply("Admin Panel:", makeAdminPanelKeyboard());
    return;
  }

  if (currentState === "INPUT_VIRTUAL_BALANCE") {
    const balance = parseFloat(text);
    if (isNaN(balance) || balance <= 0) {
      await sendMessageWithRetry(ctx, "Invalid balance amount. Please enter a positive number:");
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
    
    await sendMessageWithRetry(ctx, `🖥️ Switched to Virtual Mode with ${balance} Ks`, makeAutoBetKeyboard());
    delete userState[userId];
    saveUserSettings();
    return;
  }

  if (currentState === "MANUAL_BET_AMOUNT") {
    const betAmount = parseFloat(text);
    if (isNaN(betAmount) || betAmount <= 0) {
      await sendMessageWithRetry(ctx, "❌ Wrong bet amount format. Please enter a positive number:");
      return;
    }
    
    const state = userState[userId];
    await processManualBetAmount(userId, betAmount, ctx, state.betChoice, state.gameType);
    return;
  }

  if (currentState === "MANUAL_BET_CUSTOM_MULTIPLIER") {
    const multiplier = parseInt(text);
    if (isNaN(multiplier) || multiplier <= 0) {
      await sendMessageWithRetry(ctx, "❌ Wrong multiplier format. Please enter a positive number (e.g., 23):");
      return;
    }
    
    const state = userState[userId];
    state.multiplier = multiplier;
    state.state = "MANUAL_BET_CONFIRM";
    
    const totalAmount = state.amount * multiplier;
    
    let betChoiceText;
    if (state.betChoice === 'B' || state.betChoice === 'S') {
      betChoiceText = state.betChoice === 'B' ? 'BIG' : 'SMALL';
    } else {
      betChoiceText = getColorName(state.betChoice);
    }
    
    await sendMessageWithRetry(ctx,
      `🎯 Bet Confirmation\n\n` +
      `▫️ Type: ${betChoiceText}\n` +
      `▫️ Amount: ${state.amount} Ks\n` +
      `▫️ Multiplier: ×${multiplier}\n` +
      `▫️ Total: ${totalAmount} Ks\n\n` +
      `Confirm this bet?`,
      makeBetConfirmationKeyboard()
    );
    return;
  }

  if (currentState === "INPUT_TIME_RANGE_START") {
    const timeStr = text.trim();
    const timeMatch = timeStr.match(/^\d{1,2}:\d{2}\s*(AM|PM)$/i);
    
    if (!timeMatch) {
      await sendMessageWithRetry(ctx, 
        "❌ Invalid time format. Please use format: 00:00 AM/PM\n\n" +
        "Examples:\n" +
        "• 01:13 AM\n" +
        "• 03:00 PM\n" +
        "• 09:30 AM\n" +
        "• 11:45 PM",
        makeRiskControlKeyboard()
      );
      return;
    }
    
    const timeInMinutes = parseTimeToMinutes(timeStr);
    if (timeInMinutes === null) {
      await sendMessageWithRetry(ctx, "❌ Invalid time. Please try again.", makeRiskControlKeyboard());
      return;
    }
    
    const settings = userSettings[userId];
    settings.time_range_start = timeStr.toUpperCase();
    
    userState[userId] = { state: "INPUT_TIME_RANGE_END" };
    
    const now = new Date();
    const currentTime = formatTime(now);
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
    let timeStatus = "";
    if (timeInMinutes > currentMinutes) {
      const diffMinutes = timeInMinutes - currentMinutes;
      const diffHours = Math.floor(diffMinutes / 60);
      const diffMins = diffMinutes % 60;
      
      if (diffHours > 0) {
        timeStatus = `\n⏳ Auto Bet will start in ${diffHours}h ${diffMins}m`;
      } else {
        timeStatus = `\n⏳ Auto Bet will start in ${diffMins}m`;
      }
    } else if (timeInMinutes < currentMinutes) {
      const diffMinutes = (24 * 60 - currentMinutes) + timeInMinutes;
      const diffHours = Math.floor(diffMinutes / 60);
      const diffMins = diffMinutes % 60;
      
      if (diffHours > 0) {
        timeStatus = `\n⏳ Auto Bet will start in ${diffHours}h ${diffMins}m (tomorrow)`;
      } else {
        timeStatus = `\n⏳ Auto Bet will start in ${diffMins}m (tomorrow)`;
      }
    } else {
      timeStatus = `\n⏳ Auto Bet will start now!`;
    }
    
    await sendMessageWithRetry(ctx, 
      `✅ Start time set to: ${timeStr.toUpperCase()}\n\n` +
      `⏰ Current Time: ${currentTime}${timeStatus}\n\n` +
      "Now enter end time (format: 00:00 AM/PM):\n\n" +
      "Examples:\n" +
      "• 01:15 AM\n" +
      "• 04:00 PM\n" +
      "• 10:30 AM\n" +
      "• 02:00 AM (next day)"
    );
    
    saveUserSettings();
    return;
  }

  if (currentState === "INPUT_TIME_RANGE_END") {
    const timeStr = text.trim();
    const timeMatch = timeStr.match(/^\d{1,2}:\d{2}\s*(AM|PM)$/i);
    
    if (!timeMatch) {
      await sendMessageWithRetry(ctx, 
        "❌ Wrong time format. Please use format: 00:00 AM/PM\n\n" +
        "Examples:\n" +
        "• 01:15 AM\n" +
        "• 04:00 PM\n" +
        "• 10:30 AM\n" +
        "• 02:00 AM",
        makeRiskControlKeyboard()
      );
      return;
    }
    
    const endTimeInMinutes = parseTimeToMinutes(timeStr);
    if (endTimeInMinutes === null) {
      await sendMessageWithRetry(ctx, "❌ Invalid time. Please try again.", makeRiskControlKeyboard());
      return;
    }
    
    const settings = userSettings[userId];
    const startTimeInMinutes = parseTimeToMinutes(settings.time_range_start);
    
    if (startTimeInMinutes === null) {
      await sendMessageWithRetry(ctx, "❌ Start time is not set properly. Please set time range again.", makeRiskControlKeyboard());
      delete userState[userId];
      return;
    }
    
    let isEndAfterStart = false;
    if (endTimeInMinutes > startTimeInMinutes) {
      isEndAfterStart = true;
    } else {
      await sendMessageWithRetry(ctx,
        `⚠️ End time (${timeStr.toUpperCase()}) is before start time (${settings.time_range_start}).\n\n` +
        `Do you want end time to be next day?`,
        Markup.inlineKeyboard([
          [
            Markup.button.callback("✅ Yes, next day", "time_range_confirm:yes"),
            Markup.button.callback("❌ No, change time", "time_range_confirm:no")
          ]
        ])
      );
      
      userTemp[userId] = { pending_end_time: timeStr.toUpperCase() };
      return;
    }
    
    if (isEndAfterStart) {
      settings.time_range_end = timeStr.toUpperCase();
      settings.time_range_auto_start = true;
      
      const now = new Date();
      const currentTime = formatTime(now);
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      
      let autoStartMessage = "";
      if (settings.running) {
        autoStartMessage = "\n\n⚠️ Bot is already running. Time range will be applied on next bet cycle.";
      } else {
        autoStartMessage = "\n\n✅ Auto Start is enabled. Bot will start automatically at the start time.";
        
        if (currentMinutes >= startTimeInMinutes && currentMinutes < endTimeInMinutes) {
          autoStartMessage += "\n🟢 Within time range now! You can start the bot.";
        }
      }
      
      await sendMessageWithRetry(ctx, 
        `✅ Time Range Set Successfully!\n\n` +
        `⏰ Time Range: ${settings.time_range_start} - ${settings.time_range_end}\n` +
        `🕒 Current Time: ${currentTime}\n` +
        autoStartMessage,
        makeRiskControlKeyboard()
      );
      
      delete userState[userId];
      delete userTemp[userId];
      saveUserSettings();
    }
    return;
  }

  // === LOGIN HANDLING ===
  const command = text.toUpperCase()
    .replace(/_/g, '')
    .replace(/ /g, '')
    .replace(/\//g, '')
    .replace(/\(/g, '')
    .replace(/\)/g, '')
    .replace(/🔐/g, '')
    .replace(/💰/g, '')
    .replace(/📝/g, '')
    .replace(/▶️/g, '')
    .replace(/⏹️/g, '')
    .replace(/🎯/g, '')
    .replace(/🛑/g, '')
    .replace(/🎛/g, '')
    .replace(/🧠/g, '')
    .replace(/📈/g, '')
    .replace(/⛔/g, '')
    .replace(/🔄/g, '')
    .replace(/ℹ️/g, 'INFO')
    .replace(/🖥️/g, '')
    .replace(/📂/g, '')
    .replace(/🤿/g, '')
    .replace(/🔺/g, '')
    .replace(/🔻/g, '')
    .replace(/🎲/g, '')
    .replace(/📚/g, '')
    .replace(/🕹/g, '')
    .replace(/💥/g, '')
    .replace(/⛳/g, '')
    .replace(/🕒/g, '');

  if (command === "LOGIN" || (lines.length > 0 && lines[0].toLowerCase() === "login")) {
    if (lines.length >= 3 && lines[0].toLowerCase() === "login") {
      const username = lines[1];
      const password = lines[2];
      const selectedSite = userSelectedSite[userId] || "6Lottery";

      console.log(`[USER_ACTIVITY] User ${userName} (ID: ${userId}) logged in to ${selectedSite}`);
      activeUsers.add(userId);
      
      await sendMessageWithRetry(ctx, "Checking...");
      const { response: res, session } = await loginRequest(username, password, selectedSite);
      if (session) {
        const userInfo = await getUserInfo(session, userId);
        if (userInfo && userInfo.user_id) {
          const gameUserId = userInfo.user_id;

          if (!global.publicAccessEnabled && !allowedsixuserid.has(gameUserId)) {
            await sendMessageWithRetry(ctx, 
              `⛔ YOUR ID ${gameUserId} IS NOT EXIST IN LIST\n` +
              `━━━━━━━━━━━━━━━━\n\n` +
              `Please contact admin to get access\n` +
              `Admin: @Mlopp67`
            );
            return;
          }
    
          userSessions[userId] = session;
          userGameInfo[userId] = userInfo;
          userTemp[userId] = { password };
          userSelectedSite[userId] = selectedSite;

          userAllResults[userId] = [];
          userLastNumbers[userId] = [];
          
          const balance = await getBalance(session, userId);
          
          if (!userSettings[userId]) {
            userSettings[userId] = {
              strategy: "AI_PREDICTION",
              betting_strategy: "Martingale",
              game_type: "TRX",
              bet_type: "BS",
              martin_index: 0,
              dalembert_units : 1,
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
          
          if (!userStats[userId]) {
            userStats[userId] = { start_balance: parseFloat(balance || 0), profit: 0.0 };
          }
          
          const balanceDisplay = balance !== null ? balance : 0.0;
          
          const userInfoMessage = 
            `✅ LOGIN SUCCESSFUL!\n\n` +
            `🌐 Site: ${selectedSite}\n` +
            `👤 User Information:\n` +
            `├─ User ID: ${userInfo.user_id}\n` +
            `├─ Username: ${userInfo.username || 'N/A'}\n` +
            `├─ Nickname: ${userInfo.nickname || 'N/A'}\n` +
            `├─ Balance: ${balanceDisplay} Ks\n` +
            `├─ Login Date: ${userInfo.login_date || 'N/A'}\n` +
            `└─ Allow Withdraw: ${userInfo.is_allow_withdraw ? 'Yes' : 'No'}\n\n` +
            `🎮 Select your betting mode:`;
          
          await sendMessageWithRetry(ctx, userInfoMessage, makeMainMenuKeyboard(true));
          
          const settings = userSettings[userId];
          if (settings.bet_sizes && settings.pattern) {
            await showUserStats(ctx, userId);
          }

          saveUserSettings();
        } else {
          await sendMessageWithRetry(ctx, "Login failed: Could not get user info", makeMainMenuKeyboard(false));
        }
      } else {
        const msg = res.msg || "Login failed";
        await sendMessageWithRetry(ctx, `Login error: ${msg}`, makeMainMenuKeyboard(false));
      }
      delete userState[userId];
      delete userTemp[userId];
      return;
    }
    await sendMessageWithRetry(ctx, "အောက်မှာပြထားသည့်အတိုင်း Login ၀င်ပါ:\n\nLogin\nphone\npassword");
    return;
  }
  
  if (!await checkUserAuthorized(ctx) && command !== "LOGIN") {
    return;
  }
  
  try {
    // === RISK CONTROL BUTTONS ===
    if (rawText.includes("🔺 Profit Target") || rawText.includes("Profit Target")) {
      userState[userId] = { state: "INPUT_PROFIT_TARGET" };
      await sendMessageWithRetry(ctx, "🔺 Profit_Target ထည့်ပါ\n\nExample: 10000", makeRiskControlKeyboard());
      return;
    }

    if (rawText.includes("🔻 Stop Loss Limit") || rawText.includes("Stop Loss Limit")) {
      userState[userId] = { state: "INPUT_STOP_LIMIT" };
      await sendMessageWithRetry(ctx, "🔻 Stop_Loss_Limit ထည့်ပါ\n\nExample: 10000", makeRiskControlKeyboard());
      return;
    }

    if (rawText.includes("⛳ Entry Layer") || rawText.includes("Entry Layer")) {
      await sendMessageWithRetry(ctx, "Choose Entry Layer", makeEntryLayerKeyboard());
      return;
    }

    if (rawText.includes("💥 Bet_SL") || rawText.includes("Bet_SL")) {
      await sendMessageWithRetry(ctx, "Choose SL Layer", makeSLLayerKeyboard());
      return;
    }

    if (rawText.includes("🕒 Time Range") || rawText.includes("Time Range")) {
      await sendMessageWithRetry(ctx, "⏰ Time Range Settings", makeTimeRangeKeyboard());
      return;
    }

    if (rawText.includes("📚 Strategy") || rawText.includes("Strategy")) {
      await sendMessageWithRetry(ctx, "Choose strategy:", makeStrategyKeyboard(userId));
      return;
    }

    // === AUTO BET CONTROL BUTTONS ===
    if (rawText.includes("🍏 Activate") || rawText.includes("Start")) {
      console.log(`[USER_ACTIVITY] User ${userName} (ID: ${userId}) started the bot`);
      
      const settings = userSettings[userId] || {};
      
      if (!settings.bet_sizes) {
        await sendMessageWithRetry(ctx, "Please set BET WRAGER first!", makeAutoBetKeyboard());
        return;
      }
      
      if (settings.strategy === "SNIPER" && settings.bet_sizes.length !== 4) {
        await sendMessageWithRetry(ctx, "SNIPER strategy requires exactly 4 bet wrager. Please set 4 bet wrager first.", makeAutoBetKeyboard());
        return;
      }
      
      if (settings.strategy === "BS_ORDER" && !settings.pattern) {
        settings.pattern = DEFAULT_BS_ORDER;
        settings.pattern_index = 0;
        await sendMessageWithRetry(ctx, `No BS order provided. Using default: ${DEFAULT_BS_ORDER}`, makeAutoBetKeyboard());
      }
      
      if (settings.betting_strategy === "D'Alembert" && settings.bet_sizes.length > 1) {
        await sendMessageWithRetry(ctx, 
          "❌ D'Alembert strategy requires only ONE bet wrager.\n" +
          "Please set Bet Wrager again with only one number.",
          makeAutoBetKeyboard()
        );
        return;
      }
      
      if (settings.running) {
        await sendMessageWithRetry(ctx, "Bot is already running!", makeAutoBetKeyboard());
        return;
      }
      
      settings.running = true;
      settings.consecutive_errors = 0;
      saveUserSettings();
      
      const isLeslayStrategy = settings.strategy === "SNIPER";
      const entryLayer = settings.layer_limit || 1;
      
      if (!isLeslayStrategy) {
        if (entryLayer === 2) {
          settings.entry_layer_state = { waiting_for_lose: true };
        } else if (entryLayer === 3) {
          settings.entry_layer_state = { waiting_for_loses: true, consecutive_loses: 0 };
        }
      }

      if (settings.strategy === "DREAM") {
        settings.dream_state = {
          first_bet: true,
          current_pattern: "",
          current_index: 0
        };
      }

      if (settings.strategy === "BABIO") {
        settings.babio_state = {
          current_position: 8,
          last_result: null
        };
      }

      if (settings.strategy === "LEO") {
        settings.leo_state = {
          last_result: null,
          pattern_index: 0
        };
        logging.info(`LEO strategy initialized for user ${userId}`);
      }

      if (settings.strategy === "TREND_FOLLOW") {
        settings.trend_state = {
          last_result: null,
          skip_mode: false
        };
        logging.info(`TREND_FOLLOW strategy initialized for user ${userId}`);
      }

      const betType = settings.bet_type || "BS";
      if (betType === "COLOR" && settings.strategy === "TREND_FOLLOW") {
        settings.color_trend_state = {
          last_result: null
        };
        logging.info(`Color TREND_FOLLOW strategy initialized for user ${userId}`);
      }

      if (settings.strategy === "ALTERNATE") {
        settings.alternate_state = {
          last_result: null,
          skip_mode: false
        };
        logging.info(`ALTERNATE strategy initialized for user ${userId}`);
      }
      
      if (isLeslayStrategy) {
        settings.sniper_state = {
          active: false,
          direction: null,
          current_index: 0,
          hit_count: 0,
          bet_sequence: [],
          got_same_result: false
        };
        userLastNumbers[userId] = [];
        logging.info(`SNIPER strategy reset for user ${userId}`);
      }
      
      if (settings.strategy === "BEATRIX") {
        settings.beatrix_state = {
          waiting_for_seven: true,
          last_period_with_seven: null
        };
        logging.info(`BEATRIX strategy initialized for user ${userId}`);
      }

      if (settings.strategy === "AI_PREDICTION") {
        userAILast10Results[userId] = [];
        userAIRoundCount[userId] = 0;
        logging.info(`AI strategy initialized for user ${userId}`);
      }

      if (settings.strategy === "BABIO") {
        userAILast10Results[userId] = [];
        userAIRoundCount[userId] = 0;
        logging.info(`Babio strategy initialized for user ${userId}`);
      }
      
      if (settings.strategy === "LYZO") {
        userLast10Results[userId] = [];
        userLyzoRoundCount[userId] = 0;
        logging.info(`Lyzo strategy initialized for user ${userId}`);
      }
      if (!userLastNumbers[userId]) {
        userLastNumbers[userId] = [];
      }
      
      delete userSkippedBets[userId];
      userShouldSkipNext[userId] = false;
      delete userSLSkipWaitingForWin[userId];
      
      userWaitingForResult[userId] = false;
      bettingWorker(userId, ctx, bot || ctx.telegram.bot || ctx.telegram);
      return;
    } 
      
    if (rawText.includes("📂 Info") || rawText.includes("Info")) {
      await showUserStats(ctx, userId);
      return;
    }

    if (rawText === "🍎 Deactivate" || rawText === "Stop") {
      console.log(`[USER_ACTIVITY] User ${userName} (ID: ${userId}) stopped the bot`);
      
      const settings = userSettings[userId] || {};
      if (!settings.running) {
        await sendMessageWithRetry(ctx, "Bot is not running!", makeAutoBetKeyboard());
        return;
      }
      
      userStopInitiated[userId] = true;
      
      settings.running = false;
      delete userWaitingForResult[userId];
      delete userShouldSkipNext[userId];
      delete userSLSkipWaitingForWin[userId];
      
      saveUserSettings();
      
      if (settings.strategy === "AI_PREDICTION") {
        delete userAILast10Results[userId];
        delete userAIRoundCount[userId];
      }
      
      if (settings.strategy === "BABIO") {
        delete userAILast10Results[userId];
        delete userAIRoundCount[userId];
        delete settings.babio_state;
      }
      
      if (settings.strategy === "LYZO") {
        delete userLast10Results[userId];
        delete userLyzoRoundCount[userId];
      }
      
      if (settings.strategy === "LEO") {
        delete settings.leo_state;
      }
      
      if (settings.strategy === "TREND_FOLLOW") {
        delete settings.trend_state;
        delete settings.color_trend_state;
      }
      
      if (settings.strategy === "ALTERNATE") {
        delete settings.alternate_state;
      }
      
      if (settings.strategy === "SNIPER") {
        delete settings.sniper_state;
      }
      
      if (settings.strategy === "BEATRIX") {
        delete settings.beatrix_state;
      }
      
      let totalProfit = 0;
      let balanceText = "";
      
      if (settings.virtual_mode) {
        totalProfit = (userStats[userId]?.virtual_balance || 0) - (userStats[userId]?.initial_balance || 0);
        balanceText = `Final Balance: ${(userStats[userId]?.virtual_balance || 0).toFixed(2)} Ks\n`;
      } else {
        totalProfit = userStats[userId]?.profit || 0;
        try {
          const session = userSessions[userId];
          const finalBalance = await getBalance(session, userId);
          balanceText = `Final Balance: ${finalBalance?.toFixed(2) || '0.00'} Ks\n`;
        } catch (error) {
          logging.error(`Failed to get final balance: ${error.message}`);
          balanceText = "Final Balance: Unknown\n";
        }
      }
      
      let profitIndicator = "";
      if (totalProfit > 0) {
        profitIndicator = "+";
      } else if (totalProfit < 0) {
        profitIndicator = "-";
      }
      
      delete userStats[userId];
      settings.martin_index = 0;
      settings.dalembert_units = 1;
      settings.custom_index = 0;
      delete settings.dream_state;
      
      saveUserSettings();
      const message = `🍎 BOT DEACTIVATED\n\n` +
                      `💳 ${balanceText}` +
                      `💰 Total Profit: ${profitIndicator}${totalProfit.toFixed(2)} Ks`;
      await sendMessageWithRetry(ctx, message, makeAutoBetKeyboard());
      return;
    }
    
    if (rawText.includes("🤿 Bet_Wrager") || rawText.includes("Bet_Size")) {
      userState[userId] = { state: "INPUT_BET_WRAGER" };
      await sendMessageWithRetry(ctx, "Enter bet wrager:\n\nExample: 100-300-500-900", makeAutoBetKeyboard());
      return;
    }
    
    if (rawText.includes("🕹 Anti/Martingale") || rawText.includes("Anti/Martingale")) {
      const settings = userSettings[userId] || {};
  
      if (settings.strategy === "SNIPER") {
        await sendMessageWithRetry(ctx, "SNIPER strategy only supports Martingale betting strategy!", makeBetPlaceSettingsKeyboard());
        return;
      }
  
      await sendMessageWithRetry(ctx, "Choose Betting Strategy", makeBettingStrategyKeyboard());
      return;
    }
    
    if (rawText.includes("🎲 Game Type") || rawText.includes("Game Type")) {
      await sendMessageWithRetry(ctx, "Select Game Type:", makeGameTypeKeyboard());
      return;
    }
    
    if (rawText.includes("🎯 Bet Type") || rawText.includes("Bet Type")) {
      await sendMessageWithRetry(ctx, "Select Bet Type:", makeBetTypeKeyboard());
      return;
    }
    
    if (rawText.includes("🎛 Virtual/Real Mode") || rawText.includes("Virtual/Real Mode")) {
      await sendMessageWithRetry(ctx, "Choose Mode", makeModeSelectionKeyboard());
      return;
    }

    // === INPUT STATE HANDLING ===
    if (currentState === "INPUT_BET_WRAGER") {
      let betSizes = [];
      if (lines.length === 1 && lines[0].includes('-')) {
        betSizes = lines[0].split('-')
          .map(s => s.trim())
          .filter(s => s.match(/^\d+$/))
          .map(Number);
      } else {
        betSizes = lines.filter(s => s.match(/^\d+$/)).map(Number);
      }
      
      if (betSizes.length === 0) {
        throw new Error("No valid numbers");
      }
    
      const settings = userSettings[userId];
      if (settings.betting_strategy === "D'Alembert" && betSizes.length > 1) {
        await sendMessageWithRetry(ctx, 
          "❌ D'Alembert strategy requires only ONE bet wrager.\n" +
          "Please enter only one number for unit wrager.\n" +
          "Example:\n100",
          makeAutoBetKeyboard()
        );
        return;
      }

      userSettings[userId].bet_sizes = betSizes;
      userSettings[userId].dalembert_units = 1;
      userSettings[userId].martin_index = 0;
      userSettings[userId].custom_index = 0;
      
      let message = `BET WRAGER set: ${betSizes.join(',')} Ks`;
      if (settings.betting_strategy === "D'Alembert") {
        message += `\n📝 D'Alembert Unit Wrager: ${betSizes[0]} Ks`;
      }
      
      await sendMessageWithRetry(ctx, message, makeAutoBetKeyboard());
      delete userState[userId];
      saveUserSettings();
      return;
    } else if (currentState === "INPUT_4_BET_SIZES") {
      const betSizes = lines.filter(s => s.match(/^\d+$/)).map(Number);
      if (betSizes.length !== 4) {
        throw new Error("Please enter exactly 4 bet wrager for SNIPER strategy");
      }
      
      userSettings[userId].bet_sizes = betSizes;
      await sendMessageWithRetry(ctx, `SNIPER Bet Wrager set: ${betSizes.join(',')} Ks`, makeAutoBetKeyboard());
      delete userState[userId];
      saveUserSettings();
      return;
    } else if (currentState === "INPUT_BS_PATTERN") {
      const pattern = text.toUpperCase();
      if (pattern && pattern.split('').every(c => c === 'B' || c === 'S')) {
        userSettings[userId].pattern = pattern;
        userSettings[userId].pattern_index = 0;
        await sendMessageWithRetry(ctx, `BS Pattern set: ${pattern}`, makeAutoBetKeyboard());
        delete userState[userId];
        saveUserSettings();
      } else {
        await sendMessageWithRetry(ctx, "Invalid pattern. Please use only B and S. Example: BSBSSB", makeAutoBetKeyboard());
      }
      return;
    } else if (currentState === "INPUT_PROFIT_TARGET") {
      const target = parseFloat(lines.length >= 2 ? lines[1] : text);
      if (isNaN(target) || target <= 0) {
        throw new Error("profit target အရင်ပြီးအောင်ထည့်ပါ");
      }

      userSettings[userId].target_profit = target;
      await sendMessageWithRetry(ctx,
        `✅PROFIT TARGET set: ${target} Ks\n\n`+ 
        `Bot will automatically stop when profit reaches ${target} Ks`, 
        makeRiskControlKeyboard()
      );
      delete userState[userId];
      saveUserSettings();
      return;
    } else if (currentState === "INPUT_STOP_LIMIT") {
      const stopLoss = parseFloat(text);
      if (isNaN(stopLoss) || stopLoss <= 0) {
        await sendMessageWithRetry(ctx, "❌ Invalid amount. Please enter a positive number for stop loss limit:\n\nExample: 10000", makeRiskControlKeyboard());
        return;
      }
      userSettings[userId].stop_loss = stopLoss;
      await sendMessageWithRetry(ctx, 
        `✅ STOP LOSS LIMIT SET: ${stopLoss} Ks\n\n` +
        `Bot will automatically stop when loss reaches ${stopLoss} Ks`,
        makeRiskControlKeyboard()
      );
      delete userState[userId];
      saveUserSettings();
      return;
    }
  } catch (error) {
    logging.error(`Text message handler error: ${error.message}`);
    await sendMessageWithRetry(ctx, `❌ Error: ${error.message}`, makeAutoBetKeyboard());
  }
}
const bot = new Telegraf(BOT_TOKEN);

bot.command('admin', cmdAdminPanelHandler);
bot.start(cmdStartHandler);
bot.command('add', cmdAllowHandler);
bot.command('remove', cmdRemoveHandler);
bot.command('showid', cmdShowIdHandler);
bot.command('users', cmdUsersHandler);
bot.command('send', cmdSendHandler);
bot.command('enable', cmdEnableHandler);
bot.command('disable', cmdDisableHandler);
bot.on('callback_query', callbackQueryHandler);
bot.on('text', textMessageHandler);

loadAllowedUsers();
loadUserSettings();
loadPatterns();
loadDreamPatterns();

// Start win/lose checker
winLoseChecker(bot);

// Start bot

function addDebugLogging() {
  logging.debug = (msg) => console.log(`[DEBUG] ${new Date().toISOString()} - ${msg}`);
}


bot.launch().then(() => {
  logging.info('Bot started successfully');
}).catch(error => {
  logging.error(`Bot failed to start: ${error.message}`);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

module.exports = { bot, userSettings, userSessions };
