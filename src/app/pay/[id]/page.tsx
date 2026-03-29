import { notFound } from "next/navigation";
import { getPublicLinkState } from "@/app/lib/server-data";
import PayClient from "./PayClient";

export default async function PayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const state = await getPublicLinkState(id);
    return <PayClient initialState={state} />;
  } catch {
    notFound();
  }
}
