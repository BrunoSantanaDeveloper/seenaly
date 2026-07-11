import Link from "next/link";

import { Box, List, ListItem, ListItemButton, ListItemIcon, ListItemText } from "@mui/material";

import NiBuilding from "@/icons/nexture/ni-building";
import NiCheckSquare from "@/icons/nexture/ni-check-square";
import NiPlug from "@/icons/nexture/ni-plug";
import NiUser from "@/icons/nexture/ni-user";
import NiWallet from "@/icons/nexture/ni-wallet";

export type SettingsMenuActive = "profile" | "organization" | "connections" | "billing" | "security";

type GroupProps = { label: string };

const Group = ({ label }: GroupProps) => (
  <ListItem disablePadding>
    <ListItemButton className="pointer-events-none mt-4">
      <ListItemText
        primary={label}
        slotProps={{
          primary: { className: "text-xs! font-semibold! opacity-40" },
        }}
      />
    </ListItemButton>
  </ListItem>
);

type ItemProps = {
  href: string;
  label: string;
  icon: React.ReactNode;
  selected?: boolean;
};

const Item = ({ href, label, icon, selected }: ItemProps) => (
  <ListItem disablePadding>
    <ListItemButton href={href} LinkComponent={Link} selected={selected}>
      <ListItemIcon>{icon}</ListItemIcon>
      <ListItemText primary={label} />
    </ListItemButton>
  </ListItem>
);

/** Only real destinations — every item leads to a working settings page. */
export default function SettingsMenu({ active }: { active: SettingsMenuActive }) {
  return (
    <Box className="flex flex-col gap-4">
      <List className="-mt-6">
        <Group label="Personal" />
        <Item href="/settings" label="Profile" icon={<NiUser size="medium" />} selected={active === "profile"} />
        <Item
          href="/settings/security"
          label="Security"
          icon={<NiCheckSquare size="medium" />}
          selected={active === "security"}
        />

        <Group label="Organization" />
        <Item
          href="/settings/organization"
          label="Organization"
          icon={<NiBuilding size="medium" />}
          selected={active === "organization"}
        />
        <Item
          href="/settings/connections"
          label="Connections"
          icon={<NiPlug size="medium" />}
          selected={active === "connections"}
        />

        <Group label="Payment" />
        <Item
          href="/settings/billing"
          label="Billing"
          icon={<NiWallet size="medium" />}
          selected={active === "billing"}
        />
      </List>
    </Box>
  );
}
