import { describe, expect, it } from "vitest";
import { canonicalizeUrl, normalizeLocation, normalizeTitle, postingFingerprint, stableContentHash, stripHtml } from "./normalization";

describe("normalization", () => {
  it("normalizes titles and locations deterministically", () => {
    expect(normalizeTitle("  Robotics Co-op — C++  ")).toBe("robotics internship c++");
    expect(normalizeLocation("Greater Toronto Area, Ontario")).toBe("toronto, on");
  });

  it("removes markup and decodes common entities", () => {
    expect(stripHtml("<p>Build &amp; test<br>robots</p><script>private()</script>")).toBe("Build & test robots");
  });

  it("canonicalizes HTTPS URLs without tracking parameters", () => {
    expect(canonicalizeUrl("https://JOBS.example.invalid/role/1/?utm_source=test&gh_src=abc#apply"))
      .toBe("https://jobs.example.invalid/role/1");
  });

  it("rejects non-HTTPS canonical URLs", () => {
    expect(() => canonicalizeUrl("http://jobs.example.invalid/role/1")).toThrow("HTTPS");
  });

  it("uses stable object ordering for hashes and fingerprints", () => {
    expect(stableContentHash({ b: 2, a: 1 })).toBe(stableContentHash({ a: 1, b: 2 }));
    expect(postingFingerprint("Example Labs", "Robotics Intern", "Toronto, ON"))
      .toBe(postingFingerprint("example labs", "Robotics Internship", "Toronto, Ontario"));
  });
});
