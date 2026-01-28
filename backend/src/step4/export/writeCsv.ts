import fs from "fs";

export function writeCsv(path: string, rows: any[]) {
  if (!rows.length) return;

  const header = Object.keys(rows[0]).join(",");
  const data = rows.map(r => Object.values(r).join(",")).join("\n");

  fs.mkdirSync("data/step4", { recursive: true });
  fs.writeFileSync(path, header + "\n" + data);
}
