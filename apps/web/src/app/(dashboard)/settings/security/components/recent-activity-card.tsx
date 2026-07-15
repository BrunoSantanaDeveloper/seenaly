"use client";

import { useEffect, useState } from "react";

import { Box, Card, CardContent, Chip, Grid, Typography } from "@mui/material";

import { describeAgent } from "@/app/(dashboard)/admin/audit/components/access-events-admin";
import { createClient } from "@flyee/auth/client";

type AccessRow = {
  id: string;
  ip: string | null;
  userAgent: string | null;
  aal: string | null;
  createdAt: string;
};

/**
 * The user's own sign-in history (RLS: own rows only). The job here is
 * reassurance — "was that me?": glance over recent sessions and spot a
 * device or place that doesn't belong.
 */
export default function RecentActivityCard() {
  const [rows, setRows] = useState<AccessRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("access_events")
        .select("id, ip, user_agent, aal, created_at")
        .order("created_at", { ascending: false })
        .limit(20);
      if (cancelled) return;
      setRows(
        (data ?? []).map((row) => ({
          id: row.id,
          ip: row.ip,
          userAgent: row.user_agent,
          aal: row.aal,
          createdAt: row.created_at,
        })),
      );
      setLoaded(true);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Grid size={12}>
      <Card component="section">
        <CardContent className="flex flex-col gap-4">
          <Typography variant="h5" component="h2" className="card-title">
            Recent activity
          </Typography>
          <Typography variant="body1" className="text-text-secondary">
            Sign-ins to your account. If you see a device or location you don&apos;t recognize, change your password and
            enable two-factor authentication.
          </Typography>

          {loaded && rows.length === 0 && (
            <Typography variant="body2" className="text-text-secondary">
              No sign-ins recorded yet — this history starts filling from your next sign-in.
            </Typography>
          )}

          {rows.map((row) => (
            <Box key={row.id} className="flex flex-row items-center gap-2">
              <Box className="flex-1">
                <Typography variant="body1">
                  {describeAgent(row.userAgent) ?? "Unknown device"}
                  {row.ip ? ` · ${row.ip}` : ""}
                </Typography>
                <Typography variant="body2" className="text-text-secondary">
                  {new Date(row.createdAt).toLocaleString()}
                </Typography>
              </Box>
              <Chip
                label={row.aal === "aal2" ? "2FA" : "password"}
                size="small"
                color={row.aal === "aal2" ? "success" : "default"}
                variant="outlined"
              />
            </Box>
          ))}
        </CardContent>
      </Card>
    </Grid>
  );
}
