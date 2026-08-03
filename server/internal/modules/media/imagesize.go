package media

import "encoding/binary"

// Image dimensions are read from the file's own header rather than trusted
// from the upload form. Clients send width/height as hints, but anything
// that gates on size — sticker format validation in particular — has to
// work from the bytes, otherwise the check is trivially bypassed.
//
// Only the headers are parsed; no pixel data is decoded, so this stays
// cheap and needs no image codec dependency.

// sniffHeaderBytes is how much of the file we need to determine size for
// every format handled here.
const sniffHeaderBytes = 64

// sniffImageSize returns the pixel dimensions encoded in b, or nil when the
// format is unrecognised or the header is truncated.
func sniffImageSize(b []byte) (w, h *int) {
	switch {
	case isPNGHeader(b):
		return pngSize(b)
	case isWebPHeader(b):
		return webpSize(b)
	}
	return nil, nil
}

func isPNGHeader(b []byte) bool {
	return len(b) >= 8 &&
		b[0] == 0x89 && b[1] == 'P' && b[2] == 'N' && b[3] == 'G' &&
		b[4] == '\r' && b[5] == '\n' && b[6] == 0x1a && b[7] == '\n'
}

// pngSize reads the IHDR chunk, which is always first and always at a
// fixed offset.
func pngSize(b []byte) (*int, *int) {
	if len(b) < 24 {
		return nil, nil
	}
	w := int(binary.BigEndian.Uint32(b[16:20]))
	h := int(binary.BigEndian.Uint32(b[20:24]))
	return okSize(w, h)
}

func isWebPHeader(b []byte) bool {
	return len(b) >= 16 &&
		string(b[0:4]) == "RIFF" && string(b[8:12]) == "WEBP"
}

// webpSize handles the three WebP flavours. Animated stickers are always
// VP8X, static ones are usually VP8 (lossy) or VP8L (lossless).
func webpSize(b []byte) (*int, *int) {
	if len(b) < 30 {
		return nil, nil
	}
	switch string(b[12:16]) {
	case "VP8X":
		// Extended format: 24-bit little-endian canvas size minus one.
		w := int(uint32(b[24]) | uint32(b[25])<<8 | uint32(b[26])<<16)
		h := int(uint32(b[27]) | uint32(b[28])<<8 | uint32(b[29])<<16)
		return okSize(w+1, h+1)

	case "VP8 ":
		// Lossy: keyframe header, then a 3-byte start code, then 14-bit
		// dimensions with a 2-bit scale field we ignore.
		if len(b) < 30 || b[23] != 0x9d || b[24] != 0x01 || b[25] != 0x2a {
			return nil, nil
		}
		w := int(binary.LittleEndian.Uint16(b[26:28]) & 0x3fff)
		h := int(binary.LittleEndian.Uint16(b[28:30]) & 0x3fff)
		return okSize(w, h)

	case "VP8L":
		// Lossless: signature byte, then 14 bits width-1 and 14 bits
		// height-1 packed little-endian.
		if len(b) < 25 || b[20] != 0x2f {
			return nil, nil
		}
		bits := binary.LittleEndian.Uint32(b[21:25])
		w := int(bits&0x3fff) + 1
		h := int((bits>>14)&0x3fff) + 1
		return okSize(w, h)
	}
	return nil, nil
}

func okSize(w, h int) (*int, *int) {
	if w <= 0 || h <= 0 {
		return nil, nil
	}
	return &w, &h
}
