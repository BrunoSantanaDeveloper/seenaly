"use client";

import AssistsAdmin from "./components/assists-admin";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Alert, Breadcrumbs, Card, CardContent, Grid, Typography } from "@mui/material";

import { isSupabaseConfigured } from "@flyee/auth";
import { createClient } from "@flyee/auth/client";

/**
 * Superadmin console for the concierge queue. RLS + the server actions'
 * superadmin check are the real gate; this check only decides whether to
 * render the console or the notice.
 */
export default function AdminAssists() {
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    const check = async () => {
      if (!isSupabaseConfigured) {
        setAllowed(false);
        return;
      }
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setAllowed(false);
        return;
      }
      const { data } = await supabase.from("profiles").select("is_superadmin").eq("id", user.id).maybeSingle();
      setAllowed(Boolean(data?.is_superadmin));
    };
    check();
  }, []);

  return (
    <Grid container spacing={5}>
      <Grid size={12}>
        <Typography variant="h1" component="h1" className="mb-0">
          Guided sessions
        </Typography>
        <Breadcrumbs>
          <Link color="inherit" href="/home">
            Home
          </Link>
          <Typography variant="body2">Admin</Typography>
          <Typography variant="body2">Guided sessions</Typography>
        </Breadcrumbs>
      </Grid>

      {allowed === false && (
        <Grid size={12}>
          <Alert severity="error" className="neutral bg-background-paper/60!">
            This area is restricted to platform superadmins.
          </Alert>
        </Grid>
      )}

      {allowed && (
        <Grid size={12}>
          <Card component="section">
            <CardContent>
              <AssistsAdmin />
            </CardContent>
          </Card>
        </Grid>
      )}
    </Grid>
  );
}
