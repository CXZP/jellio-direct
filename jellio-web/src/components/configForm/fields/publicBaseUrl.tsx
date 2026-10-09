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

export const PublicBaseUrlField: FC<Props> = ({ form }) => {
  return (
    <FormField
      control={form.control}
      name="publicBaseUrl"
      render={({ field, fieldState }) => (
        <SettingsRow
          stacked
          label="Public Base URL"
          description="The HTTPS address your other devices use to reach Jellyfin. Posters, videos and subtitles are linked through it."
          htmlFor="publicBaseUrl"
          error={fieldState.error?.message}
        >
          <Input
            id="publicBaseUrl"
            className={glassField}
            placeholder="https://jellyfin.example.com"
            {...field}
          />
        </SettingsRow>
      )}
    />
  );
};
