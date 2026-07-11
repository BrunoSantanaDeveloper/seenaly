"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "use-intl";

import {
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  CardActions,
  ClickAwayListener,
  Fade,
  List,
  ListItem,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  Popper,
  Tooltip,
  Typography,
} from "@mui/material";

import NiBell from "@/icons/nexture/ni-bell";
import NiBellInactive from "@/icons/nexture/ni-bell-inactive";
import NiMoney from "@/icons/nexture/ni-money";
import NiScreen from "@/icons/nexture/ni-screen";
import NiSettings from "@/icons/nexture/ni-settings";
import NiUsers from "@/icons/nexture/ni-users";
import { cn } from "@/lib/utils";
import { isSupabaseConfigured } from "@flyee/auth";
import { createClient } from "@flyee/auth/client";

type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  href: string | null;
  readAt: string | null;
  createdAt: string;
};

/** Icon + tint per notification family; projects extend the map. */
const TYPE_STYLE: Record<string, { icon: React.ReactNode; className: string }> = {
  system: { icon: <NiScreen size="medium" />, className: "bg-accent-1-light/10 text-accent-1" },
  team: { icon: <NiUsers size="medium" />, className: "bg-accent-2-light/10 text-accent-2" },
  billing: { icon: <NiMoney size="medium" />, className: "bg-accent-3-light/10 text-accent-3" },
};
const DEFAULT_STYLE = { icon: <NiBell size="medium" />, className: "bg-primary/10 text-primary" };

function timeAgo(iso: string, locale: string) {
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  const format = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (seconds < 60) return format.format(-seconds, "second");
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return format.format(-minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (hours < 24) return format.format(-hours, "hour");
  const days = Math.round(hours / 24);
  if (days < 30) return format.format(-days, "day");
  return new Date(iso).toLocaleDateString(locale);
}

/**
 * Header bell backed by the notifications table (migration 0012). Rows are
 * created by server code (lib/notifications.ts) or DB triggers; here the
 * user reads them, opens their destination and marks them read.
 */
export default function Notifications() {
  const t = useTranslations("dashboard");
  const locale = useLocale();
  const router = useRouter();

  const [items, setItems] = useState<NotificationRow[]>([]);
  const [open, setOpen] = useState(false);
  const [tooltipShow, setTooltipShow] = useState(false);
  const anchorRef = React.useRef<HTMLButtonElement>(null);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("id, type, title, body, href, read_at, created_at")
      .order("created_at", { ascending: false })
      .limit(30);
    setItems(
      (data ?? []).map((row) => ({
        id: row.id,
        type: row.type,
        title: row.title,
        body: row.body,
        href: row.href,
        readAt: row.read_at,
        createdAt: row.created_at,
      })),
    );
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const unreadCount = items.filter((item) => !item.readAt).length;

  const handleToggle = () => {
    if (!open) refresh();
    setOpen((prevOpen) => !prevOpen);
  };

  const handleClose = (event: Event | React.SyntheticEvent) => {
    if (anchorRef.current && anchorRef.current.contains(event.target as HTMLElement)) {
      return;
    }
    setOpen(false);
  };

  const markRead = async (ids: string[]) => {
    if (ids.length === 0) return;
    const readAt = new Date().toISOString();
    setItems((current) => current.map((item) => (ids.includes(item.id) ? { ...item, readAt } : item)));
    const supabase = createClient();
    await supabase.from("notifications").update({ read_at: readAt }).in("id", ids).is("read_at", null);
  };

  const handleItemClick = (item: NotificationRow, event: React.SyntheticEvent) => {
    markRead([item.id]);
    if (item.href) router.push(item.href);
    handleClose(event);
  };

  return (
    <>
      <Tooltip title={t("notifications-title")} placement="bottom" arrow open={!open && tooltipShow}>
        <Badge
          badgeContent={unreadCount}
          color="primary"
          slotProps={{
            badge: { className: "right-2 top-2 pointer-events-none" },
          }}
        >
          <Button
            variant="text"
            size="large"
            color="text-primary"
            className={cn(
              "icon-only hover-icon-shrink [&.active]:text-primary! hover:bg-grey-25",
              open && "active bg-grey-25",
            )}
            onClick={handleToggle}
            onMouseEnter={() => setTooltipShow(true)}
            onMouseLeave={() => setTooltipShow(false)}
            ref={anchorRef}
            startIcon={<NiBell size="large" variant={open ? "contained" : "outlined"} />}
          />
        </Badge>
      </Tooltip>
      <Popper
        open={open}
        anchorEl={anchorRef.current}
        role={undefined}
        placement="bottom-end"
        className="mt-3!"
        transition
      >
        {({ TransitionProps }) => (
          <Fade {...TransitionProps}>
            <Box>
              <ClickAwayListener onClickAway={handleClose}>
                <Card className="shadow-darker-sm! w-xs md:w-sm">
                  <Box className="flex flex-1 flex-row items-start justify-between pr-4">
                    <Typography variant="h5" component="h5" className="card-title px-4 pt-4">
                      {t("notifications-title")}
                    </Typography>
                    <Button
                      className="icon-only mt-3"
                      size="small"
                      color="grey"
                      variant="text"
                      startIcon={<NiSettings size={"small"} />}
                      href="/settings"
                      component={Link}
                    />
                  </Box>

                  {items.length === 0 ? (
                    <Box className="flex flex-col items-center gap-2 px-6 py-10 text-center">
                      <span className="bg-primary/10 text-primary flex h-12 w-12 items-center justify-center rounded-2xl">
                        <NiBellInactive size="medium" />
                      </span>
                      <Typography variant="subtitle2">{t("notifications-empty")}</Typography>
                      <Typography variant="body2" className="text-text-secondary">
                        {t("notifications-empty-hint")}
                      </Typography>
                    </Box>
                  ) : (
                    <List className="my-2 max-h-96 overflow-auto">
                      {items.map((item) => {
                        const style = TYPE_STYLE[item.type] ?? DEFAULT_STYLE;
                        return (
                          <ListItem key={item.id} className="px-4 py-0">
                            <ListItemButton
                              onClick={(event) => {
                                event.preventDefault();
                                handleItemClick(item, event);
                              }}
                              classes={{ root: cn("w-full items-start", !item.readAt && "bg-primary-dark/5") }}
                              LinkComponent={item.href ? Link : Box}
                              href={item.href ?? "#"}
                            >
                              <ListItemAvatar>
                                <Avatar className={cn("medium mr-3", style.className)}>{style.icon}</Avatar>
                              </ListItemAvatar>
                              <ListItemText
                                primary={
                                  <Typography component="span" className="leading-4">
                                    <Typography component="span" variant="subtitle1" className="leading-4">
                                      {item.title}
                                    </Typography>
                                    {item.body && (
                                      <>
                                        {" "}
                                        <Typography component="span" variant="body1" className="leading-4">
                                          {item.body}
                                        </Typography>
                                      </>
                                    )}
                                  </Typography>
                                }
                                secondary={timeAgo(item.createdAt, locale)}
                              />
                            </ListItemButton>
                          </ListItem>
                        );
                      })}
                    </List>
                  )}

                  {unreadCount > 0 && (
                    <CardActions disableSpacing>
                      <Button
                        variant="outlined"
                        size="tiny"
                        color="grey"
                        className="w-full"
                        onClick={() => markRead(items.filter((item) => !item.readAt).map((item) => item.id))}
                      >
                        {t("notifications-mark-all-read")}
                      </Button>
                    </CardActions>
                  )}
                </Card>
              </ClickAwayListener>
            </Box>
          </Fade>
        )}
      </Popper>
    </>
  );
}
