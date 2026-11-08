// 사진을 올리기 전에 줄여요: 긴 쪽 1024px, JPEG, 한 장에 약 150KB 이하가 될 때까지 화질을 조금씩 낮춰요.
// 다시 그리면서 위치 정보(EXIF)도 사라져요. 폰 화면에서 보기엔 충분한 크기예요.
const MAX_SIDE = 1024;
const TARGET = 150 * 1024;

export async function shrinkPhoto(file: File, max = MAX_SIDE): Promise<Blob> {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * k);
  c.height = Math.round(bmp.height * k);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close?.();
  const encode = (q: number) =>
    new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("encode"))), "image/jpeg", q));
  let blob = await encode(0.78);
  for (const q of [0.68, 0.58, 0.5]) {
    if (blob.size <= TARGET) break;
    blob = await encode(q);
  }
  return blob;
}
