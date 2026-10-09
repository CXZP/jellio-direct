import { type FC, useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, RefreshCw, Trash2 } from 'lucide-react';
import { glassButton, glassFrame } from '@/components/settings.tsx';
import { Button } from '@/components/ui/button';
import { getLogs, clearLogs, type LogEntry } from '@/services/backendService';

interface LogsViewerProps {
  accessToken?: string;
  defaultOpen?: boolean;
}

export const LogsViewer: FC<LogsViewerProps> = ({
  accessToken,
  defaultOpen = false,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const fetchLogs = useCallback(async () => {
    if (!accessToken) return;

    setLoading(true);
    try {
      const fetchedLogs = await getLogs({ token: accessToken, limit: 100 });
      setLogs(fetchedLogs);
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  const handleClearLogs = async () => {
    if (!accessToken) return;

    try {
      await clearLogs({ token: accessToken });
      setLogs([]);
    } catch (error) {
      console.error('Failed to clear logs:', error);
    }
  };

  useEffect(() => {
    if (isOpen) {
      void fetchLogs();
    }
  }, [isOpen, fetchLogs]);

  useEffect(() => {
    if (isOpen && autoRefresh) {
      const interval = setInterval(() => void fetchLogs(), 2000);
      return () => clearInterval(interval);
    }
  }, [isOpen, autoRefresh, fetchLogs]);

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'Error':
        return 'text-red-500';
      case 'Warning':
        return 'text-amber-500';
      default:
        return 'text-sky-600 dark:text-sky-400';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleString();
    } catch {
      return timestamp;
    }
  };

  return (
    <div className={`w-full overflow-hidden ${glassFrame}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between px-4 py-3 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Plugin log</span>
          {logs.length > 0 && (
            <span className="text-sm text-muted-foreground">
              ({logs.length} entries)
            </span>
          )}
        </div>
        {isOpen ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </button>

      {isOpen && (
        <div className="space-y-3 border-t border-black/5 p-4 dark:border-white/10">
          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="ghost"
              className={glassButton}
              onClick={() => void fetchLogs()}
              disabled={loading}
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`}
              />
              {loading ? 'Loading...' : 'Refresh'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className={glassButton}
              onClick={() => void handleClearLogs()}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Clear
            </Button>
            <Button
              type="button"
              variant="ghost"
              className={glassButton}
              onClick={() => setAutoRefresh(!autoRefresh)}
            >
              {autoRefresh ? 'Stop Auto-Refresh' : 'Auto-Refresh'}
            </Button>
          </div>
          <div className="h-96 w-full overflow-y-auto rounded-2xl border border-black/10 bg-background/80 p-4 font-mono text-xs leading-5 dark:border-white/10">
            {logs.length === 0 ? (
              <div className="text-center text-muted-foreground">
                No log entries yet.
              </div>
            ) : (
              <div className="space-y-1">
                {logs.map((log, index) => (
                  <div key={index} className="flex gap-2">
                    <span className="whitespace-nowrap text-muted-foreground">
                      {formatTimestamp(log.timestamp)}
                    </span>
                    <span
                      className={`${getLevelColor(log.level)} whitespace-nowrap`}
                    >
                      [{log.level}]
                    </span>
                    <span className="break-words">{log.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
