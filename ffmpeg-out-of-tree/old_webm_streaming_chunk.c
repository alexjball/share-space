/*
 * Copyright (c) 2015, Vignesh Venkatasubramanian
 *
 * This file is part of FFmpeg.
 *
 * FFmpeg is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 2.1 of the License, or (at your option) any later version.
 *
 * FFmpeg is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with FFmpeg; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA
 */

/**
 * @file WebM Streaming Chunk Muxer
 * The streaming chunk muxer supports writing a streamable webm container to one output
 * and metadata about the chunks to another output. It is based on the webm chunk muxer,
 * which itself uses the Matroska/WebM muxer to handle the format.
 * 
 * The stream starts with a header/initialization segment, then chunk/media segments. 
 * Metadata is written at the start of each segment and specifies {type, offset, wall_time},
 * where type is in {INITIALIZATION, MEDIA}, offset identifies the first octet of the segment
 * relative to the start of the stream, and wall_time is the wall time when the packet is passed
 * to the muxer. Consumers can use this to identify segment boundaries and monitor end-to-end
 * latency.
 * 
 * This approach allows lower latency than file-oriented chunks. Files are written when the chunk
 * is complete, whereas the stream can be forwarded to endpoints while the encoder is still 
 * generating part of the chunk.
 * 
 * TODO: conform to https://ffmpeg.org/developer.html#New-codecs-or-formats-checklist
 */

#include <float.h>
#include <time.h>

#include "libavformat/avformat.h"
#include "libavformat/avio.h"
// #include "avio_internal.h"
#include "internal.h"

#include "libavutil/avassert.h"
#include "libavutil/log.h"
#include "libavutil/opt.h"
#include "libavutil/avstring.h"
#include "libavutil/parseutils.h"
#include "libavutil/mathematics.h"
#include "libavutil/time.h"
// #include "libavutil/time_internal.h"
#include "libavutil/timestamp.h"

typedef struct WebMStreamingChunkContext
{
    const AVClass *class;
    char *stream_url;
    char *info_url;
    ff_const59 AVOutputFormat *oformat;
    AVFormatContext *avf;
    AVIOContext *info_io;
    int open_media_segment;
} WebMStreamingChunkContext;

enum WebMStreamEvent
{
    WEBM_STREAM_EVENT_INITIALIZATION_SEGMENT_START = 1,
    WEBM_STREAM_EVENT_MEDIA_SEGMENT_START = 2
};

// TODO: make sure this is written consistently to info_stream
// event: 1 byte
// offset: 8 bytes, js can only handle 53 bits.
typedef struct WebMStreamInfo
{
    enum WebMStreamEvent event;
    int64_t offset;
} WebMStreamInfo;

static void write_info(AVIOContext *info_io, WebMStreamInfo *info)
{
    if (!info_io)
    {
        return;
    }

    char msg[1024];
    sprintf(msg, "{ \"event\": %d, \"offset\": %ld }\n", info->event, info->offset);
    avio_put_str(info_io, msg);

    // avio_write(info_io, info, sizeof(WebMStreamInfo));
    avio_flush(info_io);
}

static int chunk_mux_init(AVFormatContext *s)
{
    WebMStreamingChunkContext *wc = s->priv_data;
    AVFormatContext *oc;
    int ret;

    // Allocate the WebM format context
    ret = avformat_alloc_output_context2(&wc->avf, wc->oformat, NULL, NULL);
    if (ret < 0)
        return ret;
    oc = wc->avf;

    oc->interrupt_callback = s->interrupt_callback;
    oc->max_delay = s->max_delay;
    av_dict_copy(&oc->metadata, s->metadata, 0);

    // Set WebM format options
    *(const AVClass **)oc->priv_data = oc->oformat->priv_class;
    av_opt_set_defaults(oc->priv_data);
    av_opt_set_int(oc->priv_data, "live", 1, 0);

    // Expose top-level streams to WebM muxer
    oc->streams = s->streams;
    oc->nb_streams = s->nb_streams;

    return 0;
}

static int webm_chunk_write_header(AVFormatContext *s)
{
    WebMStreamingChunkContext *wc = s->priv_data;
    AVFormatContext *oc = NULL;
    int ret;
    int i;

    if (!wc->stream_url)
    {
        av_log(oc, AV_LOG_ERROR, "No output stream URL (-stream_url) provided\n");
        return AVERROR(EINVAL);
    }

    wc->oformat = av_guess_format("webm", s->url, "video/webm");
    if (!wc->oformat)
        return AVERROR_MUXER_NOT_FOUND;

    ret = chunk_mux_init(s);
    if (ret < 0)
        return ret;

    // Get the context for the WebM muxer
    oc = wc->avf;

    // Initialize WebM Muxer IO using the top-level format context
    ff_format_set_url(oc, av_strdup(wc->stream_url));
    ret = s->io_open(s, &oc->pb, oc->url, AVIO_FLAG_WRITE, NULL);
    if (ret < 0)
        return ret;
    oc->pb->seekable = 0;

    // Initialize stream information IO using the top-level format context
    if (wc->info_url)
    {
        ret = s->io_open(s, &wc->info_io, wc->info_url, AVIO_FLAG_WRITE, NULL);
        if (ret < 0)
            return ret;
    }

    // Write initialization segment information
    WebMStreamInfo initialization_segment_info = {WEBM_STREAM_EVENT_INITIALIZATION_SEGMENT_START, 0};
    write_info(wc->info_io, &initialization_segment_info);

    // Write the WebM header
    ret = oc->oformat->write_header(oc);
    if (ret < 0)
        return ret;

    for (i = 0; i < s->nb_streams; i++)
    {
        // ms precision is the de-facto standard timescale for mkv files.
        avpriv_set_pts_info(s->streams[i], 64, 1, 1000);
    }
    return 0;
}

static void media_segment_start(AVFormatContext *s)
{
    WebMStreamingChunkContext *wc = s->priv_data;
    AVFormatContext *oc = wc->avf;

    wc->open_media_segment = 1;

    WebMStreamInfo media_segment_info =
        {WEBM_STREAM_EVENT_MEDIA_SEGMENT_START, avio_tell(oc->pb)};

    write_info(wc->info_io, &media_segment_info);
}

static void media_segment_end(AVFormatContext *s, int flush)
{
    WebMStreamingChunkContext *wc = s->priv_data;
    AVFormatContext *oc = wc->avf;

    wc->open_media_segment = 0;

    if (flush)
        // Flush the cluster in WebM muxer.
        oc->oformat->write_packet(oc, NULL);
}

static int webm_chunk_write_packet(AVFormatContext *s, AVPacket *pkt)
{
    WebMStreamingChunkContext *wc = s->priv_data;
    AVFormatContext *oc = wc->avf;
    AVStream *st = s->streams[pkt->stream_index];
    int ret;

    // On video keyframes, flush the WebM muxer, which triggers the end of the
    // current cluster. Each cluster corresponds to a media segment ("chunk").
    if (st->codecpar->codec_type == AVMEDIA_TYPE_VIDEO && (pkt->flags & AV_PKT_FLAG_KEY))
    {
        if (wc->open_media_segment)
        {
            media_segment_end(s, 1);
        }
        media_segment_start(s);
    }

    ret = oc->oformat->write_packet(oc, pkt);

    return ret;
}

static int webm_chunk_write_trailer(AVFormatContext *s)
{
    WebMStreamingChunkContext *wc = s->priv_data;
    AVFormatContext *oc = wc->avf;
    int ret;

    if (!wc->open_media_segment)
    {
        media_segment_start(s);
    }
    ret = oc->oformat->write_trailer(oc);
    media_segment_end(s, 0);

    // Clean up
    ff_format_io_close(s, &oc->pb);
    if (wc->info_io)
    {
        ff_format_io_close(s, &wc->info_io);
    }
    oc->streams = NULL;
    oc->nb_streams = 0;
    avformat_free_context(oc);

    return ret;
}

#define OFFSET(x) offsetof(WebMStreamingChunkContext, x)
static const AVOption options[] = {
    {"stream_url", "output url for WebM media stream", OFFSET(stream_url), AV_OPT_TYPE_STRING, {0}, 0, 0, AV_OPT_FLAG_ENCODING_PARAM},
    {"info_url", "output url for stream information", OFFSET(info_url), AV_OPT_TYPE_STRING, {0}, 0, 0, AV_OPT_FLAG_ENCODING_PARAM},
    {NULL},
};

static const AVClass webm_chunk_class = {
    .class_name = "WebM Streaming Chunk Muxer",
    .item_name = av_default_item_name,
    .option = options,
    .version = LIBAVUTIL_VERSION_INT,
};

AVOutputFormat webm_streaming_chunk_muxer = {
    .name = "webm_streaming_chunk",
    .long_name = "WebM Streaming Chunk Muxer",
    .mime_type = "video/webm",
    .extensions = "chk",
    .flags = AVFMT_NOFILE | AVFMT_GLOBALHEADER | AVFMT_NEEDNUMBER |
             AVFMT_TS_NONSTRICT,
    .audio_codec = AV_CODEC_ID_OPUS,
    .video_codec = AV_CODEC_ID_VP9,
    .priv_data_size = sizeof(WebMStreamingChunkContext),
    .write_header = webm_chunk_write_header,
    .write_packet = webm_chunk_write_packet,
    .write_trailer = webm_chunk_write_trailer,
    .priv_class = &webm_chunk_class,
};