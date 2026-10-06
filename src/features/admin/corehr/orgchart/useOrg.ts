import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getOrgChart } from "@/lib/corehr/api";
import { useAccess } from "../../administration/access";
import { buildTree, ORG_KEY, type Person } from "./tree";

/** Everything the Org chart layouts share: the people, the tree, and who is open in the side panel. */
export function useOrg() {
  const chart = useQuery({
    queryKey: ORG_KEY,
    queryFn: getOrgChart,
    staleTime: 0,
  });
  const access = useAccess();
  const [openId, setOpenId] = useState<string | null>(null);
  const data = chart.data;
  const tree = data ? buildTree(data) : null;
  const head = data?.people.find((p) => p.id === data.headId);
  // Without a head, the top of the chart is everyone who reports to no one.
  const roots: Person[] = tree ? (head ? [head] : tree.kidsOf(undefined)) : [];
  return {
    chart,
    data,
    tree,
    head,
    roots,
    // No single head: the partners run the firm together, one cluster each.
    partnersLead:
      !head &&
      roots.length > 1 &&
      roots.every((p) => p.positionTitle === "Partner"),
    canEdit: access.company === "edit" || access.company === "approve",
    open: data?.people.find((p) => p.id === openId),
    openPerson: (p: Person | string) =>
      setOpenId(typeof p === "string" ? p : p.id),
    close: () => setOpenId(null),
  };
}

export type Org = ReturnType<typeof useOrg>;
