export default function Explanation({ steps }: { steps: string[] }) {
  if (!steps?.length) return null;
  return (
    <ol className="space-y-2 mt-2">
      {steps.map((s, i) => (
        <li key={i} className="flex gap-3 text-sm text-charcoal/80">
          <span className="shrink-0 w-6 h-6 rounded-full bg-coral/20 text-coral-dark grid place-items-center text-xs font-bold">{i + 1}</span>
          <span>{s}</span>
        </li>
      ))}
    </ol>
  );
}
