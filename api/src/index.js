const SYMBOLS = ["AAPL", "MSFT", "TSLA", "GOOGL", "AMZN"];
const BASE_URL = "https://finnhub.io/api/v1/quote";
const THROTTLE_SECONDS = 60;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Setup CORS
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Content-Type": "application/json",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers });
    }

    if (url.pathname === "/api/stocks/latest") {
      try {
        const now = Math.floor(Date.now() / 1000);

        // 1. Check D1 for the most recent fetched_at timestamp
        const timeCheck = env.DB.prepare(`
          SELECT MAX(fetched_at) as last_fetch FROM stock_quotes
        `);
        const { results: timeResults } = await timeCheck.all();
        const lastFetch = timeResults[0]?.last_fetch || 0;

        // 2. Decide if we need fresh data from Finnhub (> 60s ago)
        if (now - lastFetch > THROTTLE_SECONDS) {
          console.log("Cache missed (or expired). Fetching fresh data from Finnhub...");
          await this.fetchAndStoreQuotes(env, now);
        } else {
          console.log("Cache hit! Serving data from D1 database.");
        }

        // 3. Return the Absolute Latest Data for each symbol
        const stmt = env.DB.prepare(`
          SELECT s1.* 
          FROM stock_quotes s1 
          JOIN (
            SELECT symbol, MAX(fetched_at) as max_time 
            FROM stock_quotes 
            GROUP BY symbol
          ) s2 
          ON s1.symbol = s2.symbol AND s1.fetched_at = s2.max_time
        `);
        const { results } = await stmt.all();
        return new Response(JSON.stringify(results), { headers });

      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers });
      }
    }

    if (url.pathname === "/api/stocks/history") {
      try {
        const symbol = url.searchParams.get("symbol") || "AAPL";
        const stmt = env.DB.prepare(`
          SELECT * FROM stock_quotes 
          WHERE symbol = ? 
          ORDER BY fetched_at DESC 
          LIMIT 60
        `).bind(symbol);

        const { results } = await stmt.all();
        return new Response(JSON.stringify(results.reverse()), { headers });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers });
      }
    }

    // New Finnhub Symbol Search Endpoint
    if (url.pathname === "/api/stocks/search") {
      try {
        const query = url.searchParams.get("q");
        if (!query) return new Response(JSON.stringify([]), { headers });

        const apiToken = env.FINNHUB_API_KEY;
        if (!apiToken || apiToken === "dummy-api-key") {
            return new Response(JSON.stringify([]), { headers }); 
        }

        const finnhubUrl = `https://finnhub.io/api/v1/search?q=${query}&token=${apiToken}`;
        
        const rawRes = await fetch(finnhubUrl);
        const data = await rawRes.json();
        
        // Filter out non-US stocks for cleaner UI (optional but good for basic apps)
        let results = data.result || [];
        results = results.filter(item => !item.symbol.includes('.')).slice(0, 8); // top 8 US-only

        return new Response(JSON.stringify(results), { headers });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers });
      }
    }

    return new Response(JSON.stringify({ message: "Welcome to Stocks API" }), { headers });
  },

  // Helper function to handle the actual fetching and inserts
  async fetchAndStoreQuotes(env, fetchedAt) {
    const apiToken = env.FINNHUB_API_KEY;

    // Optional Market Hours Check: Prevent hitting API fully if weekend
    const date = new Date(fetchedAt * 1000);
    const day = date.getUTCDay(); // 0 is Sunday, 6 is Saturday
    if (day === 0 || day === 6) {
      console.log("Market is closed (Weekend). Skipping Finnhub fetch.");
      return;
      // You could expand this to check UTC hours 13:30 - 20:00 (EST 9:30-16:00)
    }

    if (!apiToken || apiToken === "dummy-api-key") {
      console.error("FINNHUB_API_KEY not configured.");
      return;
    }

    // Fetch in parallel
    const fetches = SYMBOLS.map(async (symbol) => {
      const url = `${BASE_URL}?symbol=${symbol}&token=${apiToken}`;
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Status HTTP ${res.status}`);
        const data = await res.json();

        if (data.c !== undefined) {
          data.symbol = symbol;
          data.fetched_at = fetchedAt;
          return data;
        }
        return null;
      } catch (e) {
        console.error(`Failed to fetch ${symbol}:`, e.message);
        return null;
      }
    });

    const quotes = await Promise.all(fetches);
    const validQuotes = quotes.filter(q => q !== null);

    if (validQuotes.length === 0) return;

    // 1. Save raw JSON to R2 (Bronze)
    const key = `raw/${fetchedAt}.json`;
    await env.R2.put(key, JSON.stringify(validQuotes), {
      httpMetadata: { contentType: "application/json" }
    });

    // 2. Insert into D1
    const statements = validQuotes.map(q => {
      return env.DB.prepare(`
        INSERT INTO stock_quotes 
        (symbol, current_price, change, percent_change, high_price, low_price, open_price, previous_close, fetched_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        q.symbol, q.c, q.d, q.dp, q.h, q.l, q.o, q.pc, q.fetched_at
      );
    });

    try {
      if (statements.length > 0) {
        await env.DB.batch(statements);
        console.log(`Successfully fetched and inserted ${statements.length} records to D1.`);
      }
    } catch (e) {
      console.error("D1 Batch insert failed:", e.message);
    }
  }
};
