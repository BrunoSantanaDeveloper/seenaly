/**
 * Emits a schema.org structured-data block as a <script type="application/ld+json">.
 * Structured data helps both traditional search (rich results) and AI search
 * decide what a page is about — see the marketing-page skill's SEO section.
 *
 * Renders nothing visible and is safe in Server or Client Components. The `<`
 * escape prevents a `</script>` breakout when a string field contains markup.
 */
export default function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
