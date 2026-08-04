"use client";

import { useMemo } from "react";
import DOMPurify from "dompurify";
import { SUPABASE_STORAGE_URL } from "@/config/theme";

interface CardContentRendererProps {
  html: string;
  className?: string;
}

const PURIFY_CONFIG = {
  ALLOWED_TAGS: [
    "b", "strong", "i", "em", "u", "br", "p", "div", "span",
    "ul", "ol", "li", "img", "a", "h1", "h2", "h3", "h4",
    "sub", "sup", "table", "thead", "tbody", "tr", "th", "td",
  ],
  ALLOWED_ATTR: ["src", "alt", "href", "class", "style", "width", "height"],
};

function fixImageUrls(html: string): string {
  return html.replace(
    /src="(?!https?:\/\/)(.*?)"/g,
    `src="${SUPABASE_STORAGE_URL}$1"`
  );
}

function sanitize(html: string): string {
  if (typeof window === "undefined") {
    // Server-side: strip dangerous tags; full DOMPurify runs on client hydration
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/on\w+="[^"]*"/gi, "");
  }
  return DOMPurify.sanitize(html, PURIFY_CONFIG);
}

export function CardContentRenderer({ html, className = "" }: CardContentRendererProps) {
  const sanitizedHtml = useMemo(() => {
    const fixed = fixImageUrls(html);
    return sanitize(fixed);
  }, [html]);

  return (
    <div
      className={`card-content ${className}`}
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  );
}
