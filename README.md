# form0-react-native

## Fonts

`form0-react-native` ships with the static Figtree font files and applies the theme
font family to all internal `Text` and `TextInput` components. The default theme
maps weights 400/500/600/700 to the matching Figtree families so Android doesn't
fall back to system bold.

### Expo

```js
import { useFonts } from 'expo-font';
import { form0Fonts } from 'form0-react-native';

const [loaded] = useFonts(form0Fonts);
if (!loaded) return null;
```

### Bare React Native

Add the package fonts to your app assets and link them:

```js
// react-native.config.js (in your app)
module.exports = {
  assets: ['./assets/fonts', './node_modules/form0-react-native/src/fonts'],
};
```

Then run:

```bash
npx react-native-asset
```

### Custom font family

Override in the theme provider if you need a different font family or weight map:

```js
import { ThemeProvider } from 'form0-react-native';

<ThemeProvider
  customTheme={{
    typography: {
      fontFamily: 'YourFont-Regular',
      fontFamilyByWeight: {
        400: 'YourFont-Regular',
        500: 'YourFont-Medium',
        600: 'YourFont-SemiBold',
        700: 'YourFont-Bold',
      },
    },
  }}
>
  ...
</ThemeProvider>;
```
