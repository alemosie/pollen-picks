/** beehiiv serves images through Cloudflare image resizing, usually with no width set (full size). Ask for a smaller one. */
export const sized = (url: string, width: number) =>
  url.replace(/(\/cdn-cgi\/image\/)([^/]*)(\/)/, (m, a: string, opts: string, c: string) => (/(^|,)width=/.test(opts) ? m : `${a}width=${width},${opts}${c}`));
