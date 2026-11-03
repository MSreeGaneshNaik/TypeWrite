// swift-tools-version:5.9
// Tests TypeWrite's typing engine on its own, without the app: `swift test`.
// The app itself is built from TypeWrite.xcodeproj.
import PackageDescription

let package = Package(
    name: "TypeWriteEngine",
    targets: [
        .target(
            name: "TypeWriteEngine",
            path: "TypeWrite/Engine",
            exclude: ["TypewriterModel.swift"],
            sources: ["TypeLayout.swift", "InkJitter.swift", "TypistCore.swift"]
        ),
        .testTarget(
            name: "TypeWriteEngineTests",
            dependencies: ["TypeWriteEngine"],
            path: "EngineTests"
        ),
    ]
)
