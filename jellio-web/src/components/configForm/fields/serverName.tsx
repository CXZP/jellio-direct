import type { FC } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import type { ConfigFormType } from '@/components/configForm/formSchema.tsx';
import { SettingsRow } from '@/components/settings.tsx';
import { glassField } from '@/components/settings.tsx';
import { FormField } from '@/components/ui/form.tsx';
import { Input } from '@/components/ui/input.tsx';

interface Props {
  form: UseFormReturn<ConfigFormType>;
}

export const ServerNameField: FC<Props> = ({ form }) => {
  return (
    <FormField
      control={form.control}
      name="serverName"
      render={({ field, fieldState }) => (
        <SettingsRow
          label="Server name"
          description="Shown after each catalog name in Stremio, e.g. “Movies | Jellyfin”."
          htmlFor="serverName"
          error={fieldState.error?.message}
        >
          <Input
            id="serverName"
            className={`w-full sm:w-64 ${glassField}`}
            {...field}
          />
        </SettingsRow>
      )}
    />
  );
};
