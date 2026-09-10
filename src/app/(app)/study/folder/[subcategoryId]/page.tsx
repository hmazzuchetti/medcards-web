"use client";

import { use, useMemo } from "react";
import { StudySession } from "@/components/study/study-session";

interface StudyFolderPageProps {
  params: Promise<{ subcategoryId: string }>;
}

/** Study a single folder (subcategory), e.g. from the search page. */
export default function StudyFolderPage({ params }: StudyFolderPageProps) {
  const { subcategoryId } = use(params);
  const ids = useMemo(() => [subcategoryId], [subcategoryId]);
  return <StudySession subcategoryIds={ids} backHref={`/search?folder=${subcategoryId}`} />;
}
