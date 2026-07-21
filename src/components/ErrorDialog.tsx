"use client";

import { useT } from "@/lib/i18n";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function ErrorDialog({
  message,
  onClose,
}: {
  message: string | null;
  onClose: () => void;
}) {
  const t = useT();
  return (
    <Dialog
      open={message !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("Something went wrong. Please try again.")}</DialogTitle>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}
