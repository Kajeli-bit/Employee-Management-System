import { Monogram } from "./DepartmentMonogram";

export const columns = [
  {
    name: "S No",
    selector: (row) => row.sno,
    width: "100px",
    cell: (row) => (
      <span className="font-mono tabular-nums text-slate-500">
        {row.sno}
      </span>
    ),
  },
  {
    name: "Department Name",
    selector: (row) => row.dep_name,
    sortable: true,
    cell: (row) => (
      <div className="flex items-center gap-3">
        <Monogram name={row.dep_name} size="sm" />
        <span className="font-medium text-slate-900">
          {row.dep_name}
        </span>
      </div>
    ),
  },
  {
    name: "Teams",
    selector: (row) => row.teamCount ?? 0,
    sortable: true,
    width: "130px",
    center: true,
    cell: (row) => (
      <span className="inline-flex min-w-7 justify-center rounded-full bg-brand-50 px-2.5 py-0.5 text-sm font-medium tabular-nums text-brand-700">
        {row.teamCount ?? 0}
      </span>
    ),
  },
  {
    name: "Action",
    cell: (row) => row.action,
    center: true,
  },
];
