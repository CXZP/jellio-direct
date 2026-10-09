import type { FC } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { ModePicker, type PickerOption } from './transcoding.tsx';
import type { ConfigFormType } from '@/components/configForm/formSchema.tsx';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form.tsx';

interface Props {
  form: UseFormReturn<ConfigFormType>;
}

type EpisodeListSource = 'cinemeta' | 'jellyfin';

const OPTIONS: PickerOption<EpisodeListSource>[] = [
  {
    value: 'cinemeta',
    label: 'Cinemeta (IMDb)',
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
      render={({ field }) => (
        <FormItem className="rounded-lg border p-2">
          <FormLabel className="text-base">Series episode list</FormLabel>
          <FormControl>
            <ModePicker
              value={field.value ?? 'cinemeta'}
              onChange={field.onChange}
              options={OPTIONS}
              columns="md:grid-cols-2"
            />
          </FormControl>
          <FormDescription>
            Only affects series opened from this addon&apos;s catalogs.
            Switching gives them a new id in Stremio, so their watch progress
            starts over.
          </FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );
};
