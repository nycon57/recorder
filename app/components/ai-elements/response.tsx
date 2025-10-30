"use client";

import { cn } from "@/lib/utils";
import { memo } from "react";
import ReactMarkdown from "react-markdown";

interface ResponseProps {
  children: string;
  className?: string;
}

export const Response = memo(({ children, className }: ResponseProps) => (
  <div
    className={cn(
      "size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_a]:text-primary [&_a]:underline [&_a:hover]:text-primary/80",
      className
    )}
  >
    <ReactMarkdown
      // Disable URL sanitization - allow all URLs including relative paths
      urlTransform={(url) => url}
      components={{
        a: ({ node, href, ...props }) => {
          // Render all links with href, open in new tab
          return <a {...props} href={href} target="_blank" rel="noopener noreferrer" />;
        },
      }}
    >
      {children}
    </ReactMarkdown>
  </div>
));

Response.displayName = "Response";
