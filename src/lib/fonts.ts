import { loadFont } from '@remotion/google-fonts/Montserrat';

const { fontFamily } = loadFont('normal', {
  weights: ['700'],
  subsets: ['latin'],
});

export const montserratBold = fontFamily;
