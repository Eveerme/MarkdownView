import { XIcon } from "lucide-react";
import { useEffect, useRef } from "react";

import { Button } from "@markdownview/ui/components/button";

interface ImageLightboxProps {
  alt: string;
  onClose: () => void;
  src: string;
}

/**
 * The preview's images at full size. The native dialog brings the modal
 * behavior with it: Escape closes it, the backdrop dims the page, and the rest
 * of the app stays out of reach while it is open.
 */
export const ImageLightbox = ({ alt, onClose, src }: ImageLightboxProps) => {
  const dialog = useRef<HTMLDialogElement>(null);
  const close = useRef(onClose);

  useEffect(() => {
    close.current = onClose;
  });

  useEffect(() => {
    const element = dialog.current;

    element?.showModal();

    // A click on the backdrop targets the dialog box itself, not its content.
    const onBackdropClick = (event: MouseEvent) => {
      if (event.target === element) {
        close.current();
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close.current();
      }
    };

    element?.addEventListener("click", onBackdropClick);
    window.addEventListener("keydown", onKeyDown);

    return () => {
      element?.removeEventListener("click", onBackdropClick);
      window.removeEventListener("keydown", onKeyDown);
      element?.close();
    };
  }, []);

  return (
    <dialog
      aria-label={alt === "" ? "图片预览" : alt}
      className="backdrop:bg-background/85 m-auto w-fit max-w-[90vw] overflow-visible border-0 bg-transparent p-0 backdrop:backdrop-blur-sm"
      ref={dialog}
    >
      <img
        alt={alt}
        className="max-h-[84vh] max-w-[86vw] rounded-lg border object-contain shadow-2xl"
        src={src}
      />
      <Button
        aria-label="关闭图片预览"
        className="absolute -top-3 -right-3"
        onClick={onClose}
        size="icon-sm"
        title="关闭（Esc）"
        variant="secondary"
      >
        <XIcon />
      </Button>
    </dialog>
  );
};
