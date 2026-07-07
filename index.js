const axios = require("axios");
const fs = require("fs");
const path = require("path");
const pLimit = require("p-limit");

// ================= CONFIG =================
const CLIENT_ID = "kfq56bz2fc02cpa04fehcyp24atkzw";
const ACCESS_TOKEN = "behdqws5lx18y1gshmc7ejazmua5is";

const INPUT_FILE = "last-list.json";

const COVER_DIR = path.join(__dirname, "covers");
const CACHE_FILE = path.join(__dirname, "cache.json");
const FAILED_FILE = path.join(__dirname, "failed.txt");

// скорость (IGDB safe ~3–5 req/sec)
const limit = pLimit(1);

const HEADERS = {
  "Client-ID": CLIENT_ID,
  Authorization: `Bearer ${ACCESS_TOKEN}`,
  Accept: "application/json",
};

if (!fs.existsSync(COVER_DIR)) fs.mkdirSync(COVER_DIR);

// ================= CACHE =================
let cache = {};
if (fs.existsSync(CACHE_FILE)) {
  cache = JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8"));
}

function saveCache() {
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
}

function logFail(name) {
  fs.appendFileSync(FAILED_FILE, name + "\n");
}

// ================= UTILS =================
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function scoreGame(query, game) {
  let score = 0;

  const q = query.toLowerCase();
  const n = game.name.toLowerCase();

  if (n === q) score += 100;

  if (n.includes(q)) score += 50;

  if (game.first_release_date) score += 10;

  if (game.cover) score += 30;

  return score;
}

async function safeRequest(fn, retries = 5) {
  try {
    return await fn();
  } catch (err) {
    if (err.response?.status === 429 && retries > 0) {
      const wait = 2000;
      console.log("429 RATE LIMIT → wait", wait);

      await sleep(wait);
      return safeRequest(fn, retries - 1);
    }

    throw err;
  }
}

function normalize(name) {
  return name
    .replace(/™|®/g, "")
    .replace(/\(.*?\)/g, "")
    .replace(/\[.*?\]/g, "")
    .replace(/\bHD\b/gi, "")
    .replace(/\bRemastered\b/gi, "")
    .replace(/\bEdition\b/gi, "")
    .replace(/\bCollection\b/gi, "")
    .replace(/\bComplete\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeQuery(str) {
  return str.replace(/"/g, '\\"');
}

// ================= IGDB =================
async function searchGame(name) {
  const queries = [
    name,

    // убрать всё после :
    name.split(":")[0],

    // убрать года
    name.replace(/\d{4}/g, ""),

    // первые слова
    name.split(" ").slice(0, 2).join(" "),
  ];

  for (const query of queries) {
    const cleanQuery = query.trim();

    if (!cleanQuery) continue;

    const body = `
      search "${escapeQuery(cleanQuery)}";
      fields id,name;
      limit 10;
    `;

    const res = await safeRequest(() =>
      axios.post("https://api.igdb.com/v4/games", body, { headers: HEADERS }),
    );

    if (res.data.length) {
      console.log("FOUND BY:", cleanQuery);
      return res.data;
    }
  }

  return [];
}

async function getGamesByIds(ids) {
  const body = `
    fields name,cover.image_id,first_release_date;
    where id = (${ids.join(",")});
  `;

  const res = await axios.post("https://api.igdb.com/v4/games", body, { headers: HEADERS });

  return res.data || [];
}

// ================= DOWNLOAD =================
async function download(url, filePath) {
  const img = await safeRequest(() =>
    axios.get(url, {
      responseType: "arraybuffer",
    }),
  );

  fs.writeFileSync(filePath, img.data);
}

// ================= CORE =================
async function processGame(game) {
  // const name = clean(game.name);
  const name = normalize(game.name);

  if (cache[name]) {
    console.log("CACHE:", name);
    return;
  }

  try {
    let results = await searchGame(name);

    if (!results.length) {
      // fallback: ищем без подзаголовка после :
      const altQuery = name.split(":")[0].trim();

      if (altQuery !== name) {
        console.log("FALLBACK SEARCH:", altQuery);

        results = await searchGame(altQuery);
      }
    }

    if (!results.length) {
      // пробуем убрать лишнее после двоеточия
      const fallbackName = name.split(":")[0].trim();

      if (fallbackName !== name) {
        console.log("FALLBACK:", fallbackName);

        results = await searchGame(fallbackName);
      }
    }

    if (!results.length) {
      console.log("NO RESULTS:", name);
      logFail(name + " | NO IGDB");
      return;
    }

    const ids = results.map((r) => r.id);

    const games = await getGamesByIds(ids);

    if (!games.length) {
      console.log("NO RESULTS:", name);
      logFail(name + " | NO IGDB");
      return;
    }

    // оставляем только игры с обложками
    const withCovers = games.filter((game) => game.cover && game.cover.image_id);

    if (!withCovers.length) {
      console.log("NO COVER:", name);
      logFail(name + " | NO COVER");
      return;
    }

    // выбираем лучшую игру среди тех, у кого есть cover
    const best = withCovers.sort((a, b) => scoreGame(name, b) - scoreGame(name, a))[0];

    const imageId = best.cover.image_id;

    const url = `https://images.igdb.com/igdb/image/upload/t_cover_big/${imageId}.jpg`;

    const filePath = path.join(COVER_DIR, `${name}.jpg`);

    if (!fs.existsSync(filePath)) {
      await download(url, filePath);
    }

    cache[name] = imageId;
    saveCache();

    console.log("SAVED:", name);
  } catch (err) {
    console.log("ERROR:", name);
    logFail(name + " | NO IGDB");
  }
}

// ================= RUNNER =================
async function run() {
  const games = JSON.parse(fs.readFileSync(INPUT_FILE, "utf-8"));

  console.log("TOTAL:", games.length);

  const tasks = games.map((game, i) =>
    limit(async () => {
      console.log(`[${i + 1}/${games.length}] ${game.name}`);
      await processGame(game);
      sleep(600 - 1000);
    }),
  );

  await Promise.all(tasks);

  console.log("DONE");
}

run();
