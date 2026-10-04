import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { demoEnabled } from "@/lib/demo";
export const runtime = "nodejs";
export async function GET() {
  if (!demoEnabled() || !process.env.PHONE_TEST_HOST)
    return new NextResponse(null, { status: 404 });
  try {
    return new NextResponse(
      new Uint8Array(
        await readFile(path.join(process.cwd(), ".phone-test", "ca.cer")),
      ),
      {
        headers: {
          "Content-Type": "application/x-x509-ca-cert",
          "Content-Disposition": 'attachment; filename="wedding-wifi-test.cer"',
          "Cache-Control": "no-store",
        },
      },
    );
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
