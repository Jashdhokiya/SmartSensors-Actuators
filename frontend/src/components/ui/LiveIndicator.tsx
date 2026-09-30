import React from 'react';

interface Props {
  lastUpdate?: number;
  className?: string;
  label?: string;
}

export const LiveIndicator: React.FC<Props> = ({ lastUpdate, className = '', label = 'Live' }) => {
  const [ago, setAgo] = React.useState('just now');

  React.useEffect(() => {
    const update = () => {
      if (!lastUpdate) { setAgo('–'); return; }
      const diff = Date.now() - lastUpdate;
      if (diff < 5000) setAgo('just now');
      else if (diff < 60000) setAgo(`${Math.floor(diff / 1000)}s ago`);
      else setAgo(`${Math.floor(diff / 60000)}m ago`);
    };
    update();
    const id = setInterval(update, 2000);
    return () => clearInterval(id);
  }, [lastUpdate]);

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <span className="relative flex h-2.5 w-2.5">
        <span className="live-ripple absolute inline-flex h-full w-full rounded-full bg-[#16A34A] opacity-75" />
        <span className="live-dot relative inline-flex rounded-full h-2.5 w-2.5 bg-[#16A34A]" />
      </span>
      <span className="text-xs font-semibold text-[#16A34A] uppercase tracking-wide">{label}</span>
      {lastUpdate && (
        <span className="text-xs text-[#9CA3AF]">· {ago}</span>
      )}
    </div>
  );
};
