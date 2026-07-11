"use client";

import { useEffect, useRef, useState } from "react";

import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  FormControl,
  FormLabel,
  Grid,
  Input,
  Typography,
} from "@mui/material";

import { createClient } from "@flyee/auth/client";

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

/**
 * Real profile editing: display name + avatar. The avatar goes to the
 * public `avatars` bucket (migration 0013, per-user folder) and its URL
 * lands in profiles.avatar_url — the same fields the header menu shows.
 */
export default function ProfileCard() {
  const [userId, setUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<"saved" | "error" | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const { data } = await supabase
        .from("profiles")
        .select("display_name, avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      setDisplayName(data?.display_name ?? "");
      setAvatarUrl(data?.avatar_url ?? null);
    };
    load();
  }, []);

  const uploadAvatar = async (file: File) => {
    if (!userId) return;
    setStatus(null);
    setErrorMessage(null);
    if (file.size > MAX_AVATAR_BYTES) {
      setStatus("error");
      setErrorMessage("Image must be smaller than 2 MB.");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "png";
    // Timestamped path inside the user's folder: cache-safe, RLS-scoped.
    const path = `${userId}/avatar-${Date.now()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file);
    if (uploadError) {
      setStatus("error");
      setErrorMessage(uploadError.message);
      setSaving(false);
      return;
    }
    const {
      data: { publicUrl },
    } = supabase.storage.from("avatars").getPublicUrl(path);
    const { error: updateError } = await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("id", userId);
    if (updateError) {
      setStatus("error");
      setErrorMessage(updateError.message);
    } else {
      setAvatarUrl(publicUrl);
      setStatus("saved");
    }
    setSaving(false);
  };

  const saveName = async () => {
    if (!userId) return;
    setStatus(null);
    setErrorMessage(null);
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName.trim() || null })
      .eq("id", userId);
    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
    } else {
      setStatus("saved");
    }
    setSaving(false);
  };

  return (
    <Grid size={12}>
      <Card component="section">
        <CardContent>
          <Typography variant="h5" component="h2" className="card-title">
            Profile
          </Typography>

          {status === "saved" && (
            <Alert severity="success" className="neutral bg-background-paper/60! mb-4">
              Profile updated.
            </Alert>
          )}
          {status === "error" && (
            <Alert severity="error" className="neutral bg-background-paper/60! mb-4">
              {errorMessage ?? "Could not update the profile."}
            </Alert>
          )}

          <Box className="mb-6 flex flex-row items-center gap-4">
            <Avatar src={avatarUrl ?? undefined} alt="avatar" className="h-16! w-16!" />
            <Box className="flex flex-col gap-1">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) uploadAvatar(file);
                  event.target.value = "";
                }}
              />
              <Button
                variant="outlined"
                size="small"
                disabled={saving || !userId}
                onClick={() => fileInputRef.current?.click()}
              >
                Change photo
              </Button>
              <Typography variant="body2" className="text-text-secondary">
                PNG, JPG or WEBP, up to 2 MB.
              </Typography>
            </Box>
          </Box>

          <FormControl className="outlined mb-4 max-w-md" variant="standard" size="small" fullWidth>
            <FormLabel component="label">Display name</FormLabel>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </FormControl>

          <Box>
            <Button variant="contained" size="small" onClick={saveName} disabled={saving || !userId}>
              Save profile
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Grid>
  );
}
