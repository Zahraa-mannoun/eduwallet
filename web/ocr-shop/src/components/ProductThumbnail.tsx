import { useState } from 'react';

// Shows the real product image once a file exists at that path; falls back to the neutral
// 📦 placeholder (via the img's onError, not a pre-check) for any filename not dropped into
// public/images/ yet. className carries the caller's sizing/layout so both states line up.
export function ProductThumbnail({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className: string;
}) {
  const [failed, setFailed] = useState(false);

  return (
    <div className={className}>
      {failed ? '📦' : (
        <img
          src={src}
          alt={alt}
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}
