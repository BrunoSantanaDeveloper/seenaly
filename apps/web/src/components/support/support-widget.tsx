"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "use-intl";

import { Box, Button, Card, ClickAwayListener, Fade, Tooltip } from "@mui/material";

import { BRAND } from "@/brand";
import NiCross from "@/icons/nexture/ni-cross";
import NiEmail from "@/icons/nexture/ni-email";
import NiHeadset from "@/icons/nexture/ni-headset";
import NiPhoneHandset from "@/icons/nexture/ni-phone-handset";
import NiQuestionHexagon from "@/icons/nexture/ni-question-hexagon";

/**
 * Floating quick-support button (marketing site + dashboard). Channels
 * come from BRAND.support (@flyee/content): WhatsApp deep link, email,
 * help center. Renders nothing until a HUMAN channel (whatsapp/email) is
 * configured — a floating button that only repeats the footer is noise.
 */
export default function SupportWidget() {
  const t = useTranslations("marketing");
  const [open, setOpen] = useState(false);

  const { whatsapp, email, helpCenter } = BRAND.support;
  if (!whatsapp && !email) return null;

  const channels = [
    whatsapp
      ? {
          key: "whatsapp",
          href: `https://wa.me/${whatsapp}`,
          external: true,
          icon: <NiPhoneHandset size="medium" />,
          label: t("support-widget-whatsapp"),
        }
      : null,
    email
      ? {
          key: "email",
          href: `mailto:${email}`,
          external: true,
          icon: <NiEmail size="medium" />,
          label: t("support-widget-email"),
        }
      : null,
    helpCenter
      ? {
          key: "help",
          href: helpCenter,
          external: false,
          icon: <NiQuestionHexagon size="medium" />,
          label: t("support-widget-help"),
        }
      : null,
  ].filter(Boolean) as { key: string; href: string; external: boolean; icon: React.ReactNode; label: string }[];

  return (
    <ClickAwayListener onClickAway={() => setOpen(false)}>
      <Box className="fixed right-5 bottom-5 z-50 flex flex-col items-end gap-3">
        <Fade in={open} unmountOnExit>
          <Card className="shadow-darker-sm! flex w-64 flex-col gap-1 p-2">
            {channels.map((channel) =>
              channel.external ? (
                <Button
                  key={channel.key}
                  component="a"
                  href={channel.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="text"
                  color="text-primary"
                  size="medium"
                  className="justify-start gap-2"
                  startIcon={channel.icon}
                >
                  {channel.label}
                </Button>
              ) : (
                <Button
                  key={channel.key}
                  component={Link}
                  href={channel.href}
                  variant="text"
                  color="text-primary"
                  size="medium"
                  className="justify-start gap-2"
                  startIcon={channel.icon}
                  onClick={() => setOpen(false)}
                >
                  {channel.label}
                </Button>
              ),
            )}
          </Card>
        </Fade>
        <Tooltip title={t("support-widget-label")} placement="left">
          <Button
            variant="contained"
            color="primary"
            aria-label={t("support-widget-label")}
            onClick={() => setOpen((current) => !current)}
            className="h-14 w-14 min-w-0 rounded-full p-0 shadow-lg [&_svg]:h-7 [&_svg]:w-7"
          >
            {open ? <NiCross size="large" /> : <NiHeadset size="large" />}
          </Button>
        </Tooltip>
      </Box>
    </ClickAwayListener>
  );
}
