import type { FC } from 'react';
import { useEffect, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  ChevronDown,
  Download,
  Globe,
  Inbox,
  PanelLeftClose,
  PanelLeftOpen,
  Play,
  Rows3,
  Import,
  ScrollText,
  Server,
  Tv,
  type LucideIcon,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import {
  LibrariesField,
  ServerNameField,
  JellyseerrFieldset,
  PublicBaseUrlField,
  TranscodingFieldset,
  EpisodeListField,
} from '@/components/configForm/fields';
import { formSchema } from '@/components/configForm/formSchema.tsx';
import { InstallUrlsContainer } from '@/components/configForm/installUrls/InstallUrlsContainer';
import { LogsViewer } from '@/components/logsViewer';
import {
  glassButton,
  menuMotion,
  SettingsGroup,
  usePopover,
} from '@/components/settings.tsx';
import { ThemeToggle } from '@/components/themeToggle.tsx';
import { Tip } from '@/components/tooltip.tsx';
import { Button } from '@/components/ui/button.tsx';
import { Form } from '@/components/ui/form';
import { useConfigStorage } from '@/hooks/useConfigStorage';
import { cn, stripTrailingSlash, withViewTransition } from '@/lib/utils';
import { saveConfigToServer } from '@/services/backendService';
import type { ServerInfo } from '@/types';

interface Props {
  serverInfo: ServerInfo;
  insecure?: boolean;
}

const SIDEBAR_KEY = 'jelliodirect_sidebar';
const LAYOUT_KEY = 'jelliodirect_layout';

type Layout = 'pages' | 'scroll';

const SECTIONS: {
  id: string;
  label: string;
  icon: LucideIcon;
  color: string;
}[] = [
  { id: 'general', label: 'General', icon: Server, color: 'bg-gray-500' },
  { id: 'connection', label: 'Connection', icon: Globe, color: 'bg-blue-500' },
  { id: 'series', label: 'Series', icon: Tv, color: 'bg-purple-500' },
  { id: 'playback', label: 'Playback', icon: Play, color: 'bg-red-500' },
  {
    id: 'jellyseerr',
    label: 'Jellyseerr',
    icon: Inbox,
    color: 'bg-indigo-500',
  },
  { id: 'install', label: 'Install', icon: Download, color: 'bg-green-500' },
  { id: 'logs', label: 'Logs', icon: ScrollText, color: 'bg-orange-500' },
];

type Section = (typeof SECTIONS)[number];

// Phone navigation: the current section as a button that opens every section in a list.
const SectionMenu: FC<{
  current: Section;
  onSelect: (id: string) => void;
}> = ({ current, onSelect }) => {
  const menu = usePopover();
  const CurrentIcon = current.icon;
  return (
    <div ref={menu.ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={menu.shown}
        onClick={() => (menu.shown ? menu.hide() : menu.show())}
        className="flex items-center gap-2 rounded-full py-1 pr-3 pl-1 text-base font-semibold hover:bg-accent"
      >
        <span
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-lg text-white',
            current.color,
          )}
        >
          <CurrentIcon className="h-4 w-4" />
        </span>
        {current.label}
        <ChevronDown
          className={cn(
            'h-4 w-4 transition-transform',
            menu.shown && 'rotate-180',
          )}
        />
      </button>
      {menu.open && (
        <div
          role="menu"
          className={cn(
            'absolute top-full left-0 z-30 mt-2 w-64 origin-top-left space-y-0.5 rounded-2xl p-1.5 border border-black/10 bg-white/80 shadow-2xl backdrop-blur-2xl backdrop-saturate-150 dark:border-white/10 dark:bg-zinc-900/80',
            menuMotion(menu.closing),
          )}
        >
          {SECTIONS.map(({ id, label, icon: Icon, color }) => (
            <button
              key={id}
              type="button"
              role="menuitem"
              onClick={() => {
                menu.hide();
                onSelect(id);
              }}
              className={cn(
                'flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-sm font-medium',
                id === current.id
                  ? 'bg-blue-500 text-white'
                  : 'hover:bg-accent',
              )}
            >
              <span
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-lg text-white',
                  color,
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const ConfigForm: FC<Props> = ({ serverInfo, insecure = false }) => {
  const [sectionId, setSectionId] = useState('general');
  // The sidebar can shrink to its icons; the choice is remembered on this browser.
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_KEY) === 'collapsed';
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_KEY, collapsed ? 'collapsed' : 'open');
    } catch {
      // Private windows can refuse storage; the sidebar just won't be remembered.
    }
  }, [collapsed]);
  // One section at a time, or every section on one scrolling page.
  const [layout, setLayout] = useState<Layout>(() => {
    try {
      return localStorage.getItem(LAYOUT_KEY) === 'scroll' ? 'scroll' : 'pages';
    } catch {
      return 'pages';
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(LAYOUT_KEY, layout);
    } catch {
      // Not remembered in private windows.
    }
  }, [layout]);
  const mainRef = useRef<HTMLElement>(null);
  const jumpTargetRef = useRef<string | null>(null);
  // On the one-page layout, highlight the section being read in the sidebar.
  useEffect(() => {
    if (layout !== 'scroll') return;
    const main = mainRef.current;
    if (!main) return;
    const scrollsItself = getComputedStyle(main).overflowY === 'auto';
    const scroller: HTMLElement | Window = scrollsItself ? main : window;
    // The section being read is the last one whose heading has passed the top quarter.
    let settleTimer: ReturnType<typeof setTimeout> | undefined;
    const update = () => {
      if (jumpTargetRef.current) {
        clearTimeout(settleTimer);
        settleTimer = setTimeout(() => {
          jumpTargetRef.current = null;
        }, 150);
        return;
      }
      const top = scrollsItself ? main.getBoundingClientRect().top : 0;
      const line =
        top + (scrollsItself ? main.clientHeight : window.innerHeight) / 4;
      let current = SECTIONS[0].id;
      main
        .querySelectorAll<HTMLElement>('[data-section]')
        .forEach((element) => {
          if (element.getBoundingClientRect().top <= line) {
            current = element.dataset.section ?? current;
          }
        });
      setSectionId(current);
    };
    update();
    scroller.addEventListener('scroll', update, { passive: true });
    return () => {
      clearTimeout(settleTimer);
      scroller.removeEventListener('scroll', update);
    };
  }, [layout]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      serverName: serverInfo.serverName,
      libraries: [],
      jellyseerrEnabled: false,
      jellyseerrUrl: '',
      jellyseerrApiKey: '',
      publicBaseUrl: '',
      // Transcoding settings
      videoTranscodingMode: 'adaptive',
      audioTranscodingMode: 'adaptive',
      enableDirectStreaming: true,
      forceTranscodeVideo: false,
      forceTranscodeAudio: false,
      maxVideoBitrate: 120,
      maxVideoHeight: 2160,
      episodeListSource: 'cinemeta',
      streamDeliveryMode: 'both',
    },
  });

  const { saveConfig } = useConfigStorage(
    form,
    serverInfo.accessToken,
    serverInfo.libraries,
  );

  const serverName = form.watch('serverName');

  const handleSaveToServer = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const values = form.getValues();
      saveConfig();
      await saveConfigToServer({
        config: {
          jellyseerrEnabled: values.jellyseerrEnabled ?? false,
          jellyseerrUrl: stripTrailingSlash(values.jellyseerrUrl ?? ''),
          jellyseerrApiKey: values.jellyseerrApiKey ?? '',
          publicBaseUrl: stripTrailingSlash(values.publicBaseUrl ?? ''),
          selectedLibraries:
            values.libraries?.map((lib: { key: string }) =>
              lib.key.replace(/-/g, ''),
            ) ?? [],
          // Transcoding settings
          videoTranscodingMode: values.videoTranscodingMode ?? 'adaptive',
          audioTranscodingMode: values.audioTranscodingMode ?? 'adaptive',
          enableDirectStreaming: values.enableDirectStreaming ?? true,
          forceTranscodeVideo: values.forceTranscodeVideo ?? false,
          forceTranscodeAudio: values.forceTranscodeAudio ?? false,
          maxVideoBitrate: values.maxVideoBitrate ?? 120,
          maxVideoHeight: values.maxVideoHeight ?? 2160,
          episodeListSource: values.episodeListSource ?? 'cinemeta',
          streamDeliveryMode: values.streamDeliveryMode ?? 'both',
        },
        token: serverInfo.accessToken,
      });

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      console.error('Failed to save configuration:', error);
      alert('Failed to save configuration to server');
    } finally {
      setSaving(false);
    }
  };

  const section = SECTIONS.find((s) => s.id === sectionId) ?? SECTIONS[0];

  const sectionContent = (id: string) => {
    switch (id) {
      case 'general':
        return (
          <>
            <SettingsGroup>
              <ServerNameField form={form} />
            </SettingsGroup>
            <SettingsGroup title="Catalogs">
              <LibrariesField
                form={form}
                serverName={serverName}
                libraries={serverInfo.libraries}
              />
            </SettingsGroup>
          </>
        );
      case 'connection':
        return (
          <SettingsGroup footer="Needed when Stremio runs on another device, and always behind Tailscale Serve or another HTTPS proxy. Leave it empty if Stremio only runs on this computer.">
            <PublicBaseUrlField form={form} />
          </SettingsGroup>
        );
      case 'series':
        return (
          <SettingsGroup footer="Applies to series opened from this addon's catalogs. Switching resets their watch progress in Stremio.">
            <EpisodeListField form={form} />
          </SettingsGroup>
        );
      case 'playback':
        return <TranscodingFieldset form={form} />;
      case 'jellyseerr':
        return <JellyseerrFieldset form={form} />;
      case 'install':
        return <InstallUrlsContainer form={form} serverInfo={serverInfo} />;
      case 'logs':
        return <LogsViewer accessToken={serverInfo.accessToken} defaultOpen />;
      default:
        return null;
    }
  };

  const goTo = (id: string) => {
    setSectionId(id);
    if (layout === 'scroll') {
      jumpTargetRef.current = id;
      document
        .getElementById(`section-${id}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const sidebarButtons = (
    <>
      <Tip label="Light or dark">
        <ThemeToggle />
      </Tip>
      <Tip
        label={
          layout === 'scroll'
            ? 'Show one section at a time'
            : 'Show all settings on one page'
        }
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-pressed={layout === 'scroll'}
          onClick={() =>
            withViewTransition(
              () => setLayout((l) => (l === 'scroll' ? 'pages' : 'scroll')),
              // One page drops down into place; back to sections lifts up.
              layout === 'scroll' ? 'up' : 'down',
            )
          }
          aria-label="Show all settings on one page"
          className={cn(layout === 'scroll' && 'bg-accent')}
        >
          <Rows3 className="h-5 w-5" />
        </Button>
      </Tip>
    </>
  );

  return (
    <Form {...form}>
      <div className="min-h-screen bg-background md:flex md:h-screen md:gap-3 md:p-3">
        {/* Sidebar like iPadOS/macOS settings: a rounded panel beside the content. */}
        <aside
          className={cn(
            // Only the width animates; everything inside keeps its layout and is clipped,
            // so nothing reflows mid-animation. The curve settles like iOS sheets.
            'hidden shrink-0 flex-col overflow-x-hidden overflow-y-auto rounded-[24px] bg-muted/70 p-3 transition-[width] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] md:flex dark:bg-white/[0.06]',
            collapsed ? 'w-[4.5rem]' : 'w-64',
          )}
        >
          <div className="flex items-center gap-1 pb-3">
            <Tip
              label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              side={collapsed ? 'right' : 'bottom'}
              align="start"
              className="ml-0.5 shrink-0"
            >
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setCollapsed((c) => !c)}
                aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                {collapsed ? (
                  <PanelLeftOpen className="h-5 w-5" />
                ) : (
                  <PanelLeftClose className="h-5 w-5" />
                )}
              </Button>
            </Tip>
            <span
              className={cn(
                'min-w-0 flex-1 overflow-hidden text-lg font-semibold whitespace-nowrap transition-opacity duration-300',
                collapsed && 'opacity-0',
              )}
            >
              Jellio Direct
            </span>
            <div
              className={cn(
                'flex shrink-0 items-center overflow-hidden transition-[width,opacity] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]',
                collapsed ? 'w-0 opacity-0' : 'w-[4.5rem] opacity-100',
              )}
            >
              {sidebarButtons}
            </div>
          </div>
          <nav className="flex flex-col gap-1">
            {SECTIONS.map(({ id, label, icon: Icon, color }) => (
              <Tip key={id} label={label} side="right" enabled={collapsed}>
                <button
                  type="button"
                  onClick={() => goTo(id)}
                  aria-current={id === section.id ? 'page' : undefined}
                  className={cn(
                    'flex w-full items-center gap-3 overflow-hidden rounded-xl px-2.5 py-2 text-left text-sm font-medium transition-colors',
                    id === section.id
                      ? 'bg-blue-500 text-white'
                      : 'hover:bg-black/5 dark:hover:bg-white/10',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white',
                      color,
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span
                    className={cn(
                      'whitespace-nowrap transition-opacity duration-300',
                      collapsed && 'opacity-0',
                    )}
                  >
                    {label}
                  </span>
                </button>
              </Tip>
            ))}
          </nav>
        </aside>

        {/* Phones: a top bar whose section button opens a vertical list. */}
        <header className="sticky top-0 z-20 flex items-center gap-2 border-b bg-background/85 px-4 py-2.5 backdrop-blur-xl md:hidden">
          <SectionMenu current={section} onSelect={goTo} />
          <div className="ml-auto flex items-center">{sidebarButtons}</div>
        </header>

        <div className="flex min-w-0 flex-1 flex-col md:min-h-0 md:overflow-hidden">
          <main
            ref={mainRef}
            className="vt-content flex-1 md:min-h-0 md:overflow-y-auto"
          >
            <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 md:px-8">
              {insecure && (
                <div className="rounded-xl bg-yellow-100 p-4 text-sm text-yellow-800">
                  Stremio requires addons over HTTPS or from localhost. Open
                  this page over HTTPS or from 127.0.0.1 to install the addon.
                </div>
              )}
              {layout === 'pages' ? (
                <>
                  <h2 className="text-2xl font-semibold">{section.label}</h2>
                  {sectionContent(section.id)}
                </>
              ) : (
                SECTIONS.map(({ id, label }) => (
                  <section
                    key={id}
                    id={`section-${id}`}
                    data-section={id}
                    className="scroll-mt-20 space-y-4 pb-4 md:scroll-mt-6"
                  >
                    <h2 className="text-2xl font-semibold">{label}</h2>
                    {sectionContent(id)}
                  </section>
                ))
              )}
            </div>
          </main>

          <footer className="sticky bottom-0 border-t bg-background/85 backdrop-blur-xl">
            <div className="mx-auto flex max-w-4xl items-center justify-end gap-3 px-4 py-3 md:px-8">
              <span className="text-xs text-muted-foreground">
                Settings are saved on the server and apply to every device.
              </span>
              <Button
                type="button"
                variant="ghost"
                className={`${glassButton} px-5 font-semibold`}
                onClick={() => void handleSaveToServer()}
                disabled={saving}
              >
                <Import className="mr-2 h-4 w-4 text-blue-500" />
                {saved ? 'Saved' : saving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </footer>
        </div>
      </div>
    </Form>
  );
};

export default ConfigForm;
