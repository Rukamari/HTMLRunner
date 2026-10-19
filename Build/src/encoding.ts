export function byteToCharOffset(text: string, byteOffset: number): number {
  if (byteOffset <= 0) return 0;
  let byteIdx = 0;
  let charIdx = 0;
  while (charIdx < text.length && byteIdx < byteOffset) {
    const code = text.codePointAt(charIdx) ?? 0xfffd;
    const codeUnits = code > 0xffff ? 2 : 1;
    const byteLen =
      code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
    byteIdx += byteLen;
    charIdx += codeUnits;
  }
  return Math.min(charIdx, text.length);
}
