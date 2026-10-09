import type { FC } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import type { ConfigFormType } from '@/components/configForm/formSchema.tsx';
import { SettingsRow, Switch } from '@/components/settings.tsx';
import { FormField } from '@/components/ui/form.tsx';
import type { Library } from '@/types';

interface Props {
  form: UseFormReturn<ConfigFormType>;
  serverName: string;
  libraries: Library[];
}

export const LibrariesField: FC<Props> = ({ form, serverName, libraries }) => {
  return (
    <FormField
      control={form.control}
      name="libraries"
      render={({ field }) =>
        libraries.length > 0 ? (
          <>
            {libraries.map((item: Library) => {
              const checked = field.value.some((v) => v.key === item.key);
              return (
                <SettingsRow
                  key={item.key}
                  label={item.name}
                  description={`Shown in Stremio as “${item.name} | ${serverName}”.`}
                  htmlFor={`library-${item.key}`}
                >
                  <Switch
                    id={`library-${item.key}`}
                    checked={checked}
                    onCheckedChange={(on) =>
                      field.onChange(
                        on
                          ? [
                              ...field.value,
                              {
                                key: item.key,
                                name: item.name,
                                type: item.type,
                              },
                            ]
                          : field.value.filter(
                              (value) => value.key !== item.key,
                            ),
                      )
                    }
                  />
                </SettingsRow>
              );
            })}
          </>
        ) : (
          <SettingsRow
            label="No libraries found"
            description="Only movie and show libraries can become catalogs."
          />
        )
      }
    />
  );
};
