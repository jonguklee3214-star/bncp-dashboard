import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Hanwha CI — Hanwha Orange (색상 규정)
        hanwha: {
          DEFAULT: "#F37321", // Hanwha Orange 100%  RGB 243/115/33
          70: "#F89B6C", // 70%  RGB 248/155/108
          50: "#FBB584", // 50%  RGB 251/181/132
        },
        ink: "#111111", // Process Black
        // 절제된 중립 팔레트 (색상 항목 73)
        neutral: {
          border: "#E5E7EB",
          soft: "#F7F8FA",
        },
        success: "#16A34A",
        warning: "#D97706",
        danger: "#DC2626",
      },
      fontFamily: {
        // Hanwha 전용 폰트 + 언어별 폴백 (한글/영문: Hanwha, বাংলা: Noto Sans Bengali)
        sans: [
          "Hanwha R",
          "Pretendard",
          "Noto Sans KR",
          "Noto Sans Bengali",
          "system-ui",
          "sans-serif",
        ],
        bold: ["Hanwha B", "Pretendard", "Noto Sans KR", "sans-serif"],
        light: ["Hanwha L", "Pretendard", "Noto Sans KR", "sans-serif"],
      },
      borderRadius: {
        card: "14px",
      },
    },
  },
  plugins: [],
};

export default config;
