// Copied from ffmpeg internals

#include "libavformat/avformat.h"
#include "libavformat/avio.h"
#include "libavutil/avassert.h"

/**
 * Set AVFormatContext url field to the provided pointer. The pointer must
 * point to a valid string. The existing url field is freed if necessary. Also
 * set the legacy filename field to the same string which was provided in url.
 */
void ff_format_set_url(AVFormatContext *s, char *url)
{
    av_assert0(url);
    av_freep(&s->url);
    s->url = url;
}

/*
 * A wrapper around AVFormatContext.io_close that should be used
 * instead of calling the pointer directly.
 */
void ff_format_io_close(AVFormatContext *s, AVIOContext **pb)
{
    if (*pb)
        s->io_close(s, *pb);
    *pb = NULL;
}

/**
 * Set the time base and wrapping info for a given stream. This will be used
 * to interpret the stream's timestamps. If the new time base is invalid
 * (numerator or denominator are non-positive), it leaves the stream
 * unchanged.
 *
 * @param s stream
 * @param pts_wrap_bits number of bits effectively used by the pts
 *        (used for wrap control)
 * @param pts_num time base numerator
 * @param pts_den time base denominator
 */
void avpriv_set_pts_info(AVStream *s, int pts_wrap_bits,
                         unsigned int pts_num, unsigned int pts_den);

