export const FORM0_FONT_FAMILY = 'Figtree-Regular';
export const FORM0_FONT_FAMILY_ITALIC = 'Figtree-Italic';

export const FORM0_FONT_FAMILY_BY_WEIGHT = {
  400: 'Figtree-Regular',
  500: 'Figtree-Medium',
  600: 'Figtree-SemiBold',
  700: 'Figtree-Bold',
};

export const FORM0_FONT_FAMILY_BY_WEIGHT_ITALIC = {
  400: 'Figtree-Italic',
  500: 'Figtree-MediumItalic',
  600: 'Figtree-SemiBoldItalic',
  700: 'Figtree-BoldItalic',
};

export const form0Fonts =
  typeof require === 'function'
    ? {
        [FORM0_FONT_FAMILY]: require('./fonts/Figtree-Regular.ttf'),
        [FORM0_FONT_FAMILY_ITALIC]: require('./fonts/Figtree-Italic.ttf'),
        [FORM0_FONT_FAMILY_BY_WEIGHT[500]]: require('./fonts/Figtree-Medium.ttf'),
        [FORM0_FONT_FAMILY_BY_WEIGHT[600]]: require('./fonts/Figtree-SemiBold.ttf'),
        [FORM0_FONT_FAMILY_BY_WEIGHT[700]]: require('./fonts/Figtree-Bold.ttf'),
        [FORM0_FONT_FAMILY_BY_WEIGHT_ITALIC[500]]: require('./fonts/Figtree-MediumItalic.ttf'),
        [FORM0_FONT_FAMILY_BY_WEIGHT_ITALIC[600]]: require('./fonts/Figtree-SemiBoldItalic.ttf'),
        [FORM0_FONT_FAMILY_BY_WEIGHT_ITALIC[700]]: require('./fonts/Figtree-BoldItalic.ttf'),
      }
    : {};
