// swift-tools-version:5.9
// Tests the app's own Swift logic on its own, without the app: `swift test`.
// The app itself is built from TypeWrite.xcodeproj; the machine is the web version in web/ (its checks are in web/tests).
import PackageDescription

let package = Package(
    name: "TypeWriteShell",
    platforms: [.macOS(.v14), .iOS(.v17)],
    targets: [
        .target(name: "TypeWriteShell", path: "TypeWrite/Model"),
        .testTarget(name: "TypeWriteShellTests", dependencies: ["TypeWriteShell"], path: "ShellTests"),
    ]
)
