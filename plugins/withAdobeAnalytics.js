const { resolve } = require("path");
const { readFileSync, writeFileSync } = require("fs");

const {
  withDangerousMod,
  withPlugins,
  withAppDelegate,
  withMainApplication,
} = require("@expo/config-plugins");

// For Podfile updates
function withAdobeSDKPod(config) {
  return withDangerousMod(config, [
    "ios",
    (cfg) => {
      const { platformProjectRoot } = cfg.modRequest;
      const podfile = resolve(platformProjectRoot, "Podfile");
      let contents = readFileSync(podfile, "utf-8");

      const postInstallBlock = `
    # For installing AEP SDK
    installer.pods_project.targets.each do |t|
        if t.name.start_with?("AEP")
        t.build_configurations.each do |bc|
            bc.build_settings['OTHER_SWIFT_FLAGS'] = '$(inherited) -no-verify-emitted-module-interface'
        end
        end
    end
          `;

      //   Check if the postInstallBlock is already there
      if (!contents.includes(postInstallBlock)) {
        // Insert the postInstallBlock after the post_install do |installer| block
        contents = contents.replace(
          /(:ccache_enabled => podfile_properties\['apple\.ccacheEnabled'\] == 'true',\s*\))/,
          `$&\n${postInstallBlock}`
        );
      }

      writeFileSync(podfile, contents);
      return cfg;
    },
  ]);
}

// For AppDelegate.h updates
function withAdobeSDKDelegate(config) {
  return withDangerousMod(config, [
    "ios",
    (cfg) => {
      const { platformProjectRoot } = cfg.modRequest;
      const delegate = resolve(
        platformProjectRoot,
        "./CareGiver/AppDelegate.h"
      );
      let contents = readFileSync(delegate, "utf-8");

      //   Check if the import statements are not there
      const importLine = "#import <ExpoModulesCore/EXAppDelegateWrapper.h>";

      if (!contents.includes(importLine)) {
        // Comment out the line
        contents = contents.replace(/(#import <Expo\/Expo\.h>)/, `// $1`);

        // Add the new import line
        contents = contents.replace(
          /(@interface AppDelegate : EXAppDelegateWrapper)/,
          `${importLine}\n$1`
        );
      }

      writeFileSync(delegate, contents);
      return cfg;
    },
  ]);
}

// For AppDelegate.mm updates
function withAdobeSDKAppDelegate(config) {
  return withAppDelegate(config, (cfg) => {
    const { modResults } = cfg;
    let { contents } = modResults;

    const adobeSdkKey = process.env.EXPO_PUBLIC_ADOBE_ANALYTICS_KEY;

    const importStatement = `
@import AEPCore;
    `;

    const sdkInitStatement = `  // Initialize Adobe SDK
    [AEPMobileCore setLogLevel:AEPLogLevelWarning];
  [AEPMobileCore configureWithAppId:@"${adobeSdkKey}"];

  const UIApplicationState appState = application.applicationState;

  [AEPMobileCore registerExtensions: @[
  ] completion:^{
      if (appState != UIApplicationStateBackground) {
       [AEPMobileCore lifecycleStart:nil];
      }
  }];
    `;

    const importLine = "@import AEPRulesEngine;";
    const sdkInitLine = "[AEPMobileCore setLogLevel:AEPLogLevelWarning];";

    // Check if the import statements are not there
    if (!contents.includes(importLine)) {
      // Insert the import statement after the last #import line
      contents = contents.replace(
        /(#import <React\/RCTLinkingManager\.h>)/,
        `$1\n${importStatement}`
      );
    }

    //   Check if the SDK initialization statement is not there
    if (!contents.includes(sdkInitLine)) {
      // Insert the SDK initialization statement before the return statement in didFinishLaunchingWithOptions
      contents = contents.replace(
        /(return \[super application:application didFinishLaunchingWithOptions:launchOptions\];)/,
        `${sdkInitStatement}\n$1`
      );
    }

/*
    // Check if the Assurance statements are not there
    const assuranceLine = "  [AEPMobileAssurance startSessionWithUrl:url];";

    // Check if the assuranceLine statement is not there
    if (!contents.includes(assuranceLine)) {
      // Insert the assuranceLine statement before a specific line or return statement
      contents = contents.replace(
        /(- \(BOOL\)application:\(UIApplication \*\)application openURL:\(NSURL \*\)url options:\(NSDictionary<UIApplicationOpenURLOptionsKey,id> \*\)options {\n)/,
        `$1${assuranceLine}\n`
      );
    }

    // Check if the Assurance session init is not there
    const assuranceSessionLine =
      "    UIOpenURLContext * urlContext = URLContexts.anyObject;";

    // For Adobe Assurance session
    const assuranceSessionInit = `- (void) scene:(UIScene *)scene openURLContexts:(NSSet<UIOpenURLContext *> *)URLContexts {
    UIOpenURLContext * urlContext = URLContexts.anyObject;
    if (urlContext != nil) {
        [AEPMobileAssurance startSessionWithUrl:urlContext.URL];
    }
}`;

    // Check if the assuranceLine statement is not there
    if (!contents.includes(assuranceSessionLine)) {
      contents = contents.replace(/(@end)/, `${assuranceSessionInit}\n\n$1`);
    }
  */
    modResults.contents = contents;
    return cfg;
  });
}

// Update the AEPCore podspec in node_modules
function withAEPCorePodspec(config) {
  return withDangerousMod(config, [
    "ios",
    async (config) => {
      const {
        modRequest: { projectRoot },
      } = config;
      const podspecPath = resolve(
        projectRoot,
        "./node_modules/@adobe/react-native-aepcore/RCTAEPCore.podspec"
      );
      let contents = readFileSync(podspecPath, "utf-8");

      // Split the contents into lines
      const lines = contents.split("\n").filter(l => l.indexOf('s.ios.xcconfig') === -1);

      // Find the index of the line after the last dependency
      const index =
        lines.findIndex((line) =>
          line.includes('s.dependency "AEPSignal", ">= 5.0.0", "< 6.0.0"')
        ) + 1;

      // Add the new line
      lines.splice(
        index,
        0,
        "  s.ios.xcconfig  = { \"OTHER_CPLUSPLUSFLAGS\" => '-fmodules -fcxx-modules' }"
      );

      // Join the lines back into a single string
      contents = lines.join("\n");

      writeFileSync(podspecPath, contents);
      return config;
    },
  ]);
}

// For MainApplication.kt updates
function withAdobeSDKMainApplication(config) {
  return withMainApplication(config, (cfg) => {
    const { modResults } = cfg;
    const { contents } = modResults;
    const lines = contents.split("\n");

    const adobeSdkKey = process.env.EXPO_PUBLIC_ADOBE_ANALYTICS_KEY;

    const importIndex = lines.findIndex((line) => /^package/.test(line));

    // Find the index of the line
    const applicationCreateIndex = lines.findIndex((line) =>
      /ApplicationLifecycleDispatcher\.onApplicationCreate\(this\)/.test(line)
    );

    // Check if the import statements are not there
    const importLine = "import com.adobe.marketing.mobile.Assurance";

    if (!lines.includes(importLine)) {
      // Add your import statements here
      lines.splice(
        importIndex + 1,
        0,
        `import com.adobe.marketing.mobile.Assurance
import com.adobe.marketing.mobile.Edge
import com.adobe.marketing.mobile.Identity
import com.adobe.marketing.mobile.Lifecycle
import com.adobe.marketing.mobile.MobileCore
import com.adobe.marketing.mobile.Places
import com.adobe.marketing.mobile.Signal
import com.adobe.marketing.mobile.UserProfile
import com.adobe.marketing.mobile.WrapperType
import com.adobe.marketing.mobile.Target;
import com.adobe.marketing.mobile.edge.bridge.EdgeBridge;
import com.adobe.marketing.mobile.edge.consent.Consent;
import com.adobe.marketing.mobile.edge.identity.Identity as EdgeIdentity;
import com.adobe.marketing.mobile.Extension;
import com.adobe.marketing.mobile.LoggingMode;`
      );
    }

    // Check if sdk statements are not there
    const sdkLine = `    MobileCore.setWrapperType(WrapperType.REACT_NATIVE)`;

    if (!lines.includes(sdkLine)) {
      // Add your lines after super.onCreate()
      lines.splice(
        applicationCreateIndex + 1,
        0,
        `     // Initialize the Adobe Experience Platform SDK
    MobileCore.setWrapperType(WrapperType.REACT_NATIVE)
    MobileCore.setApplication(this)
    MobileCore.setLogLevel(LoggingMode.WARNING)

    val extensions = listOf(
        EdgeIdentity.EXTENSION,
        Identity.EXTENSION,
        Lifecycle.EXTENSION,
        Signal.EXTENSION,
        Assurance.EXTENSION,
        Edge.EXTENSION,
        EdgeBridge.EXTENSION,
        Consent.EXTENSION,
        UserProfile.EXTENSION,
        Places.EXTENSION,
        Target.EXTENSION
    );
    MobileCore.registerExtensions(extensions) {
        MobileCore.configureWithAppID("${adobeSdkKey}")
        }
`
      );
    }

    modResults.contents = lines.join("\n");

    return cfg;
  });
}

function withAdobeAnalytics(config) {
  return withPlugins(config, [
    withAdobeSDKPod,
    withAdobeSDKAppDelegate,
    // withAdobeSDKDelegate,
    withAdobeSDKMainApplication,
    withAEPCorePodspec,
  ]);
}

module.exports = withAdobeAnalytics;
