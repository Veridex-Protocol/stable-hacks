import { NextResponse } from "next/server";
import { getServerRuntime } from "@/server/runtime";

export async function GET() {
  const { marketData } = getServerRuntime();

  if (!marketData.isAvailable()) {
    return NextResponse.json(
      { data: [], note: "SIX Market Data not configured — mTLS certificates missing." },
      { status: 200 },
    );
  }

  try {
    const rates = await marketData.getAllForexRates();
    return NextResponse.json({ data: rates });
  } catch (error) {
    return NextResponse.json(
      { data: [], error: error instanceof Error ? error.message : "Failed to fetch forex rates." },
      { status: 502 },
    );
  }
}
