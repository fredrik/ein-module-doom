import { pngDataUrl } from '@games/png';

/**
 * Doom's title screen, its `TITLEPIC`, coloured with `palette`, its `PLAYPAL`'s first, as a PNG
 * `data:` URL; undefined when it is not a picture. `TITLEPIC` is in Doom's patch format: its width
 * and height, then for each column the offset of its posts, each post a starting row, a length and
 * that many palette indexes between two padding bytes, the column ending at row 255.
 */
export async function titlePng(picture: Uint8Array, palette: Uint8Array): Promise<string | undefined> {
  if (picture.length < 8 || palette.length < 768) return undefined;
  const view = new DataView(picture.buffer, picture.byteOffset, picture.byteLength);
  const width = view.getUint16(0, true);
  const height = view.getUint16(2, true);
  if (width === 0 || height === 0 || width > 1024 || height > 1024 || picture.length < 8 + width * 4) return undefined;
  const rgba = new Uint8Array(width * height * 4);
  for (let x = 0; x < width; x++) {
    let at = view.getUint32(8 + x * 4, true);
    while (at < picture.length && picture[at] !== 0xff) {
      const top = picture[at];
      const length = picture[at + 1];
      for (let i = 0; i < length; i++) {
        const y = top + i;
        if (y >= height) break;
        const colour = picture[at + 3 + i] * 3;
        const pixel = (y * width + x) * 4;
        rgba[pixel] = palette[colour];
        rgba[pixel + 1] = palette[colour + 1];
        rgba[pixel + 2] = palette[colour + 2];
        rgba[pixel + 3] = 255;
      }
      at += length + 4;
    }
  }
  return await pngDataUrl(width, height, rgba);
}

/**
 * Heretic's and Hexen's title screen, their `TITLE`, coloured with `palette`, as a PNG `data:` URL;
 * undefined when it is not one. It is a raw 320 by 200 picture, a palette index for each pixel, row
 * by row.
 */
export async function rawTitlePng(picture: Uint8Array, palette: Uint8Array): Promise<string | undefined> {
  const width = 320;
  const height = 200;
  if (picture.length < width * height || palette.length < 768) return undefined;
  const rgba = new Uint8Array(width * height * 4);
  for (let pixel = 0; pixel < width * height; pixel++) {
    const colour = picture[pixel] * 3;
    rgba[pixel * 4] = palette[colour];
    rgba[pixel * 4 + 1] = palette[colour + 1];
    rgba[pixel * 4 + 2] = palette[colour + 2];
    rgba[pixel * 4 + 3] = 255;
  }
  return await pngDataUrl(width, height, rgba);
}
