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
 * Packets are written directly to the output stream. The metadata consists of a simple
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

#define MAX_FILENAME_SIZE 1024

typedef struct WebMStreamingChunkContext
{
    const AVClass *class;
    char *stream_url;
    char *info_url;
    int64_t prev_pts;
    ff_const59 AVOutputFormat *oformat;
    AVFormatContext *avf;
    AVIOContext *info_io;
} WebMStreamingChunkContext;

enum WebMStreamEvent
{
    WEBM_STREAM_EVENT_INITIALIZATION_SEGMENT_START = 1,
    WEBM_STREAM_EVENT_MEDIA_SEGMENT_START = 2
}

typedef struct WebMStreamInfo
{
    WebMStreamInfo event;
    int64_t offset;
} WebMStreamInfo;

// typedef struct WebMChunkContext {
//     const AVClass *class;
//     int chunk_start_index;
//     char *header_filename;
//     int chunk_duration;
//     int chunk_index;
//     char *http_method;
//     uint64_t duration_written;
//     int64_t prev_pts;
//     ff_const59 AVOutputFormat *oformat;
//     AVFormatContext *avf;
// } WebMChunkContext;

static int chunk_mux_init(AVFormatContext *s)
{
    WebMChunkContext *wc = s->priv_data;
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
    av_opt_set_int(oc->priv_data, "dash", 1, 0);
    av_opt_set_int(oc->priv_data, "cluster_time_limit", wc->chunk_duration, 0);
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

    // // DASH Streams can only have either one track per file.
    // if (s->nb_streams != 1) { return AVERROR_INVALIDDATA; }

    wc->oformat = av_guess_format("webm", s->url, "video/webm");
    if (!wc->oformat)
        return AVERROR_MUXER_NOT_FOUND;
    wc->prev_pts = AV_NOPTS_VALUE;

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
    ret = s->io_open(s, &wc->info_io, wc->info_url, AVIO_FLAG_WRITE, NULL);
    if (ret < 0)
        return ret;

    // Write initialization segment information
    printf("sizeof(WebMStreamInfo) %d", sizeof(WebMStreamInfo));
    WebMStreamInfo stream_init = {WEBM_STREAM_EVENT_INITIALIZATION_SEGMENT_START, 0};
    avio_write(wc->info_io, &stream_init, sizeof(WebMStreamInfo));

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

static int streaming_webm_chunk_write_header(AVFormatContext *s)
{
    // Initialize WebM muxer

    // Open IO for metadata stream

    // Write initial metadata message

    // Write WebM header
}

static int chunk_start(AVFormatContext *s)
{
    WebMChunkStreamingContext *wc = s->priv_data;
    AVFormatContext *oc = wc->avf;
    int ret;

    ret = avio_open_dyn_buf(&oc->pb);
    if (ret < 0)
        return ret;
    wc->chunk_index++;
    return 0;
}

static int chunk_end(AVFormatContext *s, int flush)
{
    WebMChunkContext *wc = s->priv_data;
    AVFormatContext *oc = wc->avf;
    int ret;
    int buffer_size;
    uint8_t *buffer;
    AVIOContext *pb;
    char filename[MAX_FILENAME_SIZE];
    AVDictionary *options = NULL;

    if (!oc->pb)
        return 0;

    if (flush)
        // Flush the cluster in WebM muxer.
        oc->oformat->write_packet(oc, NULL);
    buffer_size = avio_close_dyn_buf(oc->pb, &buffer);
    oc->pb = NULL;
    ret = get_chunk_filename(s, 0, filename);
    if (ret < 0)
        goto fail;
    if (wc->http_method)
        av_dict_set(&options, "method", wc->http_method, 0);
    ret = s->io_open(s, &pb, filename, AVIO_FLAG_WRITE, &options);
    if (ret < 0)
        goto fail;
    avio_write(pb, buffer, buffer_size);
    ff_format_io_close(s, &pb);
fail:
    av_dict_free(&options);
    av_free(buffer);
    return (ret < 0) ? ret : 0;
}

static int webm_chunk_write_packet(AVFormatContext *s, AVPacket *pkt)
{
    WebMChunkContext *wc = s->priv_data;
    AVFormatContext *oc = wc->avf;
    AVStream *st = s->streams[pkt->stream_index];
    int ret;

    // TODO: No idea what this does
    if (st->codecpar->codec_type == AVMEDIA_TYPE_AUDIO)
    {
        if (wc->prev_pts != AV_NOPTS_VALUE)
            wc->duration_written += av_rescale_q(pkt->pts - wc->prev_pts,
                                                 st->time_base,
                                                 (AVRational){1, 1000});
        wc->prev_pts = pkt->pts;
    }

    // TODO: Figure out if we can use video keyframes for chunk boundaries
    // when encoding both audio and video.

    // For video, a new chunk is started only on key frames. For audio, a new
    // chunk is started based on chunk_duration. Also, a new chunk is started
    // unconditionally if there is no currently open chunk.
    if (!oc->pb || (st->codecpar->codec_type == AVMEDIA_TYPE_VIDEO && (pkt->flags & AV_PKT_FLAG_KEY)) ||
        (st->codecpar->codec_type == AVMEDIA_TYPE_AUDIO &&
         wc->duration_written >= wc->chunk_duration))
    {
        wc->duration_written = 0;
        if ((ret = chunk_end(s, 1)) < 0 || (ret = chunk_start(s)) < 0)
        {
            return ret;
        }
    }

    ret = oc->oformat->write_packet(oc, pkt);

    return ret;
}

static int webm_chunk_write_trailer(AVFormatContext *s)
{
    WebMChunkContext *wc = s->priv_data;
    AVFormatContext *oc = wc->avf;
    int ret;

    if (!oc->pb)
    {
        ret = chunk_start(s);
        if (ret < 0)
            goto fail;
    }
    oc->oformat->write_trailer(oc);
    ret = chunk_end(s, 0);
fail:
    // TODO: check that this always works
    ff_format_io_close(s, &oc->pb);
    oc->streams = NULL;
    oc->nb_streams = 0;
    avformat_free_context(oc);
    return ret;
}

// TODO: How tf to make this accept options for WebM container? Something in docs about child entities with AVOptions.
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