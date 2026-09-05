import { GalleryVerticalEnd } from "lucide-react";

export function GovernifyBrand({ product = "Join" }: { product?: string }) {
  return (
    <div className="flex items-center gap-2 font-medium">
      <span className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <GalleryVerticalEnd className="size-4" aria-hidden="true" />
      </span>
      <span>Governify {product}</span>
    </div>
  );
}
