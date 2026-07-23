"use client";
import Notifications from "../notifications/notifications";
import User from "../user/user";
import Link from "next/link";
import { useTranslations } from "next-intl";
import * as React from "react";
import { useEffect, useState } from "react";

import { Box, Button } from "@mui/material";

import { useLayoutContext } from "@/components/layout/layout-context";
import Logo from "@/components/logo/logo";
import NiMenuSplit from "@/icons/nexture/ni-menu-split";
import { cn } from "@/lib/utils";

export default function Header() {
  const t = useTranslations("dashboard");
  const { showLeftInMobile, showLeftMobileButton, leftMenuWidth, leftShowBackdrop, resetLeftMenu } = useLayoutContext();

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Box
        component="header"
        className="flex h-14 flex-none flex-row items-center sm:h-16"
        style={{ padding: `0 var(--main-padding)` }}
      >
        <Box className="flex h-full flex-row items-center">
          <Link href="/home" aria-label={`${t("menu-home")} — Seenaly`}>
            <Logo classNameFull="ml-2 hidden md:block" classNameMobile="ml-2 md:hidden" />
          </Link>
        </Box>
      </Box>
    );
  }

  return (
    <Box className="mui-fixed fixed z-20 h-20 w-full" component="header">
      <Box
        className={cn(
          "bg-background-paper flex h-full w-full flex-none flex-row items-center rounded-br-3xl sm:h-20",
          leftShowBackdrop && "relative",
        )}
        style={{ padding: `0 var(--main-padding)` }}
      >
        <Box className="bg-background-paper shadow-darker-xs absolute inset-0 -z-10 rounded-b-3xl"></Box>
        {/* Left menu button */}
        <Button
          variant="text"
          size="large"
          color="text-primary"
          aria-label={t("menu-navigation-label")}
          aria-expanded={leftMenuWidth.primary > 0}
          aria-controls="primary-navigation"
          className={cn(
            "icon-only hover-icon-shrink [&.active]:text-primary [&.active]:bg-grey-25 hover:bg-grey-25",
            showLeftMobileButton ? "flex" : "hidden",
            leftMenuWidth.primary > 0 && "active",
          )}
          onClick={() => (leftMenuWidth.primary > 0 ? resetLeftMenu() : showLeftInMobile())}
          startIcon={<NiMenuSplit size={24} />}
        />
        <Box className="flex h-full flex-row items-center gap-6">
          {/* Logo */}
          <Link href="/home" aria-label={`${t("menu-home")} — Seenaly`}>
            <Logo classNameFull="ml-2 hidden md:block" classNameMobile="ml-2 md:hidden" />
          </Link>
        </Box>

        {/* Right buttons. The template's Search and Shortcuts popovers were
            demo-only (hardcoded fake results/links) and were pruned at launch
            prep; reintroduce a real search when the product grows one. */}
        <Box className="ml-auto flex flex-row sm:gap-1">
          <Notifications />
        </Box>

        {/* User Avatar and Menu */}
        <User />
      </Box>
    </Box>
  );
}
