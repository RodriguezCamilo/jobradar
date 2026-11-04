import { NextRequest, NextResponse } from "next/server";
import { assertLocalRequest } from "./lib/security";
export function proxy(request: NextRequest) {
  return assertLocalRequest(request) ?? NextResponse.next();
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
