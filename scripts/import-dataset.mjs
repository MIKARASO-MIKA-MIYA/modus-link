import { readFileSync, writeFileSync } from "node:fs";
const text = readFileSync("docs/source/dataset.txt", "utf8");
const pattern =
  /^(A-\d{3}) · (.+?) · (.+)\r?\nАвтор: (.+?)\s+Приоритет: (.+?)\s+Статус: (.+)\r?\nТекст обращения\. (.+)\r?\nУсловный ответственный: (.+?)\s+Пример дальнейшего действия: (.+)$/gm;
const rows = [...text.matchAll(pattern)].map((m) => ({
  number: m[1],
  sourceType: m[2],
  category: m[3],
  authorRole: m[4],
  sourcePriority: m[5],
  sourceStatus: m[6],
  description: m[7],
  assigneeRole: m[8],
  nextAction: m[9],
}));
if (
  rows.length !== 20 ||
  rows.some((r, i) => r.number !== `A-${String(i + 1).padStart(3, "0")}`)
)
  throw new Error("Expected original A-001 through A-020");
writeFileSync("prisma/data/tickets.json", JSON.stringify(rows, null, 2) + "\n");
console.log(`Imported ${rows.length} source records without inventing fields.`);
