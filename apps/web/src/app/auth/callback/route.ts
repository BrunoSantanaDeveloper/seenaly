import { NextResponse } from "next/server";

import { DEFAULTS } from "@/config";
import { resolvePostAuthDestination } from "@/lib/onboarding";
import { createClient } from "@flyee/auth/server";

/**
 * OAuth and email-link callback: exchanges the auth code for a session and
 * redirects. An explicit `next` (a page the user was bounced from) wins;
 * otherwise onboarding decides between the setup flow and the app root.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const requestedNext = searchParams.get("next");

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // An explicit next (a page the user was bounced from, or the reset-password
      // link) always wins and skips the setup check below.
      if (requestedNext) {
        return NextResponse.redirect(`${origin}${requestedNext}`);
      }
      if (data.user) {
        // OAuth is sign-in AND sign-up: a first-time Google/GitHub user is
        // provisioned here but never filled the sign-up form, so they have no
        // organization (the handle_new_user trigger only creates one when the
        // signup metadata carries a company). Send them to complete setup.
        const { data: membership } = await supabase
          .from("memberships")
          .select("org_id")
          .eq("user_id", data.user.id)
          .limit(1)
          .maybeSingle();
        if (!membership) {
          return NextResponse.redirect(`${origin}/auth/complete-profile`);
        }
        const next = await resolvePostAuthDestination(supabase, data.user.id);
        return NextResponse.redirect(`${origin}${next}`);
      }
      return NextResponse.redirect(`${origin}${DEFAULTS.appRoot}`);
    }
  }

  return NextResponse.redirect(`${origin}/auth/sign-in?error=auth_callback_failed`);
}
