import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { updateEmployee } from "@/lib/api";
import {
  clusterOptions,
  editEmployeeSchema,
  employeeStatusOptions,
  officeOptions,
  type EditEmployeeFormValues,
} from "@/lib/schemas";
import type { Employee } from "@/lib/types";

const inputClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand";
const labelClass = "mb-1 block text-xs font-semibold text-ink-2";
const errorClass = "mt-1 text-xs font-medium text-critical";

export function EditEmployeeDialog({
  employee,
  onClose,
  onSubmitted,
}: {
  employee: Employee | null;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EditEmployeeFormValues>({
    resolver: zodResolver(editEmployeeSchema),
    values: employee
      ? {
          name: employee.name,
          position: employee.position,
          department: employee.department,
          office: employee.office,
          cluster: employee.cluster,
          status: employee.status,
        }
      : undefined,
  });

  const mutation = useMutation({
    mutationFn: (values: EditEmployeeFormValues) => updateEmployee(employee!.id, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "employee-directory"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "overview-stats"] });
      onClose();
      onSubmitted();
    },
  });

  return (
    <Dialog open={employee !== null} onClose={onClose} title="Edit employee">
      <form onSubmit={handleSubmit((values) => mutation.mutate(values))} className="flex flex-col gap-3.5">
        <div>
          <label htmlFor="edit-emp-name" className={labelClass}>
            Full name
          </label>
          <input id="edit-emp-name" className={inputClass} {...register("name")} />
          {errors.name && <p className={errorClass}>{errors.name.message}</p>}
        </div>

        <div>
          <label htmlFor="edit-emp-position" className={labelClass}>
            Position
          </label>
          <input id="edit-emp-position" className={inputClass} {...register("position")} />
          {errors.position && <p className={errorClass}>{errors.position.message}</p>}
        </div>

        <div>
          <label htmlFor="edit-emp-department" className={labelClass}>
            Department
          </label>
          <input id="edit-emp-department" className={inputClass} {...register("department")} />
          {errors.department && <p className={errorClass}>{errors.department.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="edit-emp-office" className={labelClass}>
              Office
            </label>
            <select id="edit-emp-office" className={inputClass} {...register("office")}>
              {officeOptions.map((office) => (
                <option key={office} value={office}>
                  {office}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="edit-emp-cluster" className={labelClass}>
              Cluster
            </label>
            <select id="edit-emp-cluster" className={inputClass} {...register("cluster")}>
              {clusterOptions.map((cluster) => (
                <option key={cluster} value={cluster}>
                  {cluster}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="edit-emp-status" className={labelClass}>
            Status
          </label>
          <select id="edit-emp-status" className={inputClass} {...register("status")}>
            {employeeStatusOptions.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-1 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting || mutation.isPending}>
            {mutation.isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
