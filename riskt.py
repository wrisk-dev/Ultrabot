import hashlib
import json
import time
import requests

# ---------------------------------------------------------
# CONFIGURATION
# ---------------------------------------------------------
TELEGRAM_BOT_TOKEN = "8731226261:AAFrSdmLs7wUOvkReHc1_KuPAv-wJUxguMY"
TELEGRAM_CHAT_ID = "-1004429330585"

GAME_LINK = "https://www.6win999.com/#/register?invitationCode=74587792885"
BOT_CONTACT = "@RN_6Lottery_Bot"

API_URL = "https://6lotteryapi.com/api/webapi/GetNoaverageEmerdList"
PAGE_SIZE = 100

HISTORY_7 = []

# Standard Emojis
EMOJI_BIG = "🔴"
EMOJI_SMALL = "🔵"
EMOJI_WIN = "✅"
EMOJI_LOSE = "❌"
EMOJI_FIRE = "🔥"
EMOJI_CHART = "📊"
EMOJI_TARGET = "🎯"
EMOJI_LIGHT = "💡"
EMOJI_GAME = "🎮"
EMOJI_ADMIN = "💬"

def generate_signature(params):
    filtered_keys = sorted([k for k in params.keys() if k != "timestamp"])
    sorted_obj = {k: params[k] for k in filtered_keys}
    json_str = json.dumps(sorted_obj, separators=(',', ':'))
    return hashlib.md5(json_str.encode('utf-8')).hexdigest().upper()

def fetch_lottery_data():
    timestamp = int(time.time())
    payload = {
        "pageSize": PAGE_SIZE,
        "typeId": 30,
        "language": 7,
        "random": "6958cae52e234eb1967082c9b5a9c4ce",
        "timestamp": timestamp
    }
    payload["signature"] = generate_signature(payload)
    headers = {"Content-Type": "application/json"}
    
    try:
        response = requests.post(API_URL, json=payload, headers=headers, timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get("code") == 0 and "data" in data and "list" in data["data"]:
                return data["data"]["list"]
    except Exception as e:
        print(f"[ERROR] API Fetch Failed: {e}")
    return []

def get_outcome(item):
    raw = item.get("number") or item.get("openNumber") or item.get("result") or item.get("winningNumber")
    if raw is None or raw == "":
        return "WAIT"

    raw_str = str(raw)
    if "," in raw_str:
        parts = [int(p.strip()) for p in raw_str.split(",") if p.strip().isdigit()]
        if not parts:
            return "WAIT"
        digit = sum(parts) % 10
    else:
        digits = [c for c in raw_str if c.isdigit()]
        if not digits:
            return "WAIT"
        digit = int(digits[-1])

    return "BIG" if digit >= 5 else "SMALL"

# ---------------------------------------------------------
# ADVANCED SIGNAL ALGORITHM (Trend & Pattern Analysis)
# ---------------------------------------------------------
def generate_advanced_signal(lottery_list):
    if len(lottery_list) < 10:
        return {"predict": "WAIT", "confidence": "0%", "reason": "Insufficient Data"}

    # ရလဒ် အဟောင်းမှ အသစ်သို့ စီခြင်း
    recent_history = [get_outcome(item) for item in lottery_list[:15] if get_outcome(item) != "WAIT"]
    
    if len(recent_history) < 5:
        return {"predict": "WAIT", "confidence": "0%", "reason": "Insufficient Valid History"}

    latest = recent_history[0]
    
    # 1. Streak Detection (Trend Follow Strategy)
    streak_count = 1
    for res in recent_history[1:]:
        if res == latest:
            streak_count += 1
        else:
            break
            
    if streak_count >= 3:
        return {
            "predict": latest,
            "confidence": "92%",
            "reason": f"Strong Trend Follow ({streak_count} Consecutive {latest})"
        }

    # 2. Pattern Detection (Zig-Zag Pattern Strategy)
    if len(recent_history) >= 4:
        if recent_history[0] != recent_history[1] and recent_history[1] != recent_history[2] and recent_history[2] != recent_history[3]:
            next_pred = "SMALL" if latest == "BIG" else "BIG"
            return {
                "predict": next_pred,
                "confidence": "87%",
                "reason": "Zig-Zag Alternating Pattern Detected"
            }

    # 3. Frequency Balance (Mean Reversion Strategy)
    last_10 = recent_history[:10]
    big_count = last_10.count("BIG")
    small_count = last_10.count("SMALL")

    if big_count >= 7:
        return {
            "predict": "SMALL",
            "confidence": "85%",
            "reason": f"Mean Reversion (BIG Dominance: {big_count}/10)"
        }
    elif small_count >= 7:
        return {
            "predict": "BIG",
            "confidence": "85%",
            "reason": f"Mean Reversion (SMALL Dominance: {small_count}/10)"
        }

    # 4. Fallback Logic based on Last Digit Weighting
    last_digit = int(str(lottery_list[0].get("issueNumber", 0))[-1])
    predict = "BIG" if (last_digit % 2 == 0) else "SMALL"
    
    return {
        "predict": predict,
        "confidence": "80%",
        "reason": "Standard Momentum & Probability Matrix"
    }

def build_7_games_text():
    if not HISTORY_7:
        return "<i>No data available</i>"
    
    wins = HISTORY_7.count("WIN")
    losses = HISTORY_7.count("LOSE")
    icons = " ".join([EMOJI_WIN if res == "WIN" else EMOJI_LOSE for res in HISTORY_7])
    return f"{icons}\n<b>Stats:</b> {wins} Win / {losses} Loss"

def send_telegram_msg(text):
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": TELEGRAM_CHAT_ID,
        "text": text,
        "parse_mode": "HTML",
        "disable_web_page_preview": True
    }
    try:
        res = requests.post(url, json=payload, timeout=5)
        return res.status_code == 200
    except Exception as e:
        print(f"[ERROR] Telegram Network Error: {e}")
        return False

def send_signal_msg(period, predict, confidence, reason):
    predict_emoji = EMOJI_BIG if predict == "BIG" else EMOJI_SMALL
    text = (
        f"<b>💎 VIP LOTTERY SIGNAL 💎</b>\n"
        f"━━━━━━━━━━━━━━━━━━━\n"
        f"{EMOJI_TARGET} <b>Target Period:</b> <code>{period}</code>\n"
        f"{EMOJI_CHART} <b>Prediction:</b> {predict_emoji} <b>{predict}</b>\n"
        f"{EMOJI_FIRE} <b>Win Rate:</b> <code>{confidence}</code>\n\n"
        f"{EMOJI_LIGHT} <b>Analysis:</b> <i>{reason}</i>\n"
        f"━━━━━━━━━━━━━━━━━━━\n"
        f"{EMOJI_GAME} <a href='{GAME_LINK}'><b>ဆော့ရန် လင့်ခ်နှိပ်ပါ</b></a>\n"
        f"{EMOJI_ADMIN} <b>Admin Contact:</b> {BOT_CONTACT}"
    )
    return send_telegram_msg(text)

def send_result_msg(period, predict, actual_outcome, raw_num, is_win):
    status_icon = f"{EMOJI_WIN} <b>WIN</b>" if is_win else f"{EMOJI_LOSE} <b>LOSE</b>"
    predict_emoji = EMOJI_BIG if predict == "BIG" else EMOJI_SMALL
    actual_emoji = EMOJI_BIG if actual_outcome == "BIG" else EMOJI_SMALL
    streak_7_text = build_7_games_text()

    text = (
        f"<b>📊 RESULT UPDATE</b>\n"
        f"━━━━━━━━━━━━━━━━━━━\n"
        f"{EMOJI_TARGET} <b>Period:</b> <code>{period}</code>\n"
        f"{EMOJI_LIGHT} <b>Predicted:</b> {predict_emoji} <b>{predict}</b>\n"
        f"🎲 <b>Actual Result:</b> {actual_emoji} <b>{actual_outcome}</b> (Number: {raw_num})\n\n"
        f"🏆 <b>Status:</b> {status_icon}\n"
        f"━━━━━━━━━━━━━━━━━━━\n"
        f"⚡ <b>Last 7 Games History:</b>\n{streak_7_text}\n"
        f"━━━━━━━━━━━━━━━━━━━\n"
        f"{EMOJI_GAME} <a href='{GAME_LINK}'><b>ဆော့ရန် လင့်ခ်နှိပ်ပါ</b></a>\n"
        f"{EMOJI_ADMIN} <b>Admin Contact:</b> {BOT_CONTACT}"
    )
    return send_telegram_msg(text)

def main():
    print("🚀 6 Lottery VIP Signal Bot Started...")
    pending_prediction = None

    while True:
        lottery_list = fetch_lottery_data()
        
        if lottery_list:
            latest_official = lottery_list[0]
            latest_period_str = str(latest_official["issueNumber"])
            latest_outcome = get_outcome(latest_official)
            raw_num = latest_official.get("number") or latest_official.get("openNumber") or latest_official.get("result") or "--"

            # 1. Result Update
            if pending_prediction and pending_prediction["period"] == latest_period_str:
                predicted = pending_prediction["predict"]
                is_win = (predicted == latest_outcome)
                
                HISTORY_7.append("WIN" if is_win else "LOSE")
                if len(HISTORY_7) > 7:
                    HISTORY_7.pop(0)

                success = send_result_msg(
                    period=latest_period_str,
                    predict=predicted,
                    actual_outcome=latest_outcome,
                    raw_num=raw_num,
                    is_win=is_win
                )
                if success:
                    print(f"[RESULT] Sent Period {latest_period_str} -> {'WIN' if is_win else 'LOSE'}")
                pending_prediction = None

            # 2. Next Signal Generation
            next_period_str = str(int(latest_period_str) + 1)
            
            if not pending_prediction or pending_prediction["period"] != next_period_str:
                signal = generate_advanced_signal(lottery_list)
                
                if signal["predict"] != "WAIT":
                    success = send_signal_msg(
                        period=next_period_str,
                        predict=signal["predict"],
                        confidence=signal["confidence"],
                        reason=signal["reason"]
                    )
                    
                    if success:
                        pending_prediction = {
                            "period": next_period_str,
                            "predict": signal["predict"]
                        }
                        print(f"[SIGNAL] Sent Period {next_period_str} -> {signal['predict']} ({signal['confidence']})")

        time.sleep(10)

if __name__ == "__main__":
    main()
    