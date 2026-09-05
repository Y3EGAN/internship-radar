import { describe, expect, it, vi } from "vitest";
import { createChromiumFetch } from "./browser-fetch";

describe("bounded Chromium transport", () => {
  it("renders HTML, blocks heavy resources, and closes its browser", async () => {
    let routeHandler: ((route: {
      request(): { resourceType(): string };
      abort(): Promise<void>;
      continue(): Promise<void>;
    }) => Promise<void>) | undefined;
    const page = {
      route: vi.fn(async (_pattern: string, handler: typeof routeHandler) => { routeHandler = handler; }),
      goto: vi.fn().mockResolvedValue(undefined),
      content: vi.fn().mockResolvedValue("<html><main>Rendered jobs</main></html>"),
      close: vi.fn().mockResolvedValue(undefined),
    };
    const context = {
      newPage: vi.fn().mockResolvedValue(page),
      close: vi.fn().mockResolvedValue(undefined),
    };
    const browser = {
      newContext: vi.fn().mockResolvedValue(context),
      close: vi.fn().mockResolvedValue(undefined),
    };
    const chromium = { launch: vi.fn().mockResolvedValue(browser) };

    const client = await createChromiumFetch({ chromium: chromium as never });
    const response = await client.fetch("https://careers.example.invalid/jobs");

    expect(chromium.launch).toHaveBeenCalledWith({ channel: "chrome", headless: true });
    expect(page.goto).toHaveBeenCalledWith("https://careers.example.invalid/jobs", {
      waitUntil: "domcontentloaded",
      timeout: 8_000,
    });
    expect(await response.text()).toContain("Rendered jobs");
    expect(page.close).toHaveBeenCalledOnce();

    const abort = vi.fn().mockResolvedValue(undefined);
    const continueRequest = vi.fn().mockResolvedValue(undefined);
    await routeHandler?.({
      request: () => ({ resourceType: () => "image" }),
      abort,
      continue: continueRequest,
    });
    expect(abort).toHaveBeenCalledOnce();
    expect(continueRequest).not.toHaveBeenCalled();

    await client.close();
    expect(context.close).toHaveBeenCalledOnce();
    expect(browser.close).toHaveBeenCalledOnce();
  });
});
