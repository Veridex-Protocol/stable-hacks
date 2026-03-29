import { notFound } from "next/navigation";
import { getPublicLinkState } from "@/app/lib/server-data";
import ClaimClient from "./ClaimClient";

export default async function ClaimPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const state = await getPublicLinkState(id);
    return <ClaimClient initialState={state} />;
  } catch {
    notFound();
  }
}
