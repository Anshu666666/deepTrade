import os
import upstox_client
from dotenv import load_dotenv

load_dotenv()

from contextvars import ContextVar

# Unified state for sandbox modes by thread_id
thread_sandbox_modes = {}

# By default, use Sandbox mode
is_sandbox_mode: ContextVar[bool] = ContextVar("is_sandbox_mode", default=True)

# Cache clients so we don't recreate them constantly
_sandbox_client = None
_live_client = None
_analytics_client = None

def get_trading_client() -> upstox_client.ApiClient:
    """Gets the API client for trading (Orders/Portfolio). Respects sandbox vs live toggle."""
    sandbox_active = is_sandbox_mode.get()
    
    if sandbox_active:
        global _sandbox_client
        if _sandbox_client is None:
            token = os.environ.get("UPSTOX_SANDBOX_ACCESS_TOKEN")
            if not token:
                raise ValueError("UPSTOX_SANDBOX_ACCESS_TOKEN is not set.")
            config = upstox_client.Configuration()
            config.host = "https://api-sandbox.upstox.com"
            config.order_host = "https://api-sandbox.upstox.com"
            config.access_token = token
            _sandbox_client = upstox_client.ApiClient(config)
        return _sandbox_client
    else:
        return get_live_trading_client()

def get_live_trading_client() -> upstox_client.ApiClient:
    """Always gets the API client for LIVE trading, regardless of sandbox mode."""
    global _live_client
    if _live_client is None:
        token = os.environ.get("UPSTOX_LIVE_ACCESS_TOKEN")
        if not token:
            raise ValueError("UPSTOX_LIVE_ACCESS_TOKEN is not set. Cannot access real portfolio data.")
        config = upstox_client.Configuration()
        config.host = "https://api.upstox.com"
        config.order_host = "https://api-hft.upstox.com"
        config.access_token = token
        _live_client = upstox_client.ApiClient(config)
    return _live_client

def get_analytics_client() -> upstox_client.ApiClient:
    """Gets the API client for market data using the long-lived Analytics Token (always LIVE)."""
    global _analytics_client
    if _analytics_client is None:
        token = os.environ.get("UPSTOX_ANALYTICS_TOKEN")
        if not token:
            raise ValueError("UPSTOX_ANALYTICS_TOKEN is not set.")
        config = upstox_client.Configuration(sandbox=False)
        config.access_token = token
        _analytics_client = upstox_client.ApiClient(config)
    return _analytics_client

# Expose V3 APIs as preferred by SDK for orders and quotes
# Expose V3 APIs as preferred by SDK for orders and quotes
def get_order_api() -> upstox_client.OrderApiV3:
    return upstox_client.OrderApiV3(get_trading_client())

def get_market_quote_api() -> upstox_client.MarketQuoteV3Api:
    # Always use analytics client for market data since sandbox doesn't support it
    return upstox_client.MarketQuoteV3Api(get_analytics_client())

def get_history_api() -> upstox_client.HistoryV3Api:
    # Always use analytics client for market data
    return upstox_client.HistoryV3Api(get_analytics_client())

# Expose V2 APIs where V3 does not exist or isn't standard
def get_portfolio_api() -> upstox_client.PortfolioApi:
    # Portfolio APIs are NOT supported by Upstox Sandbox.
    # Therefore, we always use the LIVE trading client to read real portfolio data, even in sandbox mode.
    return upstox_client.PortfolioApi(get_live_trading_client())

def get_user_api() -> upstox_client.UserApi:
    return upstox_client.UserApi(get_live_trading_client())

def get_trade_pnl_api() -> upstox_client.TradeProfitAndLossApi:
    return upstox_client.TradeProfitAndLossApi(get_live_trading_client())
