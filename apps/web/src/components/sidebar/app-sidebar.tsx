"use client";

import Image from "next/image";
import { Image as ImageIcon, Package, Video } from "lucide-react";

import { NavMain } from "@/components/sidebar/nav-main";
import { NavProjects } from "@/components/sidebar/nav-projects";
import { NavUser } from "@/components/sidebar/nav-user";
import { VersionDisplay } from "@/components/sidebar/version-display";
import type { MediaFile, MediaType } from "@openinary/ui";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import Link from "next/link";

// Each media view is addressable and survives refreshes.
const data = {
  navMain: [
    {
      title: "Assets",
      url: "/",
      icon: Package,
      mediaType: null,
    },
    {
      title: "Image",
      url: "/?type=image",
      icon: ImageIcon,
      mediaType: "image",
    },
    {
      title: "Video",
      url: "/?type=video",
      icon: Video,
      mediaType: "video",
    },
  ],
};

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  mediaType?: MediaType | null;
  onMediaSelect?: (media: MediaFile) => void;
}

export function AppSidebar({ onMediaSelect, mediaType = null, ...props }: AppSidebarProps) {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="pl-4 pt-4 group-data-[collapsible=icon]:pt-[11px] group-data-[collapsible=icon]:pl-[12px]">
        <Link href="/" className="flex items-center">
          <Image
            src={isCollapsed ? "/icon.svg" : "/openinary.svg"}
            alt="Openinary"
            width={100}
            height={25}
            className="dark:invert h-[25px] w-auto"
          />
        </Link>
      </SidebarHeader>
      <SidebarContent
        style={{
          maskImage:
            "linear-gradient(to bottom, transparent, black 12px, black calc(100% - 12px), transparent)",
          WebkitMaskImage:
            "linear-gradient(to bottom, transparent, black 12px, black calc(100% - 12px), transparent)",
        }}
      >
        <NavMain items={data.navMain.map((item) => ({ ...item, isActive: item.mediaType === mediaType }))} />
        <NavProjects onMediaSelect={onMediaSelect} mediaType={mediaType} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
        {!isCollapsed && <VersionDisplay />}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
