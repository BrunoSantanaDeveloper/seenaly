"use client";

import { createInvite } from "../actions";
import { OrgInvite, OrgRole, OrgSummary } from "./use-organization";
import { useState } from "react";

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  FormControl,
  FormLabel,
  Grid,
  Input,
  MenuItem,
  Select,
  Tooltip,
  Typography,
} from "@mui/material";

import NiBinEmpty from "@/icons/nexture/ni-bin-empty";
import NiChevronDownSmall from "@/icons/nexture/ni-chevron-down-small";
import NiLink from "@/icons/nexture/ni-link";
import { recordAudit } from "@/lib/audit";
import { createClient } from "@flyee/auth/client";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Props = {
  org: OrgSummary;
  invites: OrgInvite[];
  onChanged: () => void;
};

export default function OrgInvites({ org, invites, onChanged }: Props) {
  const [email, setEmail] = useState("");
  // Invites never grant ownership; owners are only made via role change.
  const [role, setRole] = useState<Exclude<OrgRole, "owner">>("member");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const canManage = org.role === "owner" || org.role === "admin";
  if (!canManage) return null;

  const handleInvite = async () => {
    setError(null);
    setInfo(null);
    if (!EMAIL_PATTERN.test(email)) {
      setError("Enter a valid email.");
      return;
    }
    setSending(true);
    const result = await createInvite({ orgId: org.id, email, role });
    setSending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setEmail("");
    setInfo(
      result.emailSent
        ? "Invite email sent. The link below can also be shared directly."
        : "Invite created. Email delivery is not configured (RESEND_API_KEY) — copy the link below and share it.",
    );
    onChanged();
  };

  const handleCopyLink = async (invite: OrgInvite) => {
    await navigator.clipboard.writeText(`${window.location.origin}/invite/${invite.token}`);
    setInfo(`Invite link for ${invite.email} copied to the clipboard.`);
  };

  const handleRevoke = async (invite: OrgInvite) => {
    setError(null);
    const supabase = createClient();
    const { error: deleteError } = await supabase.from("invites").delete().eq("id", invite.id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    recordAudit(supabase, "org.invite.revoked", {
      orgId: org.id,
      entityType: "invite",
      entityId: invite.id,
      metadata: { email: invite.email },
    });
    onChanged();
  };

  return (
    <Grid size={12}>
      <Card component="section">
        <CardContent>
          <Typography variant="h5" component="h5" className="card-title">
            Invites
          </Typography>

          <Box className="flex flex-col">
            <Box className="flex flex-col gap-2 md:flex-row md:items-end">
              <FormControl className="outlined grow" variant="standard" size="small">
                <FormLabel component="label">Email</FormLabel>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="person@company.com" />
              </FormControl>
              <FormControl className="outlined w-40" variant="standard" size="small">
                <FormLabel component="label">Role</FormLabel>
                <Select
                  value={role}
                  size="small"
                  variant="standard"
                  IconComponent={NiChevronDownSmall}
                  onChange={(e) => setRole(e.target.value as Exclude<OrgRole, "owner">)}
                >
                  <MenuItem value="member">member</MenuItem>
                  <MenuItem value="admin">admin</MenuItem>
                </Select>
              </FormControl>
              <Button variant="outlined" size="medium" color="grey" onClick={handleInvite} disabled={sending}>
                Send invite
              </Button>
            </Box>

            {error && (
              <Alert severity="error" className="neutral bg-background-paper/60! my-4">
                {error}
              </Alert>
            )}
            {info && (
              <Alert severity="success" className="neutral bg-background-paper/60! my-4">
                {info}
              </Alert>
            )}

            {invites.length > 0 && (
              <Box className="mt-6 flex flex-col gap-4">
                {invites.map((invite) => (
                  <Box key={invite.id} className="flex flex-row items-center gap-3">
                    <Box className="flex min-w-0 grow flex-col">
                      <Typography variant="subtitle2" className="truncate">
                        {invite.email}
                      </Typography>
                      <Typography variant="body2" className="text-text-secondary">
                        Expires {new Date(invite.expiresAt).toLocaleDateString()}
                      </Typography>
                    </Box>
                    <Chip label={invite.role} size="small" variant="outlined" className="capitalize" />
                    <Tooltip title="Copy invite link">
                      <Button
                        className="icon-only"
                        size="small"
                        color="grey"
                        variant="text"
                        onClick={() => handleCopyLink(invite)}
                      >
                        <NiLink size="medium" />
                      </Button>
                    </Tooltip>
                    <Tooltip title="Revoke invite">
                      <Button
                        className="icon-only"
                        size="small"
                        color="error"
                        variant="text"
                        onClick={() => handleRevoke(invite)}
                      >
                        <NiBinEmpty size="medium" />
                      </Button>
                    </Tooltip>
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        </CardContent>
      </Card>
    </Grid>
  );
}
