// Portable image payloads survive Markdown, LKL and offline workspace exports.
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export function safeMediaUrl(value, {image = false} = {}) {
  const url = String(value ?? '').trim();
  if (image && /^data:image\/(png|jpeg|webp|gif);base64,[a-z0-9+/=\s]+$/i.test(url)) return url.length <= MAX_IMAGE_BYTES * 1.4 ? url : null;
  if (/^https?:\/\//i.test(url)) return url;
  if (!image && /^(mailto:|#)/i.test(url)) return url;
  return null;
}
export async function imageFileMarkdown(file) {
  if (!/^image\/(png|jpeg|webp|gif)$/i.test(file?.type ?? '')) throw new Error('请选择 PNG、JPEG、WebP 或 GIF 图片。');
  if (file.size > MAX_IMAGE_BYTES) throw new Error('每张图片最大 5 MB，请缩小后再插入。');
  const data = await new Promise((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('图片读取失败')); reader.readAsDataURL(file);
  });
  if (!safeMediaUrl(data, {image:true})) throw new Error('图片格式无效');
  return '![' + String(file.name || '粘贴的图片').replace(/[\[\]\n\r]/g, '') + '](' + data + ')';
}
