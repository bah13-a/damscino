import fs from 'node:fs';
import QRCode from 'qrcode';

/**
 * Writes a Y4M video showing the QR code of {@code text}, used as fake camera by Chromium
 * (--use-file-for-fake-video-capture), so that the scanner decodes it exactly as with a real phone camera.
 */
export function writeQrVideo(text: string, file: string, width = 640, height = 480, frames = 10) {
  const qr = QRCode.create(text, { errorCorrectionLevel: 'M' });
  const size = qr.modules.size;
  const scale = Math.floor((Math.min(width, height) * 0.8) / (size + 8));
  const origin = { x: Math.floor((width - size * scale) / 2), y: Math.floor((height - size * scale) / 2) };

  const luma = Buffer.alloc(width * height, 235);
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (!qr.modules.get(row, col)) continue;
      for (let dy = 0; dy < scale; dy++) {
        const offset = (origin.y + row * scale + dy) * width + origin.x + col * scale;
        luma.fill(16, offset, offset + scale);
      }
    }
  }
  const chroma = Buffer.alloc((width / 2) * (height / 2), 128);
  const frame = Buffer.concat([Buffer.from('FRAME\n'), luma, chroma, chroma]);
  const header = Buffer.from(`YUV4MPEG2 W${width} H${height} F10:1 Ip A1:1 C420jpeg\n`);
  fs.writeFileSync(file, Buffer.concat([header, ...Array.from({ length: frames }, () => frame)]));
}
