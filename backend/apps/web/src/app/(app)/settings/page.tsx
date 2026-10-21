'use client';

import {
  LABELS,
  type Preferences,
  type TableDensity,
  type TextSize,
  type ThemePreference,
} from '@msma/shared';
import { Monitor, Moon, Sun } from 'lucide-react';
import { InstallAppCard } from '@/components/install-app';
import { PageHeader } from '@/components/page-header';
import { useToast } from '@/components/toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { effectiveTheme } from '@/lib/appearance';
import { useAuth } from '@/lib/auth';
import { useUpdatePreferences } from '@/lib/queries';
import { cn } from '@/lib/utils';

function Choice<T extends string>({
  name,
  value,
  options,
  onChange,
}: {
  name: string;
  value: T;
  options: {
    value: T;
    label: string;
    hint: string;
    icon?: React.ComponentType<{ className?: string }>;
  }[];
  onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={name} className="grid gap-2 sm:grid-cols-3">
      {options.map((o) => (
        <label
          key={o.value}
          className={cn(
            'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors',
            value === o.value ? 'border-accent bg-accent-soft' : 'border-border hover:bg-bg',
          )}
        >
          <input
            type="radio"
            name={name}
            value={o.value}
            aria-label={`${o.label}: ${o.hint}`}
            className="mt-1 accent-[var(--accent)]"
            checked={value === o.value}
            onChange={() => onChange(o.value)}
          />
          <span>
            <span className="flex items-center gap-1.5 text-sm font-medium">
              {o.icon && <o.icon className="size-4" />} {o.label}
            </span>
            <span className="text-xs text-muted">{o.hint}</span>
          </span>
        </label>
      ))}
    </div>
  );
}

export default function SettingsPage() {
  const { user } = useAuth();
  const update = useUpdatePreferences();
  const toast = useToast();
  if (!user) return null;
  const prefs = user.preferences;

  const save = (patch: Partial<Preferences>) =>
    update.mutate(patch, {
      onSuccess: () => toast('success', 'Saved. This setting follows you on any computer.'),
      onError: (e) => toast('error', e.message),
    });

  return (
    <>
      <PageHeader title="Settings" subtitle="Appearance is saved to your account." sample={false} />
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <section>
            <h3 className="mb-2 text-sm font-medium">Theme</h3>
            <Choice<ThemePreference>
              name="Theme"
              value={effectiveTheme(prefs)}
              onChange={(theme) => save({ theme })}
              options={[
                {
                  value: 'LIGHT',
                  label: LABELS.theme.LIGHT,
                  hint: 'Best in bright offices (default)',
                  icon: Sun,
                },
                {
                  value: 'DARK',
                  label: LABELS.theme.DARK,
                  hint: 'Easier on the eyes at night',
                  icon: Moon,
                },
                {
                  value: 'SYSTEM',
                  label: LABELS.theme.SYSTEM,
                  hint: 'Follows your computer setting',
                  icon: Monitor,
                },
              ]}
            />
          </section>
          <section>
            <h3 className="mb-2 text-sm font-medium">Text size</h3>
            <Choice<TextSize>
              name="Text size"
              value={prefs.textSize}
              onChange={(textSize) => save({ textSize })}
              options={[
                { value: 'STANDARD', label: 'Standard', hint: 'Default size' },
                { value: 'LARGE', label: 'Large', hint: 'Bigger text everywhere' },
              ]}
            />
          </section>
          <section>
            <h3 className="mb-2 text-sm font-medium">Table density</h3>
            <Choice<TableDensity>
              name="Table density"
              value={prefs.tableDensity}
              onChange={(tableDensity) => save({ tableDensity })}
              options={[
                { value: 'COMFORTABLE', label: 'Comfortable', hint: 'More space between rows' },
                { value: 'COMPACT', label: 'Compact', hint: 'More rows on screen (payroll)' },
              ]}
            />
          </section>
        </CardContent>
      </Card>
      <div className="mt-4">
        <InstallAppCard />
      </div>
    </>
  );
}
