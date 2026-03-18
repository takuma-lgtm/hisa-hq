"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, useReducedMotion, AnimatePresence, type Variants } from "framer-motion";
import { Download, ChevronDown } from "lucide-react";
import { Resizable } from "react-resizable";
import "react-resizable/css/styles.css";

export interface Employee {
  id: string;
  name: string;
  email: string;
  department: string;
  position: string;
  salary: number;
  hireDate: string;
  status: "active" | "inactive" | "on-leave";
  avatar?: string;
}

interface ColumnLabels {
  email?: string;
  department?: string;
  position?: string;
  salary?: string;
  hireDate?: string;
  status?: string;
}

interface ResizableTableProps {
  title?: string;
  employees?: Employee[];
  columnLabels?: ColumnLabels;
  formatSalary?: (salary: number) => string;
  onEmployeeSelect?: (employeeId: string) => void;
  onColumnResize?: (columnKey: string, newWidth: number) => void;
  className?: string;
  enableAnimations?: boolean;
  showCheckboxes?: boolean;
  showToolbar?: boolean;
  showStatus?: boolean;
}

const defaultEmployees: Employee[] = [
  { id: "1", name: "Sarah Chen", email: "sarah.chen@company.com", department: "Engineering", position: "Senior Software Engineer", salary: 125000, hireDate: "2022-03-15", status: "active" },
  { id: "2", name: "Michael Rodriguez", email: "michael.rodriguez@company.com", department: "Marketing", position: "Marketing Manager", salary: 95000, hireDate: "2021-08-22", status: "active" },
  { id: "3", name: "Emily Watson", email: "emily.watson@company.com", department: "Design", position: "UX Designer", salary: 88000, hireDate: "2023-01-10", status: "active" },
  { id: "4", name: "David Kim", email: "david.kim@company.com", department: "Engineering", position: "Tech Lead", salary: 145000, hireDate: "2020-11-05", status: "active" },
  { id: "5", name: "Lisa Anderson", email: "lisa.anderson@company.com", department: "HR", position: "HR Director", salary: 110000, hireDate: "2019-06-12", status: "on-leave" },
  { id: "6", name: "James Mitchell", email: "james.mitchell@company.com", department: "Sales", position: "Sales Director", salary: 130000, hireDate: "2021-02-28", status: "active" },
  { id: "7", name: "Jennifer Lee", email: "jennifer.lee@company.com", department: "Finance", position: "Financial Analyst", salary: 75000, hireDate: "2023-04-18", status: "active" },
  { id: "8", name: "Robert Chang", email: "robert.chang@company.com", department: "Engineering", position: "DevOps Engineer", salary: 105000, hireDate: "2022-09-14", status: "active" },
  { id: "9", name: "Amanda Pierce", email: "amanda.pierce@company.com", department: "Marketing", position: "Content Manager", salary: 72000, hireDate: "2023-07-03", status: "inactive" },
  { id: "10", name: "Christopher Hayes", email: "chris.hayes@company.com", department: "Operations", position: "Operations Manager", salary: 98000, hireDate: "2021-12-01", status: "active" },
  { id: "11", name: "Victoria Moore", email: "victoria.moore@company.com", department: "Design", position: "Product Designer", salary: 92000, hireDate: "2022-05-20", status: "active" },
  { id: "12", name: "Nicholas Brown", email: "nicholas.brown@company.com", department: "Engineering", position: "Frontend Developer", salary: 85000, hireDate: "2023-03-08", status: "active" },
  { id: "13", name: "Rebecca Sullivan", email: "rebecca.sullivan@company.com", department: "Sales", position: "Account Executive", salary: 78000, hireDate: "2022-11-15", status: "active" },
  { id: "14", name: "Thomas Wright", email: "thomas.wright@company.com", department: "Finance", position: "Senior Financial Analyst", salary: 95000, hireDate: "2021-04-30", status: "active" },
  { id: "15", name: "Maria Garcia", email: "maria.garcia@company.com", department: "HR", position: "HR Specialist", salary: 68000, hireDate: "2023-08-12", status: "active" },
];

type SortField = "name" | "department" | "position" | "salary" | "hireDate";
type SortOrder = "asc" | "desc";

export function ResizableTable({
  title = "Employee",
  employees: initialEmployees = defaultEmployees,
  columnLabels = {},
  formatSalary,
  onEmployeeSelect,
  onColumnResize,
  className = "",
  enableAnimations = true,
  showCheckboxes = true,
  showToolbar = true,
  showStatus = true,
}: ResizableTableProps = {}) {
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const shouldReduceMotion = useReducedMotion();

  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({
    checkbox: 50,
    name: 200,
    email: 220,
    department: 140,
    position: 180,
    salary: 120,
    hireDate: 120,
    status: 110,
  });

  const ITEMS_PER_PAGE = 10;

  // Reset to page 1 when data changes (e.g. external filter applied)
  useEffect(() => {
    setCurrentPage(1);
  }, [initialEmployees]);

  const handleCheckboxSelect = (employeeId: string) => {
    setSelectedEmployees(prev =>
      prev.includes(employeeId) ? prev.filter(id => id !== employeeId) : [...prev, employeeId]
    );
  };

  const handleSelectAll = () => {
    if (selectedEmployees.length === paginatedEmployees.length) {
      setSelectedEmployees([]);
    } else {
      setSelectedEmployees(paginatedEmployees.map(e => e.id));
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
    setShowSortMenu(false);
    setCurrentPage(1);
  };

  const sortedEmployees = useMemo(() => {
    if (!sortField) return initialEmployees;
    return [...initialEmployees].sort((a, b) => {
      let aVal: string | number = a[sortField];
      let bVal: string | number = b[sortField];
      if (sortField === "hireDate") {
        aVal = new Date(a.hireDate).getTime();
        bVal = new Date(b.hireDate).getTime();
      }
      if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
      if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
  }, [initialEmployees, sortField, sortOrder]);

  const paginatedEmployees = useMemo(() => {
    const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
    return sortedEmployees.slice(startIdx, startIdx + ITEMS_PER_PAGE);
  }, [sortedEmployees, currentPage]);

  const totalPages = Math.ceil(sortedEmployees.length / ITEMS_PER_PAGE);

  const totalWidth = (showCheckboxes ? columnWidths.checkbox : 0)
    + columnWidths.name + columnWidths.email + columnWidths.department
    + columnWidths.position + columnWidths.salary + columnWidths.hireDate
    + (showStatus ? columnWidths.status : 0);

  const getStatusColor = (status: string) => {
    const statusMap: Record<string, { bgColor: string; borderColor: string; textColor: string; dotColor: string }> = {
      active: { bgColor: "bg-green-50", borderColor: "border-green-200", textColor: "text-green-700", dotColor: "bg-green-500" },
      inactive: { bgColor: "bg-red-50", borderColor: "border-red-200", textColor: "text-red-600", dotColor: "bg-red-400" },
      "on-leave": { bgColor: "bg-amber-50", borderColor: "border-amber-200", textColor: "text-amber-700", dotColor: "bg-amber-500" },
    };
    return statusMap[status] ?? statusMap.active;
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

  const handleResize = (columnKey: string, { size }: { size: { width: number } }) => {
    const newWidth = Math.max(80, Math.min(400, size.width));
    setColumnWidths(prev => ({ ...prev, [columnKey]: newWidth }));
    if (onColumnResize) onColumnResize(columnKey, newWidth);
  };

  const exportToCSV = () => {
    const headers = ["Name", columnLabels.email ?? "Email", columnLabels.department ?? "Department", columnLabels.position ?? "Position", columnLabels.salary ?? "Salary", columnLabels.hireDate ?? "Hire Date", columnLabels.status ?? "Status"];
    const rows = sortedEmployees.map(e => [e.name, e.email, e.department, e.position, e.salary, e.hireDate, e.status]);
    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
    ].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `export-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  };

  const exportToJSON = () => {
    const blob = new Blob([JSON.stringify(sortedEmployees, null, 2)], { type: "application/json;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `export-${new Date().toISOString().split("T")[0]}.json`;
    link.click();
  };

  const shouldAnimate = enableAnimations && !shouldReduceMotion;

  const containerVariants: Variants = {
    visible: { transition: { staggerChildren: 0.04, delayChildren: 0.1 } },
  };

  const rowVariants: Variants = {
    hidden: { opacity: 0, y: 20, scale: 0.98, filter: "blur(4px)" },
    visible: {
      opacity: 1, y: 0, scale: 1, filter: "blur(0px)",
      transition: { type: "spring", stiffness: 400, damping: 25, mass: 0.7 },
    },
    exit: { opacity: 0, y: -10, transition: { duration: 0.2 } },
  };

  return (
    <div className={`w-full ${className}`}>
      {/* Toolbar */}
      {showToolbar && <div className="mb-3 flex items-center justify-end gap-2 flex-wrap">
        {/* Sort */}
        <div className="relative">
          <button
            onClick={() => setShowSortMenu(!showSortMenu)}
            className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 text-sm hover:bg-slate-50 transition-colors flex items-center gap-2 rounded-md"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M3 6L6 3L9 6M6 3V13M13 10L10 13L7 10M10 13V3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Sort
            {sortField && <span className="ml-1 text-xs bg-slate-800 text-white rounded px-1.5 py-0.5">1</span>}
            <ChevronDown size={14} className="opacity-50" />
          </button>
          {showSortMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowSortMenu(false)} />
              <div className="absolute right-0 mt-1 w-48 bg-white border border-slate-200 shadow-md rounded-md z-20 py-1">
                {(["name", "department", "salary", "hireDate"] as SortField[]).map(field => {
                  const labels: Record<string, string> = {
                    name: title,
                    department: columnLabels.department ?? "Department",
                    salary: columnLabels.salary ?? "Salary",
                    hireDate: columnLabels.hireDate ?? "Hire Date",
                  };
                  return (
                    <button
                      key={field}
                      onClick={() => handleSort(field)}
                      className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-50 transition-colors ${sortField === field ? "bg-slate-50 font-medium" : ""}`}
                    >
                      {labels[field]} {sortField === field && `(${sortOrder === "asc" ? "↑" : "↓"})`}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Export */}
        <div className="relative">
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 text-sm hover:bg-slate-50 transition-colors flex items-center gap-2 rounded-md"
          >
            <Download size={14} />
            Export
            <ChevronDown size={14} className="opacity-50" />
          </button>
          {showExportMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)} />
              <div className="absolute right-0 mt-1 w-28 bg-white border border-slate-200 shadow-md rounded-md z-20">
                <button onClick={() => { exportToCSV(); setShowExportMenu(false); }} className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 transition-colors">
                  CSV
                </button>
                <button onClick={() => { exportToJSON(); setShowExportMenu(false); }} className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 transition-colors border-t border-slate-100">
                  JSON
                </button>
              </div>
            </>
          )}
        </div>
      </div>}

      {/* Table container */}
      <div className="bg-white border border-slate-200 overflow-hidden rounded-lg">
        <div className="overflow-x-auto">
          <div style={{ minWidth: totalWidth }}>
            {/* Header */}
            <div className="flex py-2.5 text-xs font-medium text-slate-500 bg-slate-50 border-b border-slate-200">
              {/* Checkbox column */}
              {showCheckboxes && (
                <div className="flex items-center justify-center border-r border-slate-200 pr-3" style={{ width: columnWidths.checkbox }}>
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-slate-300 cursor-pointer accent-slate-600"
                    checked={paginatedEmployees.length > 0 && selectedEmployees.length === paginatedEmployees.length}
                    onChange={handleSelectAll}
                  />
                </div>
              )}

              {/* Name */}
              <Resizable width={columnWidths.name} height={0} onResize={(e, data) => handleResize("name", data)} minConstraints={[80, 0]} maxConstraints={[400, 0]} handle={<div className="absolute right-0 top-0 bottom-0 w-1 hover:w-1.5 cursor-col-resize bg-transparent hover:bg-slate-300 transition-all" />}>
                <div className="flex items-center border-r border-slate-200 px-3 relative" style={{ width: columnWidths.name }}>
                  <span>{title}</span>
                </div>
              </Resizable>

              {/* Email / Website */}
              <Resizable width={columnWidths.email} height={0} onResize={(e, data) => handleResize("email", data)} minConstraints={[80, 0]} maxConstraints={[400, 0]} handle={<div className="absolute right-0 top-0 bottom-0 w-1 hover:w-1.5 cursor-col-resize bg-transparent hover:bg-slate-300 transition-all" />}>
                <div className="flex items-center gap-1.5 border-r border-slate-200 px-3 relative" style={{ width: columnWidths.email }}>
                  <span>{columnLabels.email ?? "Email"}</span>
                </div>
              </Resizable>

              {/* Department */}
              <Resizable width={columnWidths.department} height={0} onResize={(e, data) => handleResize("department", data)} minConstraints={[80, 0]} maxConstraints={[400, 0]} handle={<div className="absolute right-0 top-0 bottom-0 w-1 hover:w-1.5 cursor-col-resize bg-transparent hover:bg-slate-300 transition-all" />}>
                <div className="flex items-center gap-1.5 border-r border-slate-200 px-3 relative" style={{ width: columnWidths.department }}>
                  <span>{columnLabels.department ?? "Department"}</span>
                </div>
              </Resizable>

              {/* Position */}
              <Resizable width={columnWidths.position} height={0} onResize={(e, data) => handleResize("position", data)} minConstraints={[80, 0]} maxConstraints={[400, 0]} handle={<div className="absolute right-0 top-0 bottom-0 w-1 hover:w-1.5 cursor-col-resize bg-transparent hover:bg-slate-300 transition-all" />}>
                <div className="flex items-center gap-1.5 border-r border-slate-200 px-3 relative" style={{ width: columnWidths.position }}>
                  <span>{columnLabels.position ?? "Position"}</span>
                </div>
              </Resizable>

              {/* Salary / count */}
              <Resizable width={columnWidths.salary} height={0} onResize={(e, data) => handleResize("salary", data)} minConstraints={[80, 0]} maxConstraints={[400, 0]} handle={<div className="absolute right-0 top-0 bottom-0 w-1 hover:w-1.5 cursor-col-resize bg-transparent hover:bg-slate-300 transition-all" />}>
                <div className="flex items-center gap-1.5 border-r border-slate-200 px-3 relative" style={{ width: columnWidths.salary }}>
                  <span>{columnLabels.salary ?? "Salary"}</span>
                </div>
              </Resizable>

              {/* Hire Date */}
              <Resizable width={columnWidths.hireDate} height={0} onResize={(e, data) => handleResize("hireDate", data)} minConstraints={[80, 0]} maxConstraints={[400, 0]} handle={<div className="absolute right-0 top-0 bottom-0 w-1 hover:w-1.5 cursor-col-resize bg-transparent hover:bg-slate-300 transition-all" />}>
                <div className="flex items-center gap-1.5 border-r border-slate-200 px-3 relative" style={{ width: columnWidths.hireDate }}>
                  <span>{columnLabels.hireDate ?? "Hire Date"}</span>
                </div>
              </Resizable>

              {/* Status */}
              {showStatus && (
                <div className="flex items-center gap-1.5 px-3" style={{ width: columnWidths.status }}>
                  <span>{columnLabels.status ?? "Status"}</span>
                </div>
              )}
            </div>

            {/* Rows */}
            <AnimatePresence mode="wait">
              <motion.div
                key={`page-${currentPage}`}
                variants={shouldAnimate ? containerVariants : undefined}
                initial={shouldAnimate ? "hidden" : false}
                animate="visible"
              >
                {paginatedEmployees.map(employee => (
                  <motion.div key={employee.id} variants={shouldAnimate ? rowVariants : undefined}>
                    <div
                      className={`py-3 group relative transition-all duration-150 border-b border-slate-100 flex cursor-pointer ${
                        selectedEmployees.includes(employee.id) ? "bg-slate-50" : "bg-white hover:bg-slate-50"
                      }`}
                      onClick={() => onEmployeeSelect?.(employee.id)}
                    >
                      {/* Checkbox */}
                      {showCheckboxes && (
                        <div
                          className="flex items-center justify-center border-r border-slate-100 pr-3"
                          style={{ width: columnWidths.checkbox }}
                          onClick={e => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            className="w-4 h-4 rounded border-slate-300 cursor-pointer accent-slate-600"
                            checked={selectedEmployees.includes(employee.id)}
                            onChange={() => handleCheckboxSelect(employee.id)}
                          />
                        </div>
                      )}

                      {/* Name */}
                      <div className="flex items-center min-w-0 border-r border-slate-100 px-3" style={{ width: columnWidths.name }}>
                        <span className="text-sm text-slate-900 font-medium truncate">{employee.name}</span>
                      </div>

                      {/* Email / Website */}
                      <div className="flex items-center min-w-0 border-r border-slate-100 px-3" style={{ width: columnWidths.email }}>
                        {employee.email && employee.email !== "—" ? (
                          <a
                            href={employee.email.startsWith("http") ? employee.email : `mailto:${employee.email}`}
                            target={employee.email.startsWith("http") ? "_blank" : undefined}
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 hover:text-blue-700 truncate"
                            onClick={e => e.stopPropagation()}
                          >
                            {employee.email}
                          </a>
                        ) : (
                          <span className="text-sm text-slate-400">—</span>
                        )}
                      </div>

                      {/* Department */}
                      <div className="flex items-center border-r border-slate-100 px-3" style={{ width: columnWidths.department }}>
                        <span className="text-sm text-slate-600 truncate">{employee.department || "—"}</span>
                      </div>

                      {/* Position */}
                      <div className="flex items-center min-w-0 border-r border-slate-100 px-3" style={{ width: columnWidths.position }}>
                        <span className="text-sm text-slate-600 truncate">{employee.position || "—"}</span>
                      </div>

                      {/* Salary */}
                      <div className="flex items-center border-r border-slate-100 px-3" style={{ width: columnWidths.salary }}>
                        <span className="text-sm font-medium text-slate-700">
                          {formatSalary ? formatSalary(employee.salary) : formatCurrency(employee.salary)}
                        </span>
                      </div>

                      {/* Hire Date */}
                      <div className="flex items-center border-r border-slate-100 px-3" style={{ width: columnWidths.hireDate }}>
                        <span className="text-sm text-slate-600">{formatDate(employee.hireDate)}</span>
                      </div>

                      {/* Status */}
                      {showStatus && (
                        <div className="flex items-center px-3" style={{ width: columnWidths.status }}>
                          {(() => {
                            const { bgColor, textColor, dotColor } = getStatusColor(employee.status);
                            return (
                              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${bgColor} ${textColor} ${bgColor.replace("bg-", "border-").replace("50", "200")}`}>
                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
                                {employee.status.charAt(0).toUpperCase() + employee.status.slice(1).replace("-", " ")}
                              </span>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-3 flex items-center justify-between px-1">
          <div className="text-xs text-slate-400">
            Page {currentPage} of {totalPages} · {sortedEmployees.length} rows
          </div>
          <div className="flex gap-1.5">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 text-xs hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors rounded-md"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 text-xs hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors rounded-md"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
