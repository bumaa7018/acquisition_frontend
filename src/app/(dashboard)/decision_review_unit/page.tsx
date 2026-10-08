"use client";
import { Building } from "lucide-react";
import { decisionReviewUnitApi } from "@/lib/api";
import { DecisionOptionPage } from "@/components/dashboard/decision-option-page";

export default function DecisionReviewUnitPage() {
  return (
    <DecisionOptionPage
      title="Төсөл хянах нэгж"
      subtitle="Захирамжийн төслийн «Хянагдаж буй» явцын «Хянагдаж буй газар» сонголт"
      queryKey="decision-review-units"
      api={decisionReviewUnitApi}
      icon={Building}
      codeExample="legal_department"
    />
  );
}
