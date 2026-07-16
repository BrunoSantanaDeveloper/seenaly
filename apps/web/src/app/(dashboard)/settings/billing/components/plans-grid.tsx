"use client";

import { startCheckout } from "../actions";
import { formatMoney, ModuleRow, PlanRow, SubscriptionInfo } from "./use-billing";
import { useTranslations } from "next-intl";
import { useState } from "react";

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  FormControl,
  FormControlLabel,
  FormLabel,
  Grid,
  Input,
  MenuItem,
  Select,
  Typography,
} from "@mui/material";

import NiChevronDownSmall from "@/icons/nexture/ni-chevron-down-small";
import type { BillingProviderName } from "@flyee/billing";

const PERIOD_LABEL: Record<string, string> = {
  weekly: "/week",
  monthly: "/month",
  yearly: "/year",
};

type Props = {
  orgId: string;
  subscription: SubscriptionInfo | null;
  plans: PlanRow[];
  modules: ModuleRow[];
  providers: BillingProviderName[];
  canManage: boolean;
};

export default function PlansGrid({ orgId, subscription, plans, modules, providers, canManage }: Props) {
  const t = useTranslations("billing");
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [couponCode, setCouponCode] = useState("");
  const [provider, setProvider] = useState<BillingProviderName>(providers[0] ?? "stripe");
  const [error, setError] = useState<string | null>(null);
  const [workingPlan, setWorkingPlan] = useState<string | null>(null);

  if (!canManage) return null;

  // No payment provider configured: checkout is unavailable by design (mock
  // billing phase) — say so persistently instead of erroring on click.
  const checkoutUnavailable = providers.length === 0;

  const toggleModule = (id: string) => {
    setSelectedModules((current) => (current.includes(id) ? current.filter((m) => m !== id) : [...current, id]));
  };

  const handleSubscribe = async (plan: PlanRow) => {
    setError(null);
    if (checkoutUnavailable) return;
    setWorkingPlan(plan.id);
    const result = await startCheckout({
      orgId,
      planId: plan.id,
      moduleIds: selectedModules,
      couponCode: couponCode || undefined,
      provider,
    });
    setWorkingPlan(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.url) window.location.href = result.url;
  };

  const paidPlans = plans.filter((plan) => !plan.isFree);
  if (paidPlans.length === 0) return null;

  return (
    <Grid size={12}>
      <Card component="section">
        <CardContent>
          <Typography variant="h5" component="h5" className="card-title">
            Plans
          </Typography>

          {checkoutUnavailable && (
            <Alert severity="info" className="neutral bg-background-paper/60! mb-4">
              {t("checkout-unavailable")}
            </Alert>
          )}

          {error && (
            <Alert severity="error" className="neutral bg-background-paper/60! mb-4">
              {error}
            </Alert>
          )}

          <Grid container spacing={2.5}>
            {paidPlans.map((plan) => {
              const isCurrent = subscription?.planId === plan.id;
              return (
                <Grid key={plan.id} size={{ xs: 12, md: 6, lg: 4 }}>
                  <Card variant="outlined" className="h-full">
                    <CardContent className="flex h-full flex-col gap-3">
                      <Box className="flex flex-row items-center gap-2">
                        <Typography variant="h6" component="h6">
                          {plan.name}
                        </Typography>
                        {plan.trialDays > 0 && (
                          <Chip label={`${plan.trialDays}-day trial`} size="small" color="warning" variant="outlined" />
                        )}
                        {isCurrent && <Chip label="Current" size="small" color="success" variant="outlined" />}
                      </Box>
                      <Typography variant="h4" component="p">
                        {formatMoney(plan.priceCents, plan.currency)}
                        <Typography component="span" variant="body2" className="text-text-secondary">
                          {plan.kind === "credits"
                            ? plan.period
                              ? ` for ${plan.creditAmount} credits ${PERIOD_LABEL[plan.period] ?? ""}`
                              : ` for ${plan.creditAmount} credits`
                            : plan.period
                              ? ` ${PERIOD_LABEL[plan.period] ?? ""}`
                              : ""}
                        </Typography>
                      </Typography>
                      {plan.description && (
                        <Typography variant="body2" className="text-text-secondary grow">
                          {plan.description}
                        </Typography>
                      )}
                      <Button
                        variant="contained"
                        size="medium"
                        onClick={() => handleSubscribe(plan)}
                        disabled={isCurrent || workingPlan !== null || checkoutUnavailable}
                      >
                        {workingPlan === plan.id
                          ? "Redirecting..."
                          : plan.kind === "credits"
                            ? "Buy credits"
                            : "Subscribe"}
                      </Button>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>

          {modules.length > 0 && (
            <Box className="mt-6 flex flex-col gap-1">
              <Typography variant="subtitle2">Add-ons (order bump)</Typography>
              {modules.map((module) => (
                <FormControlLabel
                  key={module.id}
                  control={
                    <Checkbox
                      size="small"
                      checked={selectedModules.includes(module.id)}
                      onChange={() => toggleModule(module.id)}
                    />
                  }
                  label={
                    <Typography variant="body2">
                      {module.name} — {formatMoney(module.priceCents)}
                      {module.kind === "recurring" ? " (recurring)" : " (one-time)"}
                    </Typography>
                  }
                />
              ))}
            </Box>
          )}

          <Box className="mt-6 flex flex-col gap-2 md:flex-row md:items-end">
            <FormControl className="outlined w-56" variant="standard" size="small">
              <FormLabel component="label">Coupon code</FormLabel>
              <Input value={couponCode} onChange={(e) => setCouponCode(e.target.value.toUpperCase())} />
            </FormControl>
            {providers.length > 1 && (
              <FormControl className="outlined w-40" variant="standard" size="small">
                <FormLabel component="label">Pay with</FormLabel>
                <Select
                  value={provider}
                  size="small"
                  variant="standard"
                  IconComponent={NiChevronDownSmall}
                  onChange={(e) => setProvider(e.target.value as BillingProviderName)}
                >
                  <MenuItem value="stripe">Stripe (card)</MenuItem>
                  <MenuItem value="asaas">Asaas (Pix/boleto/card)</MenuItem>
                </Select>
              </FormControl>
            )}
          </Box>
        </CardContent>
      </Card>
    </Grid>
  );
}
