import { File, Paths } from 'expo-file-system';
import { ImageFormat, Skia } from '@shopify/react-native-skia';

import { filterById, type FilterId } from '@/data/photo-filters';

/**
 * Write the picked filter into the file.
 *
 * The point of doing this rather than tinting a view: what leaves the device
 * is what the person chose. A preview overlay looks the same on screen and
 * disappears on save, which is the failure the old filters button avoided by
 * doing nothing at all.
 *
 * The same matrix drives the viewfinder, the thumbnail strip and this, so
 * there is one number to be wrong rather than three to disagree.
 */
export async function bakeFilter(uri: string, filter: FilterId): Promise<string> {
  const picked = filterById(filter);
  // Nothing to do, and nothing to lose by saying so: re-encoding an unfiltered
  // photo would cost a generation of JPEG quality for no change.
  if (!picked.matrix) return uri;

  const data = await Skia.Data.fromURI(uri);
  const image = Skia.Image.MakeImageFromEncoded(data);
  if (!image) {
    // A file Skia cannot decode is not a reason to lose the photo. It goes
    // out unfiltered rather than not at all.
    return uri;
  }

  try {
    const width = image.width();
    const height = image.height();
    const surface = Skia.Surface.MakeOffscreen(width, height);
    if (!surface) return uri;

    const paint = Skia.Paint();
    paint.setColorFilter(Skia.ColorFilter.MakeMatrix(picked.matrix));
    surface.getCanvas().drawImage(image, 0, 0, paint);

    const out = surface.makeImageSnapshot();
    // JPEG at 92: the source is a camera photo, so it is already lossy, and a
    // PNG here would triple the bytes of every picture on the way to a server
    // that charges for them in upload time.
    const bytes = out.encodeToBytes(ImageFormat.JPEG, 92);
    out.dispose();
    surface.dispose();

    const file = new File(Paths.cache, `filtered-${Date.now()}.jpg`);
    file.create({ overwrite: true });
    file.write(bytes);
    return file.uri;
  } finally {
    // Skia images hold native memory that the JS collector knows nothing
    // about. Left undisposed, a session of editing photos climbs until the
    // system kills the app.
    image.dispose();
  }
}
