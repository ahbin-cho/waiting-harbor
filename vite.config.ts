import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

/**
 * 검색/공유용 설정.
 * - 사이트 주소: SITE_URL, 없으면 Vercel 이 주는 운영 주소를 써요.
 * - 검색 등록 인증: GOOGLE_SITE_VERIFICATION, NAVER_SITE_VERIFICATION (Vercel 환경 변수에 넣으면 돼요)
 * - robots.txt, sitemap.xml 을 빌드할 때 만들어요.
 */
function seo(): Plugin {
  const env = process.env;
  const today = new Date().toISOString().slice(0, 10);
  const site = (
    env.SITE_URL ||
    (env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:5173")
  ).replace(/\/$/, "");
  const verify = [
    ["google-site-verification", env.GOOGLE_SITE_VERIFICATION],
    ["naver-site-verification", env.NAVER_SITE_VERIFICATION],
  ]
    .filter(([, v]) => v)
    .map(([n, v]) => `<meta name="${n}" content="${v}" />`)
    .join("\n    ");

  return {
    name: "harbor-seo",
    transformIndexHtml: {
      order: "pre", // Vite 가 주소를 해석하기 전에 바꿔야 해요
      handler: (html) => html.replaceAll("%SITE_URL%", site).replace("<!-- verify -->", verify),
    },
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "robots.txt",
        // 공유 링크(/l/…)와 카드 이미지(/api/og)는 미리보기 수집기가 읽어야 해서 막지 않아요. 대신 그 페이지에 noindex 를 걸어요.
        source: `User-agent: *\nAllow: /\n\nSitemap: ${site}/sitemap.xml\n`,
      });
      this.emitFile({
        type: "asset",
        fileName: "sitemap.xml",
        source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${site}/</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq><priority>1.0</priority></url>\n  <url><loc>${site}/discharge/</loc><lastmod>${today}</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>\n  <url><loc>${site}/rainbow/</loc><lastmod>${today}</lastmod><changefreq>monthly</changefreq><priority>0.9</priority></url>\n</urlset>\n`,
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), seo()],
  build: {
    rollupOptions: {
      // 3D 마을(index.html)과 글로 된 페이지들을 따로 만들어요
      input: { main: "index.html", discharge: "discharge/index.html", rainbow: "rainbow/index.html" },
    },
  },
});
