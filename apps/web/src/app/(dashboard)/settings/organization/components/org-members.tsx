"use client";

import { OrgMember, OrgRole, OrgSummary } from "./use-organization";
import { useState } from "react";

import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  MenuItem,
  Select,
  Tooltip,
  Typography,
} from "@mui/material";

import NiBinEmpty from "@/icons/nexture/ni-bin-empty";
import NiChevronDownSmall from "@/icons/nexture/ni-chevron-down-small";
import { recordAudit } from "@/lib/audit";
import { createClient } from "@flyee/auth/client";

const ROLES: OrgRole[] = ["owner", "admin", "member"];

type Props = {
  org: OrgSummary;
  members: OrgMember[];
  currentUserId: string | null;
  onChanged: () => void;
};

export default function OrgMembers({ org, members, currentUserId, onChanged }: Props) {
  const canManage = org.role === "owner" || org.role === "admin";
  const ownerCount = members.filter((member) => member.role === "owner").length;
  const [error, setError] = useState<string | null>(null);

  const isLastOwner = (member: OrgMember) => member.role === "owner" && ownerCount <= 1;

  const handleRoleChange = async (member: OrgMember, role: OrgRole) => {
    setError(null);
    const supabase = createClient();
    const { error: updateError } = await supabase.from("memberships").update({ role }).eq("id", member.membershipId);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    recordAudit(supabase, "org.member.role_changed", {
      orgId: org.id,
      entityType: "membership",
      entityId: member.membershipId,
      metadata: { userId: member.userId, role },
    });
    onChanged();
  };

  const handleRemove = async (member: OrgMember) => {
    setError(null);
    const supabase = createClient();
    const { error: deleteError } = await supabase.from("memberships").delete().eq("id", member.membershipId);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    recordAudit(supabase, "org.member.removed", {
      orgId: org.id,
      entityType: "membership",
      entityId: member.membershipId,
      metadata: { userId: member.userId },
    });
    onChanged();
  };

  return (
    <Grid size={12}>
      <Card component="section">
        <CardContent>
          <Typography variant="h5" component="h5" className="card-title">
            Members
          </Typography>

          {error && (
            <Alert severity="error" className="neutral bg-background-paper/60! mb-4">
              {error}
            </Alert>
          )}

          <Box className="flex flex-col gap-4">
            {members.map((member) => {
              const isSelf = member.userId === currentUserId;
              // The last owner can neither be demoted nor removed; otherwise
              // the organization would be orphaned.
              const locked = isLastOwner(member);
              return (
                <Box key={member.membershipId} className="flex flex-row items-center gap-3">
                  <Avatar src={member.avatarUrl ?? undefined} alt={member.displayName ?? "Member"} />
                  <Box className="flex min-w-0 grow flex-col">
                    <Box className="flex flex-row items-center gap-2">
                      <Typography variant="subtitle2" className="truncate">
                        {member.displayName ?? "Unnamed user"}
                      </Typography>
                      {isSelf && <Chip label="You" size="small" variant="outlined" />}
                    </Box>
                    <Typography variant="body2" className="text-text-secondary">
                      Joined {new Date(member.createdAt).toLocaleDateString()}
                    </Typography>
                  </Box>

                  {canManage && !locked ? (
                    <Select
                      value={member.role}
                      size="small"
                      className="outlined w-32"
                      variant="standard"
                      IconComponent={NiChevronDownSmall}
                      onChange={(e) => handleRoleChange(member, e.target.value as OrgRole)}
                    >
                      {ROLES.map((role) => (
                        <MenuItem key={role} value={role}>
                          {role}
                        </MenuItem>
                      ))}
                    </Select>
                  ) : (
                    <Chip label={member.role} size="small" variant="outlined" className="capitalize" />
                  )}

                  {(canManage || isSelf) && !locked && (
                    <Tooltip title={isSelf ? "Leave organization" : "Remove member"}>
                      <Button
                        className="icon-only"
                        size="small"
                        color="error"
                        variant="text"
                        onClick={() => handleRemove(member)}
                      >
                        <NiBinEmpty size="medium" />
                      </Button>
                    </Tooltip>
                  )}
                </Box>
              );
            })}
          </Box>
        </CardContent>
      </Card>
    </Grid>
  );
}
