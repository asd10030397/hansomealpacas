import Link from "next/link";

type ActionButtonProps = {
  href?: string;
  disabled?: boolean;
  children: string;
  sublabel?: string;
  variant?: "default" | "gold";
  size?: "default" | "lg";
};

function isInternalHref(href: string): boolean {
  return href.startsWith("/") && !href.startsWith("//");
}

export function ActionButton({
  href,
  disabled = false,
  children,
  sublabel,
  variant = "default",
  size = "default",
}: ActionButtonProps) {
  const sizeClass =
    size === "lg"
      ? "min-w-[12rem] px-12 py-4 sm:min-w-[14rem] sm:px-14 sm:py-5"
      : "min-w-[9rem] px-8 py-3 sm:min-w-[10rem] sm:px-10 sm:py-3.5";

  const variantClass =
    variant === "gold"
      ? "border-wood bg-gradient-to-b from-gold-pale to-gold text-wood-dark"
      : "border-wood bg-surface text-foreground";

  const className = `pixel-btn inline-flex flex-col items-center justify-center gap-1 border font-[family-name:var(--font-anton)] ${sizeClass} ${variantClass}`;
  const labelClass =
    size === "lg"
      ? "text-sm tracking-[0.18em] sm:text-base"
      : "text-xs tracking-[0.18em] sm:text-sm";
  const sublabelClass = "text-[0.62rem] tracking-[0.14em] opacity-75 sm:text-[0.68rem]";

  const content = (
    <>
      <span className={labelClass}>{children}</span>
      {sublabel ? <span className={sublabelClass}>{sublabel}</span> : null}
    </>
  );

  if (!href && !disabled) {
    return null;
  }

  if (disabled || !href) {
    return (
      <span aria-disabled="true" className={`${className} cursor-default opacity-70`}>
        {content}
      </span>
    );
  }

  if (isInternalHref(href)) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {content}
    </a>
  );
}
