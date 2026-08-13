"use client";
import { Hammer } from "lucide-react";
import { decisionWorkTypeApi } from "@/lib/api";
import { DecisionOptionPage } from "@/components/dashboard/decision-option-page";

export default function DecisionWorkTypePage() {
  return (
    <DecisionOptionPage
      title="Ажлын төрөл"
      subtitle="Захирамжийн төсөл дээрх ажлын төрлийн сонголт"
      queryKey="decision-work-types"
      api={decisionWorkTypeApi}
      icon={Hammer}
      codeExample="road"
    />
  );
}
