// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdf = require("pdf-parse");

export async function parseBuffer(buffer: Buffer): Promise<string> {
  const data = await pdf(buffer);
  return data.text ?? "";
}
