import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { createEmployee } from "@/lib/api";
import { addEmployeeSchema, clusterOptions, officeOptions, type AddEmployeeFormValues } from "@/lib/schemas";

const inputClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand";
const labelClass = "mb-1 block text-xs font-semibold text-ink-2";
const errorClass = "mt-1 text-xs font-medium text-critical";

export function AddEmployeeDialog({
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
  } = useForm<AddEmployeeFormValues>({
    resolver: zodResolver(addEmployeeSchema),
    defaultValues: { name: "", position: "", department: "", office: "Cebu HQ", cluster: "RPM" },
  });

  const mutation = useMutation({
    mutationFn: createEmployee,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "employee-directory"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "overview-stats"] });
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
    <Dialog open={open} onClose={close} title="Add employee">
      <form onSubmit={handleSubmit((values) => mutation.mutate(values))} className="flex flex-col gap-3.5">
        <div>
          <label htmlFor="emp-name" className={labelClass}>
            Full name
          </label>
          <input id="emp-name" className={inputClass} placeholder="Juan Dela Cruz" {...register("name")} />
          {errors.name && <p className={errorClass}>{errors.name.message}</p>}
        </div>

        <div>
          <label htmlFor="emp-position" className={labelClass}>
            Position
          </label>
          <input id="emp-position" className={inputClass} placeholder="Audit Associate" {...register("position")} />
          {errors.position && <p className={errorClass}>{errors.position.message}</p>}
        </div>

        <div>
          <label htmlFor="emp-department" className={labelClass}>
            Department
          </label>
          <input
            id="emp-department"
            className={inputClass}
            placeholder="Audit & Assurance"
            {...register("department")}
          />
          {errors.department && <p className={errorClass}>{errors.department.message}</p>}
        </div>

        <div>
          <label htmlFor="emp-office" className={labelClass}>
            Office
          </label>
          <select id="emp-office" className={inputClass} {...register("office")}>
            {officeOptions.map((office) => (
              <option key={office} value={office}>
                {office}
              </option>
            ))}
          </select>
          {errors.office && <p className={errorClass}>{errors.office.message}</p>}
        </div>

        <div>
          <label htmlFor="emp-cluster" className={labelClass}>
            Cluster
          </label>
          <select id="emp-cluster" className={inputClass} {...register("cluster")}>
            {clusterOptions.map((cluster) => (
              <option key={cluster} value={cluster}>
                {cluster}
              </option>
            ))}
          </select>
          {errors.cluster && <p className={errorClass}>{errors.cluster.message}</p>}
        </div>

        <div className="mt-1 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting || mutation.isPending}>
            {mutation.isPending ? "Adding…" : "Add employee"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
