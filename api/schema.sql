DROP TABLE IF EXISTS stock_quotes;
CREATE TABLE stock_quotes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    current_price REAL,
    change REAL,
    percent_change REAL,
    high_price REAL,
    low_price REAL,
    open_price REAL,
    previous_close REAL,
    fetched_at INTEGER NOT NULL
);

-- Index for querying by symbol and time
CREATE INDEX idx_symbol_time ON stock_quotes(symbol, fetched_at DESC);
