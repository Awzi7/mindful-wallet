const tintColorLight = '#2E9E8F';
const tintColorDark = '#5AD1C2';

export default {
  light: {
    text: '#241C16',
    background: '#FBF3EA',
    card: '#FFFFFF',
    subtle: '#8C8074',
    border: '#EFE2D2',
    tint: tintColorLight,
    accent: '#FF6B4A',
    accentSoft: '#FFE7DE',
    /** Money coming in / a positive balance. Deliberately not `tint`, which means "interactive". */
    positive: '#3E9C57',
    tabIconDefault: '#C7BBAC',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#F2EDE7',
    // The old values (#221F1C bg / #2F2B27 card) were only ~13/255 apart per channel, which
    // read as one flat grey mass. Deepening the background gives cards something to lift off.
    background: '#1A1714',
    card: '#262220',
    subtle: '#ABA097',
    border: '#3A342E',
    tint: tintColorDark,
    accent: '#FF9478',
    accentSoft: '#40291F',
    positive: '#62C97F',
    tabIconDefault: '#6E675E',
    tabIconSelected: tintColorDark,
  },
};
