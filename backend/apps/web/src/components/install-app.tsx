'use client';

import { Check, Download, MonitorDown } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

/** Chrome/Edge's install prompt event (not in the standard DOM types yet). */
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type Where = 'installed' | 'prompt' | 'safari' | 'insecure' | 'manual';

/**
 * "Install on this computer": the web dashboard as a desktop app on Windows and macOS
 * (own window, Start menu / Dock icon). Uses the browser's install prompt when available,
 * otherwise shows the steps for this browser.
 */
export function InstallAppCard() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [where, setWhere] = useState<Where>('manual');

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches;
    const ua = navigator.userAgent;
    const isSafari = /Safari\//.test(ua) && !/Chrome|Chromium|Edg\//.test(ua);
    setWhere(
      standalone
        ? 'installed'
        : !window.isSecureContext
          ? 'insecure'
          : isSafari
            ? 'safari'
            : 'manual',
    );
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPromptEvent);
      setWhere('prompt');
    };
    const onInstalled = () => setWhere('installed');
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  async function install() {
    if (!prompt) return;
    await prompt.prompt();
    if ((await prompt.userChoice).outcome === 'accepted') setWhere('installed');
    setPrompt(null);
  }

  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MonitorDown className="size-4" aria-hidden /> Install on this computer
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted">
          Opens MSMA HRIS in its own window with an icon in the Start menu (Windows) or the Dock
          (Mac), like a normal program. Nothing else to download; updates arrive automatically.
        </p>
        {where === 'installed' && (
          <p className="flex items-center gap-2 text-success">
            <Check className="size-4" aria-hidden /> Installed on this computer.
          </p>
        )}
        {where === 'prompt' && (
          <Button onClick={install}>
            <Download /> Install MSMA HRIS
          </Button>
        )}
        {where === 'safari' && (
          <p>
            In Safari: open the <strong>File</strong> menu and choose <strong>Add to Dock</strong>.
          </p>
        )}
        {where === 'manual' && (
          <p>
            In Chrome or Edge: click the install icon at the right end of the address bar, or open
            the browser menu (⋮ or …) and choose <strong>Install MSMA HRIS</strong> (Chrome: Cast,
            save and share → Install page as app; Edge: Apps → Install this site as an app).
          </p>
        )}
        {where === 'insecure' && (
          <p>
            Installing needs a secure address (https, or this computer). Open MSMA HRIS through its
            https link to install it.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
