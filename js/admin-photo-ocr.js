const TESSERACT_SCRIPT_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/tesseract.min.js';

let scriptPromise = null;

function loadTesseract() {
  if (globalThis.Tesseract?.createWorker) return Promise.resolve(globalThis.Tesseract);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = TESSERACT_SCRIPT_URL;
    script.async = true;
    script.onload = () => globalThis.Tesseract?.createWorker
      ? resolve(globalThis.Tesseract)
      : reject(new Error('OCRライブラリを読み込めませんでした。'));
    script.onerror = () => reject(new Error('OCRライブラリを読み込めませんでした。通信状態を確認してください。'));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

async function loadBitmap(file) {
  if ('createImageBitmap' in globalThis) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch (_) {
      return createImageBitmap(file);
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function otsuThreshold(data) {
  const histogram = new Uint32Array(256);
  let sum = 0;
  const pixels = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    const value = Math.round(data[i] * .299 + data[i + 1] * .587 + data[i + 2] * .114);
    histogram[value]++;
    sum += value;
  }

  let backgroundWeight = 0;
  let backgroundSum = 0;
  let bestVariance = -1;
  let threshold = 128;
  for (let value = 0; value < 256; value++) {
    backgroundWeight += histogram[value];
    if (!backgroundWeight) continue;
    const foregroundWeight = pixels - backgroundWeight;
    if (!foregroundWeight) break;
    backgroundSum += value * histogram[value];
    const backgroundMean = backgroundSum / backgroundWeight;
    const foregroundMean = (sum - backgroundSum) / foregroundWeight;
    const variance = backgroundWeight * foregroundWeight * (backgroundMean - foregroundMean) ** 2;
    if (variance > bestVariance) {
      bestVariance = variance;
      threshold = value;
    }
  }
  return threshold;
}

function cropAndPrepare(source, region) {
  const sourceWidth = source.width || source.naturalWidth;
  const sourceHeight = source.height || source.naturalHeight;
  const sx = Math.round(sourceWidth * region.x);
  const sy = Math.round(sourceHeight * region.y);
  const sw = Math.max(1, Math.round(sourceWidth * region.width));
  const sh = Math.max(1, Math.round(sourceHeight * region.height));
  const scale = Math.min(4, Math.max(2, 1200 / sw));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(sw * scale);
  canvas.height = Math.round(sh * scale);
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(source, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  const threshold = otsuThreshold(image.data);
  let darkPixels = 0;
  for (let i = 0; i < image.data.length; i += 4) {
    const value = Math.round(image.data[i] * .299 + image.data[i + 1] * .587 + image.data[i + 2] * .114);
    if (value <= threshold) darkPixels++;
  }
  const invert = darkPixels > image.data.length / 8;
  for (let i = 0; i < image.data.length; i += 4) {
    const value = Math.round(image.data[i] * .299 + image.data[i + 1] * .587 + image.data[i + 2] * .114);
    const black = invert ? value > threshold : value <= threshold;
    const output = black ? 0 : 255;
    image.data[i] = output;
    image.data[i + 1] = output;
    image.data[i + 2] = output;
    image.data[i + 3] = 255;
  }
  context.putImageData(image, 0, 0);
  return canvas;
}

function cleanLine(value) {
  return String(value || '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/[|_[\]{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseDecimal(value, max) {
  const normalized = String(value || '')
    .replace(/,/g, '.')
    .replace(/[Oo]/g, '0')
    .replace(/[Il]/g, '1');
  const matches = normalized.match(/\d{1,3}(?:\.\d{1,3})?/g) || [];
  const numbers = matches
    .map(text => Number(text))
    .filter(number => Number.isFinite(number) && number >= 0 && number <= max);
  return numbers.length ? numbers[0].toFixed(2) : '';
}

function parsePart(value) {
  const text = String(value || '').toUpperCase();
  const difficulty = /MASTER|MAS(?:TER)?/.test(text) ? 'MAS'
    : /EXTREME|EXT/.test(text) ? 'EXT'
      : /ADVANCED|ADV/.test(text) ? 'ADV'
        : /BASIC|BSC/.test(text) ? 'BSC' : '';
  const instrument = /DRUM|DRUMS/.test(text) ? 'D'
    : /BASS/.test(text) ? 'B'
      : /GUITAR/.test(text) ? 'G' : '';
  return difficulty && instrument ? `${difficulty}-${instrument}` : '';
}

function parseOption(value) {
  // ピリオド・空白・OCRの区切り方に依存しない形へ揃えてから判定する。
  // 「+」付きが通常RANDOMへ先に一致しないよう、必ず長い表記から確認する。
  const text = String(value || '').toUpperCase().replace(/[^A-Z+]/g, '');
  if (/(?:S|SUPER)RANDOM\+|SRAN\+/.test(text)) return 'SRA+';
  if (/(?:RANDOM|RANDAM|RAN)\+/.test(text)) return 'RAN+';
  if (/(?:S|SUPER)RANDOM|SRAN/.test(text)) return 'SRA';
  if (/(?:RANDOM|RANDAM|RAN)/.test(text)) return 'RAN';
  if (/MIRRORTYPEA|MIRRORTYPA|MIRRORA/.test(text)) return 'BASS_MIRROR';
  if (!text || text === 'OFF' || text === 'MIRROROFF') return 'NORMAL';
  return 'NORMAL';
}

const REGIONS = Object.freeze({
  title: { x: .03, y: .79, width: .46, height: .12 },
  achievement: { x: .70, y: .14, width: .28, height: .19 },
  chart: { x: .25, y: .90, width: .27, height: .10 },
  // 撮影範囲によってオプション表示の高さが大きく変わるため、右下を広く読む。
  option: { x: .45, y: .58, width: .38, height: .42 }
});

async function recognizeLine(worker, canvas, whitelist = '', pageSegMode = '7') {
  const parameters = { tessedit_pageseg_mode: pageSegMode };
  if (whitelist) parameters.tessedit_char_whitelist = whitelist;
  await worker.setParameters(parameters);
  const result = await worker.recognize(canvas);
  return cleanLine(result?.data?.text);
}

export async function readResultPhotos(files, onProgress = () => {}) {
  const list = Array.from(files || []);
  if (!list.length) return [];

  const Tesseract = await loadTesseract();
  let activeFileIndex = 0;
  const worker = await Tesseract.createWorker(['jpn', 'eng'], Tesseract.OEM.LSTM_ONLY, {
    logger(message) {
      onProgress({
        fileIndex: activeFileIndex,
        fileCount: list.length,
        status: message.status,
        progress: Number(message.progress || 0)
      });
    }
  });

  const results = [];
  try {
    for (let index = 0; index < list.length; index++) {
      activeFileIndex = index;
      const file = list[index];
      onProgress({ fileIndex: index, fileCount: list.length, status: '画像を準備中', progress: 0 });
      const bitmap = await loadBitmap(file);
      try {
        const titleText = await recognizeLine(worker, cropAndPrepare(bitmap, REGIONS.title));
        const achievementText = await recognizeLine(
          worker,
          cropAndPrepare(bitmap, REGIONS.achievement),
          '0123456789.,%'
        );
        const chartText = await recognizeLine(
          worker,
          cropAndPrepare(bitmap, REGIONS.chart),
          '0123456789.GUITARBASDRUMCEXVNMT'
        );
        const optionText = await recognizeLine(
          worker,
          cropAndPrepare(bitmap, REGIONS.option),
          'ABCDEFGHIJKLMNOPQRSTUVWXYZ.+ ',
          '11'
        );

        const title = cleanLine(titleText)
          .replace(/^[-:・\s]+|[-:・\s]+$/g, '')
          .replace(/\s+/g, ' ');
        const level = parseDecimal(chartText, 9.99);
        const rate = parseDecimal(achievementText, 100);
        const part = parsePart(chartText);
        const option = parseOption(optionText);
        const missing = [];
        if (!title) missing.push('曲名');
        if (!part) missing.push('パート・難易度');
        if (!rate) missing.push('達成率');

        results.push({
          fileName: file.name,
          title,
          part,
          level,
          rate,
          option,
          missing,
          raw: { title: titleText, achievement: achievementText, chart: chartText, option: optionText }
        });
      } finally {
        bitmap.close?.();
      }
    }
  } finally {
    await worker.terminate();
  }

  return results;
}
