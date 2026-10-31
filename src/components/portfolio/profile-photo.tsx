import Image from "next/image";

interface ProfilePhotoProps {
  src: string;
  /** Used to describe the photo for screen readers; falls back to a generic description. */
  name?: string | null;
}

export function ProfilePhoto({ src, name }: ProfilePhotoProps) {
  return (
    <div className="hero-in relative size-20 shrink-0 overflow-hidden rounded-full border border-border bg-surface sm:size-24">
      <Image
        src={src}
        alt={name ? `Photo of ${name}` : "Profile photo"}
        fill
        sizes="(min-width: 640px) 96px, 80px"
        loading="eager"
        className="object-cover"
      />
    </div>
  );
}
