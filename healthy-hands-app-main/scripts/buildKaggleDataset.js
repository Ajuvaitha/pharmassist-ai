/**
 * scripts/buildKaggleDataset.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Compiles public/Medicine_Names.csv (187,528 Kaggle drug records) into a
 * compact, indexed dataset file for sub-millisecond voice search in the browser.
 */

import fs from "fs";
import path from "path";
import readline from "readline";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function buildDataset() {
  console.log("⚡ Processing public/Medicine_Names.csv...");
  const csvPath = path.join(__dirname, "../public/Medicine_Names.csv");
  const outputPath = path.join(__dirname, "../src/data/kaggleMedicines.json");

  if (!fs.existsSync(csvPath)) {
    console.error("❌ CSV file not found at:", csvPath);
    return;
  }

  const fileStream = fs.createReadStream(csvPath, { encoding: "utf-8" });
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  const dataset = [];
  let count = 0;

  for await (const line of rl) {
    count++;
    if (count === 1 && line.trim() === "str") continue; // header
    const str = line.trim();
    if (!str) continue;

    // Extract brand inside brackets if present: [BrandName]
    const brandMatch = str.match(/\[(.*?)\]/);
    const brand = brandMatch ? brandMatch[1].trim() : "";
    const cleanName = str.replace(/\[.*?\]/g, "").trim();

    // Extract key words for searching
    const words = str
      .toLowerCase()
      .split(/[\/\s,()\[\]\.\-\:]+/)
      .filter(
        (w) =>
          w.length >= 3 &&
          !/^\d+$/.test(w) &&
          !/^(mg|ml|mcg|iu|g|tab|tablet|tablets|cap|capsule|capsules|solution|injectable|oral|topical|extended|release|product|suspension|ointment|gel|patch|cream|drops|spray|mg\/ml|mg\/g)$/i.test(
            w
          )
      );

    dataset.push({
      i: dataset.length + 1,
      n: str,
      b: brand,
      g: cleanName,
      k: Array.from(new Set(words)).slice(0, 5), // top 5 key search tokens
    });
  }

  console.log(`✅ Processed ${dataset.length} medicines from Kaggle dataset.`);

  fs.writeFileSync(outputPath, JSON.stringify(dataset));
  const stats = fs.statSync(outputPath);
  console.log(
    `📦 Saved dataset to src/data/kaggleMedicines.json (${(stats.size / (1024 * 1024)).toFixed(2)} MB)`
  );
}

buildDataset().catch(console.error);
