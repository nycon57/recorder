import { cn } from "@/lib/utils";
import type { Experimental_GeneratedImage } from "ai";

export type ImageProps = Experimental_GeneratedImage & {
  className?: string;
  alt?: string;
};

export const Image = ({
  base64,
  uint8Array,
  mediaType,
  ...props
}: ImageProps) => {
  // Validate that required data exists before rendering
  if (!mediaType || !base64) {
    return null;
  }

  return (
    <img
      {...props}
      className={cn(
        "h-auto max-w-full overflow-hidden rounded-md",
        props.className
      )}
      src={`data:${mediaType};base64,${base64}`}
    />
  );
};
