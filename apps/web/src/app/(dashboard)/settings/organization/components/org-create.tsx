"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Alert, Box, Button, Card, CardContent, FormControl, FormLabel, Grid, Input, Typography } from "@mui/material";

import { createClient } from "@flyee/auth/client";

const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

type Props = {
  onCreated: () => void;
};

export default function OrgCreate({ onCreated }: Props) {
  const t = useTranslations("settings");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    setError(null);
    if (name.trim().length < 3) {
      setError(t("org-error-name"));
      return;
    }
    setCreating(true);
    const supabase = createClient();
    // Random suffix keeps the generated slug unique; it stays editable in General.
    const slug = `${slugify(name)}-${Math.random().toString(36).slice(2, 8)}`;
    const { error: rpcError } = await supabase.rpc("create_organization", {
      org_name: name.trim(),
      org_slug: slug,
    });
    setCreating(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    setName("");
    onCreated();
  };

  return (
    <Grid size={12}>
      <Card component="section">
        <CardContent>
          <Typography variant="h5" component="h5" className="card-title">
            {t("org-new")}
          </Typography>

          <Box className="flex flex-col">
            <Box className="flex flex-col gap-2 md:flex-row md:items-end">
              <FormControl className="outlined grow" variant="standard" size="small">
                <FormLabel component="label">{t("org-name")}</FormLabel>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Inc." />
              </FormControl>
              <Button variant="outlined" size="medium" color="grey" onClick={handleCreate} disabled={creating}>
                {t("org-create")}
              </Button>
            </Box>

            {error && (
              <Alert severity="error" className="neutral bg-background-paper/60! mt-4">
                {error}
              </Alert>
            )}
          </Box>
        </CardContent>
      </Card>
    </Grid>
  );
}
