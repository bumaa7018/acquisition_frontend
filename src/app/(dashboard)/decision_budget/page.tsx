"use client";
import { Wallet } from "lucide-react";
import { decisionBudgetApi } from "@/lib/api";
import { DecisionOptionPage } from "@/components/dashboard/decision-option-page";

export default function DecisionBudgetPage() {
  return (
    <DecisionOptionPage
      title="Төсөв"
      subtitle="Захирамжийн төсөл дээрх төсвийн сонголт"
      queryKey="decision-budgets"
      api={decisionBudgetApi}
      icon={Wallet}
      codeExample="state_budget"
    />
  );
}
