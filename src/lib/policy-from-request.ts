import { NextRequest } from "next/server";
import { POLICY_COOKIE } from "@/lib/adaptive-policy";
import { parsePolicyCookie } from "@/lib/policy-store";
import type { AdaptivePolicy } from "@/lib/adaptive-policy";

export function policyFromRequest(req: NextRequest): AdaptivePolicy {
  return parsePolicyCookie(req.cookies.get(POLICY_COOKIE)?.value);
}
