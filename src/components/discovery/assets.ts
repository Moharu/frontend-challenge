// Figma originals in public/assets/figma; scripts/optimize-artwork.mjs derives
// the WebP widths served at runtime into public/assets/art.
export const artSources: Record<string, string> = {
  emerald: "detail-NftCollectionArtwork04.png",
  sage: "detail-NftCollectionArtwork06.png",
  ivory: "detail-NftCollectionArtwork08.png",
  golden: "detail-NftCollectionArtwork09.png",
};
export const artWidths = [240, 480, 800, 1254];
const artPath = (art: string, width: number) =>
  `/assets/art/${art}-${width}.webp`;
export function artImage(art: string, sizes: string) {
  return {
    src: artPath(art, 800),
    srcSet: artWidths.map((w) => `${artPath(art, w)} ${w}w`).join(", "),
    sizes,
  };
}
export const asset = (name: string) => `/assets/figma/${name}`;
