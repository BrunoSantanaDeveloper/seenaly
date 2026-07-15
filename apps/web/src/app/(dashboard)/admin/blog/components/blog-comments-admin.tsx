"use client";

import { useCallback, useEffect, useState } from "react";

import { Alert, Box, Button, Chip, Tab, Tabs, Typography } from "@mui/material";

import { RowLine, RowText } from "@/app/(dashboard)/admin/billing/components/catalog-shared";
import EmptyState from "@/components/product/empty-state";
import NiMessages from "@/icons/nexture/ni-messages";
import { recordAudit } from "@/lib/audit";
import { createClient } from "@flyee/auth/client";

type CommentRow = {
  id: string;
  postTitle: string;
  authorName: string | null;
  body: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
};

const STATUSES = ["pending", "approved", "rejected"] as const;

/**
 * Comment moderation queue: pending comments wait here; approving one
 * makes it public on the post instantly.
 */
export default function BlogCommentsAdmin() {
  const [rows, setRows] = useState<CommentRow[]>([]);
  const [statusTab, setStatusTab] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const status = STATUSES[statusTab];

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const { data, error: readError } = await supabase
      .from("blog_comments")
      .select("id, author_name, body, status, created_at, blog_posts(title)")
      .eq("status", status)
      .order("created_at", { ascending: false })
      .limit(200);
    if (readError) {
      setError(readError.message);
      setLoaded(true);
      return;
    }
    setRows(
      (data ?? []).map((row) => ({
        id: row.id,
        postTitle: (row.blog_posts as unknown as { title: string } | null)?.title ?? "?",
        authorName: row.author_name,
        body: row.body,
        status: row.status,
        createdAt: row.created_at,
      })),
    );
    setLoaded(true);
  }, [status]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const moderate = async (id: string, nextStatus: "approved" | "rejected") => {
    setError(null);
    const supabase = createClient();
    const { error: updateError } = await supabase.from("blog_comments").update({ status: nextStatus }).eq("id", id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    recordAudit(supabase, `admin.blog.comment.${nextStatus}`, { entityType: "blog_comment", entityId: id });
    refresh();
  };

  return (
    <Box className="flex flex-col gap-3">
      <Tabs value={statusTab} onChange={(_, value) => setStatusTab(value)}>
        <Tab label="Pending" />
        <Tab label="Approved" />
        <Tab label="Rejected" />
      </Tabs>

      {error && (
        <Alert severity="error" className="neutral bg-background-paper/60!">
          {error}
        </Alert>
      )}

      {loaded && rows.length === 0 && (
        <EmptyState
          icon={<NiMessages size="medium" />}
          title={status === "pending" ? "Nothing waiting for review" : `No ${status} comments`}
          description={
            status === "pending"
              ? "New comments land here before going public — an empty queue means you're up to date."
              : "Comments you moderate show up under their status."
          }
        />
      )}

      {rows.map((row) => (
        <RowLine key={row.id}>
          <RowText
            primary={row.body}
            secondary={`${row.authorName ?? "—"} · on "${row.postTitle}" · ${new Date(row.createdAt).toLocaleString()}`}
          />
          <Chip label={row.status} size="small" variant="outlined" className="capitalize" />
          {row.status !== "approved" && (
            <Button size="small" variant="text" color="success" onClick={() => moderate(row.id, "approved")}>
              Approve
            </Button>
          )}
          {row.status !== "rejected" && (
            <Button size="small" variant="text" color="error" onClick={() => moderate(row.id, "rejected")}>
              Reject
            </Button>
          )}
        </RowLine>
      ))}
      {rows.length > 0 && (
        <Typography variant="body2" className="text-text-secondary">
          Approving makes a comment public on the post immediately.
        </Typography>
      )}
    </Box>
  );
}
