"use client";
import { DECISION_DRAFT_STATUS_CONFIRMED } from "@/types";
import { DecisionListView } from "../decision_draft/_components/decision_list_view";

// «Захирамж» → «Шийдвэр»: Баталгаажсан төлөвтэй захирамжууд.
export default function DecisionListPage() {
  return (
    <DecisionListView
      status={DECISION_DRAFT_STATUS_CONFIRMED}
      title="Шийдвэр"
      subtitle="Баталгаажсан захирамжууд"
      allowCreate={false}
      detailBase="/decision"
    />
  );
}
