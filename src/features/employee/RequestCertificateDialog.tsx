import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { createCertificateRequest } from "@/lib/api";
import { certificateRequestSchema, certificateTypes, type CertificateRequestFormValues } from "@/lib/schemas";

const inputClass =
  "field w-full px-3 py-2 text-sm";
const labelClass = "mb-1 block text-xs font-medium text-ink";
const errorClass = "mt-1 text-xs font-medium text-critical";

export function RequestCertificateDialog({
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
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CertificateRequestFormValues>({
    resolver: zodResolver(certificateRequestSchema),
    defaultValues: { type: "Certificate of Employment", purpose: "" },
  });

  const mutation = useMutation({
    mutationFn: createCertificateRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee", "certificate-requests"] });
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
    <Dialog open={open} onClose={close} title="Request a certificate">
      <form onSubmit={handleSubmit((values) => mutation.mutate(values))} className="flex flex-col gap-3.5">
        <div>
          <label htmlFor="cert-type" className={labelClass}>
            Certificate type
          </label>
          <select id="cert-type" className={inputClass} {...register("type")}>
            {certificateTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          {errors.type && <p className={errorClass}>{errors.type.message}</p>}
        </div>

        <div>
          <label htmlFor="cert-purpose" className={labelClass}>
            Purpose
          </label>
          <textarea
            id="cert-purpose"
            rows={3}
            className={inputClass}
            placeholder="e.g. Bank loan application, visa processing"
            {...register("purpose")}
          />
          {errors.purpose && <p className={errorClass}>{errors.purpose.message}</p>}
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
