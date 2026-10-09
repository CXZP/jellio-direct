import type { FC } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import type { ConfigFormType } from '@/components/configForm/formSchema.tsx';
import {
  optionDescription,
  SettingsRow,
  SettingsSelect,
  type PickerOption,
} from '@/components/settings.tsx';
import { FormField } from '@/components/ui/form.tsx';

interface Props {
  form: UseFormReturn<ConfigFormType>;
}

type EpisodeListSource = 'cinemeta' | 'jellyfin';

const OPTIONS: PickerOption<EpisodeListSource>[] = [
  {
    value: 'cinemeta',
    label: 'Cinemeta (IMDb)',
    recommended: true,
    description:
      "IMDb's episode list. Other addons (OpenSubtitles, stream addons) work with these series too, but specials can be numbered differently from Jellyfin.",
  },
  {
    value: 'jellyfin',
    label: 'Jellyfin',
    description:
      "Your Jellyfin seasons, numbering and thumbnails. Other addons don't recognize these series.",
  },
];

export const EpisodeListField: FC<Props> = ({ form }) => {
  return (
    <FormField
      control={form.control}
      name="episodeListSource"
      render={({ field }) => {
        const value = field.value ?? 'cinemeta';
        return (
          <SettingsRow
            label="Episode list"
            description={optionDescription(OPTIONS, value)}
            htmlFor="episodeListSource"
          >
            <SettingsSelect
              id="episodeListSource"
              value={value}
              onChange={field.onChange}
              options={OPTIONS}
            />
          </SettingsRow>
        );
      }}
    />
  );
};
