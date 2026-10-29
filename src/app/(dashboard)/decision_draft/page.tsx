"use client";
import { DECISION_DRAFT_STATUS_DRAFT } from "@/types";
import { DecisionListView } from "./_components/decision_list_view";

// «Захирамж» → «Захирамжийн төсөл»: Төсөл төлөвтэй захирамжийн төслүүд.
export default function DecisionDraftListPage() {
  return (
    <DecisionListView
      status={DECISION_DRAFT_STATUS_DRAFT}
      title="Захирамжийн төсөл"
      subtitle="Саналын хуудаснаас захирамж болтол явагдах бүртгэл — Төсөл төлөвтэй"
      allowCreate
      detailBase="/decision_draft"
    />
  );
}
