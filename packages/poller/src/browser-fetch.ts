import { chromium as defaultChromium } from "playwright-core";
import type { FetchLike } from "./types";

const NAVIGATION_TIMEOUT_MS = 8_000;
const BLOCKED_RESOURCE_TYPES = new Set(["image", "media", "font"]);

export type ChromiumLauncher = Pick<typeof defaultChromium, "launch">;

export interface ChromiumFetchClient {
  readonly fetch: FetchLike;
  close(): Promise<void>;
}

function requestUrl(input: string | URL | Request): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

export async function createChromiumFetch(
  options: { readonly chromium?: ChromiumLauncher } = {},
): Promise<ChromiumFetchClient> {
  const chromium = options.chromium ?? defaultChromium;
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext();

  return {
    fetch: async (input, init) => {
      const method = init?.method?.toUpperCase() ?? "GET";
      if (method !== "GET") throw new Error("rendered source transport only supports GET requests");
      if (init?.signal?.aborted) throw new DOMException("aborted", "AbortError");

      const page = await context.newPage();
      try {
        await page.route("**/*", async (route) => {
          if (BLOCKED_RESOURCE_TYPES.has(route.request().resourceType())) {
            await route.abort();
            return;
          }
          await route.continue();
        });
        const navigation = await page.goto(requestUrl(input), {
          waitUntil: "domcontentloaded",
          timeout: NAVIGATION_TIMEOUT_MS,
        });
        const html = await page.content();
        return new Response(html, {
          status: navigation?.status() ?? 200,
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      } finally {
        await page.close();
      }
    },
    close: async () => {
      try {
        await context.close();
      } finally {
        await browser.close();
      }
    },
  };
}
