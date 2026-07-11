"use client";

import BlogCommentsAdmin from "./components/blog-comments-admin";
import BlogPostsAdmin from "./components/blog-posts-admin";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Alert, Box, Breadcrumbs, Card, CardContent, Grid, Tab, Tabs, Typography } from "@mui/material";

import { isSupabaseConfigured } from "@flyee/auth";
import { createClient } from "@flyee/auth/client";

/**
 * Superadmin blog console: posts go live at /blog on publish; comments
 * wait in the moderation queue. RLS is the real gate; the client-side
 * check only improves UX.
 */
export default function AdminBlog() {
  const [tab, setTab] = useState(0);
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
          Blog
        </Typography>
        <Breadcrumbs>
          <Link color="inherit" href="/dashboards/default">
            Home
          </Link>
          <Typography variant="body2">Admin</Typography>
          <Typography variant="body2">Blog</Typography>
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
              <Tabs value={tab} onChange={(_, value) => setTab(value)} className="mb-6">
                <Tab label="Posts" />
                <Tab label="Comments" />
              </Tabs>
              <Box hidden={tab !== 0}>{tab === 0 && <BlogPostsAdmin />}</Box>
              <Box hidden={tab !== 1}>{tab === 1 && <BlogCommentsAdmin />}</Box>
            </CardContent>
          </Card>
        </Grid>
      )}
    </Grid>
  );
}
