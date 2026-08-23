import { pixelBasedPreset, type TailwindConfig } from "react-email";

export const emailTailwindConfig = {
  presets: [pixelBasedPreset],
  theme: {
    extend: {
      colors: {
        brand: "#0759b8",
        priority: "#b54708",
        ink: "#172033",
        muted: "#526070",
        canvas: "#eef2f6",
        surface: "#ffffff",
        line: "#c8d2df",
      },
    },
  },
} satisfies TailwindConfig;
