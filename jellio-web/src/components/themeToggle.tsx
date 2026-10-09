import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/components/themeProvider.tsx';
import { Button } from '@/components/ui/button';
import { withViewTransition } from '@/lib/utils';

export function ThemeToggle() {
  const { setTheme, theme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() =>
        withViewTransition(() => setTheme(theme === 'light' ? 'dark' : 'light'))
      }
    >
      <Sun className="h-5 w-5 dark:hidden" />
      <Moon className="hidden h-5 w-5 dark:block" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
