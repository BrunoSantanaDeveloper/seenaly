"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { Alert, Avatar, Box, Button, Chip, FormControl, Input, Typography } from "@mui/material";

import { isSupabaseConfigured } from "@flyee/auth";
import { createClient } from "@flyee/auth/client";

type CommentRow = {
  id: string;
  authorName: string | null;
  body: string;
  status: string;
  createdAt: string;
};

/**
 * Moderated comment thread under a blog post. RLS shows approved comments
 * to everyone plus the reader's own pending ones; new comments are always
 * created pending and go live from /admin/blog.
 */
export default function BlogComments({ postId }: { postId: string }) {
  const t = useTranslations("marketing");
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [signedIn, setSignedIn] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    const supabase = createClient();
    const [{ data: rows }, { data: auth }] = await Promise.all([
      supabase
        .from("blog_comments")
        .select("id, author_name, body, status, created_at")
        .eq("post_id", postId)
        .order("created_at"),
      supabase.auth.getUser(),
    ]);
    setComments(
      (rows ?? []).map((row) => ({
        id: row.id,
        authorName: row.author_name,
        body: row.body,
        status: row.status,
        createdAt: row.created_at,
      })),
    );
    setSignedIn(Boolean(auth.user));
    setUserId(auth.user?.id ?? null);
  }, [postId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const submit = async () => {
    const text = body.trim();
    if (!text || !userId) return;
    setError(null);
    const supabase = createClient();
    const { error: insertError } = await supabase
      .from("blog_comments")
      .insert({ post_id: postId, user_id: userId, body: text });
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setBody("");
    setSubmitted(true);
    refresh();
  };

  if (!isSupabaseConfigured) return null;

  return (
    <div className="mx-auto flex w-full max-w-prose flex-col gap-5">
      <h2 className="font-display text-text-primary text-xl font-bold">{t("blog-comments-title")}</h2>

      {comments.length === 0 && <p className="text-text-secondary text-base">{t("blog-comments-empty")}</p>}

      {comments.map((comment) => (
        <Box key={comment.id} className="flex flex-row items-start gap-3">
          <Avatar className="medium">{(comment.authorName ?? "?").charAt(0).toUpperCase()}</Avatar>
          <Box className="flex min-w-0 flex-col gap-1">
            <Box className="flex flex-row items-center gap-2">
              <Typography variant="subtitle2">{comment.authorName ?? "—"}</Typography>
              <Typography variant="body2" className="text-text-secondary">
                {new Date(comment.createdAt).toLocaleDateString()}
              </Typography>
              {comment.status === "pending" && (
                <Chip label={t("blog-comment-pending-badge")} size="small" color="warning" variant="outlined" />
              )}
            </Box>
            <Typography variant="body1" className="text-text-secondary leading-6">
              {comment.body}
            </Typography>
          </Box>
        </Box>
      ))}

      {submitted && (
        <Alert severity="success" className="neutral bg-background-paper/60!">
          {t("blog-comment-pending")}
        </Alert>
      )}
      {error && (
        <Alert severity="error" className="neutral bg-background-paper/60!">
          {error}
        </Alert>
      )}

      {signedIn ? (
        <Box className="flex flex-col gap-3">
          <FormControl className="outlined" variant="standard" size="small" fullWidth>
            <Input
              multiline
              minRows={3}
              placeholder={t("blog-comment-placeholder")}
              value={body}
              onChange={(event) => setBody(event.target.value)}
            />
          </FormControl>
          <Box>
            <Button variant="contained" size="small" onClick={submit} disabled={!body.trim()}>
              {t("blog-comment-submit")}
            </Button>
          </Box>
        </Box>
      ) : (
        <Box>
          <Button variant="outlined" size="small" component={Link} href="/auth/sign-in">
            {t("blog-comments-signin")}
          </Button>
        </Box>
      )}
    </div>
  );
}
