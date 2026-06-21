import sharp from 'sharp';

const inputPath = 'C:\\Users\\Hugo Rafael\\Desktop\\Logo COlonia.png';
const outputPath = 'd:\\ProjetoQoder\\Circuito Gestor\\circuitogestor-db85e3b6\\public\\images\\colonia\\logo-nota.png';

async function removeBackground() {
  // Read original image
  const origBuf = await sharp(inputPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { data, info } = origBuf;
  const w = info.width;
  const h = info.height;
  const total = w * h;
  const pixels = Buffer.from(data);
  console.log(`Input: ${w}x${h}`);

  // Get background color from corner
  const bgR = pixels[0], bgG = pixels[1], bgB = pixels[2];
  console.log(`BG: rgb(${bgR},${bgG},${bgB})`);

  // Flood fill from all edges
  const tol = 50;
  const tolSq = tol * tol;

  const queue = new Int32Array(total * 2);
  let qh = 0, qt = 0;
  const mark = new Uint8Array(total);

  const enq = (x, y) => { queue[qt++] = x; queue[qt++] = y; };
  for (let x = 0; x < w; x++) { enq(x, 0); enq(x, h - 1); }
  for (let y = 1; y < h - 1; y++) { enq(0, y); enq(w - 1, y); }

  let bgPx = 0;
  while (qh < qt) {
    const x = queue[qh++], y = queue[qh++];
    if (x < 0 || x >= w || y < 0 || y >= h) continue;
    const pi = y * w + x;
    if (mark[pi]) continue;
    mark[pi] = 1;
    const o = pi * 4;
    const dr = pixels[o] - bgR, dg = pixels[o+1] - bgG, db = pixels[o+2] - bgB;
    if ((dr*dr + dg*dg + db*db) < tolSq) {
      bgPx++;
      enq(x+1,y); enq(x-1,y); enq(x,y+1); enq(x,y-1);
    }
  }
  console.log(`BG flood fill: ${bgPx} px (${((bgPx/total)*100).toFixed(1)}%)`);

  // Clear background alpha
  for (let i = 0; i < total; i++) {
    if (mark[i]) {
      pixels[i * 4 + 3] = 0;
    }
  }

  // Write directly without trim to preserve alpha channel
  const outBuf = await sharp(pixels, { raw: { width: w, height: h, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toBuffer();

  // Verify before writing
  const verify = await sharp(outBuf).raw().toBuffer({ resolveWithObject: true });
  let transpCount = 0;
  for (let i = 3; i < verify.data.length; i += 4) {
    if (verify.data[i] === 0) transpCount++;
  }
  console.log(`Verify: ${transpCount} transparent px out of ${verify.info.width * verify.info.height}`);

  const { writeFileSync } = await import('fs');
  writeFileSync(outputPath, outBuf);
  console.log(`Saved to ${outputPath}`);
}

removeBackground().catch(console.error);
