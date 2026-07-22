"use client";

import { useTranslations } from "next-intl";

import {
  Box,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Divider,
  FormControlLabel,
  MenuItem,
  TextField,
  Typography,
} from "@mui/material";

import NiChartFunnel from "@/icons/nexture/ni-chart-funnel";
import NiCreditCard from "@/icons/nexture/ni-credit-card";
import NiPulse from "@/icons/nexture/ni-pulse";
import NiScreen from "@/icons/nexture/ni-screen";
import NiSearch from "@/icons/nexture/ni-search";
import {
  CHECKOUT_TYPES,
  type CheckoutType,
  READINESS_GROUPS,
  type ReadinessEvaluation,
  type ReadinessGroup,
  type ReadinessGroupKey,
  type ReadinessProfile,
} from "@/lib/readiness/checklist";

const GROUP_ICON: Record<ReadinessGroupKey, React.ReactNode> = {
  mensuracao: <NiPulse size="medium" />,
  pagina: <NiScreen size="medium" />,
  checkout: <NiCreditCard size="medium" />,
  descoberta: <NiSearch size="medium" />,
  funil: <NiChartFunnel size="medium" />,
};

/**
 * The readiness intake — the user marks ONLY what they can confirm.
 *
 * Deliberately not a form of text fields: the user knows facts about their own
 * setup, so the fastest honest capture is a tick list. An unticked box is never
 * reported back as "you don't have it" — it may simply be unknown, and not
 * knowing whether the pixel fires is itself the finding.
 *
 * Two rendering modes, same controls (DRY across the two page modes):
 *  - default: a titled Card walking every group (the "sections"/edit view);
 *  - `bare` + `groupKeys`: just the controls for the given groups, no Card and
 *    no group header — for a `SetupWizard` step, which already supplies the
 *    title and the "why" as its hint (mirrors how product-form renders fields
 *    directly inside the wizard).
 */
export default function ReadinessChecklist({
  profile,
  evaluation,
  onChange,
  disabled,
  groupKeys,
  bare = false,
}: {
  profile: ReadinessProfile;
  evaluation: ReadinessEvaluation;
  onChange: (next: ReadinessProfile) => void;
  disabled?: boolean;
  /** Render only these groups (defaults to all). */
  groupKeys?: ReadinessGroupKey[];
  /** Drop the outer Card + intro + per-group header (for a wizard step). */
  bare?: boolean;
}) {
  const t = useTranslations("readiness");

  const set = <K extends keyof ReadinessProfile>(key: K, value: ReadinessProfile[K]) =>
    onChange({ ...profile, [key]: value });

  const groups = groupKeys ? READINESS_GROUPS.filter((group) => groupKeys.includes(group.key)) : READINESS_GROUPS;

  const items = (group: ReadinessGroup) => (
    <Box className="flex flex-col pl-1">
      {group.items.map((item) => (
        <FormControlLabel
          key={item.key}
          control={
            <Checkbox
              checked={profile[item.key]}
              disabled={disabled}
              onChange={(event) => set(item.key, event.target.checked)}
            />
          }
          label={
            <Typography variant="body2" component="span">
              {t(`item-${item.key}`)}
            </Typography>
          }
        />
      ))}

      {/* Where the money is actually taken — a select, because "none" is a real
          and blocking answer, not an unchecked box. */}
      {group.key === "checkout" && (
        <Box className="mt-2 flex flex-row flex-wrap gap-3">
          <TextField
            select
            size="small"
            label={t("checkout-type")}
            value={profile.checkoutType ?? ""}
            disabled={disabled}
            onChange={(event) => set("checkoutType", (event.target.value || null) as CheckoutType | null)}
            className="min-w-56"
          >
            <MenuItem value="">{t("checkout-type-unset")}</MenuItem>
            {CHECKOUT_TYPES.map((value) => (
              <MenuItem key={value} value={value}>
                {t(`checkout-type-${value}`)}
              </MenuItem>
            ))}
          </TextField>

          {profile.hasGuarantee && (
            <TextField
              type="number"
              size="small"
              label={t("guarantee-days")}
              value={profile.guaranteeDays ?? ""}
              disabled={disabled}
              onChange={(event) => set("guaranteeDays", event.target.value === "" ? null : Number(event.target.value))}
              slotProps={{ htmlInput: { min: 1, max: 365 } }}
              className="w-40"
            />
          )}
        </Box>
      )}
    </Box>
  );

  // Bare: only the controls (the wizard step owns the title + why + progress).
  if (bare) {
    return (
      <Box className="flex flex-col gap-4">
        {groups.map((group) => (
          <Box key={group.key}>{items(group)}</Box>
        ))}
      </Box>
    );
  }

  const groupBlock = (group: ReadinessGroup) => {
    const progress = evaluation.byGroup.find((entry) => entry.key === group.key);
    return (
      <Box key={group.key} className="flex flex-col gap-2">
        <Divider />
        <Box className="flex flex-row items-center gap-3">
          <span className="bg-primary/10 text-primary flex h-9 w-9 flex-none items-center justify-center rounded-2xl">
            {GROUP_ICON[group.key]}
          </span>
          <Box className="grow">
            <Typography variant="subtitle1" component="h3" className="mb-0">
              {t(`group-${group.key}`)}
            </Typography>
            <Typography variant="body2" className="text-text-secondary">
              {t(`group-why-${group.key}`)}
            </Typography>
          </Box>
          {progress && (
            <Chip
              label={t("group-progress", { confirmed: progress.confirmed, total: progress.total })}
              size="small"
              variant="outlined"
              color={progress.confirmed === progress.total ? "success" : "grey"}
              className="flex-none"
            />
          )}
        </Box>
        {items(group)}
      </Box>
    );
  };

  return (
    <Card component="section">
      <CardContent className="flex flex-col gap-5">
        <Box className="flex flex-col gap-1">
          <Typography variant="h5" component="h2" className="card-title mb-0">
            {t("checklist-title")}
          </Typography>
          <Typography variant="body2" className="text-text-secondary">
            {t("checklist-body")}
          </Typography>
        </Box>
        {groups.map(groupBlock)}
      </CardContent>
    </Card>
  );
}
