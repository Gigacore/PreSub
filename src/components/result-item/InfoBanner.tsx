interface InfoBannerProps {
  onClick: () => void;
  ariaLabel: string;
  title: string;
  icon: string;
  colorScheme: 'blue' | 'emerald';
  primaryText: string;
  secondaryText: string;
}

export function InfoBanner({
  onClick,
  ariaLabel,
  title,
  icon,
  colorScheme,
  primaryText,
  secondaryText,
}: InfoBannerProps) {
  const colors = {
    blue: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      hoverBg: 'hover:bg-blue-100',
      ring: 'focus-visible:ring-blue-500',
      iconText: 'text-blue-600',
      primaryText: 'text-blue-800',
      secondaryText: 'text-blue-700',
    },
    emerald: {
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      hoverBg: 'hover:bg-emerald-100',
      ring: 'focus-visible:ring-emerald-500',
      iconText: 'text-emerald-600',
      primaryText: 'text-emerald-800',
      secondaryText: 'text-emerald-700',
    },
  };

  const c = colors[colorScheme];

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      title={title}
      className={`w-full text-left ${c.bg} p-4 rounded-lg border ${c.border} ${c.hoverBg} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${c.ring} cursor-pointer`}
    >
      <div className="flex items-start">
        <span aria-hidden className={`material-symbols-outlined ${c.iconText} mr-3`}>{icon}</span>
        <div>
          <p className={`text-sm font-medium ${c.primaryText}`}>{primaryText}</p>
          <p className={`text-sm ${c.secondaryText}`}>{secondaryText}</p>
        </div>
        <span aria-hidden className={`ml-auto material-symbols-outlined ${c.iconText}`}>south</span>
      </div>
    </button>
  );
}
