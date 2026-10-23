/** A pixelated image preview over the canvas background, shown at the top of a dialog. */
export function Preview({ src, alt, minWidth }: { src: string; alt: string; minWidth: number }) {
  return (
    <div className="preview canvas-bg">
      {/* Small sprites get a minimum size so they're visible; min-width depends on the image. */}
      <img className="preview-img" src={src} alt={alt} style={{ minWidth }} />
    </div>
  );
}
