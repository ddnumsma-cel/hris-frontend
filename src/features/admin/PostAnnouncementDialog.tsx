import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog } from "@/components/ui/Dialog";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Button } from "@/components/ui/Button";
import { createAnnouncement } from "@/lib/api";

export function PostAnnouncementDialog({
  open,
  onClose,
  onSubmitted,
}: {
  open: boolean;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [confirmClose, setConfirmClose] = useState(false);
  // Closing with something typed asks first, so a stray click doesn't lose it.
  const requestClose = () => (title.trim() ? setConfirmClose(true) : onClose());

  const mutation = useMutation({
    mutationFn: createAnnouncement,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["employee", "announcements"],
      });
      setTitle("");
      onClose();
      onSubmitted();
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    mutation.mutate({ title: title.trim() });
  }

  return (
    <>
      <Dialog
        open={open}
        onClose={requestClose}
        title="Post announcement"
        dismissOnBackdrop={false}
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          <div>
            <label
              htmlFor="announcement-title"
              className="mb-1 block text-xs font-semibold text-ink-2"
            >
              Announcement
            </label>
            <textarea
              id="announcement-title"
              rows={3}
              required
              className="field w-full px-3 py-2 text-sm"
              placeholder="e.g. Office closed Nov 1 for All Saints' Day"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="mt-1 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={requestClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Posting…" : "Post announcement"}
            </Button>
          </div>
        </form>
      </Dialog>
      <ConfirmDialog
        open={confirmClose}
        title="Discard this announcement?"
        message="What you've typed will be lost."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        onClose={() => setConfirmClose(false)}
        onConfirm={() => {
          setConfirmClose(false);
          setTitle("");
          onClose();
        }}
      />
    </>
  );
}
