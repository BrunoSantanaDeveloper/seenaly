"use client";

import type { AssistOffering } from "../actions";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Alert, Box, Button, Chip, TextField, Typography } from "@mui/material";

import NiCheck from "@/icons/nexture/ni-check";
import NiHeadset from "@/icons/nexture/ni-headset";
import type { AssistReason } from "@/lib/readiness/assist";

/**
 * The fourth exit: "our team does it WITH you".
 *
 * Who reaches this: someone who already tried. They read what the item is,
 * scanned, and it is still not done — or they claimed it and the page proved
 * them wrong twice. Their job here is "get me out of this without hiring
 * another agency". Success is leaving with a session booked, knowing the cost,
 * the duration, and that no password will ever be asked for.
 *
 * Three rules this component exists to keep:
 *
 *  1. It is EARNED, never always-on (`assistReason` decides) — otherwise the
 *     diagnostic turns into an upsell funnel and competes with the free path.
 *  2. It names the price BEFORE the click. A burned-by-agencies user meeting a
 *     surprise charge is the fastest way to lose them for good.
 *  3. It states the credential boundary out loud. We do the work together on a
 *     call; we never take their passwords. Saying so is what separates this
 *     from the agency that burned them.
 */
export default function AssistOffer({
  reason,
  offering,
  itemLabel,
  alreadyOpen,
  balance,
  onRequest,
}: {
  reason: AssistReason;
  offering: AssistOffering;
  itemLabel: string;
  /** A request for this item is already in the queue — never sell it twice. */
  alreadyOpen: boolean;
  balance: number | null;
  onRequest: (note: string) => Promise<boolean>;
}) {
  const t = useTranslations("readiness");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  // Already booked (this session or a previous one): show the standing state,
  // never another buy button.
  if (alreadyOpen || done) {
    return (
      <Alert severity="success" icon={<NiCheck size="small" />} className="neutral bg-background-paper/60!">
        <Typography variant="subtitle2">{t("assist-requested-title")}</Typography>
        <Typography variant="body2">{t("assist-requested-body")}</Typography>
      </Alert>
    );
  }

  const short = balance != null && offering.credits > 0 && balance < offering.credits;

  const request = async () => {
    setBusy(true);
    try {
      if (await onRequest(note)) setDone(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box className="border-primary/30 bg-primary/5 flex flex-col gap-2 rounded-2xl border p-3">
      <Box className="flex flex-row items-center gap-2">
        <span className="bg-primary/10 text-primary flex h-8 w-8 flex-none items-center justify-center rounded-xl">
          <NiHeadset size="small" />
        </span>
        <Box className="grow">
          <Typography variant="subtitle2" className="mb-0">
            {t("assist-title")}
          </Typography>
          {/* Why this appeared, so it never reads as a random sales pitch. */}
          <Typography variant="body2" className="text-text-secondary">
            {t(`assist-reason-${reason}`, { item: itemLabel })}
          </Typography>
        </Box>
      </Box>

      <Typography variant="body2" className="leading-6">
        {offering.description}
      </Typography>

      <Box className="flex flex-row flex-wrap items-center gap-1">
        <Chip
          label={t("assist-price", { credits: offering.credits })}
          size="small"
          color="primary"
          variant="outlined"
        />
        <Chip
          label={t("assist-duration", { minutes: offering.minutes })}
          size="small"
          color="grey"
          variant="outlined"
        />
      </Box>

      <TextField
        size="small"
        multiline
        minRows={2}
        label={t("assist-note-label")}
        placeholder={t("assist-note-placeholder")}
        value={note}
        onChange={(event) => setNote(event.target.value)}
        helperText={t("assist-note-help")}
        slotProps={{ htmlInput: { maxLength: 2000 } }}
      />

      {short ? (
        <Alert severity="warning" className="neutral bg-background-paper/60!">
          <Typography variant="body2">
            {t("assist-insufficient", { credits: offering.credits, balance: balance ?? 0 })}
          </Typography>
        </Alert>
      ) : null}

      <Box className="flex flex-row flex-wrap items-center gap-2">
        <Button
          variant="contained"
          color="primary"
          size="small"
          disabled={busy || short}
          onClick={() => void request()}
        >
          {busy ? t("assist-requesting") : t("assist-cta", { credits: offering.credits })}
        </Button>
        <Typography variant="body2" className="text-text-secondary">
          {t("assist-no-password")}
        </Typography>
      </Box>
    </Box>
  );
}
