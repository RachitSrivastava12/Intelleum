import fs from "fs";

export function writeCsv(path: string, rows: any[]) {
  if (!rows.length) return;

  const headers = Object.keys(rows[0]).join(",");
  const body = rows.map(r =>
    Object.values(r).map(v => `"${v}"`).join(",")
  ).join("\n");

  fs.writeFileSync(path, headers + "\n" + body);
}
