"use client";

import { OrgSummary } from "./use-organization";
import { useEffect, useState } from "react";

import { Alert, Box, Button, Card, CardContent, FormControl, FormLabel, Grid, Input, Typography } from "@mui/material";

import { recordAudit } from "@/lib/audit";
import { createClient } from "@flyee/auth/client";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

type Props = {
  org: OrgSummary;
  onUpdated: () => void;
};

export default function OrgGeneral({ org, onUpdated }: Props) {
  const canManage = org.role === "owner" || org.role === "admin";
  const [name, setName] = useState(org.name);
  const [slug, setSlug] = useState(org.slug);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(org.name);
    setSlug(org.slug);
    setError(null);
    setSaved(false);
  }, [org.id, org.name, org.slug]);

  const handleSave = async () => {
    setError(null);
    setSaved(false);
    if (name.trim().length < 3) {
      setError("Name should be at least 3 characters.");
      return;
    }
    if (!SLUG_PATTERN.test(slug)) {
      setError("Slug must be lowercase letters, numbers and dashes (e.g. acme-inc).");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("organizations")
      .update({ name: name.trim(), slug })
      .eq("id", org.id);
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    recordAudit(supabase, "org.updated", {
      orgId: org.id,
      entityType: "organization",
      entityId: org.id,
      metadata: { name: name.trim(), slug },
    });
    setSaved(true);
    onUpdated();
  };

  return (
    <Grid size={12}>
      <Card component="section">
        <CardContent>
          <Typography variant="h5" component="h5" className="card-title">
            General
          </Typography>

          <Box className="flex flex-col">
            <FormControl className="outlined" variant="standard" size="small" fullWidth>
              <FormLabel component="label">Organization name</FormLabel>
              <Input value={name} onChange={(e) => setName(e.target.value)} disabled={!canManage} />
            </FormControl>

            <FormControl className="outlined" variant="standard" size="small" fullWidth>
              <FormLabel component="label">Slug</FormLabel>
              <Input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} disabled={!canManage} />
            </FormControl>

            {error && (
              <Alert severity="error" className="neutral bg-background-paper/60! mb-4">
                {error}
              </Alert>
            )}
            {saved && (
              <Alert severity="success" className="neutral bg-background-paper/60! mb-4">
                Organization updated.
              </Alert>
            )}

            {canManage && (
              <Box>
                <Button variant="outlined" size="medium" color="grey" onClick={handleSave} disabled={saving}>
                  Save changes
                </Button>
              </Box>
            )}
          </Box>
        </CardContent>
      </Card>
    </Grid>
  );
}
