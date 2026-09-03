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
        // 본문·UI: Pretendard 우선(화면 선명도). বাংলা 는 Noto Sans Bengali 폴백.
        sans: [
          "Pretendard",
          "Noto Sans KR",
          "Noto Sans Bengali",
          "system-ui",
          "sans-serif",
        ],
        // 제목·브랜드: 한화 전용 폰트 (큰 글자에서 브랜드 유지)
        hanwha: ["Hanwha B", "Hanwha R", "Pretendard", "Noto Sans KR", "sans-serif"],
      },
      borderRadius: {
        card: "14px",
      },
    },
  },
  plugins: [],
};

export default config;
