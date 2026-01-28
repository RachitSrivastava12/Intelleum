import fs from "fs";

export function loadCsv<T = any>(path: string): T[] {
  const [header, ...rows] = fs.readFileSync(path, "utf8").trim().split("\n");
  const keys = header.split(",");

  return rows.map(row => {
    const values = row.split(",");
    return Object.fromEntries(keys.map((k, i) => [k, values[i]])) as T;
  });
}
