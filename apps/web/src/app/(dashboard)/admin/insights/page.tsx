"use client";

import InsightsChat from "./components/insights-chat";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Alert, Breadcrumbs, Card, CardContent, Grid, Typography } from "@mui/material";

import { isSupabaseConfigured } from "@flyee/auth";
import { createClient } from "@flyee/auth/client";

/**
 * Superadmin data-insights console. The API route re-checks is_superadmin
 * server-side before touching the database — this client check only decides
 * what to render.
 */
export default function AdminInsights() {
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
          Data Insights
        </Typography>
        <Breadcrumbs>
          <Link color="inherit" href="/dashboards/default">
            Home
          </Link>
          <Typography variant="body2">Admin</Typography>
          <Typography variant="body2">Insights</Typography>
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
              <InsightsChat />
            </CardContent>
          </Card>
        </Grid>
      )}
    </Grid>
  );
}
