// Android 12+ "Bold font" adds 300 to every text weight. The app's custom fonts are static files, and the 700 face
// pushed to 1000 renders as blank text (button labels and titles disappeared), so the app opts out and keeps its
// own weights.
const { withMainActivity, withMainApplication } = require('expo/config-plugins');

const MARKER = '// wishme: no-font-weight-adjustment';

const OVERRIDE = `
  ${MARKER}
  override fun attachBaseContext(base: android.content.Context) {
    val config = base.resources.configuration
    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S && config.fontWeightAdjustment != 0) {
      val fixed = android.content.res.Configuration(config)
      fixed.fontWeightAdjustment = 0
      super.attachBaseContext(base.createConfigurationContext(fixed))
    } else {
      super.attachBaseContext(base)
    }
  }
`;

function addOverride(contents, classDecl) {
  if (contents.includes(MARKER)) return contents;
  const idx = contents.indexOf(classDecl);
  if (idx === -1) throw new Error(`withNoFontWeightAdjustment: could not find "${classDecl}"`);
  const brace = contents.indexOf('{', idx);
  return contents.slice(0, brace + 1) + OVERRIDE + contents.slice(brace + 1);
}

module.exports = function withNoFontWeightAdjustment(config) {
  config = withMainActivity(config, (cfg) => {
    cfg.modResults.contents = addOverride(cfg.modResults.contents, 'class MainActivity');
    return cfg;
  });
  return withMainApplication(config, (cfg) => {
    cfg.modResults.contents = addOverride(cfg.modResults.contents, 'class MainApplication');
    return cfg;
  });
};
