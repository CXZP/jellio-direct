import type { FC } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import type { ConfigFormType } from '@/components/configForm/formSchema.tsx';
import {
  glassField,
  SettingsGroup,
  SettingsRow,
  Switch,
} from '@/components/settings.tsx';
import { FormField } from '@/components/ui/form.tsx';
import { Input } from '@/components/ui/input.tsx';

interface Props {
  form: UseFormReturn<ConfigFormType>;
}

export const JellyseerrFieldset: FC<Props> = ({ form }) => {
  const enabled = form.watch('jellyseerrEnabled');
  return (
    <SettingsGroup>
      <FormField
        control={form.control}
        name="jellyseerrEnabled"
        render={({ field }) => (
          <SettingsRow
            label="Request via Jellyseerr"
            description="Offer a request option in Stremio when a title isn't on your server."
            htmlFor="jellyseerrEnabled"
          >
            <Switch
              id="jellyseerrEnabled"
              checked={field.value ?? false}
              onCheckedChange={field.onChange}
            />
          </SettingsRow>
        )}
      />
      {enabled && (
        <>
          <FormField
            control={form.control}
            name="jellyseerrUrl"
            render={({ field, fieldState }) => (
              <SettingsRow
                stacked
                label="Jellyseerr URL"
                description="Your local address, without a trailing slash."
                htmlFor="jellyseerrUrl"
                error={fieldState.error?.message}
              >
                <Input
                  id="jellyseerrUrl"
                  className={glassField}
                  placeholder="http://192.168.0.105:5055"
                  {...field}
                />
              </SettingsRow>
            )}
          />
          <FormField
            control={form.control}
            name="jellyseerrApiKey"
            render={({ field }) => (
              <SettingsRow
                stacked
                label="API key"
                description="Needed to send requests to Jellyseerr."
                htmlFor="jellyseerrApiKey"
              >
                <Input
                  id="jellyseerrApiKey"
                  className={glassField}
                  type="password"
                  placeholder="Paste the API key"
                  {...field}
                />
              </SettingsRow>
            )}
          />
        </>
      )}
    </SettingsGroup>
  );
};
