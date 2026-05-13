"use client";

import { useCallback, useEffect, useState } from "react";
import {
  addVirtualFolder,
  loadVirtualFolders,
  removeVirtualFolder,
} from "@/lib/config/virtual-folders";

export function useVirtualFolders(
  repository: string | undefined,
  branch: string | undefined,
) {
  const [folders, setFolders] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!repository || !branch) {
      setFolders([]);
      setHydrated(true);
      return;
    }
    setFolders(loadVirtualFolders(repository, branch));
    setHydrated(true);
  }, [repository, branch]);

  const add = useCallback(
    (folder: string) => {
      if (!repository || !branch) return;
      setFolders(addVirtualFolder(repository, branch, folder));
    },
    [repository, branch],
  );

  const remove = useCallback(
    (folder: string) => {
      if (!repository || !branch) return;
      setFolders(removeVirtualFolder(repository, branch, folder));
    },
    [repository, branch],
  );

  return { folders, hydrated, add, remove };
}
