import Prose from "./prose";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

/**
 * Renders trusted Markdown (help articles, blog posts — superadmin-authored
 * content from the database) inside the marketing Prose rhythm. Raw HTML in
 * the source is NOT rendered (react-markdown default), so DB content cannot
 * inject markup.
 */
export default function MarkdownProse({ children, className }: { children: string; className?: string }) {
  return (
    <Prose
      className={cn(
        "[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2",
        "[&_code]:bg-grey-25 [&_code]:rounded [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-sm",
        "[&_pre]:bg-grey-25 [&_pre]:mb-4 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:p-4",
        "[&_blockquote]:border-grey-100 [&_blockquote]:text-text-secondary [&_blockquote]:mb-4 [&_blockquote]:border-l-2 [&_blockquote]:pl-4",
        "[&_ol]:text-text-secondary [&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:pl-6",
        "[&_th]:text-text-primary [&_th]:border-grey-100 [&_td]:text-text-secondary [&_td]:border-grey-50 [&_table]:mb-4 [&_table]:w-full [&_td]:border-b [&_td]:p-2 [&_th]:border-b [&_th]:p-2 [&_th]:text-left",
        "[&_img]:my-4 [&_img]:max-w-full [&_img]:rounded-xl",
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </Prose>
  );
}
