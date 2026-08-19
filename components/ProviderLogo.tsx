import { getProviderLogo } from "@/lib/providers/logos";

export function ProviderLogo({
  id,
  name,
  size = 32,
}: {
  id: string;
  name: string;
  size?: number;
}) {
  const logo = getProviderLogo(id);
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <span
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-zinc-100 ring-1 ring-zinc-200/80"
      style={{ width: size, height: size }}
      title={name}
    >
      {logo ? (
        // Brand marks are local static files in /public/providers.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logo.src}
          alt=""
          width={size}
          height={size}
          className={
            logo.fit === "contain"
              ? "h-full w-full object-contain p-0.5"
              : "h-full w-full object-cover"
          }
        />
      ) : (
        <span className="text-[10px] font-semibold tracking-wide text-zinc-600">
          {initials}
        </span>
      )}
    </span>
  );
}
