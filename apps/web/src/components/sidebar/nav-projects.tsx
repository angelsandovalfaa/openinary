"use client"

import { LazyStorageTree } from "@/components/sidebar/lazy-storage-tree"
import {
  SidebarGroup,
  SidebarGroupLabel,
} from "@/components/ui/sidebar"
import type { MediaFile, MediaType } from "@openinary/ui"

interface NavProjectsProps {
  mediaType?: MediaType | null
  onMediaSelect?: (media: MediaFile) => void
}

export function NavProjects({ onMediaSelect, mediaType }: NavProjectsProps) {
  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>Assets</SidebarGroupLabel>
      <LazyStorageTree onMediaSelect={onMediaSelect} mediaType={mediaType} />
    </SidebarGroup>
  )
}
