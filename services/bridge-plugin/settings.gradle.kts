// Without this, Gradle only looks for an already-installed JDK matching
// build.gradle.kts's toolchain(21) request and fails with "Toolchain
// download repositories have not been configured" if it doesn't find one
// — exactly what happened building on a host whose only JDK is the
// Minecraft-server JRE the installer itself set up (see
// installer/install.sh, which deliberately installs a JRE, not a JDK).
// This plugin lets Gradle download a matching JDK itself instead.
plugins {
    id("org.gradle.toolchains.foojay-resolver-convention") version "1.0.0"
}

rootProject.name = "mccore-bridge"
