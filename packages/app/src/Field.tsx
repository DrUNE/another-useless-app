export function Field(props: {
  label: string;
  value: string;
  onInput: (value: string) => void;
  placeholder?: string;
}) {
  // props не деструктурируем: чтение props.value в JSX и есть подписка на изменения.
  return (
    <label class="flex flex-col gap-1 text-sm">
      <span class="text-ink/70">{props.label}</span>
      <input
        class="rounded-control border border-ink/20 bg-surface-muted px-3 py-2 text-base outline-accent focus-visible:outline-2"
        value={props.value}
        placeholder={props.placeholder}
        onInput={(e) => props.onInput(e.currentTarget.value)}
      />
    </label>
  );
}
