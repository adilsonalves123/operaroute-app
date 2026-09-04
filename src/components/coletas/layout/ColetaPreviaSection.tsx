export function ColetaPreviaSection({
  title = "Prévia para o cliente",
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-at-muted">
        {title}
      </p>
      {children}
    </div>
  );
}
