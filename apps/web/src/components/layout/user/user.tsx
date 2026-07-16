"use client";

import UserLanguageSwitch from "./user-language-switch";
import UserModeSwitch from "./user-mode-switch";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useTranslations } from "use-intl";

import { Avatar, Box, Card, CardContent, Divider, Fade, ListItemIcon, Typography } from "@mui/material";
import Button from "@mui/material/Button";
import ClickAwayListener from "@mui/material/ClickAwayListener";
import MenuItem from "@mui/material/MenuItem";
import MenuList from "@mui/material/MenuList";
import Popper from "@mui/material/Popper";

import { useProfile } from "@/hooks/use-profile";
import NiQuestionHexagon from "@/icons/nexture/ni-question-hexagon";
import NiSettings from "@/icons/nexture/ni-settings";
import { cn } from "@/lib/utils";
import { isSupabaseConfigured } from "@flyee/auth";
import { createClient } from "@flyee/auth/client";

/**
 * Header user menu backed by the real session: the signed-in user's name,
 * email and avatar (profiles table), preference switches, and a working
 * sign-out. Shows a neutral guest state on a fresh clone without Supabase.
 */
export default function User() {
  const [open, setOpen] = React.useState(false);
  const anchorRef = React.useRef<HTMLButtonElement>(null);
  const t = useTranslations("dashboard");
  const { displayName, email, avatarUrl } = useProfile();

  const shownName = displayName || t("user-guest");
  const initial = shownName.charAt(0).toUpperCase();

  const handleToggle = () => {
    setOpen((prevOpen) => !prevOpen);
  };

  const handleClose = (event: Event | React.SyntheticEvent) => {
    if (anchorRef.current && anchorRef.current.contains(event.target as HTMLElement)) {
      return;
    }
    setOpen(false);
  };

  const router = useRouter();

  const handleSignOut = async () => {
    if (isSupabaseConfigured) {
      const supabase = createClient();
      await supabase.auth.signOut();
    }
    router.push("/auth/sign-in");
  };

  return (
    <>
      <Box ref={anchorRef}>
        {/* Desktop button */}
        <Button
          variant="text"
          color="text-primary"
          className={cn(
            "group hover:bg-grey-25 ml-2 hidden gap-2 rounded-lg py-0! pr-0! hover:py-1! hover:pr-1.5! md:flex",
            open && "active bg-grey-25 py-1! pr-1.5!",
          )}
          onClick={handleToggle}
        >
          <Box>{shownName}</Box>
          <Avatar
            alt={shownName}
            src={avatarUrl ?? undefined}
            className={cn(
              "large transition-all group-hover:ml-0.5 group-hover:h-8 group-hover:w-8",
              open && "ml-0.5 h-8! w-8!",
            )}
          >
            {initial}
          </Avatar>
        </Button>
        {/* Desktop button */}

        {/* Mobile button */}
        <Button
          variant="text"
          size="large"
          color="text-primary"
          className={cn(
            "hover:bg-grey-25 icon-only hover-icon-shrink [&.active]:text-primary group mr-1 ml-1 p-0! hover:p-1.5! md:hidden",
            open && "active bg-grey-25 p-1.5!",
          )}
          onClick={handleToggle}
          startIcon={
            <Avatar
              alt={shownName}
              src={avatarUrl ?? undefined}
              className={cn("large transition-all group-hover:h-7 group-hover:w-7", open && "h-7! w-7!")}
            >
              {initial}
            </Avatar>
          }
        />
        {/* Mobile button */}
      </Box>

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
                <Card className="shadow-darker-sm!">
                  <CardContent>
                    <Box className="max-w-64 sm:w-72 sm:max-w-none">
                      <Box className="mb-4 flex flex-col items-center">
                        <Avatar alt={shownName} src={avatarUrl ?? undefined} className="large mb-2">
                          {initial}
                        </Avatar>
                        <Typography variant="subtitle1" component="p">
                          {shownName}
                        </Typography>
                        {email && (
                          <Typography variant="body2" component="p" className="text-text-secondary -mt-2">
                            {email}
                          </Typography>
                        )}
                      </Box>

                      <MenuList className="p-0">
                        <MenuItem
                          onClick={(event) => {
                            handleClose(event);
                            router.push("/settings");
                          }}
                        >
                          <ListItemIcon>
                            <NiSettings size={20} />
                          </ListItemIcon>
                          {t("user-profile")}
                        </MenuItem>
                        <Divider className="large" />

                        <UserModeSwitch />
                        <UserLanguageSwitch />

                        <Divider className="large" />
                        <MenuItem
                          onClick={(event) => {
                            handleClose(event);
                            router.push("/help");
                          }}
                        >
                          <ListItemIcon>
                            <NiQuestionHexagon size={20} />
                          </ListItemIcon>
                          {t("user-help")}
                        </MenuItem>
                      </MenuList>
                      <Box className="my-8"></Box>
                      <Button onClick={handleSignOut} variant="outlined" size="tiny" color="grey" className="w-full">
                        {t("user-sign-out")}
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              </ClickAwayListener>
            </Box>
          </Fade>
        )}
      </Popper>
    </>
  );
}
