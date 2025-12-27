import React, { createContext, useContext } from 'react';

/**
 * Image Resolver Context
 *
 * Provides a way to resolve supporting image paths to their actual sources.
 * This is necessary because React Native requires images to be bundled with require()
 * at build time, unlike web where images can be served from a static folder.
 */

const ImageResolverContext = createContext(null);

/**
 * Default image resolver that handles remote URLs but returns null for local paths.
 * Apps should provide their own resolver for local images.
 */
const defaultResolver = (imagePath) => {
  if (!imagePath) return null;

  // Remote URLs work directly
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return { uri: imagePath };
  }

  // Local images need to be resolved by the app
  console.warn(
    `No image resolver provided for local image: ${imagePath}. ` +
      'Provide an imageResolver prop to FormRenderer to load local images.'
  );
  return null;
};

/**
 * Image Resolver Provider
 *
 * @param {Object} props
 * @param {Function} props.resolver - Function that takes an image path and returns an image source
 * @param {React.ReactNode} props.children
 */
export function ImageResolverProvider({ resolver, children }) {
  const effectiveResolver = resolver || defaultResolver;

  return (
    <ImageResolverContext.Provider value={effectiveResolver}>
      {children}
    </ImageResolverContext.Provider>
  );
}

/**
 * Hook to access the image resolver
 *
 * @returns {Function} - The image resolver function
 */
export function useImageResolver() {
  const resolver = useContext(ImageResolverContext);
  return resolver || defaultResolver;
}

export { ImageResolverContext };

