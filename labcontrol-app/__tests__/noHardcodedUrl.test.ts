// Garante que nenhuma URL de servidor fique fixa no código do cliente.
import fs from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "..");
const SOURCE_DIRS = ["app", "lib", "services", "types"];
const FORBIDDEN = [/amazonaws\.com/i, /ec2-\d/i, /https?:\/\/\d{1,3}(\.\d{1,3}){3}/];

function listSourceFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listSourceFiles(full);
    return /\.(ts|tsx|js)$/.test(entry.name) ? [full] : [];
  });
}

it("não há URL de produção fixa no cliente", () => {
  const files = SOURCE_DIRS.flatMap((d) => listSourceFiles(path.join(ROOT, d)));
  expect(files.length).toBeGreaterThan(0);

  const offenders = files.filter((file) => {
    const content = fs.readFileSync(file, "utf8");
    return FORBIDDEN.some((pattern) => pattern.test(content));
  });

  expect(offenders.map((f) => path.relative(ROOT, f))).toEqual([]);
});
