import { createServer } from "node:net";
import { chromium, type Browser, type Page } from "playwright";

// Playwright drives the form. Stagehand attaches to the same Chrome over CDP
// only when a field can't be found by id or label, so most runs make no AI call.

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const port = (srv.address() as { port: number }).port;
      srv.close(() => resolve(port));
    });
  });
}

export type Session = {
  browser: Browser;
  page: Page;
  /** Ask Stagehand to do one thing on the current page. False when unavailable or it failed. */
  act: (instruction: string) => Promise<boolean>;
  close: () => Promise<void>;
};

export async function openSession(opts: { headless: boolean; aiFallback: boolean; log: (m: string) => void }): Promise<Session> {
  const port = await freePort();
  const browser = await chromium.launch({
    headless: opts.headless,
    args: [`--remote-debugging-port=${port}`, "--remote-debugging-address=127.0.0.1"],
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1600 },
    locale: "en-US",
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  // Typed loosely so the worker runs without Stagehand installed when AI fallback is off.
  let stagehand: { act: (i: string, o: { page: Page; timeout?: number }) => Promise<{ success: boolean }>; close: () => Promise<void> } | null = null;
  let stagehandFailed = false;

  async function act(instruction: string): Promise<boolean> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!opts.aiFallback || !apiKey || stagehandFailed) return false;
    try {
      if (!stagehand) {
        const version = (await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()) as {
          webSocketDebuggerUrl: string;
        };
        const { Stagehand } = await import("@browserbasehq/stagehand");
        const sh = new Stagehand({
          env: "LOCAL",
          localBrowserLaunchOptions: { cdpUrl: version.webSocketDebuggerUrl },
          model: { modelName: "gemini-2.5-flash", apiKey },
          verbose: 0,
          disablePino: true,
        });
        await sh.init();
        stagehand = sh as unknown as typeof stagehand;
      }
      const result = await stagehand!.act(instruction, { page, timeout: 30_000 });
      return result.success;
    } catch (error) {
      opts.log(`AI fallback unavailable: ${(error as Error).message.slice(0, 160)}`);
      stagehandFailed = true;
      return false;
    }
  }

  async function close() {
    if (stagehand) await stagehand.close().catch(() => {});
    await browser.close().catch(() => {});
  }

  return { browser, page, act, close };
}
