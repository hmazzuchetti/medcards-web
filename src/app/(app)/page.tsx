"use client";

import { StudySession } from "@/components/study/study-session";
import { useEnabledSubcategories } from "@/hooks/useEnabledSubcategories";

/**
 * Home tab = the study screen itself (like Anki, you open the app ready to study).
 * Studies the single deck made of every subcategory enabled in "Pastas".
 */
export default function HomePage() {
  const { enabledIds, isLoading } = useEnabledSubcategories();

  return (
    <StudySession
      subcategoryIds={enabledIds ?? []}
      enabled={!isLoading}
      noFoldersSelected={!isLoading && enabledIds?.length === 0}
    />
  );
}
