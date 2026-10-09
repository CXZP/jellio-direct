import { z } from 'zod';

export const transcodingModeSchema = z.enum(['adaptive', 'force', 'disabled']);
export const streamDeliveryModeSchema = z.enum(['both', 'direct', 'hls']);
export const episodeListSourceSchema = z.enum(['cinemeta', 'jellyfin']);
export const maxVideoHeightSchema = z.union([
  z.literal(2160),
  z.literal(1440),
  z.literal(1080),
  z.literal(720),
]);

export const formSchema = z.object({
  serverName: z.string(),
  libraries: z.array(
    z.object({
      key: z.string(),
      name: z.string(),
      type: z.string(),
    }),
  ),
  jellyseerrEnabled: z.boolean().default(false),
  jellyseerrUrl: z.string().url().or(z.literal('')).default(''),
  jellyseerrApiKey: z.string().default(''),
  publicBaseUrl: z.string().url().or(z.literal('')).default(''),
  // Transcoding settings
  videoTranscodingMode: transcodingModeSchema.default('adaptive'),
  audioTranscodingMode: transcodingModeSchema.default('adaptive'),
  enableDirectStreaming: z.boolean().default(true),
  forceTranscodeVideo: z.boolean().default(false),
  forceTranscodeAudio: z.boolean().default(false),
  maxVideoBitrate: z.number().min(2).max(200).default(120),
  maxVideoHeight: maxVideoHeightSchema.default(2160),
  episodeListSource: episodeListSourceSchema.default('cinemeta'),
  streamDeliveryMode: streamDeliveryModeSchema.default('both'),
});

export type ConfigFormType = z.input<typeof formSchema>;
