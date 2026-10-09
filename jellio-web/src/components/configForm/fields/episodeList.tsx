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
      'Series keep their IMDb id, so other addons such as OpenSubtitles find them too. Episode numbers and thumbnails follow IMDb.',
  },
  {
    value: 'jellyfin',
    label: 'Jellyfin',
    description:
      "Episodes as Jellyfin has them: same seasons, numbering and thumbnails. Other addons don't recognise these series.",
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
            Applies to series opened from this addon&apos;s catalogs. Changing
            it starts their watch progress in Stremio over, because the series
            get a different id.
          </FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );
};
