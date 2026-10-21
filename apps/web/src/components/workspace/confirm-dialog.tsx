import { useEffect, useRef } from "react";

import { Button } from "@markdownview/ui/components/button";

interface ConfirmDialogProps {
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
  open: boolean;
}

export const ConfirmDialog = ({
  message,
  onCancel,
  onConfirm,
  open,
}: ConfirmDialogProps) => {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;

    if (element === null) {
      return;
    }

    if (open && !element.open) {
      element.showModal();
    } else if (!open && element.open) {
      element.close();
    }
  }, [open]);

  return (
    <dialog
      aria-labelledby="discard-title"
      className="bg-card text-card-foreground backdrop:bg-foreground/25 m-auto w-full max-w-sm rounded-xl border p-0 shadow-2xl backdrop:backdrop-blur-sm"
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      ref={dialog}
    >
      <div className="p-5">
        <h2 className="text-base font-semibold" id="discard-title">
          放弃未保存的修改？
        </h2>
        <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
          {message}
        </p>
      </div>
      <div className="bg-muted/40 flex justify-end gap-2 border-t px-4 py-3">
        <Button onClick={onCancel} size="sm" variant="ghost">
          取消
        </Button>
        <Button onClick={onConfirm} size="sm" variant="destructive">
          放弃修改
        </Button>
      </div>
    </dialog>
  );
};
