import type { FC } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import type { ConfigFormType } from '@/components/configForm/formSchema.tsx';
import { Button } from '@/components/ui/button.tsx';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form.tsx';
import { Label } from '@/components/ui/label.tsx';
import { cn } from '@/lib/utils.ts';

interface Props {
  form: UseFormReturn<ConfigFormType>;
}

type TranscodingMode = 'adaptive' | 'force' | 'disabled';
type StreamDeliveryMode = 'both' | 'direct' | 'hls';

export interface PickerOption<T extends string> {
  value: T;
  label: string;
  description: string;
}

const DEFAULT_VALUES = {
  videoTranscodingMode: 'adaptive' as const,
  audioTranscodingMode: 'adaptive' as const,
  enableDirectStreaming: true,
  forceTranscodeVideo: false,
  forceTranscodeAudio: false,
  maxVideoBitrate: 120,
  maxVideoHeight: 2160 as const,
  streamDeliveryMode: 'both' as const,
};

type MaxVideoHeight = '2160' | '1440' | '1080' | '720';

const MAX_HEIGHT_OPTIONS: PickerOption<MaxVideoHeight>[] = [
  {
    value: '2160',
    label: '4K',
    description: 'No scaling. 4K stays 4K, 1080p stays 1080p.',
  },
  {
    value: '1440',
    label: '1440p',
    description:
      'Video taller than 1440p is scaled down; smaller keeps its size.',
  },
  {
    value: '1080',
    label: '1080p',
    description:
      'Video taller than 1080p is scaled down. Good for phones and slow uploads.',
  },
  {
    value: '720',
    label: '720p',
    description:
      'Video taller than 720p is scaled down. For very slow connections.',
  },
];

const DELIVERY_MODE_OPTIONS: PickerOption<StreamDeliveryMode>[] = [
  {
    value: 'both',
    label: 'Direct + HLS',
    description:
      'Original file listed first, plus HLS streams that use the transcoding settings below.',
  },
  {
    value: 'direct',
    label: 'Direct only',
    description:
      'Original file with every audio track. Best for players such as mpv; no transcoding.',
  },
  {
    value: 'hls',
    label: 'HLS only',
    description:
      'Jellyfin HLS per audio track, transcoding as configured below.',
  },
];

const VIDEO_MODE_OPTIONS: PickerOption<TranscodingMode>[] = [
  {
    value: 'adaptive',
    label: 'Adaptive',
    description: 'Copy supported video; transcode only unsupported video.',
  },
  {
    value: 'force',
    label: 'Force transcode',
    description: 'Always re-encode video to H.264.',
  },
  {
    value: 'disabled',
    label: 'No transcode',
    description: 'Never request video transcoding; unsupported video may fail.',
  },
];

const AUDIO_MODE_OPTIONS: PickerOption<TranscodingMode>[] = [
  {
    value: 'adaptive',
    label: 'Adaptive',
    description: 'Copy supported audio; transcode only unsupported audio.',
  },
  {
    value: 'force',
    label: 'Force transcode',
    description: 'Always re-encode audio to AAC.',
  },
  {
    value: 'disabled',
    label: 'No transcode',
    description: 'Never request audio transcoding; unsupported audio may fail.',
  },
];

const modeSummary: Record<TranscodingMode, string> = {
  adaptive: 'adaptive fallback',
  force: 'forced transcode',
  disabled: 'no transcode',
};

export const ModePicker = <T extends string>({
  value,
  onChange,
  options,
  columns = 'md:grid-cols-3',
}: {
  value: T;
  onChange: (value: T) => void;
  options: PickerOption<T>[];
  columns?: string;
}) => (
  <div className={cn('grid gap-2', columns)}>
    {options.map((option) => {
      const selected = value === option.value;
      return (
        <button
          key={option.value}
          type="button"
          aria-pressed={selected}
          onClick={() => onChange(option.value)}
          className={cn(
            'min-h-24 rounded-md border px-3 py-2 text-left transition-colors',
            selected
              ? 'border-primary bg-primary text-primary-foreground'
              : 'bg-background hover:bg-accent hover:text-accent-foreground',
          )}
        >
          <span className="block text-sm font-medium">{option.label}</span>
          <span
            className={cn(
              'mt-1 block text-xs leading-5',
              selected ? 'text-primary-foreground/80' : 'text-muted-foreground',
            )}
          >
            {option.description}
          </span>
        </button>
      );
    })}
  </div>
);

export const TranscodingFieldset: FC<Props> = ({ form }) => {
  const videoTranscodingMode =
    form.watch('videoTranscodingMode') ?? DEFAULT_VALUES.videoTranscodingMode;
  const audioTranscodingMode =
    form.watch('audioTranscodingMode') ?? DEFAULT_VALUES.audioTranscodingMode;

  const setVideoMode = (mode: TranscodingMode) => {
    form.setValue('videoTranscodingMode', mode);
    form.setValue('enableDirectStreaming', mode !== 'force');
    form.setValue('forceTranscodeVideo', mode === 'force');
  };

  const setAudioMode = (mode: TranscodingMode) => {
    form.setValue('audioTranscodingMode', mode);
    form.setValue('forceTranscodeAudio', mode === 'force');
  };

  const handleReset = () => {
    form.setValue('videoTranscodingMode', DEFAULT_VALUES.videoTranscodingMode);
    form.setValue('audioTranscodingMode', DEFAULT_VALUES.audioTranscodingMode);
    form.setValue(
      'enableDirectStreaming',
      DEFAULT_VALUES.enableDirectStreaming,
    );
    form.setValue('forceTranscodeVideo', DEFAULT_VALUES.forceTranscodeVideo);
    form.setValue('forceTranscodeAudio', DEFAULT_VALUES.forceTranscodeAudio);
    form.setValue('maxVideoBitrate', DEFAULT_VALUES.maxVideoBitrate);
    form.setValue('maxVideoHeight', DEFAULT_VALUES.maxVideoHeight);
    form.setValue('streamDeliveryMode', DEFAULT_VALUES.streamDeliveryMode);
  };

  return (
    <div className="rounded-lg border p-2 space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-base">Playback Strategy</Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleReset}
          className="text-xs"
        >
          Reset to Recommended
        </Button>
      </div>

      <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
        <p className="font-medium">
          Video: {modeSummary[videoTranscodingMode]} · Audio:{' '}
          {modeSummary[audioTranscodingMode]}
        </p>
        <p className="text-muted-foreground">
          Adaptive mode preserves original tracks when Jellyfin can stream them,
          then transcodes only the unsupported track type.
        </p>
      </div>

      <FormField
        control={form.control}
        name="streamDeliveryMode"
        render={({ field }) => (
          <FormItem className="py-2">
            <FormLabel>Stream delivery</FormLabel>
            <FormControl>
              <ModePicker
                value={field.value ?? DEFAULT_VALUES.streamDeliveryMode}
                onChange={field.onChange}
                options={DELIVERY_MODE_OPTIONS}
              />
            </FormControl>
            <FormDescription>
              Direct streams skip Jellyfin&apos;s transcoder entirely, so the
              settings below only affect HLS streams.
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="videoTranscodingMode"
        render={({ field }) => (
          <FormItem className="py-2">
            <FormLabel>Video transcoding</FormLabel>
            <FormControl>
              <ModePicker
                value={field.value ?? DEFAULT_VALUES.videoTranscodingMode}
                onChange={setVideoMode}
                options={VIDEO_MODE_OPTIONS}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="audioTranscodingMode"
        render={({ field }) => (
          <FormItem className="py-2">
            <FormLabel>Audio transcoding</FormLabel>
            <FormControl>
              <ModePicker
                value={field.value ?? DEFAULT_VALUES.audioTranscodingMode}
                onChange={setAudioMode}
                options={AUDIO_MODE_OPTIONS}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="maxVideoBitrate"
        render={({ field }) => (
          <FormItem className="py-2">
            <div className="flex items-center justify-between">
              <FormLabel>
                Jellyfin video bitrate ceiling: {field.value} Mbps
              </FormLabel>
            </div>
            <FormControl>
              <input
                type="range"
                min="2"
                max="200"
                step="2"
                className="w-full"
                value={field.value}
                onChange={(e) => field.onChange(parseInt(e.target.value))}
              />
            </FormControl>
            <FormDescription>
              A low ceiling can trigger Jellyfin transcoding even when direct
              streaming is preferred. Use a high value for quality testing, then
              lower it only if the network buffers.
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="maxVideoHeight"
        render={({ field }) => (
          <FormItem className="py-2">
            <FormLabel>Max resolution</FormLabel>
            <FormControl>
              <ModePicker
                value={
                  String(
                    field.value ?? DEFAULT_VALUES.maxVideoHeight,
                  ) as MaxVideoHeight
                }
                onChange={(value) => field.onChange(Number(value))}
                options={MAX_HEIGHT_OPTIONS}
                columns="grid-cols-2 md:grid-cols-4"
              />
            </FormControl>
            <FormDescription>
              Taller video is transcoded down to this size. At a low bitrate
              ceiling, a smaller picture looks cleaner than a blocky 4K one.
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
};
