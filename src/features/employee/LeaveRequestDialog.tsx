import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { createLeaveRequest } from "@/lib/api";
import { leaveRequestSchema, leaveTypes, type LeaveRequestFormValues } from "@/lib/schemas";

const inputClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand";
const labelClass = "mb-1 block text-xs font-semibold text-ink-2";
const errorClass = "mt-1 text-xs font-medium text-critical";

export function LeaveRequestDialog({
  open,
  onClose,
  onSubmitted,
}: {
  open: boolean;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<LeaveRequestFormValues>({
    resolver: zodResolver(leaveRequestSchema),
    defaultValues: { type: "Vacation", startDate: "", endDate: "", reason: "" },
  });

  const leaveType = watch("type");

  const mutation = useMutation({
    mutationFn: createLeaveRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["approvals-queue"] });
      reset();
      onClose();
      onSubmitted();
    },
  });

  function close() {
    reset();
    onClose();
  }

  return (
    <Dialog open={open} onClose={close} title="File a leave request">
      <form
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
        className="flex flex-col gap-3.5"
      >
        <div>
          <label htmlFor="leave-type" className={labelClass}>
            Leave type
          </label>
          <select id="leave-type" className={inputClass} {...register("type")}>
            {leaveTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          {errors.type && <p className={errorClass}>{errors.type.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="start-date" className={labelClass}>
              Start date
            </label>
            <input id="start-date" type="date" className={inputClass} {...register("startDate")} />
            {errors.startDate && <p className={errorClass}>{errors.startDate.message}</p>}
          </div>
          <div>
            <label htmlFor="end-date" className={labelClass}>
              End date
            </label>
            <input id="end-date" type="date" className={inputClass} {...register("endDate")} />
            {errors.endDate && <p className={errorClass}>{errors.endDate.message}</p>}
          </div>
        </div>

        <div>
          <label htmlFor="reason" className={labelClass}>
            Reason {leaveType === "Emergency" ? "(required)" : "(optional)"}
          </label>
          <textarea
            id="reason"
            rows={3}
            className={inputClass}
            placeholder="Add context for your approving manager"
            {...register("reason")}
          />
          {errors.reason && <p className={errorClass}>{errors.reason.message}</p>}
        </div>

        <div className="mt-1 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting || mutation.isPending}>
            {mutation.isPending ? "Submitting…" : "Submit request"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
