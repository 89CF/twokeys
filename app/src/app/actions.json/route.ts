import { actionJson, actionOptions } from "@/lib/server/actions";

export const dynamic = "force-static";

/** Solana Actions discovery: maps shareable deal pages (/d/<deal>) to the reserve Action API. */
export function GET() {
  return actionJson({
    rules: [
      { pathPattern: "/d/*", apiPath: "/api/actions/reserve/*" },
      { pathPattern: "/api/actions/**", apiPath: "/api/actions/**" },
    ],
  });
}

export const OPTIONS = actionOptions;
