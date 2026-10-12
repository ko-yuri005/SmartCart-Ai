import React from 'react';
import { ExtractedRequirements } from '../../types/shopping';
import { Tag, DollarSign, Activity, Sparkles, Building2 } from 'lucide-react';

interface FilterBadgesProps {
  requirements?: Partial<ExtractedRequirements>;
}

export const FilterBadges: React.FC<FilterBadgesProps> = ({ requirements }) => {
  if (!requirements) return null;

  const badges: { label: string; icon: React.ReactNode; type: string }[] = [];

  if (requirements.category) {
    badges.push({
      label: requirements.category,
      icon: <Tag className="w-3 h-3 text-[#254B3B]" />,
      type: 'category',
    });
  }

  if (requirements.max_price) {
    badges.push({
      label: `Under ₹${requirements.max_price.toLocaleString('en-IN')}`,
      icon: <DollarSign className="w-3 h-3 text-emerald-700" />,
      type: 'price',
    });
  }

  if (requirements.min_price) {
    badges.push({
      label: `Above ₹${requirements.min_price.toLocaleString('en-IN')}`,
      icon: <DollarSign className="w-3 h-3 text-emerald-700" />,
      type: 'price',
    });
  }

  if (requirements.brand) {
    badges.push({
      label: requirements.brand,
      icon: <Building2 className="w-3 h-3 text-amber-700" />,
      type: 'brand',
    });
  }

  if (requirements.use_cases && requirements.use_cases.length > 0) {
    requirements.use_cases.forEach((useCase) => {
      badges.push({
        label: useCase,
        icon: <Activity className="w-3 h-3 text-sky-700" />,
        type: 'use_case',
      });
    });
  }

  if (requirements.features && requirements.features.length > 0) {
    requirements.features.forEach((feature) => {
      badges.push({
        label: feature,
        icon: <Sparkles className="w-3 h-3 text-[#254B3B]" />,
        type: 'feature',
      });
    });
  }

  if (badges.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 py-2 px-4 bg-[#F3EFE6] border-b border-[#E6E1D6] text-xs">
      <span className="text-[11px] uppercase tracking-wider text-zinc-600 font-semibold mr-1">
        Active Filters:
      </span>
      {badges.map((badge, idx) => (
        <span
          key={idx}
          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white border border-[#E6E1D6] text-zinc-800 text-xs font-medium capitalize shadow-sm"
        >
          {badge.icon}
          <span>{badge.label}</span>
        </span>
      ))}
    </div>
  );
};
