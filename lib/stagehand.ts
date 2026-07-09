import { Stagehand } from "@browserbasehq/stagehand";

type StagehandInstance = InstanceType<typeof Stagehand>;

export async function createStagehand(): Promise<StagehandInstance> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set in environment variables");
  }

  const stagehand = new Stagehand({
    env: "LOCAL",
    localBrowserLaunchOptions: {
      headless: true,
    },
    model: {
      modelName: "gemini-2.5-flash",
      apiKey,
    },
  });

  await stagehand.init();
  return stagehand;
}
