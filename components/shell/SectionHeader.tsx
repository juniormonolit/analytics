type SectionHeaderProps = {
  title: string;
  subtitle?: string;
};

/**
 * Section heading shown at the top of every section layout.
 * Pure presentational — no client-side state.
 */
export function SectionHeader({ title, subtitle }: SectionHeaderProps) {
  return (
    <header className="border-b border-border-primary bg-bg-card px-6 py-4">
      <h1 className="text-xl font-semibold text-text-primary">{title}</h1>
      {subtitle ? (
        <p className="mt-1 text-sm text-text-secondary">{subtitle}</p>
      ) : null}
    </header>
  );
}
