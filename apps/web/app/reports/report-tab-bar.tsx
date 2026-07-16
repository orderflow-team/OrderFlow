export interface ReportTab {
  id: string;
  label: string;
}

export function ReportTabBar({ tabs, activeTab, onSelect }: {
  tabs: ReportTab[];
  activeTab: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex flex-nowrap gap-2 overflow-x-auto -mx-1 px-1 pt-3 -mt-3 pb-2 scrollbar-subtle">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onSelect(tab.id)}
            className={`shrink-0 whitespace-nowrap px-4 py-2 rounded-full text-sm font-semibold ring-1 cursor-pointer transition-colors backdrop-blur-sm ${
              isActive
                ? 'ring-emerald-500/30 text-emerald-700 bg-emerald-500/10'
                : 'ring-white/50 text-slate-700 bg-white/40 hover:bg-white/60'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
