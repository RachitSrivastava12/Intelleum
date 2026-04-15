const fs = require("fs");
const path = require("path");
const http = require("http");
const { URL } = require("url");

loadEnvFile();

const PORT = Number.parseInt(process.env.PORT || "8090", 10);
const HOST = process.env.HOST || "127.0.0.1";
const QUICKNODE_TEST_SECRET = process.env.QUICKNODE_TEST_SECRET || "";

function loadEnvFile() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "*",
  });
  res.end(body);
}

function collectBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    req.on("data", (chunk) => {
      chunks.push(chunk);
    });

    req.on("end", () => {
      resolve(Buffer.concat(chunks));
    });

    req.on("error", reject);
  });
}

function safeJsonParse(input) {
  try {
    return JSON.parse(input);
  } catch {
    return null;
  }
}

function summarizePayload(payload) {
  if (!payload || typeof payload !== "object") {
    return { blocks: 0, transactions: 0, keys: [] };
  }

  const data = payload.data;
  const keys = data && typeof data === "object" ? Object.keys(data).slice(0, 10) : [];

  const blocks = [];

  if (Array.isArray(payload)) {
    blocks.push(...payload);
  } else if (Array.isArray(payload.data)) {
    blocks.push(...payload.data);
  } else if (data && typeof data === "object") {
    for (const value of Object.values(data)) {
      if (value && typeof value === "object") {
        blocks.push(value);
      }
    }
  } else if (payload.blockhash || payload.transactions || payload.blockHeight || payload.slot) {
    blocks.push(payload);
  }

  const transactions = blocks.reduce((sum, block) => {
    return sum + (Array.isArray(block.transactions) ? block.transactions.length : 0);
  }, 0);

  const firstBlock =
    blocks[0]?.slot ??
    blocks[0]?.blockHeight ??
    blocks[0]?.blockNumber ??
    null;

  return {
    blocks: blocks.length,
    transactions,
    firstBlock,
    keys,
  };
}

function headerMap(headers) {
  return {
    "content-type": headers["content-type"] || null,
    "content-length": headers["content-length"] || null,
    "content-encoding": headers["content-encoding"] || null,
    "user-agent": headers["user-agent"] || null,
    "x-qn-nonce": headers["x-qn-nonce"] || null,
    "x-qn-signature": headers["x-qn-signature"] || null,
    "x-qn-timestamp": headers["x-qn-timestamp"] || null,
    authorization: headers.authorization || null,
  };
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const pathname = requestUrl.pathname;

  console.log(`[testing-streams] ${req.method} ${pathname}`);

  if (req.method === "OPTIONS") {
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === "GET" && pathname === "/health") {
    return sendJson(res, 200, {
      ok: true,
      service: "testing-streams",
      port: PORT,
      ts: Date.now(),
    });
  }

  if (req.method === "GET" && pathname === "/webhooks/quicknode") {
    return sendJson(res, 200, {
      ok: true,
      service: "testing-streams-quicknode-webhook",
    });
  }

  if (req.method === "POST" && pathname === "/webhooks/quicknode") {
    try {
      const bodyBuffer = await collectBody(req);
      const bodyText = bodyBuffer.toString("utf8");
      const parsedBody = safeJsonParse(bodyText);
      const summary = summarizePayload(parsedBody);

      const providedSecret =
        req.headers["x-stream-secret"] ||
        req.headers["x-quicknode-secret"] ||
        req.headers.authorization ||
        null;

      console.log("[testing-streams] quicknode headers", headerMap(req.headers));
      console.log("[testing-streams] quicknode body preview", bodyText.slice(0, 500) || "<empty>");
      console.log("[testing-streams] quicknode summary", summary);

      return sendJson(res, 200, {
        ok: true,
        received: true,
        hasBody: bodyText.trim().length > 0,
        secretConfigured: Boolean(QUICKNODE_TEST_SECRET),
        secretMatched: QUICKNODE_TEST_SECRET ? providedSecret === QUICKNODE_TEST_SECRET : null,
        summary,
      });
    } catch (error) {
      console.error("[testing-streams] webhook error", error);
      return sendJson(res, 200, {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown webhook error",
      });
    }
  }

  return sendJson(res, 404, {
    ok: false,
    error: "Not found",
    path: pathname,
  });
});

server.listen(PORT, HOST, () => {
  console.log(`[testing-streams] listening on http://${HOST}:${PORT}`);
  console.log(`[testing-streams] health: http://${HOST}:${PORT}/health`);
  console.log(`[testing-streams] webhook: http://${HOST}:${PORT}/webhooks/quicknode`);
});
