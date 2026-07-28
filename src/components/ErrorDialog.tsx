"use client";

import { useT } from "@/lib/i18n";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function ErrorDialog({
  message,
  onClose,
  actionLabel,
  onAction,
}: {
  message: string | null;
  onClose: () => void;
  actionLabel?: string;
  onAction?: () => void | Promise<void>;
}) {
  const t = useT();
  const handleAction = () => {
    if (!onAction) return;
    void onAction();
    onClose();
  };

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
        {actionLabel && onAction && (
          <DialogFooter>
            <Button type="button" onClick={handleAction}>
              {t(actionLabel)}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
