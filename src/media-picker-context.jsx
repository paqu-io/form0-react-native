import React, { createContext, useContext } from 'react';

/**
 * Media Picker Context
 *
 * PhotoField and VideoField render their own list, captions and buttons, but
 * leave capture to the app: the package has no camera or photo-library
 * dependency, so it works with any picker (expo-image-picker,
 * react-native-image-picker, ...). Without a picker, both fields show a
 * placeholder.
 *
 * A picker is `{ pick(request), sources? }`:
 * - `pick({ kind, source, multiple, limit, field })` resolves to the picked
 *   items, or to an empty array or null when the user cancels. `kind` is
 *   'photo' or 'video', `source` is 'camera' or 'library', and `limit` is the
 *   number of photos the field still accepts (null for no limit). Throw an
 *   Error to show its message under the field, for example when permission is
 *   denied.
 * - Each item is `{ uri, fileName?, mimeType?, fileSize?, duration?,
 *   capturedAt? }`, with `duration` in seconds (required by form0-core for
 *   videos) and `capturedAt` as an ISO string. Keep `uri` readable for as long
 *   as the record needs the file: pickers often return temporary files.
 * - `sources` lists the buttons to show; it defaults to camera and library.
 */

const MediaPickerContext = createContext(null);

export function MediaPickerProvider({ picker, children }) {
  return (
    <MediaPickerContext.Provider value={picker || null}>{children}</MediaPickerContext.Provider>
  );
}

/**
 * @returns {{ pick: Function, sources?: string[] } | null} The app's picker, or
 * null when it did not provide one.
 */
export function useMediaPicker() {
  const picker = useContext(MediaPickerContext);
  return picker && typeof picker.pick === 'function' ? picker : null;
}

export { MediaPickerContext };
