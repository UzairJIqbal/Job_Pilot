// eslint-disable-next-line @typescript-eslint/no-require-imports
// Import the library file directly: pdf-parse's index.js runs a debug self-test
// that reads ./test/data/05-versions-space.pdf when bundled, breaking builds.
const pdf = require("pdf-parse/lib/pdf-parse.js");

export async function parseBuffer(buffer: Buffer): Promise<string> {
  const data = await pdf(buffer);
  return data.text ?? "";
}
