import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTranslation } from "react-i18next";

interface DisclaimerDialogProps {
  open: boolean;
  onAccept: () => void;
}

export function DisclaimerDialog({ open, onAccept }: DisclaimerDialogProps) {
  const { t } = useTranslation();
  const [isAccepting, setIsAccepting] = useState(false);

  const handleAccept = async () => {
    setIsAccepting(true);
    try {
      await onAccept();
    } finally {
      setIsAccepting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}} modal>
      <DialogContent
        className="max-w-3xl max-h-[90vh]"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            {t('disclaimer.title')}
          </DialogTitle>
          <DialogDescription>
            {t('disclaimer.subtitle')}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[500px] w-full rounded-md border p-4">
          <div className="space-y-4 text-sm">
            <p className="font-semibold text-base">
              {t('disclaimer.welcome')}
            </p>

            <p>{t('disclaimer.description1')}</p>

            <p className="font-medium text-destructive">
              {t('disclaimer.confidentialityWarning')}
            </p>

            <p>{t('disclaimer.disclaimer')}</p>

            <p>{t('disclaimer.documentation')}</p>

            <p className="font-medium">
              {t('disclaimer.consent')}
            </p>

            <p className="italic">
              {t('disclaimer.memoryNote')}
            </p>

            <p>{t('disclaimer.feedback')}</p>

            <p className="italic">
              {t('disclaimer.limitations')}
            </p>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button
            onClick={handleAccept}
            disabled={isAccepting}
            className="w-full sm:w-auto"
          >
            {isAccepting ? t('disclaimer.accepting') : t('disclaimer.acceptButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
