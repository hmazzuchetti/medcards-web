"use client";

import { use } from "react";
import { StudySession } from "@/components/study/study-session";

interface StudyPageProps {
  params: Promise<{ categoryId: string }>;
}

/** Study one category (or everything with "all"). */
export default function StudyCategoryPage({ params }: StudyPageProps) {
  const { categoryId } = use(params);
  return (
    <StudySession
      categoryId={categoryId === "all" ? undefined : categoryId}
      backHref={categoryId === "all" ? "/study" : "/"}
    />
  );
}
