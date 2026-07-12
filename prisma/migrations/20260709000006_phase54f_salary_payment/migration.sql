-- CreateTable
CREATE TABLE "SalaryPayment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "periodYear" INTEGER NOT NULL,
    "periodMonth" INTEGER NOT NULL,
    "basicSalary" REAL NOT NULL,
    "allowances" TEXT NOT NULL DEFAULT '[]',
    "grossSalary" REAL NOT NULL,
    "deductions" TEXT NOT NULL DEFAULT '[]',
    "totalDeductions" REAL NOT NULL DEFAULT 0,
    "netPayable" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "paidDate" DATETIME,
    "paymentMethod" TEXT,
    "expenseId" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SalaryPayment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SalaryPayment_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "SalaryPayment_expenseId_key" ON "SalaryPayment"("expenseId");

-- CreateIndex
CREATE INDEX "SalaryPayment_periodYear_periodMonth_idx" ON "SalaryPayment"("periodYear", "periodMonth");

-- CreateIndex
CREATE INDEX "SalaryPayment_status_idx" ON "SalaryPayment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SalaryPayment_employeeId_periodYear_periodMonth_key" ON "SalaryPayment"("employeeId", "periodYear", "periodMonth");
