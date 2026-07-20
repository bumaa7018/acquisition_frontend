import { redirect } from "next/navigation";

export default function DronePage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const acq = searchParams?.acq;
  const query = typeof acq === "string" ? `?acq=${encodeURIComponent(acq)}` : "";
  redirect(`/drone/images${query}`);
}
