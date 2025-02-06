const { withProjectBuildGradle, withPlugins } = require("@expo/config-plugins");

// For build.gradle updates
function withMedalliaBuildGradle(config) {
  return withProjectBuildGradle(config, (cfg) => {
    const { modResults } = cfg;
    const { contents } = modResults;
    const lines = contents.split("\n");

    // Find the 'allprojects' block
    const allProjectsIndex = lines.findIndex((line) =>
      line.includes("allprojects {")
    );

    // Ensure 'allprojects' block exists
    if (allProjectsIndex === -1) {
      console.error("Unable to find 'allprojects' block in build.gradle");
    }

    // Find the 'repositories' block within 'allprojects'
    const repositoriesIndex = lines.findIndex(
      (line, index) =>
        index > allProjectsIndex && line.includes("repositories {")
    );

    // Ensure 'repositories' block exists within 'allprojects'
    if (repositoriesIndex === -1) {
      console.error(
        "Unable to find 'repositories' block within 'allprojects' in build.gradle"
      );
    }

    // Find the closing brace of the 'repositories' block
    const repositoriesEndIndex = lines.findIndex(
      (line, index) => index > repositoriesIndex && line.includes("}")
    );

    modResults.contents = [
      ...lines.slice(0, repositoriesEndIndex + 1),
      `// For Medallia SDK
        flatDir {
          dirs "$rootDir/../node_modules/medallia-digital-rn/android/libs"
        }`,
      ...lines.slice(repositoriesEndIndex + 1),
    ].join("\n");

    return cfg;
  });
}

function withMedallia(config) {
  return withPlugins(config, [withMedalliaBuildGradle]);
}

module.exports = withMedallia;
