"""Curated symbol catalog. Indian stocks use BSE listings (Alpha Vantage coverage)."""

US = [
    ("AAPL", "Apple"), ("MSFT", "Microsoft"), ("NVDA", "NVIDIA"), ("TSLA", "Tesla"),
    ("AMZN", "Amazon"), ("GOOGL", "Alphabet"), ("META", "Meta Platforms"), ("NFLX", "Netflix"),
    ("AMD", "AMD"), ("INTC", "Intel"), ("JPM", "JPMorgan Chase"), ("V", "Visa"),
    ("MA", "Mastercard"), ("BAC", "Bank of America"), ("WMT", "Walmart"), ("DIS", "Disney"),
    ("KO", "Coca-Cola"), ("PEP", "PepsiCo"), ("NKE", "Nike"), ("ORCL", "Oracle"),
    ("CRM", "Salesforce"), ("ADBE", "Adobe"), ("AVGO", "Broadcom"), ("QCOM", "Qualcomm"),
    ("UBER", "Uber"), ("PYPL", "PayPal"), ("SHOP", "Shopify"), ("COIN", "Coinbase"),
    ("PLTR", "Palantir"), ("SPY", "SPDR S&P 500 ETF"), ("QQQ", "Invesco QQQ ETF"),
]

IN = [
    ("RELIANCE", "Reliance Industries"), ("TCS", "Tata Consultancy"), ("INFY", "Infosys"),
    ("HDFCBANK", "HDFC Bank"), ("ICICIBANK", "ICICI Bank"), ("SBIN", "State Bank of India"),
    ("HINDUNILVR", "Hindustan Unilever"), ("ITC", "ITC"), ("BHARTIARTL", "Bharti Airtel"),
    ("KOTAKBANK", "Kotak Mahindra Bank"), ("LT", "Larsen & Toubro"), ("AXISBANK", "Axis Bank"),
    ("BAJFINANCE", "Bajaj Finance"), ("MARUTI", "Maruti Suzuki"), ("ASIANPAINT", "Asian Paints"),
    ("WIPRO", "Wipro"), ("HCLTECH", "HCL Technologies"), ("SUNPHARMA", "Sun Pharma"),
    ("TATASTEEL", "Tata Steel"), ("ADANIENT", "Adani Enterprises"), ("NIFTYBEES", "Nippon Nifty 50 ETF"),
]

CRYPTO = [
    ("BTC", "Bitcoin", "bitcoin"), ("ETH", "Ethereum", "ethereum"), ("SOL", "Solana", "solana"),
    ("BNB", "BNB", "binancecoin"), ("XRP", "XRP", "ripple"), ("ADA", "Cardano", "cardano"),
    ("DOGE", "Dogecoin", "dogecoin"), ("AVAX", "Avalanche", "avalanche-2"), ("DOT", "Polkadot", "polkadot"),
    ("LINK", "Chainlink", "chainlink"), ("LTC", "Litecoin", "litecoin"), ("TRX", "TRON", "tron"),
    ("SHIB", "Shiba Inu", "shiba-inu"), ("TON", "Toncoin", "the-open-network"),
    ("POL", "Polygon", "polygon-ecosystem-token"),
]

STARTER = [("AAPL", "US"), ("TSLA", "US"), ("NVDA", "US"), ("RELIANCE", "IN"), ("INFY", "IN"),
           ("TCS", "IN"), ("BTC", "CRYPTO"), ("ETH", "CRYPTO"), ("SOL", "CRYPTO")]


def make_item(symbol: str, market: str, name: str = "", cg_id: str = "") -> dict:
    symbol = symbol.upper()
    if market == "US":
        return {"symbol": symbol, "market": "US", "name": name or symbol, "currency": "USD",
                "av_symbol": symbol, "cg_id": None, "tv_symbol": symbol}
    if market == "IN":
        return {"symbol": symbol, "market": "IN", "name": name or symbol, "currency": "INR",
                "av_symbol": f"{symbol}.BSE", "cg_id": None, "tv_symbol": f"BSE:{symbol}"}
    return {"symbol": symbol, "market": "CRYPTO", "name": name or symbol, "currency": "USD",
            "av_symbol": None, "cg_id": cg_id, "tv_symbol": f"BINANCE:{symbol}USDT"}


def lookup(symbol: str, market: str) -> dict | None:
    symbol = symbol.upper()
    if market == "US":
        for s, n in US:
            if s == symbol:
                return make_item(s, "US", n)
    elif market == "IN":
        for s, n in IN:
            if s == symbol:
                return make_item(s, "IN", n)
    else:
        for s, n, cid in CRYPTO:
            if s == symbol:
                return make_item(s, "CRYPTO", n, cid)
    return None


def search_local(q: str) -> list:
    q = q.strip().lower()
    out = []
    for s, n in US:
        if q in s.lower() or q in n.lower():
            out.append(make_item(s, "US", n))
    for s, n in IN:
        if q in s.lower() or q in n.lower():
            out.append(make_item(s, "IN", n))
    for s, n, cid in CRYPTO:
        if q in s.lower() or q in n.lower():
            out.append(make_item(s, "CRYPTO", n, cid))
    return out
