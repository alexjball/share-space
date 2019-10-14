# use pkg-config for getting CFLAGS and LDLIBS
FFMPEG_LIBS=    libavcodec                         \
                libavformat                        \
                libavutil                          \
                libswresample                      \
                libswscale                         \

CFLAGS += -Wall -g
CFLAGS := $(shell pkg-config --cflags $(FFMPEG_LIBS)) $(CFLAGS)
LDLIBS := $(shell pkg-config --libs $(FFMPEG_LIBS)) $(LDLIBS)

PROGRAMS=encode_video muxing

OBJS=$(addsuffix .o,$(PROGRAMS))

muxing: LDLIBS += -lm
muxing: muxing.o webm_streaming_chunk.o

webm_streaming_chunk.o: webm_streaming_chunk.c

run-muxing: muxing
	./muxing test_%d.chk

encode_video: encode_video.o encode_video

.phony: clean-test clean

clean-test:
	$(RM) test*.pgm test.h264 test.mp2 test.sw test.mpg test.hdr test*.chk

clean: clean-test
	$(RM) $(PROGRAMS) $(OBJS) webm_streaming_chunk.o
