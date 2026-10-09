import type { FC } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import type { ConfigFormType } from '@/components/configForm/formSchema.tsx';
import {
  optionDescription,
  SettingsGroup,
  SettingsRow,
  SettingsSelect,
  SettingsSlider,
  type PickerOption,
} from '@/components/settings.tsx';
import { FormField } from '@/components/ui/form.tsx';

interface Props {
  form: UseFormReturn<ConfigFormType>;
}

type TranscodingMode = 'adaptive' | 'force' | 'disabled';
type StreamDeliveryMode = 'both' | 'direct' | 'hls';
type MaxVideoHeight = '2160' | '1440' | '1080' | '720';

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

const DELIVERY_MODE_OPTIONS: PickerOption<StreamDeliveryMode>[] = [
  {
    value: 'both',
    label: 'Direct + HLS',
    recommended: true,
    description:
      'Original file listed first, plus HLS streams that use the settings below.',
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
    description: 'Jellyfin HLS per audio track, using the settings below.',
  },
];

const VIDEO_MODE_OPTIONS: PickerOption<TranscodingMode>[] = [
  {
    value: 'adaptive',
    label: 'Adaptive',
    recommended: true,
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
    recommended: true,
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

const MAX_HEIGHT_OPTIONS: PickerOption<MaxVideoHeight>[] = [
  {
    value: '2160',
    label: '4K',
    recommended: true,
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

export const TranscodingFieldset: FC<Props> = ({ form }) => {
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
    <div className="space-y-6">
      <SettingsGroup title="Streams">
        <FormField
          control={form.control}
          name="streamDeliveryMode"
          render={({ field }) => {
            const value = field.value ?? DEFAULT_VALUES.streamDeliveryMode;
            return (
              <SettingsRow
                label="Stream delivery"
                description={optionDescription(DELIVERY_MODE_OPTIONS, value)}
                htmlFor="streamDeliveryMode"
              >
                <SettingsSelect
                  id="streamDeliveryMode"
                  value={value}
                  onChange={field.onChange}
                  options={DELIVERY_MODE_OPTIONS}
                />
              </SettingsRow>
            );
          }}
        />
      </SettingsGroup>

      <SettingsGroup
        title="HLS transcoding"
        description="Only for the HLS entries. Jellio Direct always plays the original file."
        footer={
          <div className="flex items-start justify-between gap-4">
            <span>
              For a slow home upload: Force transcode, 1080p, and about half
              your upload speed.
            </span>
            <button
              type="button"
              onClick={handleReset}
              className="shrink-0 font-medium text-blue-500 hover:underline"
            >
              Reset to Recommended
            </button>
          </div>
        }
      >
        <FormField
          control={form.control}
          name="videoTranscodingMode"
          render={({ field }) => {
            const value = field.value ?? DEFAULT_VALUES.videoTranscodingMode;
            return (
              <SettingsRow
                label="Video"
                description={optionDescription(VIDEO_MODE_OPTIONS, value)}
                htmlFor="videoTranscodingMode"
              >
                <SettingsSelect
                  id="videoTranscodingMode"
                  value={value}
                  onChange={setVideoMode}
                  options={VIDEO_MODE_OPTIONS}
                />
              </SettingsRow>
            );
          }}
        />
        <FormField
          control={form.control}
          name="audioTranscodingMode"
          render={({ field }) => {
            const value = field.value ?? DEFAULT_VALUES.audioTranscodingMode;
            return (
              <SettingsRow
                label="Audio"
                description={optionDescription(AUDIO_MODE_OPTIONS, value)}
                htmlFor="audioTranscodingMode"
              >
                <SettingsSelect
                  id="audioTranscodingMode"
                  value={value}
                  onChange={setAudioMode}
                  options={AUDIO_MODE_OPTIONS}
                />
              </SettingsRow>
            );
          }}
        />
        <FormField
          control={form.control}
          name="maxVideoHeight"
          render={({ field }) => {
            const value = String(
              field.value ?? DEFAULT_VALUES.maxVideoHeight,
            ) as MaxVideoHeight;
            return (
              <SettingsRow
                label="Max resolution"
                description={optionDescription(MAX_HEIGHT_OPTIONS, value)}
                htmlFor="maxVideoHeight"
              >
                <SettingsSelect
                  id="maxVideoHeight"
                  value={value}
                  onChange={(v) => field.onChange(Number(v))}
                  options={MAX_HEIGHT_OPTIONS}
                />
              </SettingsRow>
            );
          }}
        />
        <FormField
          control={form.control}
          name="maxVideoBitrate"
          render={({ field }) => (
            <SettingsRow
              label="Video bitrate ceiling"
              description="A low ceiling makes Jellyfin transcode. Lower it only if playback buffers."
              htmlFor="maxVideoBitrate"
            >
              <SettingsSlider
                id="maxVideoBitrate"
                value={field.value ?? DEFAULT_VALUES.maxVideoBitrate}
                min={2}
                max={200}
                step={2}
                unit="Mbps"
                onChange={field.onChange}
              />
            </SettingsRow>
          )}
        />
      </SettingsGroup>
    </div>
  );
};
