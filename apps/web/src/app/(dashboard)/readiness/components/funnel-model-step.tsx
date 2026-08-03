"use client";

import { useTranslations } from "next-intl";

import { Box, Button, Card, CardActionArea, CardContent, Radio, Typography } from "@mui/material";

import NiCartEmpty from "@/icons/nexture/ni-cart-empty";
import NiFlask from "@/icons/nexture/ni-flask";
import NiUserCheck from "@/icons/nexture/ni-user-check";
import { FUNNEL_MODELS, type FunnelModel } from "@/lib/readiness/checklist";
import { cn } from "@/lib/utils";

const MODEL_ICON: Record<FunnelModel, React.ReactNode> = {
  direct: <NiCartEmpty size="medium" />,
  trial_first: <NiFlask size="medium" />,
  lead_first: <NiUserCheck size="medium" />,
};

/**
 * Job: say how this business actually takes money — the one answer that
 * reframes every dimension after it. Success: the user recognises their own
 * funnel in one of three sentences and never gets audited against a shape they
 * do not run.
 *
 * It leads the wizard because it is not a detail: on a trial-first funnel the
 * checkout sits behind the login (so no scan can reach it and the ad optimizes
 * for the SIGNUP), and on a lead-first one there is no self-service checkout at
 * all. Asking it later would mean auditing the wrong surface first — which is
 * exactly the failure this step exists to prevent.
 *
 * Cards, not a dropdown: the choice only becomes honest when each option is
 * described in the user's own terms, and a `select` hides the descriptions
 * behind a click.
 */
export default function FunnelModelStep({
  value,
  onChange,
  disabled,
}: {
  value: FunnelModel | null;
  onChange: (next: FunnelModel) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("readiness");

  return (
    <Box className="flex flex-col gap-2" role="radiogroup" aria-label={t("funnel-model-title")}>
      {FUNNEL_MODELS.map((model) => {
        const selected = value === model;
        return (
          <Card
            key={model}
            component="div"
            variant="outlined"
            className={cn("transition-colors", selected && "border-primary bg-primary/5")}
          >
            <CardActionArea
              disabled={disabled}
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(model)}
              className="p-0"
            >
              <CardContent className="flex flex-row items-start gap-3">
                <span
                  className={cn(
                    "flex h-10 w-10 flex-none items-center justify-center rounded-2xl",
                    selected ? "bg-primary/15 text-primary" : "bg-grey-50 text-text-secondary",
                  )}
                >
                  {MODEL_ICON[model]}
                </span>
                <Box className="grow">
                  <Typography variant="subtitle1" component="p" className="mb-0">
                    {t(`funnel-model-${model}`)}
                  </Typography>
                  <Typography variant="body2" className="text-text-secondary leading-6">
                    {t(`funnel-model-why-${model}`)}
                  </Typography>
                </Box>
                {/* A real radio glyph, not just a tinted card. Colour alone was
                    carrying the whole "this one is picked" signal — invisible to
                    anyone who does not separate those hues, and weak even for
                    those who do. Non-interactive: the CardActionArea owns the
                    click and already exposes role=radio + aria-checked. */}
                <Radio
                  checked={selected}
                  disabled={disabled}
                  tabIndex={-1}
                  disableRipple
                  className="pointer-events-none mt-0.5 flex-none p-0"
                />
              </CardContent>
            </CardActionArea>
          </Card>
        );
      })}

      {/* The silent default was the bug: leaving this blank meant "venda
          direta" anyway — the audit changed shape and the user was never told.
          Now the fallback is a CHOICE with its consequence in the label, so
          "não sei" and "não respondi" stop looking the same to us and to them.
          Subordinate on purpose: it is an escape, not a fourth funnel. */}
      {value === null && (
        <Box className="flex flex-col items-start gap-0.5 pt-1">
          <Button variant="text" color="grey" size="small" disabled={disabled} onClick={() => onChange("direct")}>
            {t("funnel-model-unsure")}
          </Button>
          <Typography variant="body2" className="text-text-secondary">
            {t("funnel-model-unsure-hint")}
          </Typography>
        </Box>
      )}
    </Box>
  );
}
