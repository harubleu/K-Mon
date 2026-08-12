// 対象のファイルパス: scripts/extract_cards.mjs

import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';

// 保存先ディレクトリ（プロジェクトルートからの相対パス）
const SAVE_DIR = './public/images/monsters';

async function downloadImage(url, filename) {
  // Wixの画像URLからリサイズ等のパラメータを除去し、元画像を抽出
  const match = url.match(/(https:\/\/static\.wixstatic\.com\/media\/[^/]+~mv2\.(png|jpg))/);
  const targetUrl = match ? match[1] : url;

  try {
    const response = await fetch(targetUrl);
    if (response.ok) {
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      fs.writeFileSync(path.join(SAVE_DIR, filename), buffer);
      console.log(`Saved: ${filename}`);
    } else {
      console.log(`Failed to download: ${targetUrl} (Status: ${response.status})`);
    }
  } catch (error) {
    console.error(`Error downloading ${targetUrl}:`, error);
  }
}

async function main() {
  // 保存先ディレクトリが存在しない場合は作成
  if (!fs.existsSync(SAVE_DIR)) {
    fs.mkdirSync(SAVE_DIR, { recursive: true });
  }

  const targetUrls = [
    "https://www.kanjimonsters.com/allcardlist/speciallist"
  ];

  // headless: false に設定し、ブラウザの挙動を目視確認できるようにする
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

for (let i = 0; i < targetUrls.length; i++) {
    console.log(`Accessing: ${targetUrls[i]}`);
    await page.goto(targetUrls[i]);
    
    // 【修正】 networkidle から domcontentloaded に変更し、Wixのバックグラウンド通信によるタイムアウトを回避
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(3000); // 基本描画のための待機
    
    // --- ページ最下部までスクロール ---
    console.log("Scrolling page to load all images...");
    await page.evaluate(async () => {
      const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
      const scrollHeight = document.body.scrollHeight;
      for (let y = 0; y < scrollHeight; y += 400) {
        window.scrollTo(0, y);
        await delay(150); 
      }
    });
    await page.waitForTimeout(3000);

    // Wixの画像タグを取得
    const images = await page.locator('img[src*="wixstatic.com/media/"]').all();
    
    for (let j = 0; j < images.length; j++) {
      const imgUrl = await images[j].getAttribute('src');
      // ヘッダーなどの不要な画像を弾く
      if (imgUrl && imgUrl.includes('~mv2.png')) {
        const filename = `monster_${i}_${j}.png`;
        await downloadImage(imgUrl, filename);
      }
    }
  }

  await browser.close();
  console.log("Extraction complete!");
}

main();