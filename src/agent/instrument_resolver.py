import csv
import gzip
import urllib.request
import os
import logging
import difflib
from io import TextIOWrapper

logger = logging.getLogger(__name__)

INSTRUMENTS_URL = "https://assets.upstox.com/market-quote/instruments/exchange/complete.csv.gz"
CACHE_FILE = "instruments_cache.csv"

_symbol_to_key = {}
_initialized = False

def init_resolver():
    """Downloads (if necessary) and loads the instrument master into memory."""
    global _initialized, _symbol_to_key
    if _initialized:
        return

    # Check if we have a local cached file (we could add an expiry check, but this is fine for MVP)
    if not os.path.exists(CACHE_FILE):
        logger.info(f"Downloading instrument master from {INSTRUMENTS_URL}...")
        try:
            req = urllib.request.Request(INSTRUMENTS_URL, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req) as response:
                with gzip.GzipFile(fileobj=response) as gz:
                    content = gz.read()
                    with open(CACHE_FILE, "wb") as f:
                        f.write(content)
            logger.info("Successfully downloaded instrument master.")
        except Exception as e:
            logger.error(f"Failed to download instrument master: {e}")
            return
            
    logger.info("Loading instrument keys into memory...")
    try:
        with open(CACHE_FILE, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                symbol = row.get("tradingsymbol", "").strip().upper()
                instrument_key = row.get("instrument_key", "").strip()
                exchange = row.get("exchange", "").strip()
                name = row.get("name", "").strip().upper()
                
                if symbol and instrument_key:
                    # Prefer NSE over BSE if both exist
                    if symbol not in _symbol_to_key or exchange == "NSE_EQ":
                        _symbol_to_key[symbol] = instrument_key
                    # Also map the full name as a fallback
                    if name and name not in _symbol_to_key:
                        _symbol_to_key[name] = instrument_key

        _initialized = True
        logger.info(f"Loaded {len(_symbol_to_key)} instruments.")
    except Exception as e:
        logger.error(f"Failed to load instrument cache: {e}")

def resolve_symbol(symbol: str) -> str:
    """
    Given a stock symbol (e.g. 'TCS' or 'RELIANCE'), returns its instrument key.
    If it's already an instrument key (contains '|'), it returns it directly.
    Raises ValueError if not found.
    """
    if not symbol:
        raise ValueError("Symbol cannot be empty")
        
    symbol = symbol.strip().upper()
    
    # If the user passed a direct key like "NSE_EQ|INE467B01029"
    if "|" in symbol:
        return symbol

    if not _initialized:
        init_resolver()

    if symbol in _symbol_to_key:
        return _symbol_to_key[symbol]
        
    # Attempt to find common suffixes if they forgot it, though Upstox symbols for EQ are usually just the name.
    if symbol + "-EQ" in _symbol_to_key:
        return _symbol_to_key[symbol + "-EQ"]

    # Fuzzy matching
    matches = difflib.get_close_matches(symbol, _symbol_to_key.keys(), n=1, cutoff=0.7)
    if matches:
        closest = matches[0]
        logger.info(f"Fuzzy match resolved '{symbol}' to '{closest}'")
        return _symbol_to_key[closest]

    raise ValueError(f"Could not find instrument key for symbol: {symbol}")
