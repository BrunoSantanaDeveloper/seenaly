"use client";
import "@/style/global.css";

import { Suspense } from "react";

import { LicenseInfo } from "@mui/x-license";

import Loading from "@/app/loading";
import CookieConsent from "@/components/consent/cookie-consent";
import AnnouncementBanner from "@/components/layout/announcements/announcement-banner";
import ContentWrapper from "@/components/layout/containers/content-wrapper";
import Header from "@/components/layout/containers/header";
import Main from "@/components/layout/containers/main";
import ThemeConfiguration from "@/components/layout/containers/theme-configuration";
import LeftMenu from "@/components/layout/menu/left-menu";
import MenuBackdrop from "@/components/layout/menu/menu-backdrop";
import SupportWidget from "@/components/support/support-widget";

LicenseInfo.setLicenseKey(process.env.NEXT_PUBLIC_MUI_X_LICENSE_KEY || "");

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <Header />
      <LeftMenu />
      <Main>
        <ContentWrapper>
          <AnnouncementBanner />
          <Suspense fallback={<Loading />}>{children}</Suspense>
        </ContentWrapper>
      </Main>
      <ThemeConfiguration />
      <MenuBackdrop />
      <SupportWidget />
      <CookieConsent />
    </>
  );
}
