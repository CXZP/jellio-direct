import type { FC } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import type { ConfigFormType } from '@/components/configForm/formSchema.tsx';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form.tsx';
import { Input } from '@/components/ui/input.tsx';

interface Props {
  form: UseFormReturn<ConfigFormType>;
}

export const PublicBaseUrlField: FC<Props> = ({ form }) => {
  return (
    <FormField
      control={form.control}
      name="publicBaseUrl"
      render={({ field }) => (
        <FormItem className="rounded-lg border p-2">
          <FormLabel className="text-base">Public Base URL</FormLabel>
          <FormControl>
            <Input placeholder="https://jellyfin.example.com" {...field} />
          </FormControl>
          <FormDescription>
            HTTPS address where your other devices reach Jellyfin. Used for the
            addon link and for every poster, video and subtitle link inside it.
            Required behind Tailscale Serve or another HTTPS proxy. Leave empty
            to use the address of this page.
          </FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );
};
