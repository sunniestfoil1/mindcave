import fs from 'fs';
import puppeteer from 'puppeteer';

async function generateGrassIcons() {
  const topB64 = fs.readFileSync('temp_grass_top.png').toString('base64');
  const sideB64 = fs.readFileSync('temp_grass_side.png').toString('base64');

  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  await page.setContent(`<!DOCTYPE html>
<html>
<body>
<canvas id="cv"></canvas>
</body>
</html>`);

  const results = await page.evaluate(async (topB64, sideB64) => {
    const topImg = new Image();
    topImg.src = 'data:image/png;base64,' + topB64;
    const sideImg = new Image();
    sideImg.src = 'data:image/png;base64,' + sideB64;

    await Promise.all([
      new Promise(r => topImg.onload = r),
      new Promise(r => sideImg.onload = r)
    ]);

    // Create offscreen canvas for tinted grass top
    const offTop = document.createElement('canvas');
    offTop.width = 16; offTop.height = 16;
    const offCtx = offTop.getContext('2d');
    offCtx.drawImage(topImg, 0, 0);
    const imgData = offCtx.getImageData(0, 0, 16, 16);
    // Biome tint #79C05A (R: 121, G: 192, B: 90)
    for (let i = 0; i < imgData.data.length; i += 4) {
      imgData.data[i] = Math.round((imgData.data[i] * 121) / 255);
      imgData.data[i+1] = Math.round((imgData.data[i+1] * 192) / 255);
      imgData.data[i+2] = Math.round((imgData.data[i+2] * 90) / 255);
    }
    offCtx.putImageData(imgData, 0, 0);

    function renderIso(size) {
      const cv = document.createElement('canvas');
      cv.width = size; cv.height = size;
      const ctx = cv.getContext('2d');
      ctx.imageSmoothingEnabled = false;

      const scale = size / 32;

      const K = 0.4375;
      function sub(img, sx, sy, sw, sh, shade) {
        ctx.drawImage(img, sx, sy, sw, sh, sx, sy, sw, sh);
        if (shade) { ctx.fillStyle = shade; ctx.fillRect(sx, sy, sw, sh); }
      }

      const boxes = [[0, 0, 0, 1, 1, 1]];
      for (const [x0, y0, z0, x1, y1, z1] of boxes) {
        const ux0 = x0 * 16, ux1 = x1 * 16, vz0 = z0 * 16, vz1 = z1 * 16, h0 = y0 * 16, h1 = y1 * 16;
        // Top face
        ctx.save();
        ctx.setTransform(scale * 0.75, scale * K, scale * -0.75, scale * K, scale * 16, scale * (2 + (16 - h1) * 0.875));
        sub(offTop, ux0, vz0, ux1 - ux0, vz1 - vz0);
        ctx.restore();

        // Left face (z = z1)
        ctx.save();
        ctx.setTransform(scale * 0.75, scale * K, 0, scale * 0.875, scale * (4 + 0.75 * (16 - vz1)), scale * (9 - K * (16 - vz1)));
        sub(sideImg, ux0, 16 - h1, ux1 - ux0, h1 - h0, 'rgba(0,0,0,0.15)');
        ctx.restore();

        // Right face (x = x1)
        ctx.save();
        ctx.setTransform(scale * 0.75, scale * -K, 0, scale * 0.875, scale * (16 - 0.75 * (16 - ux1)), scale * (16 - K * (16 - ux1)));
        sub(sideImg, 16 - vz1, 16 - h1, vz1 - vz0, h1 - h0, 'rgba(0,0,0,0.35)');
        ctx.restore();
      }
      return cv.toDataURL('image/png');
    }

    return {
      s16: renderIso(16),
      s32: renderIso(32),
      s48: renderIso(48),
      s64: renderIso(64),
      s128: renderIso(128),
      s192: renderIso(192),
      s512: renderIso(512),
    };
  }, topB64, sideB64);

  await browser.close();

  // Helper to save PNG
  function toBuf(dataUrl) {
    return Buffer.from(dataUrl.split(',')[1], 'base64');
  }

  const p16 = toBuf(results.s16);
  const p32 = toBuf(results.s32);
  const p48 = toBuf(results.s48);
  const p64 = toBuf(results.s64);
  const p128 = toBuf(results.s128);
  const p192 = toBuf(results.s192);
  const p512 = toBuf(results.s512);

  // Write favicon.png (using 32x32 crisp or 64x64)
  fs.writeFileSync('public/favicon.png', p32);
  fs.writeFileSync('public/favicon-16x16.png', p16);
  fs.writeFileSync('public/favicon-32x32.png', p32);
  fs.writeFileSync('public/apple-touch-icon.png', p192);
  fs.writeFileSync('public/android-chrome-192x192.png', p192);
  fs.writeFileSync('public/android-chrome-512x512.png', p512);

  // Create real multi-size Windows .ICO file (16x16, 32x32, 48x48)
  const images = [
    { size: 16, buf: p16 },
    { size: 32, buf: p32 },
    { size: 48, buf: p48 }
  ];

  // ICO header: 6 bytes
  // reserved (2) = 0, type (2) = 1 (icon), count (2) = images.length
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  // Directory entries: 16 bytes each
  const dirSize = images.length * 16;
  let offset = 6 + dirSize;
  const dirBuffers = [];

  for (const img of images) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(img.size === 256 ? 0 : img.size, 0); // width
    entry.writeUInt8(img.size === 256 ? 0 : img.size, 1); // height
    entry.writeUInt8(0, 2); // color palette
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(img.buf.length, 8); // size of image data
    entry.writeUInt32LE(offset, 12); // offset of image data
    dirBuffers.push(entry);
    offset += img.buf.length;
  }

  const icoBuffer = Buffer.concat([header, ...dirBuffers, ...images.map(i => i.buf)]);
  fs.writeFileSync('public/favicon.ico', icoBuffer);

  console.log('Successfully generated all icons and favicon.ico with authentic Minecraft 1.8.9 grass block!');
}

generateGrassIcons();
